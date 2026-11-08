// The authored station and its lights are static between explicit scene edits.
// Leave the experimental node/WebGPU renderer on its existing update path.
export function enableStaticShadowCache(renderer) {
  if (!renderer.isWebGLRenderer || !renderer.shadowMap) return false;
  renderer.shadowMap.autoUpdate = false;
  return true;
}

// Preserve the meaning of a forward-depth bias under r180's reversed
// comparison. This converts a declared value, never an already-mutated light.
// Normal bias is a world-space offset and must not change sign here.
export function shadowDepthBias(renderer, forwardBias) {
  if (!Number.isFinite(forwardBias)) throw new TypeError('Shadow bias must be finite');
  if (forwardBias === 0) return 0;
  return renderer?.isWebGLRenderer && renderer.capabilities?.reversedDepthBuffer === true
    ? -forwardBias : forwardBias;
}

export function refreshStaticShadows(renderer, scene) {
  if (!enableStaticShadowCache(renderer)) return false;
  const limit = renderer.capabilities.maxTextureSize;
  scene.traverse(light => {
    if (!light.isLight || !light.castShadow || !light.shadow) return;
    const shadow = light.shadow, extent = shadow.getFrameExtents();
    // r180 otherwise switches this camera lazily on its first depth draw,
    // after LightShadow has already built the cached matrix and frustum.
    // Prime the actual supported convention before either is calculated.
    shadow.camera._reversedDepth = renderer.capabilities.reversedDepthBuffer === true;
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
