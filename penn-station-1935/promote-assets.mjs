// Validate and copy the complete reviewed runtime set, preserving photographs,
// the environment and decoder. Original authoring maps stay outside this app.
import { readFile, writeFile, copyFile, mkdir, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { readGlb } from './asset_io.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const source = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('Pass the reviewed scratch runtime directory');
const out = path.join(root, 'assets');
if (source === out) throw new Error('Review assets outside the served directory first');
const metrics = JSON.parse(await readFile(path.join(source, 'asset-metrics.json'), 'utf8'));
const required = ['exterior', 'waiting-room', 'concourse', 'context', 'platform', 'trains'].flatMap(zone => [`model-${zone}.glb`, `model-${zone}-low.glb`]);
const files = new Map();
for (const name of required) {
  const bytes = await readFile(path.join(source, name));
  const { json } = readGlb(bytes);
  for (const extension of ['EXT_meshopt_compression', 'KHR_texture_basisu']) if (!json.extensionsUsed?.includes(extension)) throw new Error(`${name}: missing ${extension}`);
  const packed = gzipSync(bytes, { level: 9 });
  if (!gunzipSync(packed).equals(bytes)) throw new Error('GLB transport changed decoded geometry');
  files.set(name + '.gz', packed);
  for (const image of json.images || []) {
    if (!/^textures\/[a-f0-9]{20}\.ktx2$/.test(image.uri)) throw new Error('Unexpected texture URI');
    const bytes = await readFile(path.join(source, image.uri));
    if (!image.uri.includes(createHash('sha256').update(bytes).digest('hex').slice(0, 20))) throw new Error('Texture hash mismatch');
    files.set(image.uri, bytes);
  }
  for (const material of json.materials || []) {
    const sky = material.extras?.sky_illumination;
    if (!sky) continue;
    if (!/^lighting-[a-z-]+-sky\.webp$/.test(sky)) throw new Error('Unexpected illumination URI');
    const filename = name.includes('-low.') ? sky.replace('-sky.webp', '-sky-low.webp') : sky;
    files.set(filename, await readFile(path.join(source, filename)));
  }
  const record = metrics.assets.find(record => record.file === name);
  if (!record) throw new Error(`${name}: missing measured metrics`);
  record.bytes = bytes.length;
  record.transportFile = name + '.gz'; record.transportBytes = packed.length;
}
metrics.sharedTextureFiles = [...files.keys()].filter(file => file.endsWith('.ktx2')).length;
metrics.modelTextureAndLightingBytes = [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0);
await mkdir(path.join(out, 'textures'), { recursive: true });
for (const [file, bytes] of files) await writeFile(path.join(out, file), bytes);
for (const name of required) { try { await unlink(path.join(out, name)); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
for (const file of await readdir(path.join(out, 'textures'))) if (/^[a-f0-9]{20}\.ktx2$/.test(file) && !files.has(`textures/${file}`)) await unlink(path.join(out, 'textures', file));
for (const file of await readdir(source)) if (/^lighting-[a-z-]+\.json$/.test(file)) await copyFile(path.join(source, file), path.join(out, file));
await writeFile(path.join(out, 'asset-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
console.log(`Promoted ${required.length} verified GLBs, ${metrics.sharedTextureFiles} shared KTX2 files and their lighting (${(metrics.modelTextureAndLightingBytes / 1e6).toFixed(2)} MB).`);
