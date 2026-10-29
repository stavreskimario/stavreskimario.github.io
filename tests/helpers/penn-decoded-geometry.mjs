// Independent test-side glTF triangle decoding. Raw and Meshopt views share the
// accessor contract; node/instance transforms are applied before support tests.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { decodeView } from '../../penn-station-1935/model/meshopt_patch_io.mjs';
const requireTools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
const { Matrix4, Quaternion, Vector3 } = requireTools('three');
const width = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const getter = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' };
const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

export function accessors(model) {
  const views = new Map(), readers = new Map();
  return index => {
    if (readers.has(index)) return readers.get(index);
    const a = model.json.accessors[index], view = model.json.bufferViews[a.bufferView];
    assert(!a.sparse, 'Sparse accessor requires an explicit test decoder extension');
    assert(view, 'Accessor has a buffer view');
    if (!views.has(a.bufferView)) {
      if (view.extensions?.EXT_meshopt_compression) views.set(a.bufferView, decodeView(model, a.bufferView));
      else {
        assert.equal(view.buffer ?? 0, 0, 'Raw GLB accessor uses its binary buffer');
        views.set(a.bufferView, model.binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength));
      }
    }
    const bytes = views.get(a.bufferView), data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const count = components[a.type], size = width[a.componentType], method = getter[a.componentType];
    assert(count && size && method, 'Supported scalar/vector accessor layout');
    const stride = view.byteStride || count * size;
    const divisor = a.normalized ? { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[a.componentType] : 1;
    assert(divisor, 'Normalized accessor has an integer normalization rule');
    const read = i => {
      assert(Number.isInteger(i) && i >= 0 && i < a.count, 'Accessor index is in bounds');
      return Array.from({ length: count }, (_, k) => {
        const value = data[method]((a.byteOffset || 0) + i * stride + k * size, true) / divisor;
        return a.normalized && [5120, 5122].includes(a.componentType) ? Math.max(-1, value) : value;
      });
    };
    readers.set(index, read); return read;
  };
}

function transform(node) {
  return node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
    new Vector3().fromArray(node.translation || [0, 0, 0]),
    new Quaternion().fromArray(node.rotation || [0, 0, 0, 1]),
    new Vector3().fromArray(node.scale || [1, 1, 1]));
}

export function worldNodes(json) {
  const result = [], seen = new Set(), children = new Set(json.nodes.flatMap(n => n.children || []));
  const roots = json.scenes?.[json.scene ?? 0]?.nodes || json.nodes.map((_, i) => i).filter(i => !children.has(i));
  function visit(index, parent) {
    assert(!seen.has(index), 'Active glTF node hierarchy is acyclic with one parent');
    assert(json.nodes[index], 'Child node exists'); seen.add(index);
    const matrix = parent.clone().multiply(transform(json.nodes[index]));
    result.push({ index, matrix });
    for (const child of json.nodes[index].children || []) visit(child, matrix);
  }
  for (const root of roots) visit(root, new Matrix4());
  return result;
}

export function* decodedTriangles(model, materialNames) {
  const read = accessors(model);
  for (const { index: nodeIndex, matrix } of worldNodes(model.json)) {
    const node = model.json.nodes[nodeIndex]; if (node.mesh === undefined) continue;
    const extension = node.extensions?.EXT_mesh_gpu_instancing;
    const instanceAttributes = extension?.attributes || {};
    const instanceCounts = Object.values(instanceAttributes).map(i => model.json.accessors[i].count);
    if (extension) assert(instanceCounts.length && instanceCounts.every(n => n === instanceCounts[0]), 'Instance accessors have one shared count');
    const count = extension ? instanceCounts[0] : 1;
    for (const [primitiveIndex, primitive] of model.json.meshes[node.mesh].primitives.entries()) {
      const material = model.json.materials?.[primitive.material]?.name;
      if (materialNames && !materialNames.has(material)) continue;
      assert.equal(primitive.mode ?? 4, 4, 'Authoritative floor geometry uses triangles');
      const position = read(primitive.attributes.POSITION);
      const index = primitive.indices === undefined ? i => [i] : read(primitive.indices);
      const indices = model.json.accessors[primitive.indices ?? primitive.attributes.POSITION].count;
      assert.equal(indices % 3, 0, 'Triangle primitive has complete triples');
      for (let instance = 0; instance < count; instance++) {
        const local = extension ? new Matrix4().compose(
          new Vector3().fromArray(instanceAttributes.TRANSLATION === undefined ? [0, 0, 0] : read(instanceAttributes.TRANSLATION)(instance)),
          new Quaternion().fromArray(instanceAttributes.ROTATION === undefined ? [0, 0, 0, 1] : read(instanceAttributes.ROTATION)(instance)),
          new Vector3().fromArray(instanceAttributes.SCALE === undefined ? [1, 1, 1] : read(instanceAttributes.SCALE)(instance))) : new Matrix4();
        const world = matrix.clone().multiply(local), order = world.determinant() < 0 ? [0, 2, 1] : [0, 1, 2];
        for (let offset = 0; offset < indices; offset += 3) {
          const triangle = order.map(k => new Vector3().fromArray(position(index(offset + k)[0])).applyMatrix4(world).toArray());
          yield { material, node: nodeIndex, primitive: primitiveIndex, instance, triangle };
        }
      }
    }
  }
}
