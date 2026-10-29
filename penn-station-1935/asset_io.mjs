import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const ktx = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'))('ktx-parse');

export function canonicalKtx(bytes) {
  const container = ktx.read(bytes);
  // The compressor records its available worker count. It changes between
  // builds even when every encoded mip block is identical, defeating sharing.
  // Remove this build-only metadata; preserve format and all compressed levels.
  delete container.keyValue.KTXwriterScParams;
  const encoded = Buffer.from(ktx.write(container));
  const check = ktx.read(encoded);
  if (!container.levels.every((level, index) => Buffer.from(level.levelData).equals(Buffer.from(check.levels[index].levelData)))) throw new Error('KTX canonicalisation changed encoded pixels');
  return encoded;
}

export function readGlb(buffer) {
  if (buffer.toString('ascii', 0, 4) !== 'glTF' || buffer.readUInt32LE(4) !== 2) throw new Error('Expected glTF 2.0 binary');
  const jsonLength = buffer.readUInt32LE(12);
  const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength));
  const binaryOffset = 20 + jsonLength;
  if (buffer.readUInt32LE(binaryOffset + 4) !== 0x004e4942) throw new Error('Expected embedded BIN chunk');
  const binary = buffer.subarray(binaryOffset + 8, binaryOffset + 8 + buffer.readUInt32LE(binaryOffset));
  return { json, binary };
}

export function writeGlb(json, binary) {
  let text = Buffer.from(JSON.stringify(json));
  text = Buffer.concat([text, Buffer.alloc((4 - text.length % 4) % 4, 0x20)]);
  const data = Buffer.concat([binary, Buffer.alloc((4 - binary.length % 4) % 4)]);
  const result = Buffer.alloc(12 + 8 + text.length + 8 + data.length);
  result.write('glTF', 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(text.length, 12); result.writeUInt32LE(0x4e4f534a, 16); text.copy(result, 20);
  const offset = 20 + text.length;
  result.writeUInt32LE(data.length, offset); result.writeUInt32LE(0x004e4942, offset + 4); data.copy(result, offset + 8);
  return result;
}

// Keep repeated PBR maps outside the GLBs so different rooms and material
// instances share one compressed image download and one cached GPU texture.
// Meshopt's virtual fallback buffer is preserved; only real BIN ranges move.
export async function shareGlbTextures(buffer, out) {
  const { json, binary } = readGlb(buffer);
  const removed = new Set(); const files = [];
  await mkdir(path.join(out, 'textures'), { recursive: true });
  for (const texture of json.images || []) {
    if (texture.bufferView === undefined) continue;
    const view = json.bufferViews[texture.bufferView];
    if (view.buffer !== 0) throw new Error('Image must be stored in the real binary buffer');
    let encoded = binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength);
    if (texture.mimeType === 'image/ktx2') encoded = canonicalKtx(encoded);
    const hash = createHash('sha256').update(encoded).digest('hex').slice(0, 20);
    const extension = ({ 'image/ktx2': 'ktx2', 'image/png': 'png', 'image/jpeg': 'jpg' })[texture.mimeType];
    if (!extension) throw new Error(`Unsupported image type: ${texture.mimeType}`);
    const uri = `textures/${hash}.${extension}`;
    await writeFile(path.join(out, uri), encoded);
    files.push({ uri, bytes: encoded.length });
    removed.add(texture.bufferView); delete texture.bufferView; texture.uri = uri;
  }
  const remap = new Map(); const views = [];
  json.bufferViews.forEach((view, index) => { if (!removed.has(index)) { remap.set(index, views.length); views.push(view); } });
  const chunks = []; let length = 0; const copied = new Map();
  const copyRange = (offset, size) => {
    const key = `${offset}:${size}`;
    if (copied.has(key)) return copied.get(key);
    const start = length; const bytes = binary.subarray(offset, offset + size);
    if (bytes.length !== size) throw new Error('Binary view exceeds its buffer');
    chunks.push(bytes); length += size;
    const padding = (4 - length % 4) % 4; if (padding) { chunks.push(Buffer.alloc(padding)); length += padding; }
    copied.set(key, start); return start;
  };
  for (const view of views) {
    if (view.buffer === 0) view.byteOffset = copyRange(view.byteOffset || 0, view.byteLength);
    const compressed = view.extensions?.EXT_meshopt_compression;
    if (compressed?.buffer === 0) compressed.byteOffset = copyRange(compressed.byteOffset || 0, compressed.byteLength);
  }
  const replace = (object, key) => {
    if (object?.[key] !== undefined) {
      if (!remap.has(object[key])) throw new Error('Removed an image view that is also referenced as geometry');
      object[key] = remap.get(object[key]);
    }
  };
  for (const accessor of json.accessors || []) {
    replace(accessor, 'bufferView'); replace(accessor.sparse?.indices, 'bufferView'); replace(accessor.sparse?.values, 'bufferView');
  }
  for (const mesh of json.meshes || []) for (const primitive of mesh.primitives) replace(primitive.extensions?.KHR_draco_mesh_compression, 'bufferView');
  json.bufferViews = views; json.buffers[0].byteLength = length;
  return { buffer: writeGlb(json, Buffer.concat(chunks)), textures: files };
}
