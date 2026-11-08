// Draw only prism panels that can reach the camera. Keep the complete source
// matrix set for walking support, and a separate full-floor shadow caster.
const originals = new WeakMap();
const names = new Set(['SquareVaultLightGlass', 'ConcourseReinforcedVaultLightConcrete']);

export const isPrismVisual = mesh => originals.has(mesh);
export const staticInstanceCount = mesh => originals.get(mesh)?.count ?? mesh.count;
export function staticInstanceMatrix(mesh, index, target) {
  const data = originals.get(mesh);
  return data ? target.fromArray(data.matrices, index * 16) : (mesh.getMatrixAt(index, target), target);
}

export function preparePrismVisibility(scene, THREE) {
  const targets = [];
  scene.traverse(mesh => {
    if (!mesh.isInstancedMesh || !mesh.visible || mesh.userData.prismShadowOnly || originals.has(mesh) ||
        Array.isArray(mesh.material) || !names.has(mesh.material?.name) || mesh.count < 128 ||
        mesh.instanceColor || mesh.morphTexture || mesh.children.length ||
        Object.values(mesh.geometry.attributes).some(attribute => attribute.isInstancedBufferAttribute)) return;
    targets.push(mesh);
  });
  for (const mesh of targets) {
    const data = { mesh, count: mesh.count, matrices: mesh.instanceMatrix.array.slice(),
      ids: new Uint32Array(mesh.count), previous: new Uint32Array(mesh.count), previousCount: -1,
      bounds: [], world: null, shadow: null };
    // Complete bounds remain conservative even after the visible prefix shrinks.
    mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    if (mesh.castShadow) {
      const shadow = new THREE.InstancedMesh(mesh.geometry, mesh.material, mesh.count).copy(mesh, false);
      shadow.name = `${mesh.name || mesh.material.name} · static shadow`;
      shadow.userData.prismShadowOnly = true;
      // ShadowMap invokes onBeforeShadow rather than onBeforeRender. The
      // immutable full matrix buffer therefore participates in every shadow
      // refresh while this companion submits no camera/color geometry.
      shadow.onBeforeRender = () => { shadow.count = 0; };
      shadow.onAfterRender = () => { shadow.count = data.count; };
      mesh.parent.add(shadow); data.shadow = shadow; mesh.castShadow = false;
    }
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    originals.set(mesh, data);
  }
  return targets.length;
}

export function createPrismVisibility(building, THREE) {
  const records = [];
  building?.traverse(mesh => { if (originals.has(mesh)) records.push(originals.get(mesh)); });
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4();
  const local = new THREE.Matrix4(), world = new THREE.Matrix4(), box = new THREE.Box3();
  let lastCamera = '';
  const report = { batches: records.length, totalInstances: records.reduce((sum, data) => sum + data.count, 0),
    visibleInstances: 0, testedInstances: 0, updateMilliseconds: 0 };
  return {
    report,
    update(camera) {
      if (!records.length) return;
      camera.updateMatrixWorld();
      const key = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements].join(',');
      let worldChanged = false;
      for (const data of records) {
        if (data.world?.equals(data.mesh.matrixWorld)) continue;
        data.world = data.mesh.matrixWorld.clone(); worldChanged = true;
        data.bounds.length = 0;
        for (let i = 0; i < data.count; i++) {
          local.fromArray(data.matrices, i * 16); world.multiplyMatrices(data.world, local);
          box.copy(data.mesh.geometry.boundingBox).applyMatrix4(world);
          const sphere = box.getBoundingSphere(new THREE.Sphere());
          sphere.radius += .002; // Conservative millimetre guard at view edges.
          data.bounds.push(sphere);
        }
      }
      if (lastCamera === key && !worldChanged) return;
      lastCamera = key;
      const started = performance.now();
      projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      frustum.setFromProjectionMatrix(projection, camera.coordinateSystem, camera.reversedDepth);
      report.visibleInstances = report.testedInstances = 0;
      for (const data of records) {
        let count = 0, changed = false;
        for (let i = 0; i < data.count; i++) {
          if (!frustum.intersectsSphere(data.bounds[i])) continue;
          if (data.previous[count] !== i) changed = true;
          data.ids[count++] = i;
        }
        changed ||= count !== data.previousCount;
        if (changed) {
          const target = data.mesh.instanceMatrix.array;
          for (let i = 0; i < count; i++) {
            const sourceOffset = data.ids[i] * 16, targetOffset = i * 16;
            for (let k = 0; k < 16; k++) target[targetOffset + k] = data.matrices[sourceOffset + k];
            data.previous[i] = data.ids[i];
          }
          data.mesh.instanceMatrix.needsUpdate = true;
          data.previousCount = count;
        }
        data.mesh.count = count; data.mesh.visible = count > 0;
        report.visibleInstances += count; report.testedInstances += data.count;
      }
      report.updateMilliseconds = performance.now() - started;
    },
  };
}
