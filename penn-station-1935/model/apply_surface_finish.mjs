// Change only stone albedo references and normal-strength scalars in already
// compressed models. Source geometry, lighting, AO and roughness remain intact.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { canonicalKtx, readGlb, writeGlb } from '../asset_io.mjs';

const args = {};
for (let i = 2; i < process.argv.length; i += 2) {
  if (!['--input', '--out', '--library', '--zones'].includes(process.argv[i]) || !process.argv[i + 1]) throw new Error('Use --input DIR --out DIR --library DIR [--zones exterior,waiting-room,concourse]');
  args[process.argv[i].slice(2)] = process.argv[i + 1];
}
for (const key of ['input', 'out', 'library']) if (!args[key]) throw new Error(`Missing --${key}`);
if (path.resolve(args.input) === path.resolve(args.out)) throw new Error('Review output must differ from the source directory');
const zones = (args.zones || 'exterior,waiting-room,concourse').split(',');
if (zones.some(zone => !['exterior', 'waiting-room', 'concourse'].includes(zone))) throw new Error('Unsupported architectural zone');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const library = JSON.parse(await readFile(path.join(args.library, 'surface-finish.json'), 'utf8'));
if (library.appearanceRevision !== 4 || library.architecturalUvRevision !== 3) throw new Error('Unexpected surface library revision');
await mkdir(path.join(args.out, 'textures'), { recursive: true });
const report = { schema: 1, appearanceRevision: 4, architecturalUvRevision: 3, rebakedIllumination: false, scope: 'JSON-only base-colour references and normal strength. The BIN chunk, geometry/UV JSON, roughness, metal, AO, lightmap references and base-colour factors are preserved.', models: [] };
const protectedKeys = ['asset', 'buffers', 'bufferViews', 'accessors', 'meshes', 'nodes', 'scenes', 'scene', 'skins', 'animations', 'cameras', 'extensions', 'extensionsUsed', 'extensionsRequired'];
const select = name => {
  if (/^MilfordGranite/.test(name)) return ['MilfordFine', .045];
  if (/^InteriorGranite/.test(name)) return ['InteriorFine', .025];
  if (/^Travertine/.test(name)) return ['RomanTravertine', .035];
  if (/^(PublicFloorMarble|TennesseeMarble)/.test(name)) return ['HonedMarble', .018];
  if (/^BotticinoMarble/.test(name)) return ['HonedMarble', .025];
  return null;
};
const imageForTexture = (json, index) => json.textures?.[index]?.extensions?.KHR_texture_basisu?.source;
function textureUses(material, visit, key = '', at = []) {
  if (!material || typeof material !== 'object') return;
  if (key.endsWith('Texture') && Number.isInteger(material.index)) visit(material, at);
  for (const [child, value] of Object.entries(material)) if (value && typeof value === 'object') textureUses(value, visit, child, [...at, child]);
}
for (const zone of zones) for (const low of [false, true]) {
  const filename = `model-${zone}${low ? '-low' : ''}.glb`;
  let source;
  try { source = await readFile(path.join(args.input, filename)); }
  catch (error) { if (error.code !== 'ENOENT') throw error; source = gunzipSync(await readFile(path.join(args.input, filename + '.gz'))); }
  const { json, binary } = readGlb(source);
  if (!json.extensionsRequired?.includes('KHR_texture_basisu') || !json.extensionsUsed?.includes('EXT_meshopt_compression')) throw new Error(`${filename}: expected released Meshopt/KTX2 model`);
  const before = structuredClone(json);
  const materialChanges = [];
  const uses = new Map();
  json.materials.forEach((material, index) => textureUses(material, (info, at) => {
    const image = imageForTexture(json, info.index);
    if (image === undefined) return;
    if (!uses.has(image)) uses.set(image, []);
    uses.get(image).push({ material: index, info, at });
  }));
  const replacedImages = new Map();
  const newImages = new Map();
  for (let index = 0; index < json.materials.length; index++) {
    const material = json.materials[index];
    const profile = select(material.name || '');
    if (!profile) continue;
    const [identity, strength] = profile;
    const pbr = material.pbrMetallicRoughness;
    if (!pbr?.baseColorTexture || !material.normalTexture) throw new Error(`${filename}/${material.name}: expected textured source stone`);
    const textureIndex = pbr.baseColorTexture.index;
    const oldImage = imageForTexture(json, textureIndex);
    if (oldImage === undefined || json.images[oldImage].bufferView !== undefined) throw new Error('Expected external KTX2 source colour');
    const variant = library.profiles[identity]?.variants[low ? 'low' : 'full'];
    if (!variant?.ktx) throw new Error(`Missing compressed derivative ${identity}`);
    const compressed = await readFile(path.join(args.library, variant.ktx.file));
    if (hash(compressed) !== variant.ktx.sha256) throw new Error(`Derivative hash mismatch: ${variant.ktx.file}`);
    const canonical = canonicalKtx(compressed);
    const uri = `textures/${hash(canonical).slice(0, 20)}.ktx2`;
    await writeFile(path.join(args.out, uri), canonical);
    const exclusivelySameColour = (uses.get(oldImage) || []).every(use => {
      const assigned = select(json.materials[use.material].name || '');
      return assigned?.[0] === identity && use.at.join('.') === 'pbrMetallicRoughness.baseColorTexture';
    });
    if (exclusivelySameColour) {
      const previous = replacedImages.get(oldImage);
      if (previous && previous !== uri) throw new Error('Conflicting colour remap');
      json.images[oldImage].uri = uri;
      replacedImages.set(oldImage, uri);
    } else {
      const key = `${textureIndex}:${identity}`;
      if (!newImages.has(key)) {
        const imageIndex = json.images.length;
        json.images.push({ ...structuredClone(json.images[oldImage]), uri });
        const texture = structuredClone(json.textures[textureIndex]);
        texture.extensions.KHR_texture_basisu.source = imageIndex;
        newImages.set(key, json.textures.length);
        json.textures.push(texture);
      }
      pbr.baseColorTexture.index = newImages.get(key);
    }
    material.normalTexture.scale = strength;
    material.extras ||= {};
    material.extras.surface_appearance_revision = 4;
    material.extras.surface_appearance_profile = identity;
    material.extras.surface_normal_strength = strength;
    material.extras.surface_appearance_interpretation = 'Modern CC0 colour derivative with interpreted palette/contrast; geometry, UV scale and existing indirect illumination retained.';
    const factor = pbr.baseColorFactor || [1, 1, 1, 1];
    if (!variant.ktx.decodedLinearMean) throw new Error('Compressed albedo must have a decoded pixel/mean check');
    materialChanges.push({ material: material.name, profile: identity, texture: uri, normalStrengthBefore: before.materials[index].normalTexture.scale ?? 1, normalStrengthAfter: strength, baseColorFactorPreserved: factor, decodedMapLinearMean: variant.ktx.decodedLinearMean, finalFactorTimesMapLinearMean: variant.ktx.decodedLinearMean.map((value, channel) => value * factor[channel]), encodingError255: variant.ktx.encodedRgbError255 });
  }
  if (!materialChanges.length) throw new Error(`${filename}: no supported stone materials`);
  for (const key of protectedKeys) if (!isDeepStrictEqual(before[key], json[key])) throw new Error(`${filename}: protected ${key} changed`);
  for (let index = 0; index < json.materials.length; index++) {
    const original = before.materials[index], current = json.materials[index];
    for (const key of ['occlusionTexture', 'emissiveTexture', 'extensions']) if (!isDeepStrictEqual(original[key], current[key])) throw new Error(`${filename}: protected material ${key} changed`);
    for (const key of ['metallicRoughnessTexture', 'roughnessFactor', 'metallicFactor', 'baseColorFactor']) if (!isDeepStrictEqual(original.pbrMetallicRoughness?.[key], current.pbrMetallicRoughness?.[key])) throw new Error(`${filename}: protected material ${key} changed`);
    for (const [key, value] of Object.entries(original.extras || {})) if (key !== 'surface_normal_strength' && !isDeepStrictEqual(value, current.extras?.[key])) throw new Error(`${filename}: original material metadata ${key} changed`);
  }
  const output = writeGlb(json, binary);
  if (!readGlb(output).binary.equals(binary)) throw new Error(`${filename}: BIN changed`);
  await writeFile(path.join(args.out, filename), output);
  const gzipped = gzipSync(output, { level: 9 });
  await writeFile(path.join(args.out, filename + '.gz'), gzipped);
  report.models.push({ file: filename, sourceSha256: hash(source), outputSha256: hash(output), binSha256Before: hash(binary), binSha256After: hash(readGlb(output).binary), geometryUvJsonUnchanged: true, aoRoughnessMetalIlluminationReferencesUnchanged: true, bytes: output.length, gzipBytes: gzipped.length, materials: materialChanges });
}
await writeFile(path.join(args.out, 'surface-finish-application.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ models: report.models.length, changedMaterials: report.models.reduce((total, item) => total + item.materials.length, 0), output: args.out }));
