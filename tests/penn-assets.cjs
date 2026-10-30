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

const repositoryRoot = path.resolve(__dirname, '..');
const phase4DenoisedDirectory = 'authoring/penn-station-1935/lighting/phase4/denoised';
const phase5VaultDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase5/denoised';
const phase6AccessDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase6/denoised';
const phase6AccessRawDirectory = 'authoring/penn-station-1935/lighting/phase6/raw';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

function denoiseEntries(zone, file, record) {
  assert.equal(record.zone, zone, `${file}: top-level zone matches its filename`);
  if (record.schemaVersion === 1) return [{ zone, report: file }];
  assert([2, 3].includes(record.schemaVersion), `${zone}: supported denoise provenance schema`);
  assert.equal(zone, 'waiting-room', 'Only the waiting-room has a split-atlas index');
  assert(Array.isArray(record.atlases), `${zone}: split index contains its child reports`);
  const expected = (record.schemaVersion === 3 ? ['waiting-room-vault', 'waiting-room-masonry', 'waiting-room-order'] : ['waiting-room-vault', 'waiting-room-masonry'])
    .map(child => ({ zone: child, report: `lighting-${child}-denoise.json` }));
  const descriptors = record.atlases.map(atlas => ({ zone: atlas.zone, report: atlas.report }));
  const byZone = (a, b) => a.zone.localeCompare(b.zone);
  assert.deepEqual(descriptors.slice().sort(byZone), expected.sort(byZone),
    'The waiting-room index references exactly one of each local atlas required by its schema');
  return descriptors;
}

function denoisePolicy(record, baseZone) {
  const zone = record.zone;
  const legacyDirectory = `authoring/penn-station-1935/lighting/phase3/${zone === 'platform' ? 'platform-corrected' : 'denoised'}`;
  const authoringDirectory = record.authoringDirectory || legacyDirectory;
  const phase5Vault = zone === 'waiting-room-vault' && authoringDirectory === phase5VaultDenoisedDirectory;
  const phase6Access = zone === 'concourse-access' && authoringDirectory === phase6AccessDenoisedDirectory;
  assert([legacyDirectory, phase4DenoisedDirectory].includes(authoringDirectory) || phase5Vault || phase6Access, `${zone}: supported local authoring directory`);
  if (zone === 'concourse-access') assert(phase6Access, `${zone}: requires its exact Phase6 source directory`);
  const fresh = authoringDirectory === phase4DenoisedDirectory || phase5Vault || phase6Access;
  if (zone !== baseZone) {
    assert.equal(baseZone, 'waiting-room', 'Only waiting-room children use atlas-specific zones');
    assert(['waiting-room-vault', 'waiting-room-masonry', 'waiting-room-order'].includes(zone));
    assert(fresh, `${zone}: split-atlas provenance must identify the new authored source directory`);
  }
  const fullDimensions = phase5Vault ? [8192] : zone === 'waiting-room-vault' ? [8192, 6144]
    : ['waiting-room-masonry', 'waiting-room-order'].includes(zone) ? [4096] : [2048];
  return { authoringDirectory, fresh, fullDimensions,
    inputTransfer: fresh || zone === 'platform' ? 'linear' : 'srgb' };
}

function checkDenoiseStatistics(record, expectedTransfer) {
  const zone = record.zone;
  assert.equal(record.schemaVersion, 1, `${zone}: individual atlas uses schema1`);
  assert.equal(record.source, `lighting-${zone}-sky.hdr`);
  assert(/^[a-f0-9]{64}$/.test(record.sourceSha256));
  assert.equal(record.inputTransfer, expectedTransfer, `${zone}: source transfer matches its actual authoring generation`);
  assert(Number.isFinite(record.radianceScale) && record.radianceScale > 0);
  for (const statistics of [record.sourceStored, record.originalLinear, record.denoisedLinear, record.retainedHdr.decodedLinear]) {
    for (const value of [statistics.mean, statistics.minimum, statistics.maximum]) assert(Number.isFinite(value), `${zone}: finite radiance statistics`);
    assert(statistics.minimum <= statistics.mean && statistics.mean <= statistics.maximum);
    assert(statistics.mean > 0 && statistics.maximum > 0, `${zone}: daylight atlas contains positive radiance, not an empty black bake`);
  }
  assert(Number.isFinite(record.relativeMeanChange));
  const control = record.constant018Test;
  assert.equal(control.before, .18);
  assert.equal(control.passed, true, `${zone}: linear0.18 transfer control passed`);
  assert(Number.isFinite(control.after) && Number.isFinite(control.maximumError));
  assert(control.maximumError >= 0 && control.maximumError <= .0002);
  assert(Math.abs(control.after - .18) <= .0002);
}

