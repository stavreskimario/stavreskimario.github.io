/* Validate the custom shared-texture GLB packaging and decoded station anchors.
 * PENN_TOOLS selects the isolated pinned authoring installation.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const tools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
const { NodeIO } = tools('@gltf-transform/core');
const { ALL_EXTENSIONS } = tools('@gltf-transform/extensions');
const { getBounds } = tools('@gltf-transform/functions');
const { MeshoptDecoder } = tools('meshoptimizer');
const validator = tools('gltf-validator');
const { gunzipSync } = require('node:zlib');
const root = path.resolve(__dirname, '../penn-station-1935/assets');
const output = process.env.PENN_ASSET_REPORT || '/private/tmp/penn-phase2-asset-validation.json';

(async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'scene-manifest.json'), 'utf8'));
  const metrics = JSON.parse(await fs.readFile(path.join(root, 'asset-metrics.json'), 'utf8'));
  const report = { created: new Date().toISOString(), assets: [], anchors: manifest.dimensions };
  const shared = new Set(); const illumination = new Set(); let transfer = 0; let decoded = 0;
  for (const record of metrics.assets) {
    const filename = path.join(root, record.transportFile || record.file);
    const transport = await fs.readFile(filename);
    const bytes = record.transportFile ? gunzipSync(transport) : transport;
    const gltf = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
    assert(gltf.extensionsUsed.includes('EXT_meshopt_compression'), `${record.file}: Meshopt is present`);
    assert(gltf.extensionsUsed.includes('KHR_texture_basisu'), `${record.file}: KTX2 is present`);
    for (const image of gltf.images || []) {
      assert(/^textures\/[a-f0-9]{20}\.ktx2$/.test(image.uri), 'Images use local content-addressed compressed files');
      assert((await fs.stat(path.join(root, image.uri))).size > 0);
      shared.add(image.uri);
    }
    const validation = await validator.validateBytes(new Uint8Array(bytes), {
      uri: record.file,
      externalResourceFunction: async uri => new Uint8Array(await fs.readFile(path.join(root, uri))),
    });
    assert.equal(validation.issues.numErrors, 0, `${record.file}: ${JSON.stringify(validation.issues.messages.filter(item => item.severity === 0))}`);
    const binaryOffset = 20 + bytes.readUInt32LE(12);
    const binaryDocument = { json: gltf, resources: { '@glb.bin': new Uint8Array(bytes.subarray(binaryOffset + 8, binaryOffset + 8 + bytes.readUInt32LE(binaryOffset))) } };
    for (const image of gltf.images || []) if (image.uri) binaryDocument.resources[image.uri] = new Uint8Array(await fs.readFile(path.join(root, image.uri)));
    const document = await io.readJSON(binaryDocument);
    const scene = document.getRoot().listScenes()[0];
    const bounds = getBounds(scene);
    const materials = document.getRoot().listMaterials();
    let baked = 0; const channels = new Set();
    for (const material of materials) {
      const sky = material.getExtras().sky_illumination;
      if (!sky) continue;
      baked++;
      assert(material.getOcclusionTexture(), `${material.getName()}: AO was exported`);
      const channel = material.getOcclusionTextureInfo().getTexCoord(); channels.add(channel);
      for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
        if (primitive.getMaterial() === material) assert(primitive.getAttribute(`TEXCOORD_${channel}`), 'Atlas channel exists after optimisation');
      }
      const hdr = record.file.includes('-low.') ? sky.replace('-sky.webp', '-sky-low.webp') : sky;
      assert((await fs.stat(path.join(root, hdr))).size > 1000, `${hdr} exists`);
      illumination.add(hdr);
    }
    if (/model-(exterior|waiting-room|concourse)/.test(record.file)) assert(baked > 0, 'Architecture has actual baked lighting');
    if (record.file === 'model-waiting-room.glb') {
      assert(Math.abs(bounds.max[1] - 45.72) < .01, 'Waiting-room vault remains 150ft above its local main floor');
      assert(bounds.min[0] < -16 && bounds.max[0] > 32, 'Hall includes west threshold and upper landing');
    }
    if (record.file === 'model-concourse.glb') {
      assert(bounds.min[1] < -7.7, 'Concourse includes lower circulation/platform geometry');
      assert(bounds.max[1] > 29 && bounds.max[1] < 31, 'Concourse crown follows the engineering elevation');
    }
    transfer += transport.length; decoded += bytes.length;
    report.assets.push({ file: record.file, bytes: bytes.length, transportFile: record.transportFile || record.file, transportBytes: transport.length, errors: validation.issues.numErrors, warnings: validation.issues.numWarnings, notices: validation.issues.messages.filter(item => item.severity !== 0).map(item => ({ code: item.code, message: item.message })), bounds, bakedMaterials: baked, atlasChannels: [...channels], meshCount: document.getRoot().listMeshes().length, instances: document.getRoot().listNodes().filter(node => node.getExtension('EXT_mesh_gpu_instancing')).length });
  }
  for (const uri of shared) transfer += (await fs.stat(path.join(root, uri))).size;
  for (const uri of illumination) transfer += (await fs.stat(path.join(root, uri))).size;
  report.uniqueSharedTextures = shared.size; report.decodedGlbBytes = decoded;
  report.modelTextureAndLightingTransferBytes = transfer;
  assert.equal(transfer, metrics.modelTextureAndLightingBytes, 'Published transfer budget includes compressed models, unique textures and illumination exactly once');
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`PASS ${report.assets.length} decoded GLBs; ${shared.size} shared KTX2 textures; no glTF validation errors. Report: ${output}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
