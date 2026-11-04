/* Recover explicitly retained linear HDRs from exact local Git objects.
 * Public rendering continues to use the unchanged PNG/WebP derivatives.
 */
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const allowedPath = 'authoring/penn-station-1935/lighting/phase4/denoised/lighting-waiting-room-vault-sky-denoised-linear.hdr.gz';
const manifestPath = 'authoring/penn-station-1935/review/phase11/storage/current-vault-hdr-archive.json';
const enclosureManifest = 'authoring/penn-station-1935/review/phase13/storage/current-enclosure-hdr-archives.json';
const arrivalsManifest = 'authoring/penn-station-1935/review/phase14/storage/current-arrivals-hdr-archives.json';
const archivePolicies = new Map([
  ['authoring/penn-station-1935/lighting/phase8/raw/lighting-concourse-arrivals-sky.hdr.gz', { manifest: arrivalsManifest }],
  ['authoring/penn-station-1935/lighting/phase8/denoised/lighting-concourse-arrivals-sky-denoised-linear.hdr.gz', { manifest: arrivalsManifest }],
  [allowedPath, { manifest: manifestPath, single: true }],
  ['authoring/penn-station-1935/lighting/phase13-enclosure/raw/lighting-platform-enclosure-sky.hdr.gz', { manifest: enclosureManifest }],
  ['authoring/penn-station-1935/lighting/phase13-enclosure/denoised/lighting-platform-enclosure-sky-denoised-linear.hdr.gz', { manifest: enclosureManifest }],
  ['authoring/penn-station-1935/lighting/phase13-floor/raw/lighting-platform-enclosure-floor-sky.hdr.gz', { manifest: enclosureManifest }],
  ['authoring/penn-station-1935/lighting/phase13-floor/denoised/lighting-platform-enclosure-floor-sky-denoised-linear.hdr.gz', { manifest: enclosureManifest }],
  ['authoring/penn-station-1935/lighting/phase13-enclosure/reflections/reflection-platform-enclosure-linear.exr.gz', { manifest: enclosureManifest }],
  ['authoring/penn-station-1935/lighting/phase13-soffit/raw/lighting-concourse-exit-soffit-sky.hdr.gz', { manifest: enclosureManifest }],
  ['authoring/penn-station-1935/lighting/phase13-soffit/denoised/lighting-concourse-exit-soffit-sky-denoised-linear.hdr.gz', { manifest: enclosureManifest }],
]);

async function readSourceArchive(file, repositoryRoot) {
  try { return await fs.readFile(file); }
  catch (error) { if (error.code !== 'ENOENT') throw error;
    const relative = path.relative(repositoryRoot, file).split(path.sep).join('/');
    const policy = archivePolicies.get(relative);
    if (!policy) throw error;
    const receipt = JSON.parse(await fs.readFile(path.join(repositoryRoot, policy.manifest), 'utf8'));
    const entry = policy.single ? receipt : receipt.files?.find(item => item.path === relative);
    assert(entry && entry.path === relative, 'Only an explicitly archived source with an exact allowlisted path is allowed');
    assert(/^[a-f0-9]{40}$/.test(entry.commit), 'Immutable Git commit required');
    assert(/^[a-f0-9]{40}$/.test(entry.blob), 'Exact Git blob required');
    assert(/^[a-f0-9]{64}$/.test(entry.sha256), 'Exact archive SHA256 required');
    assert(Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes < 100_000_000);
    const membership = await run('git', ['rev-parse', `${entry.commit}:${relative}`], { cwd: repositoryRoot });
    assert.equal(membership.stdout.trim(), entry.blob, 'Archive belongs to the recorded immutable commit and path');
    const result = await run('git', ['cat-file', 'blob', entry.blob], {
      cwd: repositoryRoot, encoding: 'buffer', maxBuffer: entry.bytes + 4096,
    });
    const bytes = result.stdout;
    assert.equal(bytes.length, entry.bytes, 'Full source archive length matches');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, 'Full source archive bytes match');
    return bytes;
  }
}
module.exports = { readSourceArchive };
