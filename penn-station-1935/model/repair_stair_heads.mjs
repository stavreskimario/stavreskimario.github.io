// Repair the authored floor-to-tread seam in a delivered, compressed GLB.
// Only the affected POSITION view is re-encoded. Atlas UVs, normals, indices,
// materials and every other compressed view retain their original bytes.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
const requireTools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
const { MeshoptDecoder, MeshoptEncoder } = requireTools('meshoptimizer');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Pass input GLB[.gz] and separate output GLB paths');
if (path.resolve(input) === path.resolve(output)) throw new Error('Preserve the input asset');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
let source = await readFile(input);
if (input.endsWith('.gz')) source = gunzipSync(source);
if (source.toString('ascii', 0, 4) !== 'glTF') throw new Error('Expected a glTF2 GLB');
const jsonLength = source.readUInt32LE(12);
const json = JSON.parse(source.toString('utf8', 20, 20 + jsonLength));
const binaryStart = 28 + jsonLength;
const binary = source.subarray(binaryStart, binaryStart + source.readUInt32LE(binaryStart - 8));
const oldJson = structuredClone(json);
const head = -42.2563;
const previousBoundary = head + .12;
const report = { schemaVersion: 1, created: new Date().toISOString(), input: path.basename(input), inputSha256: sha(source),
  correction: 'Close the unsupported118mm floor-to-first-tread slot at all nine main-concourse stair heads',
  stairHeadX: head, previousOpeningEdgeX: previousBoundary, revisedOpeningEdgeX: head,
  positions: [], changedViews: [], unchangedViewHashes: [],
  retainedLighting: 'Original Phase3 bakes and reflection captures retained. Their source hashes are unchanged; this local120mm floor extension postdates those captures.' };
