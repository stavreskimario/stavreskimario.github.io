/* Focused provenance-validator controls. These do not run final model/browser
 * acceptance. The real delivered Phase3 records exercise backward compatibility;
 * isolated fixtures exercise schema2, HDR archives and rejection paths.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { gzipSync } = require('node:zlib');
const { createRequire } = require('node:module');
const tools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
const sharp = tools('sharp');
const { denoiseEntries, denoisePolicy, checkDenoiseStatistics, checkBakeStatistics,
  retainedHdr, verifyDenoiseDerivative, validateDenoising } = require('./penn-assets.cjs');
const repo = path.resolve(__dirname, '..');
const assets = path.join(repo, 'penn-station-1935/assets');
const output = process.env.PENN_DENOISE_PROOF_REPORT;

(async () => {
  const report = { created: new Date().toISOString(), scope: 'Focused validator controls; not final model/browser acceptance', checks: [] };
  const waiting = JSON.parse(await fs.readFile(path.join(assets, 'lighting-waiting-room-denoise.json')));
  assert.equal(waiting.schemaVersion, 1, 'Run compatibility controls against the retained checkpoint, before final promotion');
  const illumination = new Set();
  for (const zone of ['exterior', 'waiting-room', 'concourse', 'platform']) {
    const record = JSON.parse(await fs.readFile(path.join(assets, `lighting-${zone}-denoise.json`)));
    illumination.add(record.full.webp); illumination.add(record.low.webp);
  }
  const legacy = await validateDenoising({ assetsDirectory: assets, illumination });
  assert.equal(legacy.atlases.length, 4);
  report.checks.push('All four actual checkpoint records retain full HDR hashes,0.18 controls,raw-bake coverage and full/mobile PNG-WebP pixel identity');

  const index = { schemaVersion: 2, zone: 'waiting-room', atlases: [
    { zone: 'waiting-room-vault', report: 'lighting-waiting-room-vault-denoise.json' },
    { zone: 'waiting-room-masonry', report: 'lighting-waiting-room-masonry-denoise.json' },
  ] };
  assert.equal(denoiseEntries('waiting-room', 'lighting-waiting-room-denoise.json', index).length, 2);
  for (const mutation of [
    value => { value.atlases.pop(); },
    value => { value.atlases[1] = value.atlases[0]; },
    value => { value.atlases[0].report = '../other.json'; },
    value => { value.atlases[0].zone = 'waiting-room'; },
  ]) {
    const wrong = structuredClone(index); mutation(wrong);
    assert.throws(() => denoiseEntries('waiting-room', 'lighting-waiting-room-denoise.json', wrong));
  }
  const freshDirectory = 'authoring/penn-station-1935/lighting/phase4/denoised';
  assert.deepEqual(denoisePolicy({ zone: 'waiting-room-vault', authoringDirectory: freshDirectory }, 'waiting-room').fullDimensions, [8192, 6144]);
  assert.deepEqual(denoisePolicy({ zone: 'waiting-room-masonry', authoringDirectory: freshDirectory }, 'waiting-room').fullDimensions, [4096]);
  assert.equal(denoisePolicy({ zone: 'exterior', authoringDirectory: freshDirectory }, 'exterior').inputTransfer, 'linear');
  assert.throws(() => denoisePolicy({ zone: 'waiting-room-vault' }, 'waiting-room'));
  assert.throws(() => denoisePolicy({ zone: 'exterior', authoringDirectory: '../outside' }, 'exterior'));
  report.checks.push('Schema2 resolves exactly the two local atlas children; missing/duplicate/wrong-zone/traversal references and ambiguous source directories are rejected');

  const carvedOrder = structuredClone(index);
  carvedOrder.schemaVersion = 3;
  carvedOrder.atlases.push({ zone: 'waiting-room-order', report: 'lighting-waiting-room-order-denoise.json' });
  assert.equal(denoiseEntries('waiting-room', 'lighting-waiting-room-denoise.json', carvedOrder).length, 3);
  const missingOrder = structuredClone(carvedOrder); missingOrder.atlases.pop();
  assert.throws(() => denoiseEntries('waiting-room', 'lighting-waiting-room-denoise.json', missingOrder));
  const wrongOrder = structuredClone(carvedOrder); wrongOrder.atlases[2].report = '../order.json';
  assert.throws(() => denoiseEntries('waiting-room', 'lighting-waiting-room-denoise.json', wrongOrder));
  assert.deepEqual(denoisePolicy({ zone: 'waiting-room-order', authoringDirectory: freshDirectory }, 'waiting-room').fullDimensions, [4096]);
  report.checks.push('Schema3 requires the dedicated local order atlas, rejecting missing-order and traversal substitutions');

  for (const mutation of [
    value => { value.constant018Test.after = .19; },
    value => { value.constant018Test.maximumError = .001; },
    value => { value.denoisedLinear = { mean: 0, minimum: 0, maximum: 0 }; },
    value => { value.inputTransfer = 'linear'; },
  ]) {
    const wrong = structuredClone(waiting); mutation(wrong);
    assert.throws(() => checkDenoiseStatistics(wrong, 'srgb'));
  }
  const bake = JSON.parse(await fs.readFile(path.join(assets, 'lighting-waiting-room.json')));
  for (const mutation of [
    value => { value.atlasSurfaceArea = 4.2871713124004174e-11; },
    value => { value.illumination = {}; },
    value => { value.ambientOcclusion.mean = value.ambientOcclusion.maximum = 0; },
  ]) {
    const wrong = structuredClone(bake); mutation(wrong);
    assert.throws(() => checkBakeStatistics(wrong, waiting, { width: 2048, height: 2048 }));
  }
  report.checks.push('Failed0.18 controls,incorrect source transfer,empty radiance/AO and the observed collapsed UV-atlas failure are rejected');

  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'penn-denoise-validator-'));
  try {
    const sourceDirectory = path.join(repo, 'authoring/penn-station-1935/lighting/phase3/denoised');
    const original = (await retainedHdr(waiting, sourceDirectory)).bytes;
    const archive = waiting.retainedHdr.file + '.gz';
    await fs.writeFile(path.join(scratch, archive), gzipSync(original));
    assert((await retainedHdr(waiting, scratch)).bytes.equals(original), 'Implicit archive fallback decompresses original bytes');
    const explicit = structuredClone(waiting); explicit.retainedHdr.archiveFile = archive;
    assert((await retainedHdr(explicit, scratch)).bytes.equals(original));
    explicit.retainedHdr.sha256 = '0'.repeat(64);
    await assert.rejects(() => retainedHdr(explicit, scratch));
    report.checks.push('Explicit and implicit .hdr.gz archival preserves original HDR bytes; a wrong decoded SHA is rejected');

    await fs.copyFile(path.join(assets, waiting.full.webp), path.join(scratch, waiting.full.webp));
    await sharp({ create: { width: 2048, height: 2048, channels: 3, background: '#808080' } }).png().toFile(path.join(scratch, waiting.full.png));
    await assert.rejects(() => verifyDenoiseDerivative({ record: waiting, variant: 'full', sourceDirectory: scratch,
      assetsDirectory: scratch, illumination, fullDimensions: [2048] }), /pixels match/);
    const wrongDimension = structuredClone(waiting); wrongDimension.full.width = wrongDimension.full.height = 4096;
    await assert.rejects(() => verifyDenoiseDerivative({ record: wrongDimension, variant: 'full', sourceDirectory: scratch,
      assetsDirectory: scratch, illumination, fullDimensions: [2048] }), /atlas dimension/);
    report.checks.push('Same-size changed PNG pixels and unsupported derivative dimensions are rejected');
  } finally { await fs.rm(scratch, { recursive: true, force: true }); }
  if (output) await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(`PASS ${report.checks.length} focused denoise-validator control groups; final acceptance was not run.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
