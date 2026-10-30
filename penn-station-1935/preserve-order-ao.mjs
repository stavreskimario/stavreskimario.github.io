// Restore the dedicated 4K carved-order AO after the general desktop 2K resize.
// Existing image/texture indices and every other binary view stay unchanged.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { readGlb, writeGlb } from './asset_io.mjs';
const requireTools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
const sharp = requireTools('sharp');
const marker = 'lighting-waiting-room-order-sky.png';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const helperSha256 = sha(await readFile(fileURLToPath(import.meta.url)));
const selected = material => material.extras?.sky_illumination === marker;
function refs(value, prefix = []) {
  const result = [];
  for (const [key, item] of Object.entries(value || {})) {
    if (/Texture$/i.test(key) && Number.isInteger(item?.index)) result.push({ slot: [...prefix, key].join('.'), info: item });
    else if (item && typeof item === 'object' && !Array.isArray(item)) result.push(...refs(item, [...prefix, key]));
  }
  return result;
}
function imageIndex(json, info) {
  const texture = json.textures?.[info.index];
  assert(texture && !texture.extensions, 'Expected an uncompressed pre-UASTC texture');
  assert(Number.isInteger(texture.source), 'Expected a direct image source');
  return texture.source;
}
function viewBytes(glb, index) {
  const view = glb.json.bufferViews[index];
  assert.equal(view.buffer, 0, 'Expected an embedded image in the primary buffer');
  const bytes = glb.binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
  assert.equal(bytes.length, view.byteLength, 'Buffer view exceeds embedded BIN');
  return bytes;
}
function embeddedImage(glb, index) {
  const image = glb.json.images[index];
  assert(Number.isInteger(image?.bufferView) && !image.uri, 'Expected an embedded image');
  return viewBytes(glb, image.bufferView);
}
function assertExclusiveAO(json, image, targetView) {
  for (const material of json.materials || []) for (const role of refs(material)) {
    if (imageIndex(json, role.info) !== image) continue;
    assert(selected(material) && role.slot === 'occlusionTexture', 'Order AO image must serve only the marked order occlusion roles');
  }
  for (let i = 0; i < (json.images || []).length; i++) if (i !== image) assert.notEqual(json.images[i].bufferView, targetView, 'Order AO image view must not alias another image');
  function check(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, item] of Object.entries(value)) {
      if (key === 'bufferView') assert.notEqual(item, targetView, 'Order AO view must not contain geometry or another resource');
      else check(item);
    }
  }
  for (const [key, value] of Object.entries(json)) if (key !== 'images') check(value);
}

