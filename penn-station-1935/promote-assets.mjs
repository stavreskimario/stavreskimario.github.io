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
const manifestBytes = await readFile(path.join(source, 'scene-manifest.json'));
const manifest = JSON.parse(manifestBytes);
if (manifest.revision !== 3 || manifest.railway?.trackCount !== 21 || manifest.railway?.platformCount !== 11 || manifest.runtimeZones?.length !== 6) throw new Error('Missing coherent Phase 3 world/navigation manifest');
const required = ['exterior', 'waiting-room', 'concourse', 'context', 'platform', 'trains'].flatMap(zone => [`model-${zone}.glb`, `model-${zone}-low.glb`]);
if (metrics.assets.some(asset => asset.file === 'model-passengers.glb')) required.push('model-passengers.glb', 'model-passengers-low.glb');
const files = new Map();
for (const zone of ['exterior', 'waiting-room', 'concourse', 'platform']) {
  const report = JSON.parse(await readFile(path.join(source, `lighting-${zone}-denoise.json`), 'utf8'));
  if (report.zone !== zone || report.schemaVersion !== 1 || !report.constant018Test?.passed || report.constant018Test.maximumError > .0002 || !Number.isFinite(report.denoisedLinear?.mean)) throw new Error(`${zone}: missing calibrated denoising record`);
  if (report.full?.webp !== `lighting-${zone}-sky.webp` || report.low?.webp !== `lighting-${zone}-sky-low.webp`) throw new Error(`${zone}: inconsistent denoised derivatives`);
}
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
    if (material.extras.lightmap_encoding !== 'srgb-linear-radiance-v3' || !(material.extras.sky_illumination_scale >= 1)) throw new Error(`${name}: uncalibrated legacy light map`);
    if (!/^lighting-[a-z-]+-sky\.webp$/.test(sky)) throw new Error('Unexpected illumination URI');
    const filename = name.includes('-low.') ? sky.replace('-sky.webp', '-sky-low.webp') : sky;
    files.set(filename, await readFile(path.join(source, filename)));
  }
  const record = metrics.assets.find(record => record.file === name);
  if (!record) throw new Error(`${name}: missing measured metrics`);
  record.bytes = bytes.length;
  record.transportFile = name + '.gz'; record.transportBytes = packed.length;
}
const probeReport = JSON.parse(await readFile(path.join(source, 'reflection-probes.json'), 'utf8'));
for (const zone of ['waiting-room', 'concourse', 'platform']) {
  const probe = probeReport.probes.find(probe => probe.zone === zone);
  if (!probe) throw new Error(`Missing reviewed reflection probe: ${zone}`);
  for (const low of [false, true]) {
    const name = `reflection-${zone}${low ? '-low' : ''}.hdr.gz`;
    if ((low ? probe.lowFile : probe.fullFile) !== name) throw new Error('Unexpected reflection filename');
    const bytes = await readFile(path.join(source, name));
    const decoded = gunzipSync(bytes);
    if (!decoded.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE')) throw new Error(`${name}: invalid HDR data`);
    if (!low && createHash('sha256').update(decoded).digest('hex') !== probe.decodedSha256) throw new Error('Reflection source hash mismatch');
    files.set(name, bytes);
  }
}
files.set('reflection-probes.json', Buffer.from(JSON.stringify(probeReport, null, 2) + '\n'));
const exteriorBytes = await readFile(path.join(source, 'reflection-exterior-probe.json'));
const exteriorReport = JSON.parse(exteriorBytes);
const exteriorProbe = exteriorReport.probes?.find(probe => probe.zone === 'exterior');
const environment = await readFile(path.join(source, 'sky.hdr'));
if (!exteriorProbe || !environment.subarray(0, 11).toString('ascii').startsWith('#?RADIANCE') || createHash('sha256').update(environment).digest('hex') !== exteriorProbe.decodedSha256) throw new Error('Exterior environment must match the reviewed station capture');
files.set('sky.hdr', environment);
files.set('reflection-exterior-probe.json', exteriorBytes);
metrics.sharedTextureFiles = [...files.keys()].filter(file => file.endsWith('.ktx2')).length;
metrics.modelTextureAndLightingBytes = [...files.values()].reduce((sum, bytes) => sum + bytes.length, 0);
metrics.navigationBytes = manifestBytes.length;
await mkdir(path.join(out, 'textures'), { recursive: true });
for (const [file, bytes] of files) await writeFile(path.join(out, file), bytes);
await writeFile(path.join(out, 'scene-manifest.json'), manifestBytes);
for (const name of required) { try { await unlink(path.join(out, name)); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
for (const file of await readdir(path.join(out, 'textures'))) if (/^[a-f0-9]{20}\.ktx2$/.test(file) && !files.has(`textures/${file}`)) await unlink(path.join(out, 'textures', file));
for (const file of await readdir(source)) if (/^lighting-[a-z-]+\.json$/.test(file)) await copyFile(path.join(source, file), path.join(out, file));
await writeFile(path.join(out, 'asset-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
console.log(`Promoted ${required.length} verified GLBs, ${metrics.sharedTextureFiles} shared KTX2 files and their lighting (${(metrics.modelTextureAndLightingBytes / 1e6).toFixed(2)} MB).`);
