// Move complete interpreted indicator assemblies onto supported stair flanks.
// The documented16ft order and paired configuration are preserved. Exact
// placement is a reconstruction; this repair clears the physical east aisle.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { parseGlb, decodeView, writePatchedGlb, MeshoptEncoder } from './meshopt_patch_io.mjs';
const requireTools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
const THREE = requireTools('three');
const [input, output] = process.argv.slice(2);
if (!input || !output || path.resolve(input) === path.resolve(output)) throw new Error('Pass separate input GLB[.gz] and output GLB paths');
const model = parseGlb(await readFile(input)); const oldJson = structuredClone(model.json);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const centres = [68.764528, 54.791453, 40.818378, 27.149065, 13.327870, -.341443, -13.555112, -27.224425, -40.321460];
const head = -42.2563; const oldX = head + .40; const newX = head - .70;
const slots = centres.flatMap(centreZ => [-1, 1].map(side => ({ centreZ, side, oldZ: centreZ + side * 1.95, newZ: centreZ + side * 2.15 })));
const report = { schemaVersion: 1, created: new Date().toISOString(), input: path.basename(input), inputSha256: sha(model.bytes),
  reason: 'The reconstructed indicator placement obstructed the actual eastern walking aisle; whole assemblies now stand on solid floor beside each stair fence',
  qualification: 'Two16ft cast-iron indicators per gate are documented by Gibbs266. Their exact placement is reconstructed, not a surveyed historic dimension.',
  oldX, newX, oldTransverseOffset: 1.95, newTransverseOffset: 2.15, primitives: [], preservedPayloads: [],
  lighting: 'Original Phase3 baked light and static reflection captures retained; their original source hashes are not rewritten. Post translation is unbaked local geometry.' };