async function retainedHdr(record, directory) {
  const zone = record.zone;
  assert.equal(record.retainedHdr.file, `lighting-${zone}-sky-denoised-linear.hdr`);
  assert(/^[a-f0-9]{64}$/.test(record.retainedHdr.sha256));
  if (record.retainedHdr.archiveFile !== undefined)
    assert.equal(record.retainedHdr.archiveFile, record.retainedHdr.file + '.gz', `${zone}: expected lossless HDR archive name`);
  let archiveFile = record.retainedHdr.archiveFile || record.retainedHdr.file;
  let bytes;
  try { bytes = await fs.readFile(path.join(directory, archiveFile)); }
  catch (error) {
    if (error.code !== 'ENOENT' || record.retainedHdr.archiveFile) throw error;
    archiveFile = record.retainedHdr.file + '.gz';
    bytes = await fs.readFile(path.join(directory, archiveFile));
  }
  const decoded = archiveFile.endsWith('.gz') ? gunzipSync(bytes) : bytes;
  assert(decoded.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'), `${zone}: retained file is actual HDR radiance`);
  assert.equal(hash(decoded), record.retainedHdr.sha256, `${zone}: retained HDR bytes match the original reported SHA after decompression`);
  const resolution = decoded.subarray(0, 4096).toString('ascii').match(/\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)/);
  assert(resolution, `${zone}: retained HDR has its original resolution header`);
  return { bytes: decoded, archiveFile, archiveBytes: bytes.length, width: Number(resolution[2]), height: Number(resolution[1]) };
}

function checkBakeStatistics(bake, record, retained) {
  const zone = record.zone;
  assert.equal(bake.zone, zone, `${zone}: raw bake report uses the actual atlas zone`);
  assert(Number.isInteger(bake.resolution) && bake.resolution >= 2048, `${zone}: finite source bake resolution`);
  if (zone === 'concourse-access') assert.equal(bake.resolution, 2048, `${zone}: bounded access source bake is exactly2048`);
  assert.equal(retained.width, bake.resolution); assert.equal(retained.height, bake.resolution);
  assert(bake.resolution >= record.full.width, `${zone}: delivered derivative does not exceed retained source resolution`);
  assert(Number.isFinite(bake.atlasSurfaceArea) && bake.atlasSurfaceArea >= .01 && bake.atlasSurfaceArea <= 1.001,
    `${zone}: UV packing has non-collapsed coverage (at least1percent), without overlapping the atlas area`);
  for (const kind of ['ambientOcclusion', 'illumination']) {
    const stats = bake[kind];
    assert(stats && [stats.minimum, stats.mean, stats.maximum].every(Number.isFinite), `${zone}: finite ${kind} bake statistics`);
    assert(stats.minimum <= stats.mean && stats.mean <= stats.maximum);
    assert(stats.mean > 0 && stats.maximum > 0, `${zone}: ${kind} bake is not empty`);
    assert(Number.isInteger(stats.coveredPixels) && stats.coveredPixels > 0 && stats.coveredPixels <= bake.resolution ** 2,
      `${zone}: ${kind} bake covers actual source pixels`);
  }
}

