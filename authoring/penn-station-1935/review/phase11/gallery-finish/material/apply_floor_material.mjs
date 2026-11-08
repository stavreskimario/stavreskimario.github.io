import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync,gzipSync} from 'node:zlib';
import {readGlb,writeGlb} from '/Users/stavreskimario/Desktop/penn-station-reconstruction/penn-station-1935/asset_io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function applyFloorMaterial(input, output, materialDirectory, variant) {
 const bytes=await fs.readFile(input), raw=input.endsWith('.gz')?gunzipSync(bytes):bytes;
 const a=readGlb(raw), fixtureBytes=await fs.readFile(path.join(materialDirectory,`material-${variant}.glb`)),b=readGlb(fixtureBytes);
 const frozen=JSON.stringify({nodes:a.json.nodes,meshes:a.json.meshes,accessors:a.json.accessors,bufferViews:a.json.bufferViews,buffers:a.json.buffers,scenes:a.json.scenes});
 const materialsBefore=structuredClone(a.json.materials),source=b.json.materials[0];
 const names=a.json.materials.map((m,i)=>m.name==='ConcourseOpaqueArrivalsConcrete'?i:-1).filter(i=>i>=0);
 assert.equal(names.length,1,'Exactly the already-qualified ordinary gallery floor material');
 const target=a.json.materials[names[0]],oldFactor=target.pbrMetallicRoughness?.baseColorFactor||[1,1,1,1];
 assert(oldFactor.slice(0,3).every(n=>n>0&&n<.8));
 a.json.samplers??=[];a.json.images??=[];a.json.textures??=[];
 const samplerOffset=a.json.samplers.length,imageOffset=a.json.images.length,textureOffset=a.json.textures.length;
 a.json.samplers.push(...structuredClone(b.json.samplers||[]));
 for(const image of b.json.images){assert(/^textures\/[a-f0-9]{20}\.ktx2$/.test(image.uri));a.json.images.push(structuredClone(image));}
 for(const t of b.json.textures){const t2=structuredClone(t);assert(t2.extensions?.KHR_texture_basisu);t2.extensions.KHR_texture_basisu.source+=imageOffset;if(t2.sampler!==undefined)t2.sampler+=samplerOffset;a.json.textures.push(t2);}
 function remap(info){const r=structuredClone(info);r.index+=textureOffset;return r;}
 const mean=[.48207508081209466,.4820750833373442,.4820750820234235];
 target.pbrMetallicRoughness={...target.pbrMetallicRoughness,
  baseColorFactor:oldFactor.slice(0,3).map((v,i)=>v/mean[i]).concat(oldFactor[3]??1),
  baseColorTexture:remap(source.pbrMetallicRoughness.baseColorTexture),
  metallicRoughnessTexture:remap(source.pbrMetallicRoughness.metallicRoughnessTexture),metallicFactor:0,roughnessFactor:1};
 target.normalTexture=remap(source.normalTexture);
 target.extras={...target.extras,gallery_surface_revision:11,texture_source:source.extras.texture_source,
  surface_identity:source.extras.surface_identity,physical_tile_metres:[1.1,.55],mean_linear_albedo_preserved:true};
 a.json.extensionsUsed=[...new Set([...(a.json.extensionsUsed||[]),...(b.json.extensionsUsed||[])])];
 a.json.extensionsRequired=[...new Set([...(a.json.extensionsRequired||[]),...(b.json.extensionsRequired||[])])];
 assert.equal(JSON.stringify({nodes:a.json.nodes,meshes:a.json.meshes,accessors:a.json.accessors,bufferViews:a.json.bufferViews,buffers:a.json.buffers,scenes:a.json.scenes}),frozen,'All geometry and frames remain exact');
 for(let i=0;i<materialsBefore.length;i++)if(i!==names[0])assert.deepEqual(a.json.materials[i],materialsBefore[i]);
 assert.deepEqual(target.occlusionTexture,materialsBefore[names[0]].occlusionTexture,'Retain actual baked AO');
 const encoded=writeGlb(a.json,a.binary),transport=input.endsWith('.gz')?gzipSync(encoded,{level:9,mtime:0}):encoded;
 await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,transport);
 return {inputSha256:sha(bytes),outputSha256:sha(transport),bytes:transport.length,variant,
  fixtureSha256:sha(fixtureBytes),changedMaterialIndex:names[0],geometryAndBinaryExact:true,
  otherMaterialsExact:true,aoAndLightingRetained:true,physicalTileMetres:[1.1,.55],
  targetMeanLinearAlbedo:oldFactor.slice(0,3),factor:target.pbrMetallicRoughness.baseColorFactor,
  addedTextures:b.json.images.map(i=>i.uri),normalScale:target.normalTexture.scale};
}