const replacements = new Map();
for (const node of model.json.nodes) {
  if (node.mesh === undefined || node.matrix || node.children) continue;
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...(node.translation || [0, 0, 0])),
    new THREE.Quaternion(...(node.rotation || [0, 0, 0, 1])), new THREE.Vector3(...(node.scale || [1, 1, 1])));
  const inverse = matrix.clone().invert();
  for (const primitive of model.json.meshes[node.mesh].primitives) {
    const material = model.json.materials[primitive.material]?.name;
    if (!['PaintedStructuralIron', 'ClockFace'].includes(material)) continue;
    const accessorIndex = primitive.attributes.POSITION; const accessor = model.json.accessors[accessorIndex];
    if (accessor.componentType !== 5122 || !accessor.normalized) throw new Error('Expected quantized signed-short positions');
    const view = model.json.bufferViews[accessor.bufferView]; const ext = view.extensions?.EXT_meshopt_compression;
    if (ext.mode !== 'ATTRIBUTES' || (ext.filter && ext.filter !== 'NONE')) throw new Error('Unexpected position filter');
    const bytes = decodeView(model, accessor.bufferView); const beforeSha = sha(bytes); const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    // These batches' original longitudinal quantization frames end at their
    // outermost gates. Their200mm outward move exceeds those frames. A float
    // POSITION view preserves the node transform and avoids
    // rescaling or re-quantizing the rest of this batch. UVs/normals stay exact.
    const floatPositions = new Float32Array(accessor.count * 3);
    if (floatPositions) for (let i = 0; i < accessor.count; i++) for (let k = 0; k < 3; k++)
      floatPositions[i * 3 + k] = data.getInt16((accessor.byteOffset || 0) + i * ext.byteStride + k * 2, true) / 32767;
    const tags = new Int16Array(accessor.count); tags.fill(-1);
    for (let i = 0; i < accessor.count; i++) {
      const at = (accessor.byteOffset || 0) + i * ext.byteStride;
      const point = new THREE.Vector3(...[0, 1, 2].map(k => data.getInt16(at + k * 2, true) / 32767)).applyMatrix4(matrix);
      if (Math.abs(point.x - oldX) > .337 || point.y < -.008 || point.y > 4.89) continue;
      const slot = slots.findIndex(value => Math.abs(point.z - value.oldZ) <= .337);
      if (slot < 0) continue;
      tags[i] = slot;
    }
    const indices = model.json.accessors[primitive.indices];
    const indexBytes = decodeView(model, indices.bufferView); const indexData = new DataView(indexBytes.buffer, indexBytes.byteOffset, indexBytes.byteLength);
    const size = indices.componentType === 5123 ? 2 : indices.componentType === 5125 ? 4 : 0;
    if (!size) throw new Error('Unexpected triangle index type');
    const read = index => indexData[size === 2 ? 'getUint16' : 'getUint32']((indices.byteOffset || 0) + index * size, true);
    // A bounding box alone can also touch a nearby structural beam. Select
    // only WHOLE connected components fully contained in a post's bounds.
    // Weld positional duplicates for this classification, including seams
    // whose normals/UVs required separate glTF vertices. Delivered indices
    // remain unchanged.
    const parents = Uint32Array.from({ length: accessor.count }, (_, i) => i);
    const find = i => { while (parents[i] !== i) { parents[i] = parents[parents[i]]; i = parents[i]; } return i; };
    const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parents[b] = a; };
    for (let i = 0; i < indices.count; i += 3) { union(read(i), read(i + 1)); union(read(i), read(i + 2)); }
    const coincident = new Map();
    for (let i = 0; i < accessor.count; i++) {
      const at = (accessor.byteOffset || 0) + i * ext.byteStride;
      const key = [0, 1, 2].map(k => data.getInt16(at + k * 2, true)).join(',');
      if (coincident.has(key)) union(i, coincident.get(key)); else coincident.set(key, i);
    }
    const componentSlots = new Map();
    for (let i = 0; i < accessor.count; i++) {
      const root = find(i), tag = tags[i];
      if (!componentSlots.has(root)) componentSlots.set(root, tag);
      else if (componentSlots.get(root) !== tag) componentSlots.set(root, -1);
    }
    const chosen = new Set(); const counts = Array(slots.length).fill(0);
    for (let i = 0; i < accessor.count; i++) {
      const slot = componentSlots.get(find(i)); if (slot < 0) continue;
      const at = (accessor.byteOffset || 0) + i * ext.byteStride;
      const point = new THREE.Vector3(...[0, 1, 2].map(k => data.getInt16(at + k * 2, true) / 32767)).applyMatrix4(matrix);
      point.x += newX - oldX; point.z += slots[slot].newZ - slots[slot].oldZ; point.applyMatrix4(inverse);
      for (let k = 0; k < 3; k++) floatPositions[i * 3 + k] = point.getComponent(k);
      chosen.add(i); counts[slot]++;
    }
    if (!chosen.size || counts.some(count => count < 10)) throw new Error(`Expected all18 complete${material} assemblies`);
    for (let i = 0; i < indices.count; i += 3) {
      const moved = [0, 1, 2].filter(j => chosen.has(read(i + j))).length;
      if (moved !== 0 && moved !== 3) {
        const points = [0, 1, 2].map(j => {
          const index = read(i + j), at = (accessor.byteOffset || 0) + index * ext.byteStride;
          return { index, chosen: chosen.has(index), world: new THREE.Vector3(...[0, 1, 2].map(k => data.getInt16(at + k * 2, true) / 32767)).applyMatrix4(matrix).toArray() };
        });
        throw new Error(`Assembly bounds split ${material} triangle${i}: ${JSON.stringify(points)}`);
      }
    }
    let maximumUnmovedPositionErrorMetres = 0;
    const matrixElements = matrix.elements;
    for (let i = 0; i < accessor.count; i++) if (!chosen.has(i)) {
      const at = (accessor.byteOffset || 0) + i * ext.byteStride;
      const delta = [0, 1, 2].map(k => floatPositions[i * 3 + k] - data.getInt16(at + k * 2, true) / 32767);
      const worldError = [0, 1, 2].map(k => matrixElements[k] * delta[0] + matrixElements[4 + k] * delta[1] + matrixElements[8 + k] * delta[2]);
      maximumUnmovedPositionErrorMetres = Math.max(maximumUnmovedPositionErrorMetres, Math.hypot(...worldError));
    }
    let outputBytes = bytes;
    if (floatPositions) {
      if (model.json.accessors.filter(value => value.bufferView === accessor.bufferView).length !== 1) throw new Error('Unexpected shared white position view');
      outputBytes = new Uint8Array(floatPositions.buffer);
      accessor.componentType = 5126; accessor.normalized = false; accessor.byteOffset = 0;
      view.byteStride = 12; view.byteLength = outputBytes.length;
      view.byteOffset = (model.json.buffers[view.buffer].byteLength + 3) & ~3;
      model.json.buffers[view.buffer].byteLength = view.byteOffset + view.byteLength;
      ext.byteStride = 12;
    }
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < accessor.count; i++) for (let k = 0; k < 3; k++) {
      const value = floatPositions ? floatPositions[i * 3 + k] : data.getInt16((accessor.byteOffset || 0) + i * ext.byteStride + k * 2, true);
      min[k] = Math.min(min[k], value); max[k] = Math.max(max[k], value);
    }
    accessor.min = min; accessor.max = max;
    replacements.set(accessor.bufferView, MeshoptEncoder.encodeVertexBuffer(outputBytes, ext.count, ext.byteStride));
    report.primitives.push({ material, positionAccessor: accessorIndex, view: accessor.bufferView, movedVertices: chosen.size,
      sourceDecodedSha256: beforeSha, revisedDecodedSha256: sha(outputBytes), allTrianglesMovedWhole: true,
      maximumUnmovedPositionErrorMetres,
      positionStorage: floatPositions ? 'Float32 within the original node transform; original normalized-short coordinates rounded once to Float32' : 'Original normalized signed-short quantization',
      slots: slots.map((slot, index) => ({ ...slot, movedVertices: counts[index] })) });
  }
}
if (replacements.size !== 2) throw new Error('Expected exactly iron and white/lettering position views');
if (JSON.stringify(model.json.materials) !== JSON.stringify(oldJson.materials)) throw new Error('Material metadata changed');
const result = writePatchedGlb(model, replacements); const check = parseGlb(result);
for (let i = 0; i < oldJson.bufferViews.length; i++) {
  const a = oldJson.bufferViews[i].extensions?.EXT_meshopt_compression;
  const b = check.json.bufferViews[i].extensions?.EXT_meshopt_compression;
  if (!a || a.buffer !== 0) continue;
  if (replacements.has(i)) {
    const expected = report.primitives.find(item => item.view === i).revisedDecodedSha256;
    if (sha(decodeView(check, i)) !== expected) throw new Error('Changed positions failed exact Meshopt roundtrip');
  } else {
    const original = model.binary.subarray(a.byteOffset || 0, (a.byteOffset || 0) + a.byteLength);
    const after = check.binary.subarray(b.byteOffset || 0, (b.byteOffset || 0) + b.byteLength);
    if (!original.equals(after)) throw new Error(`Unrelated payload${i} changed`);
    report.preservedPayloads.push({ view: i, sha256: sha(original) });
  }
}
report.outputSha256 = sha(result); report.outputBytes = result.length;
await mkdir(path.dirname(path.resolve(output)), { recursive: true });
await writeFile(output, result); await writeFile(output.replace(/\.glb$/, '-gate-repair.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, sha256: report.outputSha256, primitives: report.primitives.map(({ material, movedVertices }) => ({ material, movedVertices })) }));
