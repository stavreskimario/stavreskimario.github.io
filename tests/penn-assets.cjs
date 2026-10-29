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
const sharp = tools('sharp');
const { gunzipSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '../penn-station-1935/assets');
const output = process.env.PENN_ASSET_REPORT || '/private/tmp/penn-phase3-asset-validation.json';

(async () => {
  await MeshoptDecoder.ready;
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'scene-manifest.json'), 'utf8'));
  const metrics = JSON.parse(await fs.readFile(path.join(root, 'asset-metrics.json'), 'utf8'));
  assert.equal(manifest.revision, 3, 'The promoted scene uses the Phase 3 architectural contract');
  assert.equal(manifest.railway.trackCount, 21, 'The opening-era railway layout has 21 tracks');
  assert.equal(manifest.railway.platformCount, 11, 'The opening-era railway layout has 11 platforms');
  assert.equal(manifest.railway.tracks.length, 21, 'All 21 track routes are delivered');
  assert.equal(manifest.railway.platforms.length, 11, 'All 11 platform polygons are delivered');
  assert.equal(manifest.platformNormalCorrection.upwardTopNormals, true, 'Promoted platform tops have upward normals');
  assert.equal(manifest.platformNormalCorrection.positionsAndUvUnchanged, true, 'Platform correction preserves registered geometry and atlas coordinates');
  assert(/^[a-f0-9]{64}$/.test(manifest.platformNormalCorrection.rawSha256));
  const expectedModels = ['exterior', 'waiting-room', 'concourse', 'context', 'platform', 'trains']
    .flatMap(zone => [`model-${zone}.glb`, `model-${zone}-low.glb`]).sort();
  assert.deepEqual(metrics.assets.map(record => record.file).sort(), expectedModels,
    'Exactly six full and six mobile model variants are delivered');
  const report = { created: new Date().toISOString(), revision: manifest.revision, railway: { tracks: manifest.railway.trackCount, platforms: manifest.railway.platformCount }, platformNormalCorrection: manifest.platformNormalCorrection, assets: [], anchors: manifest.dimensions };
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
      assert.equal(material.getExtras().lightmap_encoding, 'srgb-linear-radiance-v3', 'Light maps use the calibrated radiance encoding');
      assert(material.getExtras().sky_illumination_scale >= 1, 'HDR radiance scaling is preserved');
      assert(material.getOcclusionTexture(), `${material.getName()}: AO was exported`);
      const channel = material.getOcclusionTextureInfo().getTexCoord(); channels.add(channel);
      for (const mesh of document.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
        if (primitive.getMaterial() === material) assert(primitive.getAttribute(`TEXCOORD_${channel}`), 'Atlas channel exists after optimisation');
      }
      const hdr = record.file.includes('-low.') ? sky.replace('-sky.webp', '-sky-low.webp') : sky;
      assert((await fs.stat(path.join(root, hdr))).size > 1000, `${hdr} exists`);
      illumination.add(hdr);
    }
    if (/model-(exterior|waiting-room|concourse|platform)/.test(record.file)) assert(baked > 0, 'Architecture has actual baked lighting');
    if (record.file === 'model-waiting-room.glb') {
      assert(Math.abs(bounds.max[1] - 43.5864) < .02, 'Waiting-room ceiling uses the adopted 143ft engineering datum; the 150ft source conflict remains documented');
      assert(bounds.min[0] < -16 && bounds.max[0] > 32, 'Hall includes west threshold and upper landing');
    }
    if (record.file === 'model-concourse.glb') {
      assert(bounds.min[1] < -7.7, 'Concourse includes lower circulation/platform geometry');
      assert(bounds.max[1] > 29 && bounds.max[1] < 31, 'Concourse crown follows the engineering elevation');
    }
    transfer += transport.length; decoded += bytes.length;
    report.assets.push({ file: record.file, bytes: bytes.length, transportFile: record.transportFile || record.file, transportBytes: transport.length, errors: validation.issues.numErrors, warnings: validation.issues.numWarnings, notices: validation.issues.messages.filter(item => item.severity !== 0).map(item => ({ code: item.code, severity: item.severity, pointer: item.pointer, message: item.message })), bounds, bakedMaterials: baked, atlasChannels: [...channels], meshCount: document.getRoot().listMeshes().length, instances: document.getRoot().listNodes().filter(node => node.getExtension('EXT_mesh_gpu_instancing')).length });
  }
  for (const uri of shared) transfer += (await fs.stat(path.join(root, uri))).size;
  for (const uri of illumination) transfer += (await fs.stat(path.join(root, uri))).size;
  const probeBytes = await fs.readFile(path.join(root, 'reflection-probes.json'));
  const probes = JSON.parse(probeBytes);
  assert.equal(probes.probes.length, 3, 'All three room reflection captures are delivered');
  transfer += probeBytes.length;
  report.reflections = [];
  for (const zone of ['waiting-room', 'concourse', 'platform']) {
    const probe = probes.probes.find(item => item.zone === zone);
    assert(probe, `${zone}: local reflection capture exists`);
    for (const low of [false, true]) {
      const file = `reflection-${zone}${low ? '-low' : ''}.hdr.gz`;
      assert.equal(low ? probe.lowFile : probe.fullFile, file);
      const packed = await fs.readFile(path.join(root, file));
      const hdr = gunzipSync(packed);
      assert(hdr.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'), 'Reflection is actual HDR radiance');
      if (!low) assert.equal(createHash('sha256').update(hdr).digest('hex'), probe.decodedSha256, 'Reflection source hash is unchanged');
      transfer += packed.length;
      report.reflections.push({ file, bytes: packed.length, decodedBytes: hdr.length, worldPosition: probe.worldPosition });
    }
  }
  const exteriorReportBytes = await fs.readFile(path.join(root, 'reflection-exterior-probe.json'));
  const exteriorReport = JSON.parse(exteriorReportBytes);
  assert.equal(exteriorReport.probes.length, 1, 'The exterior provenance describes one approved capture');
  const exteriorProbe = exteriorReport.probes[0];
  assert.equal(exteriorProbe.zone, 'exterior', 'The active sky uses the exterior station capture');
  assert(Array.isArray(exteriorProbe.worldPosition) && exteriorProbe.worldPosition.length === 3
    && exteriorProbe.worldPosition.every(Number.isFinite), 'Exterior capture has a finite world position');
  assert.equal(typeof exteriorReport.limitation, 'string', 'Exterior reflection limitations are documented');
  assert(exteriorReport.limitation.trim().length > 0, 'Exterior reflection limitations are not blank');
  assert(exteriorReport.createdInputs.length > 0, 'Exterior capture records its source model hashes');
  for (const input of exteriorReport.createdInputs) {
    assert(/^[a-f0-9]{64}$/.test(input.sha256), `${input.zone}: capture source hash is recorded`);
  }
  const skyBytes = await fs.readFile(path.join(root, 'sky.hdr'));
  assert(skyBytes.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'), 'Active sky is actual HDR radiance');
  const skyHash = createHash('sha256').update(skyBytes).digest('hex');
  assert.equal(skyHash, exteriorProbe.decodedSha256, 'Active sky exactly matches the approved exterior capture');
  transfer += skyBytes.length + exteriorReportBytes.length;
  report.exteriorEnvironment = {
    file: 'sky.hdr', bytes: skyBytes.length, decodedSha256: skyHash,
    provenanceFile: 'reflection-exterior-probe.json', provenanceBytes: exteriorReportBytes.length,
    worldPosition: exteriorProbe.worldPosition, orientation: exteriorReport.probeOrientation,
    lighting: exteriorReport.lighting, limitation: exteriorReport.limitation,
    sourceModelHashes: exteriorReport.createdInputs.map(({ zone, file, sha256 }) => ({ zone, file, sha256 })),
  };
  report.validatorNoticesBySeverity = {};
  for (const asset of report.assets) for (const notice of asset.notices) {
    const severity = notice.severity === 1 ? 'warning' : 'information';
    const key = severity + ':' + notice.code;
    report.validatorNoticesBySeverity[key] = (report.validatorNoticesBySeverity[key] || 0) + 1;
  }
  const denoisedSources = path.resolve(__dirname, '../authoring/penn-station-1935/lighting/phase3/denoised');
  report.denoising = [];
  for (const zone of ['exterior', 'waiting-room', 'concourse', 'platform']) {
    const zoneSources = zone === 'platform' ? path.join(path.dirname(denoisedSources), 'platform-corrected') : denoisedSources;
    const file = `lighting-${zone}-denoise.json`;
    const recordBytes = await fs.readFile(path.join(root, file));
    const record = JSON.parse(recordBytes);
    assert.equal(record.schemaVersion, 1, `${zone}: supported denoise provenance schema`);
    assert.equal(record.zone, zone);
    assert.equal(record.source, `lighting-${zone}-sky.hdr`);
    assert(/^[a-f0-9]{64}$/.test(record.sourceSha256));
    assert.equal(record.inputTransfer, zone === 'platform' ? 'linear' : 'srgb', `${zone}: source transfer matches the recorded authoring pipeline`);
    assert(Number.isFinite(record.radianceScale) && record.radianceScale > 0);
    for (const statistics of [record.sourceStored, record.originalLinear, record.denoisedLinear, record.retainedHdr.decodedLinear]) {
      for (const value of [statistics.mean, statistics.minimum, statistics.maximum]) assert(Number.isFinite(value), `${zone}: finite radiance statistics`);
      assert(statistics.minimum <= statistics.mean && statistics.mean <= statistics.maximum);
    }
    assert(Number.isFinite(record.relativeMeanChange));
    const control = record.constant018Test;
    assert.equal(control.before, .18);
    assert.equal(control.passed, true, `${zone}: linear0.18 transfer control passed`);
    assert(Number.isFinite(control.after) && Number.isFinite(control.maximumError));
    // Match the documented authoring calibration limit, without adding a new visual threshold.
    assert(control.maximumError >= 0 && control.maximumError <= .0002);
    assert(Math.abs(control.after - .18) <= .0002);
    assert.equal(record.retainedHdr.file, `lighting-${zone}-sky-denoised-linear.hdr`);
    const retained = await fs.readFile(path.join(zoneSources, record.retainedHdr.file));
    assert(retained.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'));
    assert.equal(createHash('sha256').update(retained).digest('hex'), record.retainedHdr.sha256);
    const derivatives = [];
    for (const [variant, suffix, dimension] of [['full', '', 2048], ['low', '-low', 512]]) {
      const derivative = record[variant];
      assert.equal(derivative.png, `lighting-${zone}-sky${suffix}.png`);
      assert.equal(derivative.webp, `lighting-${zone}-sky${suffix}.webp`);
      assert.equal(derivative.width, dimension); assert.equal(derivative.height, dimension);
      assert(Number.isInteger(derivative.clippedRGBSamples) && derivative.clippedRGBSamples >= 0);
      assert(illumination.has(derivative.webp), `${zone}: model references the delivered denoised derivative`);
      const delivered = await sharp(path.join(root, derivative.webp)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const source = await sharp(path.join(zoneSources, derivative.png)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      assert.equal(delivered.info.width, dimension); assert.equal(delivered.info.height, dimension);
      assert(delivered.data.equals(source.data), `${zone}/${variant}: delivered lossless WebP pixels match the denoised PNG`);
      derivatives.push({ variant, file: derivative.webp, width: dimension, height: dimension, clippedRGBSamples: derivative.clippedRGBSamples });
    }
    report.denoising.push({ file, zone, authoringDirectory: path.relative(path.resolve(__dirname, '..'), zoneSources), recordSha256: createHash('sha256').update(recordBytes).digest('hex'), inputTransfer: record.inputTransfer,
      sourceSha256: record.sourceSha256, originalLinear: record.originalLinear, denoisedLinear: record.denoisedLinear,
      relativeMeanChange: record.relativeMeanChange, constant018Test: control, retainedHdr: record.retainedHdr, derivatives, limitations: record.limitations });
  }
  await fs.writeFile(path.join(path.dirname(output), 'denoise-summary.json'), JSON.stringify({ created: report.created, records: report.denoising }, null, 2) + '\n');
  report.uniqueSharedTextures = shared.size; report.decodedGlbBytes = decoded;
  report.modelTextureAndLightingTransferBytes = transfer;
  assert.equal(transfer, metrics.modelTextureAndLightingBytes, 'Published transfer budget includes compressed models, unique textures and illumination exactly once');
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`PASS ${report.assets.length} decoded GLBs; ${shared.size} shared KTX2 textures; no glTF validation errors. Report: ${output}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
