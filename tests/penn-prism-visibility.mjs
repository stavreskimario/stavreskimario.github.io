// Actual full/fallback prism matrices and geometry. No keyboard/walkthrough.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { parseGlb } from '../penn-station-1935/model/meshopt_patch_io.mjs';
import { accessors, worldNodes } from './helpers/penn-decoded-geometry.mjs';
import { preparePrismVisibility, createPrismVisibility, staticInstanceCount, staticInstanceMatrix } from '../penn-station-1935/src/prism-visibility.mjs';
const requireTools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
const THREE = requireTools('three');
const names = new Set(['SquareVaultLightGlass', 'ConcourseReinforcedVaultLightConcrete']);
const matrix = new THREE.Matrix4();
function inventory(scene) {
  const rows = [];
  scene.updateMatrixWorld(true);
  scene.traverse(mesh => {
    if (!mesh.isInstancedMesh || mesh.userData.prismShadowOnly) return;
    for (let i = 0; i < staticInstanceCount(mesh); i++) {
      staticInstanceMatrix(mesh, i, matrix);
      rows.push(`${mesh.material.name}:${matrix.elements.join(',')}:${mesh.matrixWorld.elements.join(',')}`);
    }
  });
  return rows.sort();
}
const reports = [];
for (const variant of ['', '-low']) {
  const model = parseGlb(readFileSync(new URL(`../penn-station-1935/assets/model-concourse${variant}.glb.gz`, import.meta.url)));
  const read = accessors(model), scene = new THREE.Group(); scene.position.y = -4.2672;
  const sources = [];
  for (const { index, matrix: world } of worldNodes(model.json)) {
    const node = model.json.nodes[index], attrs = node.extensions?.EXT_mesh_gpu_instancing?.attributes;
    if (!attrs || node.mesh === undefined) continue;
    for (const primitive of model.json.meshes[node.mesh].primitives) {
      const name = model.json.materials[primitive.material].name;
      if (!names.has(name)) continue;
      const geometry = new THREE.BufferGeometry();
      for (const [semantic, attribute] of Object.entries(primitive.attributes)) {
        const rows = Array.from({ length: model.json.accessors[attribute].count }, (_, i) => read(attribute)(i));
        geometry.setAttribute(({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', TEXCOORD_1: 'uv1' })[semantic] || semantic, new THREE.Float32BufferAttribute(rows.flat(), rows[0].length));
      }
      geometry.setIndex(Array.from({ length: model.json.accessors[primitive.indices].count }, (_, i) => read(primitive.indices)(i)[0]));
      const material = new THREE.MeshStandardMaterial({ name, side: THREE.DoubleSide });
      const count = model.json.accessors[Object.values(attrs)[0]].count;
      const mesh = new THREE.InstancedMesh(geometry, material, count);
      mesh.matrixAutoUpdate = false; mesh.matrix.copy(world); mesh.name = name;
      mesh.castShadow = name !== 'SquareVaultLightGlass'; mesh.receiveShadow = true;
      for (let i = 0; i < count; i++) mesh.setMatrixAt(i, new THREE.Matrix4().compose(
        new THREE.Vector3().fromArray(attrs.TRANSLATION === undefined ? [0, 0, 0] : read(attrs.TRANSLATION)(i)),
        new THREE.Quaternion().fromArray(attrs.ROTATION === undefined ? [0, 0, 0, 1] : read(attrs.ROTATION)(i)),
        new THREE.Vector3().fromArray(attrs.SCALE === undefined ? [1, 1, 1] : read(attrs.SCALE)(i))));
      scene.add(mesh); sources.push(mesh);
    }
  }
  assert.equal(sources.length, 2);
  const original = inventory(scene), reference = scene.clone(true);
  const geometryRefs = sources.map(mesh => ({ geometry: mesh.geometry, material: mesh.material, attrs: { ...mesh.geometry.attributes }, index: mesh.geometry.index }));
  assert.equal(preparePrismVisibility(scene, THREE), 2);
  assert.equal(preparePrismVisibility(scene, THREE), 0, 'Preparation does not duplicate shadow companions');
  scene.updateMatrixWorld(true);
  const manager = createPrismVisibility(scene, THREE);
  const poses = [
    ['arrivals', [-70, -5.6676, 28], [-70, -5.7176, -20]],
    ['platform', [-14, -9.785625, 15.7], [-38, -10.2, 8.690045261]],
    ['waiting', [0, -2.5872, 25], [0, 5.7328, -28]],
    ['concourse', [-67, -2.5872, 33], [-75, 5.7328, -25]],
    ['offscreen', [500, 500, 500], [600, 600, 600]],
    ['return', [-70, -5.6676, 28], [-70, -5.7176, -20]],
  ];
  const views = [];
  for (const reversed of [false, true]) for (const [name, eye, target] of poses) {
    const camera = new THREE.PerspectiveCamera(50, 1600 / 916, .15, 1000);
    camera._reversedDepth = reversed; camera.updateProjectionMatrix();
    camera.position.fromArray(eye); camera.lookAt(...target); camera.updateMatrixWorld(true);
    manager.update(camera);
    assert.deepEqual(inventory(scene), original, 'Collision helpers retain every original source instance after camera changes');
    const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), camera.coordinateSystem, camera.reversedDepth);
    const kept = new Set(); let triangles = 0, referenceTriangles = 0, visibleCalls = 0;
    scene.traverse(mesh => {
      if (!mesh.isInstancedMesh || mesh.userData.prismShadowOnly || !mesh.visible) return;
      visibleCalls++; triangles += mesh.geometry.index.count / 3 * mesh.count;
      for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, matrix); matrix.premultiply(mesh.matrixWorld); kept.add(`${mesh.material.name}:${matrix.elements.join(',')}`); }
    });
    reference.traverse(mesh => {
      if (!mesh.isInstancedMesh) return;
      if (frustum.intersectsObject(mesh)) referenceTriangles += mesh.geometry.index.count / 3 * mesh.count;
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, matrix); matrix.premultiply(mesh.matrixWorld);
        const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
        if (frustum.intersectsBox(bounds)) assert(kept.has(`${mesh.material.name}:${matrix.elements.join(',')}`), 'Every potentially visible panel remains submitted');
      }
    });
    assert(visibleCalls <= 2, 'Visible batching never adds draw calls');
    if (name === 'offscreen') assert.equal(triangles, 0);
    for (const [i, source] of sources.entries()) {
      const ref = geometryRefs[i]; assert.equal(source.geometry, ref.geometry); assert.equal(source.material, ref.material);
      assert.equal(source.geometry.index, ref.index); assert.deepEqual(source.geometry.attributes, ref.attrs);
    }
    const shadows = scene.children.filter(mesh => mesh.userData.prismShadowOnly);
    assert.equal(shadows.length, 1);
    const shadow = shadows[0], oldWeb = reference.children.find(mesh => mesh.material.name === 'ConcourseReinforcedVaultLightConcrete');
    assert(shadow.castShadow && shadow.visible); assert.equal(shadow.geometry, oldWeb.geometry); assert.equal(shadow.material, oldWeb.material);
    assert.deepEqual(shadow.instanceMatrix.array, oldWeb.instanceMatrix.array, 'Shadow updates always retain the complete original buffer');
    assert.equal(shadow.count, 2488); shadow.onBeforeRender(); assert.equal(shadow.count, 0); shadow.onAfterRender(); assert.equal(shadow.count, 2488);
    views.push({ name, reversed, beforeTriangles: referenceTriangles, afterTriangles: triangles, visibleInstances: manager.report.visibleInstances, visibleCalls });
  }
  reports.push({ variant: variant || 'full', totalInstances: 4976, sourceGeometryExact: true, fullCollisionAndShadowMatricesExact: true, views });
}
const report = { status: 'PASS', scope: 'Actual CPU source/visibility/shadow/collision controls; no native walking', reports };
if (process.env.PENN_PRISM_VISIBILITY_REPORT) writeFileSync(process.env.PENN_PRISM_VISIBILITY_REPORT, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
