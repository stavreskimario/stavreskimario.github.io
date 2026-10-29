// Merge independently baked partitions without changing their atlas UVs.
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const requireTools = createRequire(path.join(process.env.PENN_TOOLS, 'package.json'));
const { Document, NodeIO } = requireTools('@gltf-transform/core');
const { ALL_EXTENSIONS } = requireTools('@gltf-transform/extensions');
const { mergeDocuments, unpartition, getBounds } = requireTools('@gltf-transform/functions');
const [directory, denoisedDirectory] = process.argv.slice(2);
assert(directory && denoisedDirectory, 'Pass the baked and denoised directories');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const output = new Document();
const scene = output.createScene('Waiting room with separate ceiling, masonry and carved-order illumination');
output.getRoot().setDefaultScene(scene);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const fingerprint = document => document.getRoot().listMeshes().flatMap(mesh => mesh.listPrimitives().map(primitive => ({
  material: primitive.getMaterial()?.getName(),
  sky: primitive.getMaterial()?.getExtras().sky_illumination || null,
  indices: primitive.getIndices() ? sha(primitive.getIndices().getArray()) : null,
  attributes: Object.fromEntries(primitive.listSemantics().map(semantic => [semantic, sha(primitive.getAttribute(semantic).getArray())])),
}))).map(value => JSON.stringify(value)).sort();
const expected = [], inputs = [], bakes = [], atlases = [];
for (const partition of ['vault', 'masonry', 'order']) {
  const zone = `waiting-room-${partition}`;
  const filename = `model-${zone}.glb`, bytes = await readFile(path.join(directory, filename));
  const document = await io.readBinary(new Uint8Array(bytes));
  expected.push(...fingerprint(document));
  const map = mergeDocuments(output, document);
  for (const inputScene of document.getRoot().listScenes()) {
    for (const inputNode of inputScene.listChildren()) scene.addChild(map.get(inputNode));
    map.get(inputScene).dispose();
  }
  const bake = JSON.parse(await readFile(path.join(directory, `lighting-${zone}.json`), 'utf8'));
  assert.equal(bake.surfaceGroup, partition);
  bakes.push(bake);
  const reportName = `lighting-${zone}-denoise.json`;
  const denoise = JSON.parse(await readFile(path.join(denoisedDirectory, reportName), 'utf8'));
  assert.equal(denoise.zone, zone); assert.equal(denoise.inputTransfer, 'linear');
  assert.equal(denoise.constant018Test.passed, true);
  atlases.push({ zone, report: reportName });
  inputs.push({ file: filename, sha256: sha(bytes), sourceSha256: bake.sourceSha256 });
}
assert.equal(new Set(bakes.map(bake => bake.sourceSha256)).size, 1, 'All partitions use the same frozen final raw geometry');
await output.transform(unpartition());
const target = path.join(directory, 'model-waiting-room.glb');
const bytes = Buffer.from(await io.writeBinary(output));
const decoded = await io.readBinary(new Uint8Array(bytes));
assert.deepEqual(fingerprint(decoded), expected.sort(), 'Merged vertex, index, UV, material and atlas bindings are exact');
assert.equal(decoded.getRoot().listScenes().length, 1);
const report = { zone: 'waiting-room', schemaVersion: 3, purpose: 'Separate high-resolution ceiling, masonry and carved-order atlases',
  sources: inputs, unchangedPrimitiveBuffersAndAtlasBindings: true, bounds: getBounds(decoded.getRoot().listScenes()[0]),
  atlases: bakes.map(bake => ({ zone: bake.zone, report: `lighting-${bake.zone}.json`, resolution: bake.resolution, samples: bake.samples })),
  outputSha256: sha(bytes) };
await writeFile(target, bytes);
await writeFile(path.join(directory, 'lighting-waiting-room.json'), JSON.stringify(report, null, 2) + '\n');
await writeFile(path.join(denoisedDirectory, 'lighting-waiting-room-denoise.json'), JSON.stringify({ schemaVersion: 3, zone: 'waiting-room', atlases,
  note: 'Each child report preserves its own source HDR hash, linear transfer control, source-resolution HDR and delivered derivatives.' }, null, 2) + '\n');
console.log(JSON.stringify(report));
