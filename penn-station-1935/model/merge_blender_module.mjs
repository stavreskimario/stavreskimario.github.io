// Append reviewed Blender modules without re-encoding any existing payload.
// Default: texture-free modules use authoritative existing materials.
// Explicit vault mode replaces only PaleVaultPlaster's AO/lighting binding.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readGlb,writeGlb} from '../asset_io.mjs';
const args={};
for(let i=2;i<process.argv.length;i+=2){
  assert(['--input','--module','--out','--replace-material','--replace-material-binding','--report'].includes(process.argv[i])&&process.argv[i+1],'Expected named input/module/out/report arguments');
  args[process.argv[i].slice(2)]=process.argv[i+1];
}
for(const key of ['input','module','out','report'])assert(args[key],`Missing ${key}`);
assert.notEqual(path.resolve(args.input),path.resolve(args.out),'Keep immutable input');
assert.notEqual(path.resolve(args.module),path.resolve(args.out),'Keep immutable module');
assert(['true','false',undefined].includes(args['replace-material-binding']),'Material-binding option must be true or false');
const replaceBinding=args['replace-material-binding']==='true';
if(replaceBinding)assert.equal(args['replace-material'],'PaleVaultPlaster','Only PaleVaultPlaster permits an AO/lighting binding replacement');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const input=await readFile(args.input),raw=await readFile(args.module);
const base=readGlb(input[0]===31&&input[1]===139?gunzipSync(input):input),module=readGlb(raw);
for(const key of ['skins','animations','cameras'])assert.equal(module.json[key]?.length||0,0,`Module must not introduce ${key}`);
assert(!module.json.extensions,'Module must not add root extensions/live lights');
assert.equal(module.json.scenes.length,1);assert.equal(module.json.scene||0,0);
const allowedExtensions=replaceBinding?['EXT_meshopt_compression','KHR_mesh_quantization','KHR_texture_basisu','KHR_texture_transform']:[];
if(replaceBinding)for(const name of module.json.extensionsUsed||[])assert(allowedExtensions.includes(name),`Unreviewed module extension: ${name}`);
else assert(!module.json.extensionsUsed?.includes('EXT_meshopt_compression'),'Append the reviewed raw module');
for(const name of module.json.extensionsRequired||[])assert((module.json.extensionsUsed||[]).includes(name),'Required extension must also be used');
assert(module.json.buffers?.length>=1,'Module requires an embedded primary buffer');
assert(!module.json.buffers[0].uri,'Module primary buffer must be embedded');
assert(module.json.buffers[0].byteLength<=module.binary.length,'Module BIN is truncated');
if(!replaceBinding){
  assert.equal(module.json.buffers.length,1);
  for(const key of ['images','textures'])assert.equal(module.json[key]?.length||0,0,`Default module must not introduce ${key}`);
}
const json=structuredClone(base.json),offset=base.binary.length,oldBufferCount=json.buffers.length;
assert.equal(offset%4,0);
const bufferMap=[0];
for(let i=1;i<module.json.buffers.length;i++){
  const buffer=module.json.buffers[i];
  assert(!buffer.uri&&buffer.extensions?.EXT_meshopt_compression?.fallback===true,'Only virtual Meshopt fallback buffers may follow module buffer0');
  assert.deepEqual(Object.keys(buffer.extensions),['EXT_meshopt_compression']);
  bufferMap[i]=json.buffers.length;json.buffers.push(structuredClone(buffer));
}
const materialMap=module.json.materials.map(m=>{
  const matches=json.materials.map((existing,index)=>existing.name===m.name?index:-1).filter(i=>i>=0);
  assert.equal(matches.length,1,`Unique existing authoritative material required: ${m.name}`);
  return matches[0];
});
let texturesAdded=0,imagesAdded=0,samplersAdded=0,bindingReplacement=null;
const textureFiles=[];
if(replaceBinding){
  assert.equal(module.json.materials.length,1,'Vault binding module must contain exactly one material');
  const incoming=module.json.materials[0];assert.equal(incoming.name,'PaleVaultPlaster');
  assert(incoming.occlusionTexture,'Vault binding replacement requires the new AO texture');
  const permittedExtras=['lighting_atlas_uv','sky_illumination','sky_illumination_scale','lightmap_encoding'];
  for(const key of Object.keys(incoming.extras||{}))assert(permittedExtras.includes(key),'Only lighting extras may replace the vault binding');
  for(const [key,value]of Object.entries(incoming))if(key!=='occlusionTexture')assert(!/Texture$/.test(key)&&!(key==='pbrMetallicRoughness'&&Object.keys(value).some(k=>/Texture$/.test(k))),'Only module AO texture binding is permitted');
  assert(!incoming.extensions,'Module material extensions require separate review');
  const index=(value,length,label)=>{assert(Number.isInteger(value)&&value>=0&&value<length,`Invalid ${label} index`);return value;};
  const imageMap=[];
  for(const image of module.json.images||[]){
    const match=/^textures\/([a-f0-9]{20})\.ktx2$/.exec(image.uri||'');
    assert(match&&!('bufferView'in image)&&image.mimeType==='image/ktx2','Only unchanged content-addressed external KTX2 image URIs are allowed');
    const bytes=await readFile(path.join(path.dirname(args.module),image.uri));
    assert.equal(hash(bytes).slice(0,20),match[1],'Module texture filename must match its actual SHA256 prefix');
    assert(bytes.subarray(0,12).equals(Buffer.from([0xab,0x4b,0x54,0x58,0x20,0x32,0x30,0xbb,0x0d,0x0a,0x1a,0x0a])),'Expected KTX2 image');
    json.images||=[];const same=json.images.findIndex(old=>JSON.stringify(old)===JSON.stringify(image));
    imageMap.push(same>=0?same:json.images.length);if(same<0){json.images.push(structuredClone(image));imagesAdded++;}
    textureFiles.push({uri:image.uri,sha256:hash(bytes),bytes:bytes.length,source:path.resolve(path.dirname(args.module),image.uri)});
  }
  const samplerMap=[];
  for(const sampler of module.json.samplers||[]){
    json.samplers||=[];const same=json.samplers.findIndex(old=>JSON.stringify(old)===JSON.stringify(sampler));
    samplerMap.push(same>=0?same:json.samplers.length);if(same<0){json.samplers.push(structuredClone(sampler));samplersAdded++;}
  }
  const textureMap=[];
  for(const original of module.json.textures||[]){
    const texture=structuredClone(original);assert(texture.source===undefined&&texture.extensions?.KHR_texture_basisu,'KTX2 textures require the reviewed basisu binding');
    assert.deepEqual(Object.keys(texture.extensions),['KHR_texture_basisu']);
    texture.extensions.KHR_texture_basisu.source=imageMap[index(texture.extensions.KHR_texture_basisu.source,imageMap.length,'image')];
    if(texture.sampler!==undefined)texture.sampler=samplerMap[index(texture.sampler,samplerMap.length,'sampler')];
    json.textures||=[];const same=json.textures.findIndex(old=>JSON.stringify(old)===JSON.stringify(texture));
    textureMap.push(same>=0?same:json.textures.length);if(same<0){json.textures.push(texture);texturesAdded++;}
  }
  assert.equal(textureMap.length,1,'Vault module may introduce only its AO texture');
  const info=structuredClone(incoming.occlusionTexture);info.index=textureMap[index(info.index,textureMap.length,'AO texture')];
  const texCoord=info.extensions?.KHR_texture_transform?.texCoord??info.texCoord??0;
  assert(Number.isInteger(texCoord)&&texCoord>=0,'AO UV channel must be a nonnegative integer');
  for(const mesh of module.json.meshes)for(const primitive of mesh.primitives)assert(primitive.attributes[`TEXCOORD_${texCoord}`]!==undefined,'Module primitive lacks the AO UV channel');
  const target=json.materials[materialMap[0]];
  target.occlusionTexture=info;
  target.extras={...target.extras,...incoming.extras};
  bindingReplacement={name:target.name,materialIndex:materialMap[0],aoTextureIndex:info.index,effectiveTexCoord:texCoord,lightingExtras:structuredClone(incoming.extras||{})};
}
let removed=0,removedMeshes=0,detachedNodes=0;
const oldMeshMap=[];
if(args['replace-material']){
  const index=json.materials.findIndex(m=>m.name===args['replace-material']);assert(index>=0);
  const kept=[];
  json.meshes.forEach((mesh,i)=>{
    const previous=mesh.primitives.length,primitives=mesh.primitives.filter(p=>p.material!==index);
    removed+=previous-primitives.length;
    if(!primitives.length){assert(replaceBinding,'Replacement must not leave an empty mesh');oldMeshMap[i]=null;removedMeshes++;}
    else{oldMeshMap[i]=kept.length;kept.push({...mesh,primitives});}
  });
  assert(removed>0,'Declared replacement material must be present');json.meshes=kept;
  for(const node of json.nodes)if(node.mesh!==undefined){const mapped=oldMeshMap[node.mesh];if(mapped===null){delete node.mesh;detachedNodes++;}else node.mesh=mapped;}
}else json.meshes.forEach((_,i)=>{oldMeshMap[i]=i;});
const viewOffset=json.bufferViews.length,accessorOffset=json.accessors.length,meshOffset=json.meshes.length,nodeOffset=json.nodes.length;
for(const original of module.json.bufferViews){
  const view=structuredClone(original),buffer=view.buffer;
  assert(Number.isInteger(buffer)&&bufferMap[buffer]!==undefined,'Invalid module buffer index');
  assert((view.byteOffset||0)+view.byteLength<=module.json.buffers[buffer].byteLength,'Module view exceeds its buffer');
  view.buffer=bufferMap[buffer];if(buffer===0)view.byteOffset=(view.byteOffset||0)+offset;
  if(view.extensions){
    assert(replaceBinding&&view.extensions.EXT_meshopt_compression,'Only reviewed Meshopt view extensions are allowed');
    assert.deepEqual(Object.keys(view.extensions),['EXT_meshopt_compression']);
    const compressed=view.extensions.EXT_meshopt_compression;
    assert.equal(compressed.buffer,0,'Compressed source must reside in the real module BIN');
    assert((compressed.byteOffset||0)+compressed.byteLength<=module.json.buffers[0].byteLength,'Compressed range exceeds module BIN');
    assert.equal(compressed.count*compressed.byteStride,view.byteLength,'Meshopt decoded range must match its view');
    compressed.byteOffset=(compressed.byteOffset||0)+offset;
  }else assert.equal(buffer,0,'Virtual buffer views require Meshopt compression');
  json.bufferViews.push(view);
}
for(const original of module.json.accessors){
  const accessor=structuredClone(original);assert(!accessor.sparse,'Sparse modules require separate review');
  if(accessor.bufferView!==undefined){assert(module.json.bufferViews[accessor.bufferView],'Invalid module accessor view');accessor.bufferView+=viewOffset;}
  json.accessors.push(accessor);
}
for(const mesh of module.json.meshes)json.meshes.push({...structuredClone(mesh),primitives:mesh.primitives.map(p=>{
  assert(!p.targets&&!p.extensions,'Unexpected morph/primitive extension');assert(materialMap[p.material]!==undefined,'Explicit existing module material is required');
  const remap=index=>{assert(module.json.accessors[index],'Invalid primitive accessor');return index+accessorOffset;};
  return {...p,material:materialMap[p.material],indices:p.indices===undefined?undefined:remap(p.indices),attributes:Object.fromEntries(Object.entries(p.attributes).map(([key,index])=>[key,remap(index)]))};
})});
for(const node of module.json.nodes){
  assert(node.skin===undefined&&node.camera===undefined&&!node.extensions,'Unexpected module node features');
  if(node.mesh!==undefined)assert(module.json.meshes[node.mesh],'Invalid module node mesh');
  for(const child of node.children||[])assert(module.json.nodes[child],'Invalid module child');
  json.nodes.push({...structuredClone(node),mesh:node.mesh===undefined?undefined:node.mesh+meshOffset,children:node.children?.map(i=>i+nodeOffset)});
}
for(const node of module.json.scenes[0].nodes)assert(module.json.nodes[node],'Invalid module root node');
json.scenes[json.scene||0].nodes.push(...module.json.scenes[0].nodes.map(i=>i+nodeOffset));
if(replaceBinding)for(const key of ['extensionsUsed','extensionsRequired'])for(const name of module.json[key]||[]){json[key]||=[];if(!json[key].includes(name))json[key].push(name);}
const binary=Buffer.concat([base.binary,module.binary]);json.buffers[0].byteLength=binary.length;
assert(binary.subarray(0,base.binary.length).equals(base.binary));
assert.deepEqual(json.buffers.slice(1,oldBufferCount),base.json.buffers.slice(1),'Existing virtual buffers stay exact');
assert.deepEqual({...json.buffers[0],byteLength:base.json.buffers[0].byteLength},base.json.buffers[0],'Only the primary byte length may change');
for(const key of ['bufferViews','accessors','images','textures','samplers'])assert.deepEqual((json[key]||[]).slice(0,base.json[key]?.length||0),base.json[key]||[],`Existing ${key} stay exact`);
for(let i=0;i<base.json.materials.length;i++){
  const expected=structuredClone(base.json.materials[i]);
  if(bindingReplacement?.materialIndex===i){expected.occlusionTexture=json.materials[i].occlusionTexture;expected.extras={...expected.extras,...bindingReplacement.lightingExtras};}
  assert.deepEqual(json.materials[i],expected,'Existing PBR fields and non-vault materials stay exact');
}
for(let i=0;i<nodeOffset;i++){
  const expected=structuredClone(base.json.nodes[i]);
  if(expected.mesh!==undefined){const mapped=oldMeshMap[expected.mesh];if(mapped===null)delete expected.mesh;else expected.mesh=mapped;}
  assert.deepEqual(json.nodes[i],expected,'Existing transforms/children stay exact; only declared mesh removal/remapping is permitted');
}
const output=writeGlb(json,binary),transport=args.out.endsWith('.gz')?gzipSync(output,{level:9}):output;
await mkdir(path.dirname(path.resolve(args.out)),{recursive:true});await writeFile(args.out,transport);
const report={scope:'Reviewed module appended offline without re-encoding existing BIN payloads. Only declared replacement primitives and explicitly permitted vault AO/lighting binding change.',inputSha256:hash(input),moduleSha256:hash(raw),outputSha256:hash(transport),decodedSha256:hash(output),unchangedBinaryPrefixSha256:hash(base.binary),unchangedBinaryPrefixBytes:base.binary.length,removedMaterial:args['replace-material']||null,removedPrimitives:removed,removedMeshes,detachedNodes,oldMeshIndexMap:oldMeshMap,addedMeshes:module.json.meshes.length,addedNodes:module.json.nodes.length,moduleBufferIndexMap:bufferMap,materialBindings:module.json.materials.map((m,i)=>({name:m.name,existingMaterial:materialMap[i]})),bindingReplacement,texturesAdded,imagesAdded,samplersAdded,externalTextureFiles: textureFiles,callerMustPlaceExternalFiles:true,liveLightsAdded:0};
await mkdir(path.dirname(path.resolve(args.report)),{recursive:true});await writeFile(args.report,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
