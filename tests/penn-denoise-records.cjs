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
const { spawnSync } = require('node:child_process');
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
    const legacySources = path.join(scratch, 'legacy-source-tree');
    const archivedHdrs = JSON.parse(await fs.readFile(path.join(repo, 'authoring/penn-station-1935/review/phase5/storage/archived-phase3-hdr.json')));
    const restoredArchivedHdrs = [];
    for (const zone of ['exterior', 'waiting-room', 'concourse', 'platform']) {
      const record = JSON.parse(await fs.readFile(path.join(assets, `lighting-${zone}-denoise.json`)));
      const relativeDirectory = denoisePolicy(record, zone).authoringDirectory;
      const retainedDirectory = path.join(repo, relativeDirectory);
      const sourceDirectory = path.join(legacySources, relativeDirectory);
      await fs.mkdir(sourceDirectory, { recursive: true });
      try {
        const retained = await retainedHdr(record, retainedDirectory);
        assert.equal(record.retainedHdr.archiveFile, undefined, 'Exact legacy fixture uses the implicit archive fallback');
        await fs.writeFile(path.join(sourceDirectory, record.retainedHdr.file), retained.bytes);
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        const archivePath = `${relativeDirectory}/${record.retainedHdr.file}.gz`;
        const archived = archivedHdrs.files.find(item => item.path === archivePath);
        assert(archived, `${zone}: missing HDR has an explicit immutable history receipt`);
        assert(/^[a-f0-9]{40}$/.test(archived.gitBlob), `${zone}: immutable Git blob identity`);
        const result = spawnSync('git', ['cat-file', 'blob', archived.gitBlob], { cwd: repo, maxBuffer: 64 * 1024 * 1024 });
        assert.equal(result.status, 0, `${zone}: archived HDR blob must be available in local Git history`);
        assert.equal(result.stdout.length, archived.bytes);
        assert.equal(hash(result.stdout), archived.sha256, `${zone}: restored compressed HDR matches its history receipt`);
        await fs.writeFile(path.join(sourceDirectory, path.basename(archivePath)), result.stdout);
        const retained = await retainedHdr(record, sourceDirectory);
        restoredArchivedHdrs.push({ zone, sourcePath: archivePath, gitCommit: archived.gitCommit, gitBlob: archived.gitBlob,
          archiveSha256: archived.sha256, retainedDecodedSha256: hash(retained.bytes) });
      }
      for (const variant of ['full', 'low']) {
        const derivative = record[variant];
        illumination.add(derivative.webp);
        const source = path.join(sourceDirectory, derivative.png);
        const retainedPng = path.join(retainedDirectory, derivative.png);
        const destination = path.join(assets, derivative.webp);
        const sourceBytes = await fs.readFile(retainedPng);
        const sourceFixture = fixtureManifest.sourcePngs.find(item => item.file === path.relative(repo, retainedPng));
        assert(sourceFixture, `${zone}/${variant}: retained PNG fixture identity exists`);
        assert.equal(sourceBytes.length, sourceFixture.bytes);
        assert.equal(hash(sourceBytes), sourceFixture.sha256, `${zone}/${variant}: retained PNG matches the exact maintenance source`);
        await fs.writeFile(source, sourceBytes);
        await sharp(source).removeAlpha().webp({ lossless: true, effort: 6 }).toFile(destination);
        const decoded = await sharp(destination).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        derivatives.push({ zone, variant, sourcePng: path.relative(repo, retainedPng), sourceSha256: hash(sourceBytes),
          regeneratedWebp: derivative.webp, regeneratedSha256: hash(await fs.readFile(destination)),
          decodedPixelSha256: hash(decoded.data), width: decoded.info.width, height: decoded.info.height });
      }
    }
    const legacy = await validateDenoising({ assetsDirectory: assets, illumination, repositoryDirectory: legacySources });
    assert.equal(legacy.atlases.length, 4);
    report.legacyCompatibility = { sourceCommit: fixtureManifest.sourceCommit, fixtureRecords: fixtureManifest.records, retainedSourcePngs: fixtureManifest.sourcePngs,
      derivativeTreatment: 'Temporary lossless WebPs regenerated from retained Phase3 PNGs; missing historical HDR archives are restored only in the temporary source tree from SHA-verified immutable local Git blobs. These are not the earlier actual runtime WebP files. Earlier delivered-runtime proof and final model/browser acceptance are separate.',
      restoredArchivedHdrs,
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

    const phase5Directory = 'authoring/penn-station-1935/lighting/phase5/denoised';
    const phase5VaultPolicy = denoisePolicy({ zone: 'waiting-room-vault', authoringDirectory: phase5Directory }, 'waiting-room');
    assert.deepEqual(phase5VaultPolicy, { authoringDirectory: phase5Directory, fresh: true, fullDimensions: [8192], inputTransfer: 'linear' });
    for (const zone of ['exterior', 'waiting-room', 'waiting-room-masonry', 'waiting-room-order', 'concourse', 'platform']) {
      const baseZone = zone.startsWith('waiting-room') ? 'waiting-room' : zone;
      assert.throws(() => denoisePolicy({ zone, authoringDirectory: phase5Directory }, baseZone), /supported local authoring directory/);
    }
    for (const directory of [phase5Directory + '/', phase5Directory + '/../denoised', phase5Directory.replace('/phase5/', '/phase5/../phase5/'), '../' + phase5Directory])
      assert.throws(() => denoisePolicy({ zone: 'waiting-room-vault', authoringDirectory: directory }, 'waiting-room'), /supported local authoring directory/);
    const reducedPhase5Vault = structuredClone(waiting);
    reducedPhase5Vault.zone = 'waiting-room-vault';
    reducedPhase5Vault.full.width = reducedPhase5Vault.full.height = 6144;
    reducedPhase5Vault.full.png = 'lighting-waiting-room-vault-sky.png';
    reducedPhase5Vault.full.webp = 'lighting-waiting-room-vault-sky.webp';
    await assert.rejects(() => verifyDenoiseDerivative({ record: reducedPhase5Vault, variant: 'full', sourceDirectory: scratch,
      assetsDirectory: scratch, illumination, fullDimensions: phase5VaultPolicy.fullDimensions }), /atlas dimension/);
    report.checks.push('Only the exact Phase5 vault source directory is accepted, with linear transfer and an 8K full atlas; other zones, traversal/alias paths and a 6K derivative are rejected');

    await require('./penn-access-denoise.cjs')({ assets, illumination,
      repositoryDirectory: legacySources, sampleRecord: waiting, report });
    await require('./penn-circulation-denoise.cjs')({ assets, illumination,
      repositoryDirectory: legacySources, sampleRecord: waiting, report });

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
      const sourceDirectory = path.join(legacySources, 'authoring/penn-station-1935/lighting/phase3/denoised');
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
