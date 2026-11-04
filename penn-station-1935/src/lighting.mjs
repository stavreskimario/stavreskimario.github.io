import { ShaderChunk } from 'three';

// Measured with a unit-radiance hemisphere in Blender4.3: the lighting-only
// diffuse bake is outgoing unit-albedo radiance. Three expects irradiance.
export const CYCLES_TO_IRRADIANCE = Math.PI;

export function configureBakedDiffuse(material, renderer, radianceScale = 1) {
  if (!Number.isFinite(radianceScale) || radianceScale <= 0) throw new Error('Invalid illumination scale');
  material.lightMapIntensity = CYCLES_TO_IRRADIANCE * radianceScale;
  if (!renderer?.isWebGLRenderer) return;
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = function (shader, gl) {
    previous?.call(this, shader, gl);
    // The diffuse hemisphere is already integrated by Cycles with occluders.
    // Keep the room probe's specular reflection without adding unoccluded
    // ambient diffuse a second time through the walls and roof.
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_maps>',
      ShaderChunk.lights_fragment_maps.replace('iblIrradiance += getIBLIrradiance( geometryNormal );', ''));
  };
  material.customProgramCacheKey = () => 'penn-r180-baked-diffuse-v3';
  material.needsUpdate = true;
}