export async function preserveOrderAO(sourcePath, sizedPath, outputPath, reportPath) {
  const sourceBytes = await readFile(sourcePath), inputBytes = await readFile(sizedPath);
  const source = readGlb(sourceBytes), sized = readGlb(inputBytes);
  for (const glb of [source, sized]) {
    assert.equal(glb.json.buffers?.length, 1, 'Order AO restoration precedes geometry compression');
    assert(!(glb.json.extensionsUsed || []).some(name => ['EXT_meshopt_compression', 'KHR_draco_mesh_compression', 'KHR_texture_basisu'].includes(name)), 'Order AO restoration must precede compression');
  }
  const replacements = new Map(), changes = [];
  const sourceMaterials = (source.json.materials || []).filter(selected);
  const sizedMaterials = (sized.json.materials || []).filter(selected);
  assert.equal(sizedMaterials.length, sourceMaterials.length, 'Order material count changed during resize');
  for (const material of sourceMaterials) {
    const matches = sizedMaterials.filter(candidate => candidate.name === material.name);
    assert.equal(matches.length, 1, 'Order materials require unique stable names');
    const target = matches[0];
    assert(material.occlusionTexture && target.occlusionTexture, 'Marked carved-order material requires AO');
    const sourceImage = imageIndex(source.json, material.occlusionTexture), targetImage = imageIndex(sized.json, target.occlusionTexture);
    const beforeImage = sized.json.images[targetImage], originalImage = source.json.images[sourceImage];
    assert.equal(beforeImage.mimeType, originalImage.mimeType, 'Resize must retain the AO image format');
    assertExclusiveAO(source.json, sourceImage, originalImage.bufferView);
    assertExclusiveAO(sized.json, targetImage, beforeImage.bufferView);
    const original = embeddedImage(source, sourceImage), before = embeddedImage(sized, targetImage);
    const originalMetadata = await sharp(original).metadata(), beforeMetadata = await sharp(before).metadata();
    assert.equal(originalMetadata.width, 4096, 'Dedicated order AO must be 4096 pixels wide');
    assert.equal(originalMetadata.height, 4096, 'Dedicated order AO must be 4096 pixels high');
    const existing = replacements.get(beforeImage.bufferView);
    if (existing) assert(existing.equals(original), 'A shared target AO image must resolve to one original atlas');
    else replacements.set(beforeImage.bufferView, original);
    changes.push({ material: material.name, imageIndex: targetImage, bufferView: beforeImage.bufferView,
      beforeSize: [beforeMetadata.width, beforeMetadata.height], restoredSize: [4096, 4096],
      sourceImageSha256: sha(original), beforeImageSha256: sha(before), sourceBytes: original.length, beforeBytes: before.length });
  }
  const modified = new Map([...replacements].filter(([index, bytes]) => !bytes.equals(viewBytes(sized, index))));
  let output = inputBytes;
  if (modified.size) {
    const json = structuredClone(sized.json), parts = []; let length = 0;
    json.bufferViews.forEach((view, index) => {
      assert.equal(view.buffer, 0); assert(!view.extensions, 'Uncompressed buffer views are required');
      const bytes = modified.get(index) || viewBytes(sized, index);
      view.byteOffset = length; view.byteLength = bytes.length; parts.push(bytes); length += bytes.length;
      const padding = (4 - length % 4) % 4; if (padding) { parts.push(Buffer.alloc(padding)); length += padding; }
    });
    json.buffers[0].byteLength = length;
    output = writeGlb(json, Buffer.concat(parts));
  }
  const result = readGlb(output);
  const expectedJson = structuredClone(sized.json);
  expectedJson.buffers[0].byteLength = result.json.buffers[0].byteLength;
  expectedJson.bufferViews.forEach((view, index) => {
    const offset = result.json.bufferViews[index].byteOffset;
    if (offset === undefined) delete view.byteOffset; else view.byteOffset = offset;
    if (modified.has(index)) view.byteLength = modified.get(index).length;
  });
  assert.deepEqual(result.json, expectedJson, 'Only selected AO view lengths and binary offsets may change');
  const unchangedViews = [];
  for (let i = 0; i < sized.json.bufferViews.length; i++) {
    const expected = replacements.get(i) || viewBytes(sized, i), actual = viewBytes(result, i);
    assert(actual.equals(expected), `Binary view ${i} changed unexpectedly`);
    if (!replacements.has(i)) unchangedViews.push({ index: i, sha256: sha(actual) });
  }
  assert.equal(result.json.images?.length, sized.json.images?.length, 'No duplicate images may be added');
  assert.equal(result.json.textures?.length, sized.json.textures?.length, 'No duplicate textures may be added');
  await mkdir(path.dirname(outputPath), { recursive: true }); await writeFile(outputPath, output);
  const report = { created: new Date().toISOString(), status: 'passed', helperSha256, selection: marker,
    source: { path: path.resolve(sourcePath), sha256: sha(sourceBytes) }, input: { path: path.resolve(sizedPath), sha256: sha(inputBytes) },
    output: { path: path.resolve(outputPath), sha256: sha(output) }, materials: changes, restoredImages: modified.size,
    imageCount: result.json.images?.length || 0, textureCount: result.json.textures?.length || 0,
    unchangedBinaryViews: unchangedViews.length, unchangedBinaryViewsSha256: sha(JSON.stringify(unchangedViews)),
    beforeBytes: inputBytes.length, afterBytes: output.length, verbatimInput: modified.size === 0,
    geometryUVNormalMaterialBindingsUnchanged: true, otherImagesUnchanged: true };
  if (reportPath) { await mkdir(path.dirname(reportPath), { recursive: true }); await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'); }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [source, sized, output, report] = process.argv.slice(2);
  assert(source && sized && output, 'Usage: preserve-order-ao.mjs GEOMETRY.glb SIZED.glb OUTPUT.glb [PROOF.json]');
  console.log(JSON.stringify(await preserveOrderAO(source, sized, output, report)));
}
