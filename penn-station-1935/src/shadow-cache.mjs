// The authored station and its lights are static between explicit scene edits.
// Leave the experimental node/WebGPU renderer on its existing update path.
export function enableStaticShadowCache(renderer) {
  if (!renderer.isWebGLRenderer || !renderer.shadowMap) return false;
  renderer.shadowMap.autoUpdate = false;
  return true;
}

export function refreshStaticShadows(renderer, scene) {
  if (!enableStaticShadowCache(renderer)) return false;
  const limit = renderer.capabilities.maxTextureSize;
  scene.traverse(light => {
    if (!light.isLight || !light.castShadow || !light.shadow) return;
    const shadow = light.shadow, extent = shadow.getFrameExtents();
    shadow.camera.updateProjectionMatrix();
    // Match r180 WebGLShadowMap's atlas extents and hardware size clamp.
    const width = Math.min(shadow.mapSize.x, Math.floor(limit / extent.x)) * extent.x;
    const height = Math.min(shadow.mapSize.y, Math.floor(limit / extent.y)) * extent.y;
    for (const key of ['map', 'mapPass']) {
      const target = shadow[key];
      if (target && (target.width !== width || target.height !== height)) {
        // r180 allocates a new target only when map is null (or type changes).
        // A mapSize prop change alone does not resize an existing target.
        target.dispose(); shadow[key] = null;
      }
    }
    shadow.needsUpdate = true;
  });
  renderer.shadowMap.needsUpdate = true;
  return true;
}
