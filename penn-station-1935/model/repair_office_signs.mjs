// Repair only the four reversed office labels in an existing Meshopt delivery.
// A 180-degree rigid rotation changes their reading side without mirroring glyphs.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import assert from 'node:assert/strict';

const requireTools = createRequire(path.join(process.env.PENN_TOOLS, 'package.json'));
const { MeshoptDecoder, MeshoptEncoder } = requireTools('meshoptimizer');
const { Matrix4, Quaternion, Vector3, Matrix3 } = requireTools('three');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
const [input, output, receipt] = process.argv.slice(2);
assert(input && output && receipt, 'Usage: repair_office_signs.mjs input.glb[.gz] output.glb.gz audit.json');
const packed = await readFile(input);
const bytes = input.endsWith('.gz') ? gunzipSync(packed) : packed;
const json = JSON.parse(bytes.toString('utf8', 20, 20 + bytes.readUInt32LE(12)));
const oldJson = structuredClone(json);
const binaryStart = 28 + bytes.readUInt32LE(12);
const binary = bytes.subarray(binaryStart, binaryStart + bytes.readUInt32LE(binaryStart - 8));
const sha = data => createHash('sha256').update(data).digest('hex');
assert(new Set([
  '36f105ae657c2011c9f8317ce0f119bf8062013e3d3a990f2fad316f855138f0',
  'e88cd39806d085e75720f56618a4aacf216d6c31a46eeb6b01aa0f902a6eedad',
]).has(sha(bytes)), 'Use the frozen Phase3 waiting-room delivery; refuse changed inputs or a second rotation');
const changed = new Map();
function decoded(index) {
  const view = json.bufferViews[index], extension = view.extensions?.EXT_meshopt_compression;
  assert(extension && extension.buffer === 0, 'Only embedded Meshopt views supported');
  const data = new Uint8Array(extension.count * extension.byteStride);
  MeshoptDecoder.decodeGltfBuffer(data, extension.count, extension.byteStride,
    binary.subarray(extension.byteOffset, extension.byteOffset + extension.byteLength), extension.mode, extension.filter);
  return data;
}
function attribute(index) {
  const accessor = json.accessors[index], view = json.bufferViews[accessor.bufferView];
  const data = decoded(accessor.bufferView), values = new DataView(data.buffer);
  const size = { 5120: 1, 5122: 2 }[accessor.componentType];
  assert(size && accessor.type === 'VEC3' && accessor.normalized, 'Expected normalized signed quantization');
  const maximum = size === 1 ? 127 : 32767;
  const stride = view.byteStride || size * 3, offset = accessor.byteOffset || 0;
  const read = n => size === 1 ? values.getInt8(n) : values.getInt16(n, true);
  const write = (n, value) => size === 1 ? values.setInt8(n, value) : values.setInt16(n, value, true);
  return { accessor, view, data, get(i) { return new Vector3(...[0, 1, 2].map(c => Math.max(-1, read(offset + i * stride + c * size) / maximum))); },
    set(i, point) { [point.x, point.y, point.z].forEach((v, c) => { assert(Math.abs(v) <= 1.0001); write(offset + i * stride + c * size, Math.max(-maximum, Math.min(maximum, Math.round(v * maximum)))); }); } };
}
const node = json.nodes.find(n => n.name === 'Opening-era office lettering');
assert(node && node.mesh !== undefined, 'Exact office-lettering batch must exist');
const primitive = json.meshes[node.mesh].primitives[0];
assert.equal(json.materials[primitive.material].name, 'Lettering');
const positions = attribute(primitive.attributes.POSITION), normals = attribute(primitive.attributes.NORMAL);
const matrix = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
  new Vector3().fromArray(node.translation || [0, 0, 0]),
  new Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
  new Vector3().fromArray(node.scale || [1, 1, 1]));