async function verifyAccessSource({ record, bakeBytes, repositoryDirectory }) {
  assert.equal(record.zone, 'concourse-access');
  assert.equal(record.authoringDirectory, phase6AccessDenoisedDirectory, 'Access denoised source uses its exact Phase6 directory');
  assert.equal(record.inputTransfer, 'linear', 'Access HDR input remains linear');
  assert.equal(record.rawAuthoringDirectory, phase6AccessRawDirectory, 'Access raw source uses its exact Phase6 directory');
  assert.equal(record.sourceArchiveFile, 'lighting-concourse-access-sky.hdr.gz', 'Access raw HDR uses its exact lossless archive name');
  assert.equal(record.retainedHdr.archiveFile, 'lighting-concourse-access-sky-denoised-linear.hdr.gz', 'Access retained HDR uses its exact lossless archive name');
  assert(/^[a-f0-9]{64}$/.test(record.bakeReportSha256), 'Access bake report has an exact SHA256');
  assert.equal(hash(bakeBytes), record.bakeReportSha256, 'Access runtime bake report matches the reported SHA');
  const directory = path.resolve(repositoryDirectory, record.rawAuthoringDirectory);
  const rawBakeBytes = await fs.readFile(path.join(directory, 'lighting-concourse-access.json'));
  assert(rawBakeBytes.equals(bakeBytes), 'Access raw and runtime bake reports match byte-for-byte');
  const archive = await fs.readFile(path.join(directory, record.sourceArchiveFile));
  const source = gunzipSync(archive);
  assert.equal(hash(source), record.sourceSha256, 'Access raw HDR decoded bytes match sourceSha256');
  assert(source.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'), 'Access raw source is actual HDR radiance');
  const resolution = source.subarray(0, 4096).toString('ascii').match(/\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)/);
  assert(resolution && Number(resolution[1]) === 2048 && Number(resolution[2]) === 2048, 'Access raw HDR retains its2048 source resolution');
  return { authoringDirectory: record.rawAuthoringDirectory, archiveFile: record.sourceArchiveFile,
    archiveBytes: archive.length, decodedBytes: source.length, decodedSha256: hash(source), bakeReportSha256: hash(rawBakeBytes) };
}

