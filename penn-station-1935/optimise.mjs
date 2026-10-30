// Derived asset pipeline. Blender remains the source of architectural geometry.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import { readGlb, writeGlb, shareGlbTextures } from './asset_io.mjs';
import { prepareScalarTextures } from './prepare-scalars.mjs';
import { preserveOrderAO } from './preserve-order-ao.mjs';
const root = path.dirname(fileURLToPath(import.meta.url));
const tools = process.env.PENN_TOOLS || '/private/tmp/penn-station-tools';
const sharp = createRequire(path.join(tools, 'package.json'))('sharp');
const lightMaps = new Set();
const scratch = process.env.PENN_ASSET_WORK || '/private/tmp/penn-asset-work';
const out = process.env.PENN_ASSET_OUT || path.join(root, 'assets');
const rawDirectory = process.env.PENN_RAW_DIR || path.join(root, 'assets');
const cli = path.join(tools, 'node_modules/@gltf-transform/cli/bin/cli.js');
const ktx = process.env.KTX_BIN || path.join(tools, 'ktx-extracted/KTX-Software-4.4.2-Darwin-arm64-tools.pkg/Payload/usr/local/bin');
await mkdir(scratch, { recursive: true });
await mkdir(out, { recursive: true });
let metrics = { pipeline: 'Blender 4.3 → glTF Transform 4.2.1 → Meshopt + KTX2/UASTC', assets: [] };
const requestedZones = process.argv.slice(2);
if (requestedZones.some(zone => !['exterior', 'waiting-room', 'concourse', 'context', 'platform', 'trains', 'passengers'].includes(zone))) throw new Error('Unknown model zone');
if (requestedZones.length) { try { metrics = JSON.parse(await readFile(path.join(out, 'asset-metrics.json'), 'utf8')); } catch {} }
function metadata(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'glTF') throw new Error('Expected glTF 2.0 binary');
  return JSON.parse(buffer.toString('utf8', 20, 20 + buffer.readUInt32LE(12)));
}
function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { env: { ...process.env, PATH: ktx + path.delimiter + process.env.PATH }, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(result.stdout + '\n' + result.stderr);
  console.log(result.stdout.trim());
}
for (const zone of (requestedZones.length ? requestedZones : ['exterior', 'waiting-room', 'concourse'])) {
  if (requestedZones.length && !requestedZones.includes(zone)) continue;
  metrics.assets = metrics.assets.filter(item => ![ `model-${zone}.glb`, `model-${zone}-low.glb` ].includes(item.file));
  const original = path.join(rawDirectory, `model-${zone}.glb`);
  const raw = path.join(scratch, `raw-${zone}.glb`);
  const input = await readFile(original);
  if (!metadata(input).extensionsUsed?.includes('EXT_meshopt_compression')) await copyFile(original, raw);
  const rawBytes = await readFile(raw);
  for (const low of [false, true]) {
    const target = path.join(out, `model-${zone}${low ? '-low' : ''}.glb`);
    const pending = path.join(scratch, `${zone}${low ? '-low' : ''}.glb`);
    const geometry = path.join(scratch, `${zone}${low ? '-low' : ''}-geometry.glb`);
    const precision = ['--quantize-position', '16', '--quantize-texcoord', '16', '--quantize-normal', '12'];
    const args = ['optimize', raw, geometry, '--compress', 'false', '--texture-compress', 'false', '--palette', 'false', '--prune-solid-textures', 'false', '--simplify', low ? 'true' : 'false'];
    if (low) args.push('--simplify-ratio', '0.5', '--simplify-error', '0.0003', '--simplify-lock-border', 'true');
    run(args);
    const sized = path.join(scratch, `${zone}${low ? '-low' : ''}-sized.glb`);
    const textured = path.join(scratch, `${zone}${low ? '-low' : ''}-textured.glb`);
    const scalar = path.join(scratch, `${zone}${low ? '-low' : ''}-scalars.glb`);
    const scalarProof = path.join(scratch, `${zone}${low ? '-low' : ''}-scalar-proof.json`);
    run(['resize', geometry, sized, '--width', low ? '512' : '2048', '--height', low ? '512' : '2048']);
    if (!low) await preserveOrderAO(geometry, sized, sized, path.join(scratch, `${zone}-order-ao-proof.json`));
    await prepareScalarTextures(sized, scalar, scalarProof);
    run(['uastc', scalar, textured, '--level', '1', '--zstd', '6', '--jobs', '2']);
    run(['meshopt', textured, pending, ...precision]);
    const encoded = await shareGlbTextures(await readFile(pending), out);
    const parsed = readGlb(encoded.buffer);
    for (const material of parsed.json.materials || []) {
      const sky = material.extras?.sky_illumination;
      if (!sky?.endsWith('.png')) continue;
      const input = low ? sky.replace('-sky.png', '-sky-low.png') : sky;
      const output = input.replace('.png', '.webp');
      if (!lightMaps.has(output)) {
        const sourceMap = path.join(rawDirectory, input);
        const targetMap = path.join(out, output);
        await sharp(sourceMap).webp({ lossless: true, effort: 6 }).toFile(targetMap);
        const originalPixels = await sharp(sourceMap).removeAlpha().raw().toBuffer();
        const runtimePixels = await sharp(targetMap).removeAlpha().raw().toBuffer();
        if (!originalPixels.equals(runtimePixels)) throw new Error(`${output}: illumination pixels changed during lossless packaging`);
        lightMaps.add(output);
      }
      material.extras.sky_illumination = sky.replace('.png', '.webp');
    }
    const output = writeGlb(parsed.json, parsed.binary); const json = metadata(output);
    for (const required of ['EXT_meshopt_compression', 'KHR_texture_basisu']) if (!json.extensionsUsed?.includes(required)) throw new Error(`${zone}: missing ${required}`);
    await writeFile(target, output);
    metrics.assets.push({ file: path.basename(target), rawBytes: rawBytes.length, bytes: output.length, externalTextures: encoded.textures, nodes: json.nodes?.length || 0, meshes: json.meshes?.length || 0, materials: json.materials?.length || 0, textures: json.textures?.length || 0, extensionsUsed: json.extensionsUsed });
  }
}
await writeFile(path.join(out, 'asset-metrics.json'), JSON.stringify(metrics, null, 2) + '\n');
console.log('Validated Meshopt/KTX2 assets with shared texture files ready.');