const inverse = matrix.clone().invert(), normalMatrix = new Matrix3().getNormalMatrix(matrix), inverseNormal = normalMatrix.clone().invert();
const anchors = [-1, 1].flatMap(side => [-28.144, 28.144].map(z => ({ x: side * 15.51, z, vertices: 0, frontNormals: 0 })));
const selected = new Set();
for (let i = 0; i < positions.accessor.count; i++) {
  const p = positions.get(i).applyMatrix4(matrix);
  if (p.y < 3.66 || p.y > 4.1) continue;
  const anchor = anchors.find(a => Math.abs(p.x - a.x) < .025 && Math.abs(p.z - a.z) < 4.5);
  if (!anchor) continue;
  const normal = normals.get(i).applyMatrix3(normalMatrix).normalize();
  if (Math.abs(normal.x) > .8) {
    // Existing forward-facing glyph surface incorrectly points away from hall.
    if (normal.x * anchor.x > 0) anchor.frontNormals++;
  }
  p.x = 2 * anchor.x - p.x; p.z = 2 * anchor.z - p.z;
  positions.set(i, p.applyMatrix4(inverse));
  normal.x *= -1; normal.z *= -1;
  normals.set(i, normal.applyMatrix3(inverseNormal).normalize());
  anchor.vertices++; selected.add(i);
}
for (const anchor of anchors) assert(anchor.vertices > 100 && anchor.frontNormals > 10, 'Every source label must have outward faces before repair');
// Ensure no triangle crosses the selection boundary: booth interiors stay intact.
const ia = json.accessors[primitive.indices], idata = decoded(ia.bufferView), iview = new DataView(idata.buffer);
const isize = ia.componentType === 5123 ? 2 : 4;
for (let i = 0; i < ia.count; i += 3) {
  const count = [0, 1, 2].filter(k => selected.has(isize === 2 ? iview.getUint16((ia.byteOffset || 0) + (i + k) * isize, true) : iview.getUint32((ia.byteOffset || 0) + (i + k) * isize, true))).length;
  assert(count === 0 || count === 3, 'Selection must contain whole glyph triangles');
}
for (const a of [positions, normals]) {
  const index = a.accessor.bufferView, extension = json.bufferViews[index].extensions.EXT_meshopt_compression;
  assert.equal(extension.mode, 'ATTRIBUTES');
  // OCTAHEDRAL decoding already produced normalized signed vectors. Re-encode
  // those vectors without a filter, retaining the same accessor representation.
  const encoded = MeshoptEncoder.encodeVertexBuffer(a.data, extension.count, extension.byteStride);
  delete extension.filter;
  changed.set(index, Buffer.from(encoded));
}
// Preserve every untouched compressed buffer view byte-for-byte.
const pieces = []; let length = 0;
for (let index = 0; index < json.bufferViews.length; index++) {
  const view = json.bufferViews[index], extension = view.extensions?.EXT_meshopt_compression;
  if (!extension) { assert(view.buffer !== 0, 'Unexpected uncompressed embedded view'); continue; }
  const old = oldJson.bufferViews[index].extensions.EXT_meshopt_compression;
  const data = changed.get(index) || binary.subarray(old.byteOffset, old.byteOffset + old.byteLength);
  extension.byteOffset = length; extension.byteLength = data.length;
  pieces.push(data); length += data.length;
  const padding = (4 - length % 4) % 4; if (padding) { pieces.push(Buffer.alloc(padding)); length += padding; }
}
json.buffers[0].byteLength = length;
const text = Buffer.from(JSON.stringify(json)), textPad = Buffer.alloc((4 - text.length % 4) % 4, 32);
const body = Buffer.concat(pieces), header = Buffer.alloc(20), chunk = Buffer.alloc(8);
header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(28 + text.length + textPad.length + body.length, 8);
header.writeUInt32LE(text.length + textPad.length, 12); header.writeUInt32LE(0x4e4f534a, 16);
chunk.writeUInt32LE(body.length); chunk.writeUInt32LE(0x004e4942, 4);
const result = Buffer.concat([header, text, textPad, chunk, body]);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, gzipSync(result, { level: 9 }));
const audit = { sourceSha256: sha(bytes), decodedSha256: sha(result), labels: anchors, changedBufferViews: [...changed.keys()],
  operation: '180 degree vertical-axis rotation of four office-label glyph meshes about their original anchors',
  unchanged: 'All other compressed geometry views, UVs, indices, material properties and lighting metadata; no sign wording or placement changes',
  limitation: 'Existing static lighting and reflection captures predate this small unbaked lettering correction' };
await writeFile(receipt, JSON.stringify(audit, null, 2) + '\n');
console.log(JSON.stringify(audit));