async function verifyDenoiseDerivative({ record, variant, sourceDirectory, assetsDirectory, illumination, fullDimensions }) {
  const zone = record.zone; const derivative = record[variant];
  const suffix = variant === 'low' ? '-low' : '';
  assert.equal(derivative.png, `lighting-${zone}-sky${suffix}.png`);
  assert.equal(derivative.webp, `lighting-${zone}-sky${suffix}.webp`);
  const dimensions = variant === 'low' ? [512] : fullDimensions;
  assert(dimensions.includes(derivative.width), `${zone}/${variant}: expected delivered atlas dimension`);
  assert.equal(derivative.height, derivative.width);
  assert(Number.isInteger(derivative.clippedRGBSamples) && derivative.clippedRGBSamples >= 0);
  assert(illumination.has(derivative.webp), `${zone}: model references the delivered denoised derivative`);
  const delivered = await sharp(path.join(assetsDirectory, derivative.webp)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const source = await sharp(path.join(sourceDirectory, derivative.png)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const image of [delivered, source]) {
    assert.equal(image.info.width, derivative.width); assert.equal(image.info.height, derivative.height);
  }
  assert(delivered.data.equals(source.data), `${zone}/${variant}: delivered lossless WebP pixels match the denoised PNG`);
  return { variant, file: derivative.webp, width: derivative.width, height: derivative.height, clippedRGBSamples: derivative.clippedRGBSamples };
}

async function validateDenoising({ assetsDirectory, illumination, repositoryDirectory = repositoryRoot, requireCurrentCore = false }) {
  const atlases = []; const groups = []; const verifiedIllumination = new Set();
  const accessMaps = ['lighting-concourse-access-sky.webp', 'lighting-concourse-access-sky-low.webp'];
  const accessReferenced = accessMaps.some(file => illumination.has(file));
  if (accessReferenced) assert(accessMaps.every(file => illumination.has(file)), 'Referenced access atlas requires both full and low maps');
  for (const baseZone of ['exterior', 'waiting-room', 'concourse', 'platform', ...(accessReferenced ? ['concourse-access'] : [])]) {
    const indexFile = `lighting-${baseZone}-denoise.json`;
    const indexBytes = await fs.readFile(path.join(assetsDirectory, indexFile));
    const index = JSON.parse(indexBytes);
    if (requireCurrentCore && baseZone === 'waiting-room') assert.equal(index.schemaVersion, 3, 'Current architecture separates vault, masonry and detailed colossal order lighting');
    const entries = denoiseEntries(baseZone, indexFile, index);
    groups.push({ zone: baseZone, file: indexFile, schemaVersion: index.schemaVersion, recordSha256: hash(indexBytes), atlases: entries });
    for (const entry of entries) {
      const recordBytes = entry.report === indexFile ? indexBytes : await fs.readFile(path.join(assetsDirectory, entry.report));
      const record = JSON.parse(recordBytes);
      assert.equal(record.zone, entry.zone, `${entry.report}: atlas zone matches its descriptor`);
      const policy = denoisePolicy(record, baseZone);
      if (requireCurrentCore && baseZone !== 'platform') assert(policy.fresh, `${record.zone}: current architecture uses fresh linear source bakes`);
      checkDenoiseStatistics(record, policy.inputTransfer);
      const sourceDirectory = path.resolve(repositoryDirectory, policy.authoringDirectory);
      const retained = await retainedHdr(record, sourceDirectory);
      const bakeFile = `lighting-${record.zone}.json`;
      const bakeBytes = await fs.readFile(path.join(assetsDirectory, bakeFile));
      const bake = JSON.parse(bakeBytes);
      checkBakeStatistics(bake, record, retained);
      const rawSource = record.zone === 'concourse-access'
        ? await verifyAccessSource({ record, bakeBytes, repositoryDirectory }) : null;
      const derivatives = [];
      for (const variant of ['full', 'low']) {
        const derivative = await verifyDenoiseDerivative({ record, variant, sourceDirectory, assetsDirectory, illumination, fullDimensions: policy.fullDimensions });
        assert(!verifiedIllumination.has(derivative.file), `${derivative.file}: illumination derivative has one provenance record`);
        verifiedIllumination.add(derivative.file); derivatives.push(derivative);
      }
      atlases.push({ file: entry.report, baseZone, zone: record.zone, authoringDirectory: policy.authoringDirectory,
        recordSha256: hash(recordBytes), inputTransfer: record.inputTransfer, sourceSha256: record.sourceSha256,
        originalLinear: record.originalLinear, denoisedLinear: record.denoisedLinear, relativeMeanChange: record.relativeMeanChange,
        constant018Test: record.constant018Test, retainedHdr: record.retainedHdr, retainedArchive: retained.archiveFile,
        retainedArchiveBytes: retained.archiveBytes, retainedDecodedBytes: retained.bytes.length,
        retainedWidth: retained.width, retainedHeight: retained.height,
        bakeReport: bakeFile, bakeReportSha256: hash(bakeBytes), atlasSurfaceArea: bake.atlasSurfaceArea,
        ...(rawSource ? { rawSource } : {}), derivatives, limitations: record.limitations });
    }
  }
  assert.deepEqual([...verifiedIllumination].sort(), [...illumination].sort(),
    'Every delivered illumination map has exactly one pixel-verified atlas provenance record');
  return { atlases, groups };
}

module.exports = { denoiseEntries, denoisePolicy, checkDenoiseStatistics, checkBakeStatistics, retainedHdr, verifyDenoiseDerivative, verifyAccessSource, validateDenoising };

if (require.main === module) (async () => {
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
      if (sky === 'lighting-waiting-room-order-sky.webp') {
        const image = Buffer.from(material.getOcclusionTexture().getImage());
        assert.equal(image.subarray(0, 12).toString('hex'), 'ab4b5458203230bb0d0a1a0a', 'Order AO retains compressed KTX2 delivery');
        const expectedSize = record.file.includes('-low.') ? 512 : 4096;
        assert.equal(image.readUInt32LE(20), expectedSize, 'Detailed order AO retains its reviewed atlas width');
        assert.equal(image.readUInt32LE(24), expectedSize, 'Detailed order AO retains its reviewed atlas height');
      }
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
  const denoising = await validateDenoising({ assetsDirectory: root, illumination, requireCurrentCore: manifest.architecturalDetailRevision >= 4 });
  report.denoising = denoising.atlases; report.denoisingGroups = denoising.groups;
  await fs.writeFile(path.join(path.dirname(output), 'denoise-summary.json'), JSON.stringify({ created: report.created, records: report.denoising }, null, 2) + '\n');
  report.uniqueSharedTextures = shared.size; report.decodedGlbBytes = decoded;
  report.modelTextureAndLightingTransferBytes = transfer;
  assert.equal(transfer, metrics.modelTextureAndLightingBytes, 'Published transfer budget includes compressed models, unique textures and illumination exactly once');
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`PASS ${report.assets.length} decoded GLBs; ${shared.size} shared KTX2 textures; no glTF validation errors. Report: ${output}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
