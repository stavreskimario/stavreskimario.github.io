/* Recover one retained linear HDR from its exact local Git object.
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

async function readSourceArchive(file, repositoryRoot) {
  try { return await fs.readFile(file); }
  catch (error) { if (error.code !== 'ENOENT') throw error;
    const relative = path.relative(repositoryRoot, file).split(path.sep).join('/');
    if (relative !== allowedPath) throw error;
    const entry = JSON.parse(await fs.readFile(path.join(repositoryRoot, manifestPath), 'utf8'));
    assert.equal(entry.path, allowedPath, 'Only the explicitly archived vault source is allowed');
    assert(/^[a-f0-9]{40}$/.test(entry.commit), 'Immutable Git commit required');
    assert(/^[a-f0-9]{40}$/.test(entry.blob), 'Exact Git blob required');
    assert(/^[a-f0-9]{64}$/.test(entry.sha256), 'Exact archive SHA256 required');
    assert(Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes < 100_000_000);
    const membership = await run('git', ['rev-parse', `${entry.commit}:${allowedPath}`], { cwd: repositoryRoot });
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
