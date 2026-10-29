// Append a texture-free Blender module without re-encoding existing geometry.
// Existing material records are authoritative. Replacement removes only the
// declared material primitive; all original BIN bytes remain an exact prefix.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {readGlb,writeGlb} from '../asset_io.mjs';
const args={};
for(let i=2;i<process.argv.length;i+=2){
  assert(['--input','--module','--out','--replace-material','--report'].includes(process.argv[i])&&process.argv[i+1],'Expected named input/module/out/report arguments');
  args[process.argv[i].slice(2)]=process.argv[i+1];
}
for(const key of ['input','module','out','report'])assert(args[key],`Missing ${key}`);
assert.notEqual(path.resolve(args.input),path.resolve(args.out),'Keep immutable input');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const input=await readFile(args.input),raw=await readFile(args.module);
const base=readGlb(input[0]===31&&input[1]===139?gunzipSync(input):input),module=readGlb(raw);
assert.equal(module.json.buffers.length,1);
for(const key of ['images','textures','skins','animations','cameras'])assert.equal(module.json[key]?.length||0,0,`Module must not introduce ${key}`);
assert(!module.json.extensions?.KHR_lights_punctual,'Module must not add live lights');
assert(!module.json.extensionsUsed?.includes('EXT_meshopt_compression'),'Append the reviewed raw module');
const json=structuredClone(base.json),offset=base.binary.length;
assert.equal(offset%4,0);
const materialMap=module.json.materials.map(m=>{
  const index=json.materials.findIndex(existing=>existing.name===m.name);
  assert(index>=0,`Existing authoritative material required: ${m.name}`);
  return index;
});
let removed=0;
if(args['replace-material']) {
  const index=json.materials.findIndex(m=>m.name===args['replace-material']);assert(index>=0);
  for(const mesh of json.meshes){
    const previous=mesh.primitives.length;
    mesh.primitives=mesh.primitives.filter(p=>p.material!==index);
    removed+=previous-mesh.primitives.length;
    assert(mesh.primitives.length,'Replacement must not leave an empty mesh');
  }
  assert(removed>0,'Declared replacement material must be present');
}
const viewOffset=json.bufferViews.length,accessorOffset=json.accessors.length,meshOffset=json.meshes.length,nodeOffset=json.nodes.length;
for(const view of module.json.bufferViews){
  assert.equal(view.buffer,0);assert(!view.extensions,'Raw module views must not have unreviewed extensions');
  json.bufferViews.push({...view,buffer:0,byteOffset:(view.byteOffset||0)+offset});
}
for(const accessor of module.json.accessors){
  assert(!accessor.sparse,'Sparse modules require separate review');
  json.accessors.push({...accessor,bufferView:accessor.bufferView+viewOffset});
}
for(const mesh of module.json.meshes){
  json.meshes.push({...mesh,primitives:mesh.primitives.map(p=>{
    assert(!p.targets&&!p.extensions,'Unexpected morph/primitive extension');
    return {...p,material:materialMap[p.material],indices:p.indices===undefined?undefined:p.indices+accessorOffset,attributes:Object.fromEntries(Object.entries(p.attributes).map(([key,index])=>[key,index+accessorOffset]))};
  })});
}
for(const node of module.json.nodes){
  assert(node.skin===undefined&&node.camera===undefined&&!node.extensions,'Unexpected module node features');
  json.nodes.push({...node,mesh:node.mesh===undefined?undefined:node.mesh+meshOffset,children:node.children?.map(i=>i+nodeOffset)});
}
assert.equal(module.json.scenes.length,1);
json.scenes[json.scene||0].nodes.push(...module.json.scenes[0].nodes.map(i=>i+nodeOffset));
const binary=Buffer.concat([base.binary,module.binary]);json.buffers[0].byteLength=binary.length;
assert(binary.subarray(0,base.binary.length).equals(base.binary));
assert.deepEqual(json.materials,base.json.materials,'Existing PBR, UV bindings and bake metadata stay exact');
assert.deepEqual(json.nodes.slice(0,nodeOffset),base.json.nodes,'Existing transforms and instancing stay exact');
assert.deepEqual(json.bufferViews.slice(0,viewOffset),base.json.bufferViews,'Existing compressed buffer views stay exact');
const output=writeGlb(json,binary),transport=args.out.endsWith('.gz')?gzipSync(output,{level:9}):output;
await mkdir(path.dirname(path.resolve(args.out)),{recursive:true});await writeFile(args.out,transport);
const report={scope:'Reviewed Blender module appended offline; existing binary payload, material records, accessors, nodes and compressed views unchanged. Only declared old primitives are removed.',inputSha256:hash(input),moduleSha256:hash(raw),outputSha256:hash(transport),decodedSha256:hash(output),unchangedBinaryPrefixSha256:hash(base.binary),unchangedBinaryPrefixBytes:base.binary.length,removedMaterial:args['replace-material']||null,removedPrimitives:removed,addedMeshes:module.json.meshes.length,addedNodes:module.json.nodes.length,materialBindings:module.json.materials.map((m,i)=>({name:m.name,existingMaterial:materialMap[i]})),texturesAdded:0,liveLightsAdded:0};
await mkdir(path.dirname(path.resolve(args.report)),{recursive:true});await writeFile(args.report,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
