// Read-only inspection of already-mounted visual data for acceptance evidence.
// No renderer/material/camera/matrix updates occur in these helpers.
import * as THREE from 'three';

function textureInfo(texture) {
  if (!texture) return null;
  const image = texture.image || texture.source?.data;
  return {
    channel: texture.channel ?? 0,
    width: Number.isFinite(image?.width) ? image.width : null,
    height: Number.isFinite(image?.height) ? image.height : null,
    flipY: Boolean(texture.flipY), wrapS: texture.wrapS, wrapT: texture.wrapT,
    colorSpace: texture.colorSpace,
  };
}

function materialInfo(material) {
  return {
    id: material.uuid, name: material.name, type: material.type,
    side: material.side, transmission: material.transmission ?? 0,
    transparent: material.transparent, opacity: material.opacity,
    roughness: material.roughness ?? null, metalness: material.metalness ?? null,
    aoIntensity: material.aoMapIntensity ?? null,
    lightIntensity: material.lightMapIntensity ?? null,
    skyFile: material.userData?.sky_illumination ?? null,
    skyScale: material.userData?.sky_illumination_scale ?? null,
    ao: textureInfo(material.aoMap), lightmap: textureInfo(material.lightMap),
  };
}

export function getMaterialReport(building) {
  if (!building) return [];
  const entries = new Map();
  for (const zone of building.children) zone.traverse(object => {
    if (!object.isMesh) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      if (!entries.has(material)) entries.set(material, { ...materialInfo(material), zones: [], meshes: 0 });
      const entry = entries.get(material);
      if (!entry.zones.includes(zone.name)) entry.zones.push(zone.name);
      entry.meshes++;
    }
  });
  return [...entries.values()];
}

function hitUV(hit, channel) {
  const value = channel === 0 ? hit.uv : hit[`uv${channel}`];
  return value ? value.clone() : null;
}

function textureUV(hit, texture) {
  if (!texture) return null;
  const uv = hitUV(hit, texture.channel ?? 0);
  // transformUv mutates only this clone, reading the texture's existing
  // matrix, wrapping and flip state. It never calls updateMatrix.
  return uv ? texture.transformUv(uv).toArray() : null;
}

function triangleUV(hit, channel) {
  const attribute = hit.object.geometry.getAttribute(channel === 0 ? 'uv' : `uv${channel}`);
  return attribute ? [hit.face.a, hit.face.b, hit.face.c].map(i => [attribute.getX(i), attribute.getY(i)]) : null;
}

export function sampleVisuals(building, camera, renderer, points, options = {}) {
  if (!building || !camera || !renderer) return null;
  const zoneName = typeof options.zone === 'string' ? options.zone : 'waiting';
  const zone = building.children.find(item => item.name === zoneName);
  const rect = renderer.domElement.getBoundingClientRect();
  const result = {
    zone: zoneName,
    coordinateSpace: 'page CSS pixels relative to the current canvas client rectangle',
    canvasRect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
    canvasPixels: [renderer.domElement.width, renderer.domElement.height],
    camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov },
    samples: [],
  };
  if (!zone) return { ...result, error: 'Requested mounted zone is unavailable' };
  const ray = new THREE.Raycaster();
  ray.firstHitOnly = true;
  for (const point of Array.isArray(points) ? points.slice(0, 128) : []) {
    const sample = { label: String(point.label ?? ''), screen: [point.x, point.y] };
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || rect.width <= 0 || rect.height <= 0 || point.x < rect.left || point.x > rect.left + rect.width || point.y < rect.top || point.y > rect.top + rect.height) {
      result.samples.push({ ...sample, miss: 'Outside canvas' }); continue;
    }
    ray.setFromCamera(new THREE.Vector2((point.x - rect.left) / rect.width * 2 - 1, -(point.y - rect.top) / rect.height * 2 + 1), camera);
    const hit = ray.intersectObject(zone, true)[0];
    if (!hit || !hit.face) { result.samples.push({ ...sample, miss: 'No surface' }); continue; }
    const material = Array.isArray(hit.object.material) ? hit.object.material[hit.face.materialIndex] : hit.object.material;
    const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld));
    result.samples.push({
      ...sample, world: hit.point.toArray(), faceNormalWorld: normal.toArray(),
      material: materialInfo(material), mesh: hit.object.name,
      uv0: hitUV(hit, 0)?.toArray() ?? null, uv1: hitUV(hit, 1)?.toArray() ?? null,
      mappedAOuv: textureUV(hit, material.aoMap), mappedLightmapUV: textureUV(hit, material.lightMap),
      triangleUV1: triangleUV(hit, 1),
      triangleAOuv: material.aoMap ? triangleUV(hit, material.aoMap.channel ?? 0) : null,
      triangleLightmapUV: material.lightMap ? triangleUV(hit, material.lightMap.channel ?? 0) : null,
    });
  }
  return result;
}
