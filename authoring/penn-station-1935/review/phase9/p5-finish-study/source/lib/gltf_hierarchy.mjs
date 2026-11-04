// Complete active glTF hierarchy shared by derived asset packaging and decoded geometry checks.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
const requireTools=createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools','package.json'));
const {Matrix4,Quaternion,Vector3}=requireTools('three');

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

