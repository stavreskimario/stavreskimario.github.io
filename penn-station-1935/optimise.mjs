// Derived asset pipeline. Blender remains the source of architectural geometry.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.dirname(fileURLToPath(import.meta.url));
const tools = process.env.PENN_TOOLS || '/private/tmp/penn-station-tools';
const scratch = process.env.PENN_ASSET_WORK || '/private/tmp/penn-asset-work';
const cli = path.join(tools, 'node_modules/@gltf-transform/cli/bin/cli.js');
const ktx = process.env.KTX_BIN || path.join(tools, 'ktx-extracted/KTX-Software-4.4.2-Darwin-arm64-tools.pkg/Payload/usr/local/bin');
await mkdir(scratch, { recursive: true });
let metrics = { pipeline: 'Blender 4.3 → glTF Transform 4.2.1 → Meshopt + KTX2/UASTC', assets: [] };
const requestedZones = process.argv.slice(2);
if (requestedZones.some(zone => !['exterior', 'waiting-room', 'concourse'].includes(zone))) throw new Error('Unknown model zone');
if (requestedZones.length) { try { metrics = JSON.parse(await readFile(path.join(root, 'assets/asset-metrics.json'), 'utf8')); } catch {} }
function metadata(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'glTF') throw new Error('Expected glTF 2.0 binary');
  return JSON.parse(buffer.toString('utf8', 20, 20 + buffer.readUInt32LE(12)));
}
function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { env: { ...process.env, PATH: ktx + path.delimiter + process.env.PATH }, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stdout + '\n' + result.stderr);
  console.log(result.stdout.trim());
}
for (const zone of ['exterior', 'waiting-room', 'concourse']) {
  if (requestedZones.length && !requestedZones.includes(zone)) continue;
  metrics.assets = metrics.assets.filter(item => ![ `model-${zone}.glb`, `model-${zone}-low.glb` ].includes(item.file));
  const original = path.join(root, 'assets', `model-${zone}.glb`);
  const raw = path.join(scratch, `raw-${zone}.glb`);
  const input = await readFile(original);
  if (!metadata(input).extensionsUsed?.includes('EXT_meshopt_compression')) await copyFile(original, raw);
  const rawBytes = await readFile(raw);
  for (const low of [false, true]) {
    const target = path.join(root, 'assets', `model-${zone}${low ? '-low' : ''}.glb`);
    const pending = path.join(scratch, `${zone}${low ? '-low' : ''}.glb`);
    const geometry = path.join(scratch, `${zone}${low ? '-low' : ''}-geometry.glb`);
    const args = ['optimize', raw, geometry, '--compress', 'false', '--texture-compress', 'false', '--palette', 'false', '--simplify', low ? 'true' : 'false'];
    if (low) args.push('--simplify-ratio', '0.5', '--simplify-error', '0.0003', '--simplify-lock-border', 'true');
    run(args);
    const sized = path.join(scratch, `${zone}${low ? '-low' : ''}-sized.glb`);
    const textured = path.join(scratch, `${zone}${low ? '-low' : ''}-textured.glb`);
    run(['resize', geometry, sized, '--width', low ? '512' : '1024', '--height', low ? '512' : '1024']);
    run(['uastc', sized, textured, '--level', '1', '--zstd', '6', '--jobs', '2']);
    run(['meshopt', textured, pending]);
    const output = await readFile(pending); const json = metadata(output);
    for (const required of ['EXT_meshopt_compression', 'KHR_texture_basisu']) if (!json.extensionsUsed?.includes(required)) throw new Error(`${zone}: missing ${required}`);
    await copyFile(pending, target);
    metrics.assets.push({ file: path.basename(target), rawBytes: rawBytes.length, bytes: output.length, nodes: json.nodes?.length || 0, meshes: json.meshes?.length || 0, materials: json.materials?.length || 0, textures: json.textures?.length || 0, extensionsUsed: json.extensionsUsed });
  }
}
await writeFile(path.join(root, 'assets/asset-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
console.log('Six validated Meshopt/KTX2 assets ready.');
