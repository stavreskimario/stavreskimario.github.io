import{readFile,writeFile,mkdir,copyFile,readdir}from'node:fs/promises';
import{createHash}from'node:crypto';
import{isDeepStrictEqual}from'node:util';
import path from'node:path';
import{readGlb,writeGlb}from'/Users/stavreskimario/Desktop/penn-station-reconstruction/penn-station-1935/asset_io.mjs';
const source='/Users/stavreskimario/Desktop/penn-station-work/phase4-core-floor-v3';
const out='/Users/stavreskimario/Desktop/penn-station-work/phase4-core-floor-v3-ready';
await mkdir(out,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=await readFile(path.join(source,'model-concourse.glb'));
const{json,binary}=readGlb(bytes),before=structuredClone(json);
const index=json.materials.findIndex(m=>m.name==='ConcourseReinforcedVaultLightConcrete');
if(index<0)throw Error('Expected repeated concrete material');
const floor=structuredClone(json.materials[index]);
floor.name='ConcourseOpaqueCirculationConcrete';
floor.extras={...floor.extras,source_identity:'Retained opaque circulation and bearing slab around documented vault lights; surface finish reconstructed.',lighting_atlas_role:'Large opaque floor and bearing surrounds retain baked global illumination; distinct from repeated fine panel webs.'};
const next=json.materials.length;json.materials.push(floor);let changed=0;
for(const mesh of json.meshes)for(const p of mesh.primitives){
 if(p.material!==index)continue;
 const a=json.accessors[p.attributes.POSITION];
 if(a.max[0]-a.min[0]>10&&a.max[2]-a.min[2]>10){p.material=next;changed++;}
}
if(changed!==1)throw Error('Expected exactly one large opaque floor primitive, got'+changed);
for(const key of['buffers','bufferViews','accessors','nodes','scenes','scene','images','textures','samplers','extensionsUsed','extensionsRequired'])if(!isDeepStrictEqual(before[key],json[key]))throw Error('Protected'+key+'changed');
if(!isDeepStrictEqual(before.materials[index].pbrMetallicRoughness,floor.pbrMetallicRoughness))throw Error('Optical values changed');
const output=writeGlb(json,binary);if(!readGlb(output).binary.equals(binary))throw Error('BIN changed');
await writeFile(path.join(out,'model-concourse.glb'),output);
for(const f of await readdir(source))if(!['model-concourse.glb','penn-station-study.blend'].includes(f)){try{await copyFile(path.join(source,f),path.join(out,f));}catch(e){if(e.code!=='EISDIR')throw e;}}
for(const f of['scene-manifest.json','concourse-detail-audit.json']){const file=path.join(out,f),record=JSON.parse(await readFile(file,'utf8'));const detail=f==='scene-manifest.json'?record.concourseDetails:record;detail.vaultLights.coverage.repeatedWebMaterial='ConcourseReinforcedVaultLightConcrete';detail.vaultLights.coverage.opaqueSlabMaterial=floor.name;detail.materialRoleSeparation={operation:'Material-reference-only separation after immutable geometry export; no geometry,UV,normal or transform change.',opaqueSlabMaterial:floor.name,repeatedWebMaterial:'ConcourseReinforcedVaultLightConcrete'};await writeFile(file,JSON.stringify(record,null,2)+'\n');}
const report={scope:'Material-reference-only postprocess before baking. Preserves the provisional geometry export and its immutable source; canonical v3 source now creates these distinct material roles directly.',inputSha256:hash(bytes),outputSha256:hash(output),binSha256Before:hash(binary),binSha256After:hash(readGlb(output).binary),geometryArraysTransformsAndImagesUnchanged:true,opticalValuesUnchanged:true,largeFloorPrimitivesChanged:changed,opaqueMaterial:floor.name,repeatedWebMaterial:'ConcourseReinforcedVaultLightConcrete'};
await writeFile(path.join(out,'floor-material-separation.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
