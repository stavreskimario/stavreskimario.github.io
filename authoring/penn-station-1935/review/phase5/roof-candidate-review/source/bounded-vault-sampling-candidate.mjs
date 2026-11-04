// Candidate only: mapped close-view, gamma/energy and gutter acceptance remain pending.
import {LinearMipmapLinearFilter,LinearFilter,ShaderChunk} from 'three';

export function configureVaultAtlasSampling(material,texture,renderer,literal=false){
 if(!renderer?.isWebGLRenderer||texture?.image?.width!==8192||texture?.image?.height!==8192)return false;
 texture.generateMipmaps=true;texture.minFilter=LinearMipmapLinearFilter;texture.magFilter=LinearFilter;texture.anisotropy=1;texture.needsUpdate=true;
 const functionSource="vec4 pennVaultFilteredAtlas(sampler2D atlas,vec2 uv){\n  vec2 extent=vec2(textureSize(atlas,0));\n  vec2 dx=dFdx(uv)*extent,dy=dFdy(uv)*extent;\n  float footprint2=max(dot(dx,dx),dot(dy,dy));\n  float lod=clamp(0.5*log2(max(footprint2,1e-12)),0.0,2.0);\n  return textureLod(atlas,uv,lod);\n }";
 const previousHook=material.onBeforeCompile,previousKey=material.customProgramCacheKey();
 material.onBeforeCompile=(shader,renderer)=>{
  previousHook.call(material,shader,renderer);
  shader.fragmentShader=shader.fragmentShader.replace('void main() {',functionSource+'\nvoid main() {');
  const chunk=literal?'map_fragment':'lights_fragment_maps';
  const from=literal?'texture2D( map, vMapUv )':'texture2D( lightMap, vLightMapUv )';
  const to=literal?'pennVaultFilteredAtlas( map, vMapUv )':'pennVaultFilteredAtlas( lightMap, vLightMapUv )';
  const original=ShaderChunk[chunk];if(!original.includes(from))throw new Error('Missing reviewed atlas shader sample');
  if(shader.fragmentShader.includes('#include <'+chunk+'>'))shader.fragmentShader=shader.fragmentShader.replace('#include <'+chunk+'>',original);
  if(!shader.fragmentShader.includes(from))throw new Error('Prior lighting hook removed the atlas sample');
  shader.fragmentShader=shader.fragmentShader.replace(from,to);
 };
 material.customProgramCacheKey=()=>previousKey+(literal?'|penn-vault-lodcap2-basic-v2':'|penn-vault-lodcap2-lightmap-v2');
 material.userData.pennDiagnosticAtlasFilter={minimumLod:0,maximumLod:2,baseResolution:8192,bakeGutterPixels:8,generatedMipmaps:true,method:'Derivative footprint; no fixed bias; magnificationLOD0'};
 material.needsUpdate=true;return true;
}
