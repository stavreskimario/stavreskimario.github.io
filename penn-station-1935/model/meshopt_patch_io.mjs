// Scoped repairs to delivered Blender geometry; retain every untouched payload.
import { createRequire } from 'node:module';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
const requireTools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
export const { MeshoptDecoder, MeshoptEncoder } = requireTools('meshoptimizer');
await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready]);
export function parseGlb(bytes) {
  if (bytes[0] === 31 && bytes[1] === 139) bytes = gunzipSync(bytes);
  if (bytes.toString('ascii', 0, 4) !== 'glTF' || bytes.readUInt32LE(4) !== 2) throw new Error('Expected glTF2');
  const jsonLength = bytes.readUInt32LE(12); const start = jsonLength + 28;
  return { bytes, json: JSON.parse(bytes.toString('utf8', 20, 20 + jsonLength)), binary: bytes.subarray(start, start + bytes.readUInt32LE(start - 8)) };
}
export function decodeView(model, index) {
  const view = model.json.bufferViews[index]; const ext = view.extensions?.EXT_meshopt_compression;
  if (!ext || ext.buffer !== 0) throw new Error('Expected compressed real-buffer view');
  const decoded = new Uint8Array(ext.count * ext.byteStride);
  MeshoptDecoder.decodeGltfBuffer(decoded, ext.count, ext.byteStride,
    model.binary.subarray(ext.byteOffset || 0, (ext.byteOffset || 0) + ext.byteLength), ext.mode, ext.filter);
  return decoded;
}
export function writePatchedGlb(model, replacements = new Map()) {
  const json = structuredClone(model.json); const chunks = []; let size = 0;
  const ranges = new Map();
  const append = (bytes, key) => {
    if (ranges.has(key)) return ranges.get(key);
    const start = size; chunks.push(Buffer.from(bytes)); size += bytes.length;
    const padding = (4 - size % 4) % 4;
    if (padding) { chunks.push(Buffer.alloc(padding)); size += padding; }
    ranges.set(key, start); return start;
  };
  for (let index = 0; index < json.bufferViews.length; index++) {
    const view = json.bufferViews[index]; const ext = view.extensions?.EXT_meshopt_compression;
    if (ext?.buffer === 0) {
      const payload = replacements.get(index) || model.binary.subarray(ext.byteOffset || 0, (ext.byteOffset || 0) + ext.byteLength);
      ext.byteOffset = append(payload, `meshopt:${index}`); ext.byteLength = payload.length;
    }
    if (view.buffer === 0) {
      const payload = model.binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
      view.byteOffset = append(payload, `raw:${view.byteOffset || 0}:${view.byteLength}`);
    }
  }
  json.buffers[0].byteLength = size;
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 0x20)]);
  const binary = Buffer.concat(chunks); const bytes = Buffer.alloc(text.length + binary.length + 28);
  bytes.write('glTF', 0); bytes.writeUInt32LE(2, 4); bytes.writeUInt32LE(bytes.length, 8);
  bytes.writeUInt32LE(text.length, 12); bytes.writeUInt32LE(0x4e4f534a, 16); text.copy(bytes, 20);
  const offset = text.length + 20;
  bytes.writeUInt32LE(binary.length, offset); bytes.writeUInt32LE(0x004e4942, offset + 4); binary.copy(bytes, offset + 8);
  return bytes;
}
