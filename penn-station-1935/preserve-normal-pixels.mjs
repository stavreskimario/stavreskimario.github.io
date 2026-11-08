// Full-resolution normal JPEGs need a lossless carrier before general resize.
// Re-encoding a near-flat normal as JPEG can erase its XY signal at equal size.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { readGlb, writeGlb } from './asset_io.mjs';
const requireTools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
const sharp = requireTools('sharp');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function roles(value, prefix = '') {
  return Object.entries(value || {}).flatMap(([key, item]) => {
    const name = prefix ? `${prefix}.${key}` : key;
    if (/Texture$/i.test(key) && Number.isInteger(item?.index)) return [{ name, index: item.index, normal: /normalTexture$/i.test(key) }];
    return item && typeof item === 'object' && !Array.isArray(item) ? roles(item, name) : [];
  });
}
export async function preserveNormalPixels(inputPath, outputPath, reportPath) {
  assert.notEqual(path.resolve(inputPath), path.resolve(outputPath), 'Preserve the original input');
  const input = await readFile(inputPath), source = readGlb(input), json = structuredClone(source.json);
  assert.equal(json.buffers?.length, 1, 'Normal carriers precede compression');
  assert(!(json.extensionsUsed || []).some(name => ['EXT_meshopt_compression', 'KHR_draco_mesh_compression', 'KHR_texture_basisu'].includes(name)), 'Normal carriers precede compression');
  const uses = new Map();
  for (const material of json.materials || []) for (const role of roles(material)) {
    const texture = json.textures?.[role.index];
    assert(texture && !texture.extensions && Number.isInteger(texture.source), 'Expected an uncompressed image binding');
    const list = uses.get(texture.source) || [];
    list.push({ material: material.name, ...role }); uses.set(texture.source, list);
  }
  const parts = [source.binary], changed = [], inspected = []; let length = source.binary.length;
  for (const [index, bindings] of uses) {
    if (!bindings.some(role => role.normal)) continue;
    assert(bindings.every(role => role.normal), 'Normal image must not also serve a non-normal role');
    const image = json.images[index];
    assert(Number.isInteger(image?.bufferView) && !image.uri, 'Expected an embedded normal image');
    const view = json.bufferViews[image.bufferView]; assert.equal(view.buffer, 0);
    const original = source.binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    assert.equal(original.length, view.byteLength); assert(['image/jpeg', 'image/png'].includes(image.mimeType));
    const metadata = await sharp(original).metadata();
    const decoded = await sharp(original).raw().toBuffer({ resolveWithObject: true });
    const before = { image: index, mimeType: image.mimeType, imageSha256: sha(original), pixelSha256: sha(decoded.data), width: decoded.info.width, height: decoded.info.height, channels: decoded.info.channels, bindings };
    if (image.mimeType === 'image/png') { inspected.push({ ...before, preservedOriginalPNG: true }); continue; }
    assert.equal(metadata.depth, 'uchar', 'JPEG carrier expects original 8-bit pixels');
    const png = await sharp(decoded.data, { raw: decoded.info }).png({ compressionLevel: 9, adaptiveFiltering: false }).toBuffer();
    const check = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual(check.info, decoded.info); assert(check.data.equals(decoded.data), 'Normal RGB pixels changed during PNG packaging');
    const newView = json.bufferViews.length;
    json.bufferViews.push({ buffer: 0, byteOffset: length, byteLength: png.length }); parts.push(png); length += png.length;
    const padding = (-length) & 3; if (padding) { parts.push(Buffer.alloc(padding)); length += padding; }
    image.bufferView = newView; image.mimeType = 'image/png';
    changed.push({ ...before, newView, pngSha256: sha(png), pngBytes: png.length, decodedPixelsExact: true });
  }
  json.buffers[0].byteLength = length;
  const output = changed.length ? writeGlb(json, Buffer.concat(parts)) : input;
  const result = readGlb(output); assert(result.binary.subarray(0, source.binary.length).equals(source.binary));
  const reverted = structuredClone(result.json); reverted.bufferViews.length = source.json.bufferViews.length; reverted.buffers[0].byteLength = source.json.buffers[0].byteLength;
  for (const entry of changed) reverted.images[entry.image] = source.json.images[entry.image];
  assert.deepEqual(reverted, source.json, 'Only normal image carrier pointers, MIME and appended bytes may change');
  await mkdir(path.dirname(outputPath), { recursive: true }); await writeFile(outputPath, output);
  const report = { status: 'PASS', helperSha256: sha(await readFile(fileURLToPath(import.meta.url))), input: { path: path.resolve(inputPath), sha256: sha(input) }, output: { path: path.resolve(outputPath), sha256: sha(output) }, oldBinaryPrefixBytes: source.binary.length, oldBinaryPrefixSha256: sha(source.binary), oldBinaryPrefixExact: true, otherImagesAndAllGeometryUVBindingsExact: true, materialFactorsUnchanged: true, convertedNormals: changed, originalPNGs: inspected, verbatimInput: !changed.length };
  if (reportPath) await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  return report;
}