const changedViews = new Map();
const decoded = new Map();
function decode(viewIndex) {
  if (decoded.has(viewIndex)) return decoded.get(viewIndex);
  const view = json.bufferViews[viewIndex];
  const ext = view.extensions?.EXT_meshopt_compression;
  if (!ext || ext.mode !== 'ATTRIBUTES' || (ext.filter && ext.filter !== 'NONE')) throw new Error('Expected unfiltered Meshopt attribute data');
  const bytes = new Uint8Array(ext.count * ext.byteStride);
  MeshoptDecoder.decodeGltfBuffer(bytes, ext.count, ext.byteStride,
    binary.subarray(ext.byteOffset || 0, (ext.byteOffset || 0) + ext.byteLength), ext.mode, ext.filter);
  decoded.set(viewIndex, bytes); return bytes;
}
for (const node of json.nodes || []) {
  if (node.mesh === undefined) continue;
  if (node.rotation || node.matrix || node.children) continue;
  const scale = node.scale || [1, 1, 1]; const translation = node.translation || [0, 0, 0];
  for (const primitive of json.meshes[node.mesh].primitives) {
    if (json.materials[primitive.material]?.name !== 'PublicFloorMarble') continue;
    const position = json.accessors[primitive.attributes.POSITION];
    if (position.componentType !== 5122 || !position.normalized) throw new Error('Expected signed-short normalized floor positions');
    const view = json.bufferViews[position.bufferView]; const ext = view.extensions.EXT_meshopt_compression;
    const bytes = decode(position.bufferView); const originalPositionSha = sha(bytes);
    const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let changed = 0;
    for (let i = 0; i < position.count; i++) {
      const at = (position.byteOffset || 0) + i * ext.byteStride;
      const x = data.getInt16(at, true) / 32767 * scale[0] + translation[0];
      const y = data.getInt16(at + 2, true) / 32767 * scale[1] + translation[1];
      const z = data.getInt16(at + 4, true) / 32767 * scale[2] + translation[2];
      // Main slabs are300/440mm deep; the axial-passage slab is200mm.
      // The separate exit slab is atY=-3.2004 and is deliberately excluded.
      if (Math.abs(x - previousBoundary) > .006 || y < -.445 || y > .006) continue;
      const quantized = Math.round((head - translation[0]) / scale[0] * 32767);
      data.setInt16(at, quantized, true);
      report.positions.push({ vertex: i, before: [x, y, z], afterX: quantized / 32767 * scale[0] + translation[0] });
      changed++;
    }
    if (!changed) throw new Error('The expected floor boundary is missing; refuse an unscoped patch');
    changedViews.set(position.bufferView, { bytes, count: ext.count, stride: ext.byteStride });
    report.changedViews.push({ view: position.bufferView, accessor: primitive.attributes.POSITION, changedVertices: changed,
      sourceDecodedSha256: originalPositionSha, revisedDecodedSha256: sha(bytes) });
  }
}
if (changedViews.size !== 1) throw new Error(`Expected exactly one floor position view, got${changedViews.size}`);
// Repack real BIN ranges. Unchanged Meshopt payloads are copied byte-for-byte.
const chunks = []; let size = 0; const ranges = new Map();
function append(bytes, key) {
  if (ranges.has(key)) return ranges.get(key);
  const start = size; chunks.push(Buffer.from(bytes)); size += bytes.length;
  const padding = (4 - size % 4) % 4;
  if (padding) { chunks.push(Buffer.alloc(padding)); size += padding; }
  ranges.set(key, start); return start;
}
for (let index = 0; index < json.bufferViews.length; index++) {
  const view = json.bufferViews[index]; const ext = view.extensions?.EXT_meshopt_compression;
  if (ext?.buffer === 0) {
    const original = binary.subarray(ext.byteOffset || 0, (ext.byteOffset || 0) + ext.byteLength);
    let payload = original;
    if (changedViews.has(index)) {
      const value = changedViews.get(index); payload = MeshoptEncoder.encodeVertexBuffer(value.bytes, value.count, value.stride);
    } else report.unchangedViewHashes.push({ index, sha256: sha(original), bytes: original.length });
    ext.byteOffset = append(payload, `meshopt:${index}`); ext.byteLength = payload.length;
  }
  if (view.buffer === 0) {
    const original = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    view.byteOffset = append(original, `raw:${view.byteOffset || 0}:${view.byteLength}`);
  }
}
json.buffers[0].byteLength = size;
// A position-only seam change must not rewrite any authored surface metadata.
if (JSON.stringify(json.materials) !== JSON.stringify(oldJson.materials) || JSON.stringify(json.accessors) !== JSON.stringify(oldJson.accessors)) throw new Error('Unexpected material/accessor metadata mutation');
let text = Buffer.from(JSON.stringify(json));
text = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 0x20)]);
const bin = Buffer.concat(chunks); const result = Buffer.alloc(28 + text.length + bin.length);
result.write('glTF', 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
result.writeUInt32LE(text.length, 12); result.writeUInt32LE(0x4e4f534a, 16); text.copy(result, 20);
const offset = text.length + 20; result.writeUInt32LE(bin.length, offset); result.writeUInt32LE(0x004e4942, offset + 4); bin.copy(result, offset + 8);
for (let i = 0; i < json.bufferViews.length; i++) {
  const before = oldJson.bufferViews[i].extensions?.EXT_meshopt_compression;
  const after = json.bufferViews[i].extensions?.EXT_meshopt_compression;
  if (!before || before.buffer !== 0) continue;
  const payload = bin.subarray(after.byteOffset || 0, (after.byteOffset || 0) + after.byteLength);
  if (changedViews.has(i)) {
    const decodedCheck = new Uint8Array(after.count * after.byteStride);
    MeshoptDecoder.decodeGltfBuffer(decodedCheck, after.count, after.byteStride, payload, after.mode, after.filter);
    if (!Buffer.from(decodedCheck).equals(Buffer.from(changedViews.get(i).bytes))) throw new Error('Position repair failed exact Meshopt roundtrip');
  } else {
    const original = binary.subarray(before.byteOffset || 0, (before.byteOffset || 0) + before.byteLength);
    if (!payload.equals(original)) throw new Error(`Unrelated compressed view${i} changed`);
  }
}
report.unchangedCompressedPayloadsVerified = report.unchangedViewHashes.length;
report.repairedPositionsExactRoundtrip = true;
report.outputSha256 = sha(result); report.outputBytes = result.length;
await mkdir(path.dirname(path.resolve(output)), { recursive: true });
await writeFile(output, result); await writeFile(output.replace(/\.glb$/, '-stair-repair.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, changedVertices: report.positions.length, changedViews: report.changedViews, sha256: report.outputSha256 }));
