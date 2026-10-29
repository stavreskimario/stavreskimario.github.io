/* Focused provenance-validator controls. These do not run final model/browser
 * acceptance. Exact b86a591 JSON records plus regenerated temporary lossless WebPs exercise
 * legacy compatibility independently of current runtime promotion. Schema2/3,
 * HDR archives and rejection controls remain isolated from final acceptance.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { gzipSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const { createRequire } = require('node:module');
const tools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
const sharp = tools('sharp');
const { denoiseEntries, denoisePolicy, checkDenoiseStatistics, checkBakeStatistics,
  retainedHdr, verifyDenoiseDerivative, validateDenoising } = require('./penn-assets.cjs');
const repo = path.resolve(__dirname, '..');
const fixtures = path.join(__dirname, 'fixtures/penn-lighting-legacy');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const output = process.env.PENN_DENOISE_PROOF_REPORT;

(async () => {
  const report = { created: new Date().toISOString(), scope: 'Focused validator controls; not final model/browser acceptance',
    testSourceSha256: hash(await fs.readFile(__filename)), tooling: { node: process.version, sharp: sharp.versions.sharp, libvips: sharp.versions.vips, webp: sharp.versions.webp }, checks: [] };
  const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'penn-denoise-validator-'));
  try {
    const assets = path.join(scratch, 'regenerated-legacy-assets');
    await fs.mkdir(assets);
    const fixtureManifest = JSON.parse(await fs.readFile(path.join(fixtures, 'manifest.json')));
    assert.equal(fixtureManifest.sourceCommit, 'b86a59177e65461f5eb71c0593cab5b53fd4e5f6', 'Fixtures use the exact maintenance checkpoint');
    assert.equal(fixtureManifest.records.length, 8, 'Four exact bake/denoise JSON pairs');
    assert.equal(fixtureManifest.sourcePngs.length, 8, 'Retained full/fallback PNG identities from the same commit');
    for (const fixture of fixtureManifest.records) {
      assert.equal(path.basename(fixture.file), fixture.file);
      const bytes = await fs.readFile(path.join(fixtures, fixture.file));
      assert.equal(bytes.length, fixture.bytes);
      assert.equal(hash(bytes), fixture.sha256, `${fixture.file}: exact archived legacy record`);
      await fs.writeFile(path.join(assets, fixture.file), bytes);
    }
    const waiting = JSON.parse(await fs.readFile(path.join(assets, 'lighting-waiting-room-denoise.json')));
    assert.equal(waiting.schemaVersion, 1, 'Archived maintenance record retains schema1 after runtime promotion');
    const illumination = new Set();
    const derivatives = [];
    for (const zone of ['exterior', 'waiting-room', 'concourse', 'platform']) {
      const record = JSON.parse(await fs.readFile(path.join(assets, `lighting-${zone}-denoise.json`)));
      const sourceDirectory = path.join(repo, denoisePolicy(record, zone).authoringDirectory);
      for (const variant of ['full', 'low']) {
        const derivative = record[variant];
        illumination.add(derivative.webp);
        const source = path.join(sourceDirectory, derivative.png);
        const destination = path.join(assets, derivative.webp);
        const sourceBytes = await fs.readFile(source);
        const sourceFixture = fixtureManifest.sourcePngs.find(item => item.file === path.relative(repo, source));
        assert(sourceFixture, `${zone}/${variant}: retained PNG fixture identity exists`);
        assert.equal(sourceBytes.length, sourceFixture.bytes);
        assert.equal(hash(sourceBytes), sourceFixture.sha256, `${zone}/${variant}: retained PNG matches the exact maintenance source`);
        await sharp(source).removeAlpha().webp({ lossless: true, effort: 6 }).toFile(destination);
        const decoded = await sharp(destination).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        derivatives.push({ zone, variant, sourcePng: path.relative(repo, source), sourceSha256: hash(sourceBytes),
          regeneratedWebp: derivative.webp, regeneratedSha256: hash(await fs.readFile(destination)),
          decodedPixelSha256: hash(decoded.data), width: decoded.info.width, height: decoded.info.height });
      }
    }
    const legacy = await validateDenoising({ assetsDirectory: assets, illumination, repositoryDirectory: repo });
    assert.equal(legacy.atlases.length, 4);
    report.legacyCompatibility = { sourceCommit: fixtureManifest.sourceCommit, fixtureRecords: fixtureManifest.records, retainedSourcePngs: fixtureManifest.sourcePngs,
      derivativeTreatment: 'Temporary lossless WebPs regenerated from retained Phase3 PNGs; not the earlier actual runtime WebP files. Earlier delivered-runtime proof and final model/browser acceptance are separate.',
      regeneratedDerivatives: derivatives, validatedAtlases: legacy.atlases };
    report.checks.push('Four exact archived checkpoint records validate retained HDR hashes, 0.18 controls and bake coverage against regenerated lossless full/fallback derivatives; no current runtime dependency');

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

    const controls = path.join(scratch, 'rejection-controls');
    await fs.mkdir(controls);
    try {
      const sourceDirectory = path.join(repo, 'authoring/penn-station-1935/lighting/phase3/denoised');
      const original = (await retainedHdr(waiting, sourceDirectory)).bytes;
      const archive = waiting.retainedHdr.file + '.gz';
      await fs.writeFile(path.join(controls, archive), gzipSync(original));
      assert((await retainedHdr(waiting, controls)).bytes.equals(original), 'Implicit archive fallback decompresses original bytes');
      const explicit = structuredClone(waiting); explicit.retainedHdr.archiveFile = archive;
      assert((await retainedHdr(explicit, controls)).bytes.equals(original));
      explicit.retainedHdr.sha256 = '0'.repeat(64);
      await assert.rejects(() => retainedHdr(explicit, controls));
      report.checks.push('Explicit and implicit .hdr.gz archival preserves original HDR bytes; a wrong decoded SHA is rejected');

      await fs.copyFile(path.join(assets, waiting.full.webp), path.join(controls, waiting.full.webp));
      await sharp({ create: { width: 2048, height: 2048, channels: 3, background: '#808080' } }).png().toFile(path.join(controls, waiting.full.png));
      await assert.rejects(() => verifyDenoiseDerivative({ record: waiting, variant: 'full', sourceDirectory: controls,
        assetsDirectory: controls, illumination, fullDimensions: [2048] }), /pixels match/);
      const wrongDimension = structuredClone(waiting); wrongDimension.full.width = wrongDimension.full.height = 4096;
      await assert.rejects(() => verifyDenoiseDerivative({ record: wrongDimension, variant: 'full', sourceDirectory: controls,
        assetsDirectory: controls, illumination, fullDimensions: [2048] }), /atlas dimension/);
      report.checks.push('Same-size changed PNG pixels and unsupported derivative dimensions are rejected');
    } finally { await fs.rm(controls, { recursive: true, force: true }); }
    if (output) await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n');
    console.log(`PASS ${report.checks.length} focused denoise-validator control groups; final acceptance was not run.`);
  } finally { await fs.rm(scratch, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exitCode = 1; });
