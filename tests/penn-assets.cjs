/* Validate the custom shared-texture GLB packaging and decoded station anchors.
 * PENN_TOOLS selects the isolated pinned authoring installation.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { readSourceArchive } = require('./source-archive.cjs');
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
const { pathToFileURL } = require('node:url');
const root = path.resolve(process.env.PENN_ASSET_DIRECTORY || path.resolve(__dirname, '../penn-station-1935/assets'));
const output = process.env.PENN_ASSET_REPORT || '/private/tmp/penn-phase3-asset-validation.json';

const repositoryRoot = path.resolve(__dirname, '..');
const phase4DenoisedDirectory = 'authoring/penn-station-1935/lighting/phase4/denoised';
const phase5VaultDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase5/denoised';
const phase6AccessDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase6/denoised';
const phase6AccessRawDirectory = 'authoring/penn-station-1935/lighting/phase6/raw';
const phase7CirculationDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase7/denoised';
const phase7CirculationRawDirectory = 'authoring/penn-station-1935/lighting/phase7/raw';
const phase8ArrivalsDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase8/denoised';
const phase8ArrivalsRawDirectory = 'authoring/penn-station-1935/lighting/phase8/raw';
const phase9PlatformDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase9-platform/denoised';
const phase9PlatformRawDirectory = 'authoring/penn-station-1935/lighting/phase9-platform/raw';
const phase9ArcadeDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase9-arcade/denoised';
const phase9ArcadeRawDirectory = 'authoring/penn-station-1935/lighting/phase9-arcade/raw';
const phase10ExitsDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase10-exits/denoised';
const phase10ExitsRawDirectory = 'authoring/penn-station-1935/lighting/phase10-exits/raw';
const phase11ExitsDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase11-exits/denoised';
const phase11ExitsRawDirectory = 'authoring/penn-station-1935/lighting/phase11-exits/raw';
const phase11GalleryDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase11-gallery/denoised';
const phase11GalleryRawDirectory = 'authoring/penn-station-1935/lighting/phase11-gallery/raw';
const phase12BridgeDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase12-bridge/denoised';
const phase12BridgeRawDirectory = 'authoring/penn-station-1935/lighting/phase12-bridge/raw';
const phase13EnclosureDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase13-enclosure/denoised';
const phase13EnclosureRawDirectory = 'authoring/penn-station-1935/lighting/phase13-enclosure/raw';
const phase13FloorDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase13-floor/denoised';
const phase13FloorRawDirectory = 'authoring/penn-station-1935/lighting/phase13-floor/raw';
const phase13SoffitDenoisedDirectory = 'authoring/penn-station-1935/lighting/phase13-soffit/denoised';
const phase13SoffitRawDirectory = 'authoring/penn-station-1935/lighting/phase13-soffit/raw';
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
  const phase7Circulation = zone === 'concourse-circulation' && authoringDirectory === phase7CirculationDenoisedDirectory;
  const phase8Arrivals = zone === 'concourse-arrivals' && authoringDirectory === phase8ArrivalsDenoisedDirectory;
  const phase9Platform = zone === 'platform-surfaces' && authoringDirectory === phase9PlatformDenoisedDirectory;
  const phase9Arcade = zone === 'arcade-enclosure' && authoringDirectory === phase9ArcadeDenoisedDirectory;
  const phase10Exits = zone === 'concourse-exits' && authoringDirectory === phase10ExitsDenoisedDirectory;
  const phase11Exits = zone === 'concourse-exits' && authoringDirectory === phase11ExitsDenoisedDirectory;
  const exits = phase10Exits || phase11Exits;
  const gallery = zone === 'concourse-gallery-finish' && authoringDirectory === phase11GalleryDenoisedDirectory;
  const bridge = zone === 'platform-bridge' && authoringDirectory === phase12BridgeDenoisedDirectory;
  const enclosure = zone === 'platform-enclosure' && authoringDirectory === phase13EnclosureDenoisedDirectory;
  const enclosureFloor = zone === 'platform-enclosure-floor' && authoringDirectory === phase13FloorDenoisedDirectory;
  const soffit = zone === 'concourse-exit-soffit' && authoringDirectory === phase13SoffitDenoisedDirectory;
  assert([legacyDirectory, phase4DenoisedDirectory].includes(authoringDirectory) || phase5Vault || phase6Access || phase7Circulation || phase8Arrivals || phase9Platform || phase9Arcade || exits || gallery || bridge || enclosure || enclosureFloor || soffit, `${zone}: supported local authoring directory`);
  if (zone === 'concourse-access') assert(phase6Access, `${zone}: requires its exact Phase6 source directory`);
  if (zone === 'concourse-circulation') assert(phase7Circulation, `${zone}: requires its exact Phase7 source directory`);
  if (zone === 'concourse-arrivals') assert(phase8Arrivals, `${zone}: requires its exact Phase8 source directory`);
  if (zone === 'platform-surfaces') assert(phase9Platform, `${zone}: requires its exact Phase9 platform source directory`);
  if (zone === 'arcade-enclosure') assert(phase9Arcade, `${zone}: requires its exact Phase9 arcade source directory`);
  if (zone === 'concourse-gallery-finish') assert(gallery, `${zone}: requires its exact Phase11 gallery source directory`);
  if (zone === 'concourse-exits') assert(exits, `${zone}: requires an exact versioned exits source directory`);
  if (zone === 'platform-bridge') assert(bridge, `${zone}: requires its exact Phase12 bridge source directory`);
  if (zone === 'platform-enclosure') assert(enclosure, `${zone}: requires its exact Phase13 enclosure source directory`);
  if (zone === 'platform-enclosure-floor') assert(enclosureFloor, `${zone}: requires its exact Phase13 floor source directory`);
  if (zone === 'concourse-exit-soffit') assert(soffit, `${zone}: requires its exact Phase13 soffit source directory`);
  const fresh = authoringDirectory === phase4DenoisedDirectory || phase5Vault || phase6Access || phase7Circulation || phase8Arrivals || phase9Platform || phase9Arcade || exits || gallery || bridge || enclosure || enclosureFloor || soffit;
  if (zone !== baseZone) {
    assert.equal(baseZone, 'waiting-room', 'Only waiting-room children use atlas-specific zones');
    assert(['waiting-room-vault', 'waiting-room-masonry', 'waiting-room-order'].includes(zone));
    assert(fresh, `${zone}: split-atlas provenance must identify the new authored source directory`);
  }
  const fullDimensions = gallery || bridge || enclosure || enclosureFloor || soffit ? [4096] : exits ? [2048, 4096] : phase8Arrivals || phase9Platform || phase9Arcade ? [4096] : phase5Vault ? [8192] : zone === 'waiting-room-vault' ? [8192, 6144]
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
  try { bytes = await readSourceArchive(path.join(directory, archiveFile), repositoryRoot); }
  catch (error) {
    if (error.code !== 'ENOENT' || record.retainedHdr.archiveFile) throw error;
    archiveFile = record.retainedHdr.file + '.gz';
    bytes = await readSourceArchive(path.join(directory, archiveFile), repositoryRoot);
  }
  const decoded = archiveFile.endsWith('.gz') ? gunzipSync(bytes) : bytes;
  assert(decoded.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'), `${zone}: retained file is actual HDR radiance`);
  assert.equal(hash(decoded), record.retainedHdr.sha256, `${zone}: retained HDR bytes match the original reported SHA after decompression`);
  const resolution = decoded.subarray(0, 4096).toString('ascii').match(/\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)/);
  assert(resolution, `${zone}: retained HDR has its original resolution header`);
  return { bytes: decoded, archiveFile, archiveBytes: bytes.length, width: Number(resolution[2]), height: Number(resolution[1]) };
}

function checkArcadeVisibility(visibility) {
  assert(visibility && /^[a-f0-9]{64}$/.test(visibility.proofSha256), 'Arcade requires source render-visibility provenance');
  const expected = new Set(['Doric column master — 35ft', 'Fluted Corinthian shaft master.001']);
  const rules = visibility.contexts?.filter(context => context.sourceVisibilityRule);
  assert.equal(rules?.length, 2, 'Exactly two proven hidden source templates');
  assert.deepEqual(new Set(rules.map(rule => rule.sourceVisibilityRule)), expected);
  for (const rule of rules) {
    if (rule.alreadyExcludedByImporter) { assert.equal(rule.changedObjects.length, 0); continue; }
    assert.equal(rule.changedObjects?.length, 1);
    const object = rule.changedObjects[0];
    assert.equal(object.name, rule.sourceVisibilityRule);
    assert.equal(object.hideRenderAfter, true); assert.equal(object.sourceHideRender, true);
    assert.equal(object.meshMaterialAndMatrixExact, true);
    assert(Number.isFinite(object.boundErrorM) && object.boundErrorM >= 0 && object.boundErrorM < .00002);
  }
}

function checkBakeStatistics(bake, record, retained) {
  const zone = record.zone;
  assert.equal(bake.zone, zone, `${zone}: raw bake report uses the actual atlas zone`);
  assert(Number.isInteger(bake.resolution) && bake.resolution >= 2048, `${zone}: finite source bake resolution`);
  if (zone === 'concourse-access') assert.equal(bake.resolution, 2048, `${zone}: bounded access source bake is exactly2048`);
  if (zone === 'concourse-circulation') assert.equal(bake.resolution, 2048, `${zone}: bounded circulation source bake is exactly2048`);
  if (zone === 'concourse-arrivals') assert.equal(bake.resolution, 4096, `${zone}: arrivals source bake is exactly4096`);
  if (zone === 'concourse-exits') {
    assert([2048, 4096].includes(bake.resolution), `${zone}: bounded exits source bake is 2K or 4K`);
    checkArcadeVisibility(bake.sourceRenderVisibility);
  }
  if (zone === 'concourse-gallery-finish') {
    assert.equal(bake.resolution, 4096, 'Gallery finish retains its 4K source bake');
    assert(bake.samples >= 128, 'Gallery finish retains reviewed transport sampling');
    assert.equal(bake.primaryAtlasScope?.opaquePrimaryMeshesBeforeJoin, 101, 'All gallery fascia, board and stems receive their atlas');
    assert.equal(bake.primaryAtlasScope?.unbakedLetteringMeshes, 2, 'Only two lettering owners are unbaked');
    assert.equal(new Set(bake.primaryAtlasScope.primaryAtlasSourceNames).size, 101, 'Complete distinct gallery source owner census');
    assert.equal(bake.authoredNormalIntegrity?.status, 'PASS', 'Gallery carries the authored face normals through atlas preparation');
    assert.equal(bake.authoredNormalIntegrity.temporaryAttributeRemoved, true);
    assert.equal(bake.authoredNormalIntegrity.finiteUnitNormals, true);
    checkArcadeVisibility(bake.sourceRenderVisibility);
  }
  if (zone === 'platform-surfaces') assert.equal(bake.resolution, 4096, `${zone}: platform-surface source bake is exactly4096`);
  if (zone === 'concourse-exit-soffit') {
    assert.equal(bake.resolution, 4096, 'Soffit retains its detailed 4K source bake');
    assert(bake.samples >= 128);
    assert.equal(bake.primaryAtlasScope?.opaquePrimaryMeshesBeforeJoin, 1);
    assert.equal(bake.primaryAtlasScope.primaryAtlasSourceNames.length, 1);
    assert.equal(bake.authoredNormalIntegrity?.status, 'PASS');
    assert.equal(bake.authoredNormalIntegrity.temporaryAttributeRemoved, true);
    assert.equal(bake.authoredNormalIntegrity.finiteUnitNormals, true);
    checkArcadeVisibility(bake.sourceRenderVisibility);
  }
  if (['platform-enclosure', 'platform-enclosure-floor'].includes(zone)) {
    const expectedOwners = zone === 'platform-enclosure-floor' ? 3 : 27;
    assert.equal(bake.resolution, 4096, 'Enclosure retains a 4K source bake');
    assert(bake.samples >= 128, 'Enclosure retains reviewed transport sampling');
    assert.equal(bake.authoredNormalIntegrity?.status, 'PASS');
    assert.equal(bake.authoredNormalIntegrity.temporaryAttributeRemoved, true);
    assert.equal(bake.authoredNormalIntegrity.finiteUnitNormals, true);
    assert.equal(bake.primaryAtlasScope?.opaquePrimaryMeshesBeforeJoin, expectedOwners, 'All selected bridge/receiver owners receive fresh lighting');
    assert.equal(new Set(bake.primaryAtlasScope.primaryAtlasSourceNames).size, expectedOwners);
    checkArcadeVisibility(bake.sourceRenderVisibility);
  }
  if (zone === 'platform-bridge') {
    assert.equal(bake.resolution, 4096, 'Bridge retains its 4K source bake');
    assert(bake.samples >= 128, 'Bridge retains reviewed transport sampling');
    assert.equal(bake.authoredNormalIntegrity?.status, 'PASS', 'Bridge preserves authored normals through atlas preparation');
    assert.equal(bake.authoredNormalIntegrity.temporaryAttributeRemoved, true);
    assert.equal(bake.authoredNormalIntegrity.finiteUnitNormals, true);
    assert.equal(bake.primaryAtlasScope?.opaquePrimaryMeshesBeforeJoin, 7, 'All seven evaluated Blender bridge owners receive their atlas');
    assert.equal(new Set(bake.primaryAtlasScope.primaryAtlasSourceNames).size, 7, 'Bridge owner census is distinct');
    checkArcadeVisibility(bake.sourceRenderVisibility);
  }
  if (zone === 'arcade-enclosure') {
    assert.equal(bake.resolution, 4096, `${zone}: arcade source bake is exactly4096`);
    const normals = bake.arcadeNormalIntegrity;
    assert.equal(normals?.status, 'PASS', 'Arcade bake requires authored corner-normal preservation');
    assert.equal(normals.temporaryAttributeRemoved, true);
    assert.equal(normals.finiteUnitNormals, true);
    assert.equal(normals.maxAllowedEncodingAngleDegrees, .5, 'Bounded Blender custom-normal re-encoding');
    assert(Number.isFinite(normals.maxEncodingAngleDegrees) && normals.maxEncodingAngleDegrees >= 0 && normals.maxEncodingAngleDegrees <= .5);
    assert(Number.isFinite(normals.minimumRestoredSourceNormalDot) && normals.minimumRestoredSourceNormalDot >= Math.cos(Math.PI / 360) - 1e-7);
    assert(Number.isInteger(normals.sourceNegativeHemisphereCorners) && normals.sourceNegativeHemisphereCorners >= 0);
    assert(Number.isInteger(normals.restoredNegativeHemisphereCorners) && normals.restoredNegativeHemisphereCorners >= 0 && normals.restoredNegativeHemisphereCorners <= normals.sourceNegativeHemisphereCorners, 'No new inward corner normals');
    checkArcadeVisibility(bake.sourceRenderVisibility);
  }
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

async function verifyCirculationSource({ record, bakeBytes, repositoryDirectory }) {
  assert.equal(record.zone, 'concourse-circulation');
  assert.equal(record.authoringDirectory, phase7CirculationDenoisedDirectory, 'Circulation denoised source uses its exact Phase7 directory');
  assert.equal(record.inputTransfer, 'linear', 'Circulation HDR input remains linear');
  assert.equal(record.rawAuthoringDirectory, phase7CirculationRawDirectory, 'Circulation raw source uses its exact Phase7 directory');
  assert.equal(record.sourceArchiveFile, 'lighting-concourse-circulation-sky.hdr.gz', 'Circulation raw HDR uses its exact lossless archive name');
  assert.equal(record.retainedHdr.archiveFile, 'lighting-concourse-circulation-sky-denoised-linear.hdr.gz', 'Circulation retained HDR uses its exact lossless archive name');
  assert(/^[a-f0-9]{64}$/.test(record.bakeReportSha256), 'Circulation bake report has an exact SHA256');
  assert.equal(hash(bakeBytes), record.bakeReportSha256, 'Circulation runtime bake report matches the reported SHA');
  const directory = path.resolve(repositoryDirectory, record.rawAuthoringDirectory);
  const rawBakeBytes = await fs.readFile(path.join(directory, 'lighting-concourse-circulation.json'));
  assert(rawBakeBytes.equals(bakeBytes), 'Circulation raw and runtime bake reports match byte-for-byte');
  const archive = await fs.readFile(path.join(directory, record.sourceArchiveFile));
  const source = gunzipSync(archive);
  assert.equal(hash(source), record.sourceSha256, 'Circulation raw HDR decoded bytes match sourceSha256');
  assert(source.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'), 'Circulation raw source is actual HDR radiance');
  const resolution = source.subarray(0, 4096).toString('ascii').match(/\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)/);
  assert(resolution && Number(resolution[1]) === 2048 && Number(resolution[2]) === 2048, 'Circulation raw HDR retains its2048 source resolution');
  return { authoringDirectory: record.rawAuthoringDirectory, archiveFile: record.sourceArchiveFile,
    archiveBytes: archive.length, decodedBytes: source.length, decodedSha256: hash(source), bakeReportSha256: hash(rawBakeBytes) };
}

async function verifyArrivalsSource({ record, bakeBytes, repositoryDirectory }) {
  assert.equal(record.zone, 'concourse-arrivals');
  assert.equal(record.authoringDirectory, phase8ArrivalsDenoisedDirectory, 'Arrivals denoised source uses its exact Phase8 directory');
  assert.equal(record.inputTransfer, 'linear', 'Arrivals HDR input remains linear');
  assert.equal(record.rawAuthoringDirectory, phase8ArrivalsRawDirectory, 'Arrivals raw source uses its exact Phase8 directory');
  assert.equal(record.sourceArchiveFile, 'lighting-concourse-arrivals-sky.hdr.gz', 'Arrivals raw HDR uses its exact lossless archive name');
  assert.equal(record.retainedHdr.archiveFile, 'lighting-concourse-arrivals-sky-denoised-linear.hdr.gz', 'Arrivals retained HDR uses its exact lossless archive name');
  assert(/^[a-f0-9]{64}$/.test(record.bakeReportSha256), 'Arrivals bake report has an exact SHA256');
  assert.equal(hash(bakeBytes), record.bakeReportSha256, 'Arrivals runtime bake report matches the reported SHA');
  const directory = path.resolve(repositoryDirectory, record.rawAuthoringDirectory);
  const rawBakeBytes = await fs.readFile(path.join(directory, 'lighting-concourse-arrivals.json'));
  assert(rawBakeBytes.equals(bakeBytes), 'Arrivals raw and runtime bake reports match byte-for-byte');
  const archive = await fs.readFile(path.join(directory, record.sourceArchiveFile));
  const source = gunzipSync(archive);
  assert.equal(hash(source), record.sourceSha256, 'Arrivals raw HDR decoded bytes match sourceSha256');
  assert(source.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'), 'Arrivals raw source is actual HDR radiance');
  const resolution = source.subarray(0, 4096).toString('ascii').match(/\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)/);
  assert(resolution && Number(resolution[1]) === 4096 && Number(resolution[2]) === 4096, 'Arrivals raw HDR retains its4096 source resolution');
  return { authoringDirectory: record.rawAuthoringDirectory, archiveFile: record.sourceArchiveFile,
    archiveBytes: archive.length, decodedBytes: source.length, decodedSha256: hash(source), bakeReportSha256: hash(rawBakeBytes) };
}

async function verifyExitsSource({ record, bakeBytes, repositoryDirectory }) {
  assert.equal(record.zone, 'concourse-exits');
  const sourceDirectories = new Map([[phase10ExitsDenoisedDirectory, phase10ExitsRawDirectory], [phase11ExitsDenoisedDirectory, phase11ExitsRawDirectory]]);
  assert(sourceDirectories.has(record.authoringDirectory), 'Exits source uses an explicitly supported versioned directory');
  assert.equal(record.inputTransfer, 'linear', 'Exits HDR input remains linear');
  assert.equal(record.rawAuthoringDirectory, sourceDirectories.get(record.authoringDirectory), 'Exits raw and denoised archives use the same exact source generation');
  assert.equal(record.sourceArchiveFile, 'lighting-concourse-exits-sky.hdr.gz', 'Exits raw HDR uses its exact lossless archive name');
  assert.equal(record.retainedHdr.archiveFile, 'lighting-concourse-exits-sky-denoised-linear.hdr.gz', 'Exits retained HDR uses its exact lossless archive name');
  assert(/^[a-f0-9]{64}$/.test(record.bakeReportSha256), 'Exits bake report has an exact SHA256');
  assert.equal(hash(bakeBytes), record.bakeReportSha256, 'Exits runtime bake report matches the reported SHA');
  const directory = path.resolve(repositoryDirectory, record.rawAuthoringDirectory);
  const rawBakeBytes = await fs.readFile(path.join(directory, 'lighting-concourse-exits.json'));
  assert(rawBakeBytes.equals(bakeBytes), 'Exits raw and runtime bake reports match byte-for-byte');
  const archive = await fs.readFile(path.join(directory, record.sourceArchiveFile));
  const source = gunzipSync(archive);
  assert.equal(hash(source), record.sourceSha256, 'Exits raw HDR decoded bytes match sourceSha256');
  assert(source.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'), 'Exits raw source is actual HDR radiance');
  const resolution = source.subarray(0, 4096).toString('ascii').match(/\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)/);
  const bake = JSON.parse(bakeBytes);
  assert(resolution && Number(resolution[1]) === bake.resolution && Number(resolution[2]) === bake.resolution && [2048, 4096].includes(bake.resolution), 'Exits raw HDR retains its declared 2K or 4K source resolution');
  return { authoringDirectory: record.rawAuthoringDirectory, archiveFile: record.sourceArchiveFile,
    archiveBytes: archive.length, decodedBytes: source.length, decodedSha256: hash(source), bakeReportSha256: hash(rawBakeBytes) };
}

async function verifyGallerySource({ record, bakeBytes, repositoryDirectory }) {
  assert.equal(record.zone, 'concourse-gallery-finish');
  assert.equal(record.authoringDirectory, phase11GalleryDenoisedDirectory, 'Gallery exact denoised source directory');
  assert.equal(record.rawAuthoringDirectory, phase11GalleryRawDirectory, 'Gallery exact raw source directory');
  assert.equal(record.inputTransfer, 'linear');
  assert.equal(record.sourceArchiveFile, 'lighting-concourse-gallery-finish-sky.hdr.gz', 'Gallery raw HDR uses its exact lossless archive name');
  assert.equal(record.retainedHdr.archiveFile, 'lighting-concourse-gallery-finish-sky-denoised-linear.hdr.gz', 'Gallery retained HDR uses its exact lossless archive name');
  assert(/^[a-f0-9]{64}$/.test(record.bakeReportSha256), 'Gallery bake report has an exact SHA256');
  assert.equal(hash(bakeBytes), record.bakeReportSha256, 'Gallery runtime bake report matches the reported SHA');
  const directory = path.resolve(repositoryDirectory, record.rawAuthoringDirectory);
  const rawBakeBytes = await fs.readFile(path.join(directory, 'lighting-concourse-gallery-finish.json'));
  assert(rawBakeBytes.equals(bakeBytes), 'Gallery raw and runtime bake reports match byte-for-byte');
  const archive = await fs.readFile(path.join(directory, record.sourceArchiveFile));
  const source = gunzipSync(archive);
  assert.equal(hash(source), record.sourceSha256, 'Gallery raw HDR decoded bytes match sourceSha256');
  assert(source.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'), 'Gallery raw source is actual HDR radiance');
  const resolution = source.subarray(0, 4096).toString('ascii').match(/\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)/);
  const bake = JSON.parse(bakeBytes);
  const editableRaw = await fs.readFile(path.join(repositoryDirectory, 'authoring/penn-station-1935/review/phase11/gallery-finish/model/finish-addon.glb'));
  assert.equal(bake.sourceSha256, hash(editableRaw), 'Gallery lighting derives from the exact retained raw addon including its sign');
  assert(resolution && Number(resolution[1]) === bake.resolution && Number(resolution[2]) === bake.resolution && [2048, 4096].includes(bake.resolution), 'Gallery raw HDR retains its declared 2K or 4K source resolution');
  return { authoringDirectory: record.rawAuthoringDirectory, archiveFile: record.sourceArchiveFile,
    archiveBytes: archive.length, decodedBytes: source.length, decodedSha256: hash(source), bakeReportSha256: hash(rawBakeBytes) };
}

async function verifyBridgeSource({ record, bakeBytes, repositoryDirectory }) {
  assert.equal(record.zone, 'platform-bridge');
  assert.equal(record.authoringDirectory, phase12BridgeDenoisedDirectory);
  assert.equal(record.rawAuthoringDirectory, phase12BridgeRawDirectory);
  assert.equal(record.inputTransfer, 'linear');
  assert.equal(record.sourceArchiveFile, 'lighting-platform-bridge-sky.hdr.gz');
  assert.equal(record.retainedHdr.archiveFile, 'lighting-platform-bridge-sky-denoised-linear.hdr.gz');
  assert.equal(hash(bakeBytes), record.bakeReportSha256, 'Bridge runtime bake report matches its recorded SHA');
  const rawBakeBytes = await fs.readFile(path.join(repositoryDirectory, phase12BridgeRawDirectory, 'lighting-platform-bridge.json'));
  assert(rawBakeBytes.equals(bakeBytes), 'Bridge raw and runtime bake reports match exactly');
  const archive = await fs.readFile(path.join(repositoryDirectory, phase12BridgeRawDirectory, record.sourceArchiveFile));
  const source = gunzipSync(archive), bake = JSON.parse(bakeBytes);
  assert.equal(hash(source), record.sourceSha256, 'Bridge raw linear HDR retains its source identity');
  assert(source.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'));
  const resolution = source.subarray(0, 4096).toString('ascii').match(/\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)/);
  assert(resolution && Number(resolution[1]) === 4096 && Number(resolution[2]) === 4096);
  const editableRaw = await fs.readFile(path.join(repositoryDirectory, 'authoring/penn-station-1935/review/phase12/eighth-avenue-bridge/model/bridge-addon.glb'));
  assert.equal(bake.sourceSha256, hash(editableRaw), 'Bridge bake derives from the retained Blender export');
  const sourceJson = JSON.parse(editableRaw.toString('utf8', 20, 20 + editableRaw.readUInt32LE(12)));
  const sourceNames = sourceJson.nodes.filter(node => node.mesh !== undefined).map(node => node.name).sort();
  assert.deepEqual(bake.primaryAtlasScope.primaryAtlasSourceNames.slice().sort(), sourceNames, 'The baked owner census matches the actual retained source nodes');
  return { authoringDirectory: record.rawAuthoringDirectory, archiveFile: record.sourceArchiveFile,
    archiveBytes: archive.length, decodedBytes: source.length, decodedSha256: hash(source), bakeReportSha256: hash(rawBakeBytes) };
}

async function verifyEnclosureSource({ record, bakeBytes, repositoryDirectory }) {
  const floor = record.zone === 'platform-enclosure-floor';
  assert(['platform-enclosure', 'platform-enclosure-floor'].includes(record.zone));
  const denoisedDirectory = floor ? phase13FloorDenoisedDirectory : phase13EnclosureDenoisedDirectory;
  const rawDirectory = floor ? phase13FloorRawDirectory : phase13EnclosureRawDirectory;
  assert.equal(record.authoringDirectory, denoisedDirectory);
  assert.equal(record.rawAuthoringDirectory, rawDirectory);
  assert.equal(record.inputTransfer, 'linear');
  assert.equal(record.sourceArchiveFile, `lighting-${record.zone}-sky.hdr.gz`);
  assert.equal(record.retainedHdr.archiveFile, `lighting-${record.zone}-sky-denoised-linear.hdr.gz`);
  assert.equal(hash(bakeBytes), record.bakeReportSha256);
  const directory = path.join(repositoryDirectory, rawDirectory);
  const rawBake = await fs.readFile(path.join(directory, `lighting-${record.zone}.json`));
  assert(rawBake.equals(bakeBytes), 'Enclosure runtime and retained source bake reports are exact');
  const archive = await readSourceArchive(path.join(directory, record.sourceArchiveFile), repositoryDirectory);
  const source = gunzipSync(archive), bake = JSON.parse(bakeBytes);
  assert.equal(hash(source), record.sourceSha256, 'Enclosure source radiance retains all original bytes');
  assert(source.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'));
  const resolution = source.subarray(0, 4096).toString('ascii').match(/\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)/);
  assert(resolution && Number(resolution[1]) === 4096 && Number(resolution[2]) === 4096);
  const raw = await fs.readFile(path.join(repositoryDirectory, 'authoring/penn-station-1935/review/phase13/four-bay-enclosure/model/enclosure-addon.glb'));
  assert.equal(hash(raw), bake.sourceSha256, 'Fresh floor/bridge lighting derives from the exact retained source');
  const json = JSON.parse(raw.toString('utf8', 20, 20 + raw.readUInt32LE(12)));
  const names = json.nodes.filter(node => node.mesh !== undefined).map(node => node.name).sort();
  assert.equal(names.length, 27);
  const expectedNames = floor ? names.filter(name => name.startsWith('Fresh true receiver ')) : names;
  assert.equal(expectedNames.length, floor ? 3 : 27);
  assert.deepEqual(bake.primaryAtlasScope.primaryAtlasSourceNames.slice().sort(), expectedNames);
  return { authoringDirectory: record.rawAuthoringDirectory, archiveFile: record.sourceArchiveFile,
    archiveBytes: archive.length, decodedBytes: source.length, decodedSha256: hash(source), bakeReportSha256: hash(rawBake) };
}

async function verifySoffitSource({ record, bakeBytes, repositoryDirectory }) {
  assert.equal(record.zone, 'concourse-exit-soffit');
  assert.equal(record.authoringDirectory, phase13SoffitDenoisedDirectory);
  assert.equal(record.rawAuthoringDirectory, phase13SoffitRawDirectory);
  assert.equal(record.sourceArchiveFile, 'lighting-concourse-exit-soffit-sky.hdr.gz');
  assert.equal(record.retainedHdr.archiveFile, 'lighting-concourse-exit-soffit-sky-denoised-linear.hdr.gz');
  assert.equal(hash(bakeBytes), record.bakeReportSha256);
  const directory = path.join(repositoryDirectory, phase13SoffitRawDirectory);
  const rawBake = await fs.readFile(path.join(directory, 'lighting-concourse-exit-soffit.json'));
  assert(rawBake.equals(bakeBytes), 'Soffit runtime and retained raw bake reports are identical');
  const archive = await readSourceArchive(path.join(directory, record.sourceArchiveFile), repositoryDirectory);
  const source = gunzipSync(archive), bake = JSON.parse(bakeBytes);
  assert.equal(hash(source), record.sourceSha256);
  const resolution = source.subarray(0, 4096).toString('ascii').match(/\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)/);
  assert(source.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'));
  assert(resolution && Number(resolution[1]) === 4096 && Number(resolution[2]) === 4096);
  const raw = await fs.readFile(path.join(repositoryDirectory, 'authoring/penn-station-1935/review/phase13/exit-soffit/model/concourse-exit-soffit-addon.glb'));
  assert.equal(hash(raw), bake.sourceSha256, 'Soffit lighting uses the actual retained Blender export');
  const json = JSON.parse(raw.toString('utf8', 20, 20 + raw.readUInt32LE(12)));
  const names = json.nodes.filter(node => node.mesh !== undefined).map(node => node.name);
  assert.deepEqual(names, ['Exact56existinglower33rdsoffitfinishreceiver']);
  assert.deepEqual(bake.primaryAtlasScope.primaryAtlasSourceNames, names);
  const faces = json.meshes.flatMap(mesh => mesh.primitives).reduce((sum, primitive) => {
    assert.equal(primitive.mode ?? 4, 4); return sum + json.accessors[primitive.indices].count / 3;
  }, 0);
  assert.equal(faces, 56, 'Shared soffit contains only the 56 existing selected faces');
  return { authoringDirectory: record.rawAuthoringDirectory, archiveFile: record.sourceArchiveFile,
    archiveBytes: archive.length, decodedBytes: source.length, decodedSha256: hash(source), bakeReportSha256: hash(rawBake), faces };
}

async function verifyPlatformSurfaceSource({ record, bakeBytes, repositoryDirectory }) {
  assert.equal(record.zone, 'platform-surfaces');
  assert.equal(record.authoringDirectory, phase9PlatformDenoisedDirectory, 'Platform surface denoised source uses its exact Phase9 platform directory');
  assert.equal(record.inputTransfer, 'linear', 'Platform surface HDR input remains linear');
  assert.equal(record.rawAuthoringDirectory, phase9PlatformRawDirectory, 'Platform surface raw source uses its exact Phase9 platform directory');
  assert.equal(record.sourceArchiveFile, 'lighting-platform-surfaces-sky.hdr.gz', 'Platform surface raw HDR uses its exact lossless archive name');
  assert.equal(record.retainedHdr.archiveFile, 'lighting-platform-surfaces-sky-denoised-linear.hdr.gz', 'Platform surface retained HDR uses its exact lossless archive name');
  assert(/^[a-f0-9]{64}$/.test(record.bakeReportSha256), 'Platform surface bake report has an exact SHA256');
  assert.equal(hash(bakeBytes), record.bakeReportSha256, 'Platform surface runtime bake report matches the reported SHA');
  const directory = path.resolve(repositoryDirectory, record.rawAuthoringDirectory);
  const rawBakeBytes = await fs.readFile(path.join(directory, 'lighting-platform-surfaces.json'));
  assert(rawBakeBytes.equals(bakeBytes), 'Platform surface raw and runtime bake reports match byte-for-byte');
  const archive = await fs.readFile(path.join(directory, record.sourceArchiveFile));
  const source = gunzipSync(archive);
  assert.equal(hash(source), record.sourceSha256, 'Platform surface raw HDR decoded bytes match sourceSha256');
  assert(source.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'), 'Platform surface raw source is actual HDR radiance');
  const resolution = source.subarray(0, 4096).toString('ascii').match(/\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)/);
  assert(resolution && Number(resolution[1]) === 4096 && Number(resolution[2]) === 4096, 'Platform surface raw HDR retains its4096 source resolution');
  return { authoringDirectory: record.rawAuthoringDirectory, archiveFile: record.sourceArchiveFile,
    archiveBytes: archive.length, decodedBytes: source.length, decodedSha256: hash(source), bakeReportSha256: hash(rawBakeBytes) };
}

async function verifyArcadeSource({ record, bakeBytes, repositoryDirectory }) {
  assert.equal(record.zone, 'arcade-enclosure');
  assert.equal(record.authoringDirectory, phase9ArcadeDenoisedDirectory, 'Arcade denoised source uses its exact Phase9 arcade directory');
  assert.equal(record.inputTransfer, 'linear', 'Arcade HDR input remains linear');
  assert.equal(record.rawAuthoringDirectory, phase9ArcadeRawDirectory, 'Arcade raw source uses its exact Phase9 arcade directory');
  assert.equal(record.sourceArchiveFile, 'lighting-arcade-enclosure-sky.hdr.gz', 'Arcade raw HDR uses its exact lossless archive name');
  assert.equal(record.retainedHdr.archiveFile, 'lighting-arcade-enclosure-sky-denoised-linear.hdr.gz', 'Arcade retained HDR uses its exact lossless archive name');
  assert(/^[a-f0-9]{64}$/.test(record.bakeReportSha256), 'Arcade bake report has an exact SHA256');
  assert.equal(hash(bakeBytes), record.bakeReportSha256, 'Arcade runtime bake report matches the reported SHA');
  const directory = path.resolve(repositoryDirectory, record.rawAuthoringDirectory);
  const rawBakeBytes = await fs.readFile(path.join(directory, 'lighting-arcade-enclosure.json'));
  assert(rawBakeBytes.equals(bakeBytes), 'Arcade raw and runtime bake reports match byte-for-byte');
  const archive = await fs.readFile(path.join(directory, record.sourceArchiveFile));
  const source = gunzipSync(archive);
  assert.equal(hash(source), record.sourceSha256, 'Arcade raw HDR decoded bytes match sourceSha256');
  assert(source.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'), 'Arcade raw source is actual HDR radiance');
  const resolution = source.subarray(0, 4096).toString('ascii').match(/\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)/);
  assert(resolution && Number(resolution[1]) === 4096 && Number(resolution[2]) === 4096, 'Arcade raw HDR retains its4096 source resolution');
  return { authoringDirectory: record.rawAuthoringDirectory, archiveFile: record.sourceArchiveFile,
    archiveBytes: archive.length, decodedBytes: source.length, decodedSha256: hash(source), bakeReportSha256: hash(rawBakeBytes) };
}

async function verifyDenoiseDerivative({ record, variant, sourceDirectory, assetsDirectory, illumination, fullDimensions, expectedRGB }) {
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
  if (record.deliveryTransform) {
    assert.equal(zone, 'platform-enclosure-floor', 'Only the reviewed floor has a delivery transform');
    assert(Buffer.isBuffer(expectedRGB), 'Transformed delivery requires an independent every-pixel replay');
  } else assert.equal(expectedRGB, undefined, 'Ordinary denoise derivatives retain their original PNG comparison');
  const source = expectedRGB ? { data: expectedRGB, info: { width: derivative.width, height: derivative.height } }
    : await sharp(path.join(sourceDirectory, derivative.png)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  for (const image of [delivered, source]) {
    assert.equal(image.info.width, derivative.width); assert.equal(image.info.height, derivative.height);
  }
  assert(delivered.data.equals(source.data), `${zone}/${variant}: delivered lossless WebP pixels match ${expectedRGB ? 'the independently replayed radiance transition' : 'the denoised PNG'}`);
  return { variant, file: derivative.webp, width: derivative.width, height: derivative.height, clippedRGBSamples: derivative.clippedRGBSamples };
}

async function validateDenoising({ assetsDirectory, illumination, repositoryDirectory = repositoryRoot, requireCurrentCore = false, mountedPlatformDocument }) {
  const atlases = []; const groups = []; const verifiedIllumination = new Set();
  const accessMaps = ['lighting-concourse-access-sky.webp', 'lighting-concourse-access-sky-low.webp'];
  const accessReferenced = accessMaps.some(file => illumination.has(file));
  if (accessReferenced) assert(accessMaps.every(file => illumination.has(file)), 'Referenced access atlas requires both full and low maps');
  const circulationMaps = ['lighting-concourse-circulation-sky.webp', 'lighting-concourse-circulation-sky-low.webp'];
  const circulationReferenced = circulationMaps.some(file => illumination.has(file));
  if (circulationReferenced) assert(circulationMaps.every(file => illumination.has(file)), 'Referenced circulation atlas requires both full and low maps');
  const arrivalsMaps = ['lighting-concourse-arrivals-sky.webp', 'lighting-concourse-arrivals-sky-low.webp'];
  const arrivalsReferenced = arrivalsMaps.some(file => illumination.has(file));
  if (arrivalsReferenced) assert(arrivalsMaps.every(file => illumination.has(file)), 'Referenced arrivals atlas requires both full and low maps');
  const exitsMaps = ['lighting-concourse-exits-sky.webp', 'lighting-concourse-exits-sky-low.webp'];
  const exitsReferenced = exitsMaps.some(file => illumination.has(file));
  if (exitsReferenced) assert(exitsMaps.every(file => illumination.has(file)), 'Referenced exits atlas requires both full and low maps');
  const galleryMaps = ['lighting-concourse-gallery-finish-sky.webp', 'lighting-concourse-gallery-finish-sky-low.webp'];
  const galleryReferenced = galleryMaps.some(file => illumination.has(file));
  if (galleryReferenced) assert(galleryMaps.every(file => illumination.has(file)), 'Gallery atlas requires both variants');
  const platformSurfaceMaps = ['lighting-platform-surfaces-sky.webp', 'lighting-platform-surfaces-sky-low.webp'];
  const platformSurfacesReferenced = platformSurfaceMaps.some(file => illumination.has(file));
  if (platformSurfacesReferenced) assert(platformSurfaceMaps.every(file => illumination.has(file)), 'Referenced platform-surface atlas requires both full and low maps');
  const bridgeMaps = ['lighting-platform-bridge-sky.webp', 'lighting-platform-bridge-sky-low.webp'];
  const bridgeReferenced = bridgeMaps.some(file => illumination.has(file));
  if (bridgeReferenced) assert(bridgeMaps.every(file => illumination.has(file)), 'Bridge atlas requires both full and low maps');
  const enclosureMaps = ['lighting-platform-enclosure-sky.webp', 'lighting-platform-enclosure-sky-low.webp'];
  const enclosureReferenced = enclosureMaps.some(file => illumination.has(file));
  if (enclosureReferenced) assert(enclosureMaps.every(file => illumination.has(file)), 'Enclosure requires both full and low maps');
  const enclosureFloorMaps = ['lighting-platform-enclosure-floor-sky.webp', 'lighting-platform-enclosure-floor-sky-low.webp'];
  const enclosureFloorReferenced = enclosureFloorMaps.some(file => illumination.has(file));
  if (enclosureFloorReferenced) assert(enclosureFloorMaps.every(file => illumination.has(file)), 'Enclosure floor requires both variants');
  assert.equal(enclosureFloorReferenced, enclosureReferenced, 'The four-bay enclosure requires its independent detailed floor atlas');
  const soffitMaps = ['lighting-concourse-exit-soffit-sky.webp', 'lighting-concourse-exit-soffit-sky-low.webp'];
  const soffitReferenced = soffitMaps.some(file => illumination.has(file));
  if (soffitReferenced) assert(soffitMaps.every(file => illumination.has(file)), 'Shared exit soffit requires both variants');
  const arcadeMaps = ['lighting-arcade-enclosure-sky.webp', 'lighting-arcade-enclosure-sky-low.webp'];
  const arcadeReferenced = arcadeMaps.some(file => illumination.has(file));
  if (arcadeReferenced) assert(arcadeMaps.every(file => illumination.has(file)), 'Referenced arcade atlas requires both full and low maps');
  for (const baseZone of ['exterior', 'waiting-room', 'concourse', 'platform', ...(accessReferenced ? ['concourse-access'] : []), ...(circulationReferenced ? ['concourse-circulation'] : []), ...(arrivalsReferenced ? ['concourse-arrivals'] : []), ...(exitsReferenced ? ['concourse-exits'] : []), ...(galleryReferenced ? ['concourse-gallery-finish'] : []), ...(platformSurfacesReferenced ? ['platform-surfaces'] : []), ...(bridgeReferenced ? ['platform-bridge'] : []), ...(enclosureReferenced ? ['platform-enclosure'] : []), ...(enclosureFloorReferenced ? ['platform-enclosure-floor'] : []), ...(soffitReferenced ? ['concourse-exit-soffit'] : []), ...(arcadeReferenced ? ['arcade-enclosure'] : [])]) {
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
        ? await verifyAccessSource({ record, bakeBytes, repositoryDirectory }) : record.zone === 'concourse-circulation'
          ? await verifyCirculationSource({ record, bakeBytes, repositoryDirectory }) : record.zone === 'concourse-arrivals'
            ? await verifyArrivalsSource({ record, bakeBytes, repositoryDirectory }) : record.zone === 'concourse-exits'
              ? await verifyExitsSource({ record, bakeBytes, repositoryDirectory }) : record.zone === 'concourse-gallery-finish'
              ? await verifyGallerySource({ record, bakeBytes, repositoryDirectory }) : record.zone === 'platform-bridge'
              ? await verifyBridgeSource({ record, bakeBytes, repositoryDirectory }) : record.zone === 'concourse-exit-soffit'
              ? await verifySoffitSource({ record, bakeBytes, repositoryDirectory }) : ['platform-enclosure', 'platform-enclosure-floor'].includes(record.zone)
              ? await verifyEnclosureSource({ record, bakeBytes, repositoryDirectory }) : record.zone === 'platform-surfaces'
              ? await verifyPlatformSurfaceSource({ record, bakeBytes, repositoryDirectory }) : record.zone === 'arcade-enclosure'
                ? await verifyArcadeSource({ record, bakeBytes, repositoryDirectory }) : null;
      const derivatives = [];
      let deliveryProof;
      if (record.deliveryTransform) {
        assert.equal(record.zone, 'platform-enclosure-floor');
        assert(mountedPlatformDocument, 'Delivery replay must check the actual mounted platform geometry');
        for (const [fileKey, hashKey, filename] of [
          ['helperFile', 'helperSha256', 'replay-floor-gi-transition.cjs'],
          ['derivationFile', 'derivationSha256', 'floor-gi-transition-derivation.json'],
        ]) {
          const relative = `authoring/penn-station-1935/lighting/phase13-floor/transition/${filename}`;
          assert.equal(record.deliveryTransform[fileKey], relative);
          assert.equal(hash(await fs.readFile(path.join(repositoryDirectory, relative))), record.deliveryTransform[hashKey]);
        }
        deliveryProof = await require('./penn-floor-delivery/repository-floor-delivery-adapter.cjs').verifyRepositoryFloorDelivery({
          record, repositoryDirectory, assetsDirectory, sharp, THREE: tools('three'), mountedDocument: mountedPlatformDocument,
        });
      }
      for (const variant of ['full', 'low']) {
        const derivative = await verifyDenoiseDerivative({ record, variant, sourceDirectory, assetsDirectory, illumination, fullDimensions: policy.fullDimensions, expectedRGB: deliveryProof?.expectedRGB[variant] });
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
        ...(rawSource ? { rawSource } : {}), ...(deliveryProof ? { deliveryTransform: deliveryProof.report } : {}), derivatives, limitations: record.limitations });
    }
  }
  assert.deepEqual([...verifiedIllumination].sort(), [...illumination].sort(),
    'Every delivered illumination map has exactly one pixel-verified atlas provenance record');
  return { atlases, groups };
}

module.exports = { denoiseEntries, denoisePolicy, checkDenoiseStatistics, checkBakeStatistics, checkArcadeVisibility, retainedHdr, verifyDenoiseDerivative, verifyAccessSource, verifyCirculationSource, verifyArrivalsSource, verifyExitsSource, verifyPlatformSurfaceSource, verifyArcadeSource, validateDenoising };

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
  const report = { created: new Date().toISOString(), assetsDirectory: root, revision: manifest.revision, railway: { tracks: manifest.railway.trackCount, platforms: manifest.railway.platformCount }, platformNormalCorrection: manifest.platformNormalCorrection, assets: [], anchors: manifest.dimensions };
  const shared = new Set(); const illumination = new Set(); let transfer = 0; let decoded = 0; let mountedPlatformDocument;
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
    if (record.file === 'model-platform.glb') mountedPlatformDocument = document;
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
  if (illumination.has('lighting-arcade-enclosure-sky.webp')) {
    const bytes = await fs.readFile(path.join(root, 'reflection-arcade-probe.json'));
    const capture = JSON.parse(bytes); assert.equal(capture.probes?.length, 1, 'Isolated arcade capture has one current-source probe');
    checkArcadeVisibility(capture.sourceRenderVisibility);
    const arcadeBake = JSON.parse(await fs.readFile(path.join(root, 'lighting-arcade-enclosure.json')));
    assert.equal(capture.sourceRenderVisibility.proofSha256, arcadeBake.sourceRenderVisibility.proofSha256, 'Arcade lighting and reflections share exact source-visibility rules');
    assert(capture.createdInputs?.some(input => input.zone === 'arcade'), 'Arcade probe includes its actual new geometry');
    const probe = capture.probes[0]; assert.equal(probe.zone, 'arcade');
    assert(probe.worldPosition?.length === 3 && probe.worldPosition.every(Number.isFinite), 'Arcade probe has a finite world pose');
    transfer += bytes.length;
    for (const low of [false, true]) {
      const file = `reflection-arcade${low ? '-low' : ''}.hdr.gz`; assert.equal(low ? probe.lowFile : probe.fullFile, file);
      const packed = await fs.readFile(path.join(root, file)), hdr = gunzipSync(packed);
      assert(hdr.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE'), 'Arcade reflection is actual HDR radiance');
      if (!low) assert.equal(hash(hdr), probe.decodedSha256, 'Arcade reflection source identity');
      transfer += packed.length; report.reflections.push({ file, bytes: packed.length, decodedBytes: hdr.length, worldPosition: probe.worldPosition });
    }
    report.arcadeReflection = capture;
  }
  if (illumination.has('lighting-platform-enclosure-sky.webp')) {
    const bytes = await fs.readFile(path.join(root, 'reflection-platform-enclosure-probe.json'));
    const capture = JSON.parse(bytes), bake = JSON.parse(await fs.readFile(path.join(root, 'lighting-platform-enclosure.json')));
    assert.equal(capture.zone, 'platform-enclosure'); assert.equal(capture.probes?.length, 1);
    assert.equal(capture.finiteLinearRadiance, true); assert.equal(capture.negativeSamplesClamped, 0);
    assert.equal(capture.sourcePrimarySha256, bake.sourceSha256, 'Reflection uses the same physical geometry/PBR input as the enclosure');
    checkArcadeVisibility(capture.sourceRenderVisibility);
    assert.equal(capture.sourceRenderVisibility.proofSha256, bake.sourceRenderVisibility.proofSha256);
    assert.equal(capture.contextMembership?.status, 'PASS');
    assert.equal(capture.glassRestoration?.length, 14, 'Restore every known physical glass shader before reflection capture');
    assert.equal(new Set(capture.glassRestoration.map(item => item.material)).size, 14);
    for (const item of capture.glassRestoration) assert(item.restoredPrincipled && Number.isFinite(item.transmission) && Number.isFinite(item.roughness));
    assert(capture.createdInputs.some(input => input.sha256 === bake.sourceSha256 && input.objects === 27));
    assert.equal(capture.width, 2048); assert(capture.samples >= 64);
    const masterPath = 'authoring/penn-station-1935/lighting/phase13-enclosure/reflections/reflection-platform-enclosure-linear.exr.gz';
    const master = gunzipSync(await readSourceArchive(path.join(repositoryRoot, masterPath), repositoryRoot));
    assert.equal(master.readUInt32LE(0), 20000630, 'Reflection master is actual OpenEXR');
    assert.equal(hash(master), capture.rawLinearExrSha256, 'Complete floating-point reflection master is retained');
    const probe = capture.probes[0];
    assert.equal(probe.zone, 'platform-enclosure'); assert(probe.worldPosition?.length === 3 && probe.worldPosition.every(Number.isFinite));
    assert(capture.limitation?.trim());
    const { HDRLoader } = await import(pathToFileURL(tools.resolve('three/examples/jsm/loaders/HDRLoader.js')).href);
    transfer += bytes.length;
    for (const low of [false, true]) {
      const file = `reflection-platform-enclosure${low ? '-low' : ''}.hdr.gz`;
      assert.equal(low ? probe.lowFile : probe.fullFile, file);
      const packed = await fs.readFile(path.join(root, file)), hdr = gunzipSync(packed);
      const outputRecord = capture.outputs.find(item => item.file === file); assert(outputRecord);
      assert.equal(hash(hdr), outputRecord.decodedSha256);
      if (!low) assert.equal(hash(hdr), probe.decodedSha256);
      assert(outputRecord.roundtripRelativeMeanError >= 0 && outputRecord.roundtripRelativeMeanError < .01);
      const image = new HDRLoader().setDataType(tools('three').FloatType).parse(hdr.buffer.slice(hdr.byteOffset, hdr.byteOffset + hdr.byteLength));
      assert.equal(image.width, low ? 512 : 2048); assert.equal(image.height, low ? 256 : 1024);
      let sum = 0, minimum = Infinity, maximum = -Infinity, samples = 0;
      for (let i = 0; i < image.data.length; i += 4) for (let k = 0; k < 3; k++) {
        const value = image.data[i + k]; assert(Number.isFinite(value) && value >= 0);
        sum += value; minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); samples++;
      }
      // r180's runtime RGBE decoder scales mantissas by1/255; Blender's
      // source decoder uses1/256. Check that precise documented conversion.
      const scale = 256 / 255;
      for (const [actual, expected] of [[sum / samples, outputRecord.linearStats.mean], [minimum, outputRecord.linearStats.minimum], [maximum, outputRecord.linearStats.maximum]]) {
        assert(Math.abs(actual - expected * scale) <= Math.max(1e-7, Math.abs(expected * scale) * 1e-6));
      }
      transfer += packed.length;
      report.reflections.push({ file, bytes: packed.length, decodedBytes: hdr.length, worldPosition: probe.worldPosition, runtimeLinearStats: { mean: sum / samples, minimum, maximum }, runtimeToOfflineMantissaScale: scale });
    }
    report.enclosureReflection = capture;
  }
  const denoising = await validateDenoising({ assetsDirectory: root, illumination, requireCurrentCore: manifest.architecturalDetailRevision >= 4, mountedPlatformDocument });
  report.denoising = denoising.atlases; report.denoisingGroups = denoising.groups;
  await fs.writeFile(path.join(path.dirname(output), 'denoise-summary.json'), JSON.stringify({ created: report.created, records: report.denoising }, null, 2) + '\n');
  report.uniqueSharedTextures = shared.size; report.decodedGlbBytes = decoded;
  report.modelTextureAndLightingTransferBytes = transfer;
  assert.equal(transfer, metrics.modelTextureAndLightingBytes, 'Published transfer budget includes compressed models, unique textures and illumination exactly once');
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`PASS ${report.assets.length} decoded GLBs; ${shared.size} shared KTX2 textures; no glTF validation errors. Report: ${output}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
