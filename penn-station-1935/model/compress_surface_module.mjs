// Lossless Meshopt transport for the small Phase9 platform surface module.
// Textures must already be external KTX2 files from shareGlbTextures. Encode
// raw attribute views without quantization/filtering and indices with INDICES
// so no vertex, UV, normal, Float32 bit, index order or authored transform moves.
import assert from'node:assert/strict';
import fs from'node:fs/promises';
import path from'node:path';
import{fileURLToPath}from'node:url';
import{createHash}from'node:crypto';
import{gzipSync}from'node:zlib';
import{parseGlb,decodeView,MeshoptEncoder,MeshoptDecoder}from'./meshopt_patch_io.mjs';
import{writeGlb}from'../asset_io.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const names=['RailwayPlatformRubbedConcretePhase9','RailwayPlatformStippledGranolithicPhase9'];
const sizes={5123:2,5125:4,5126:4},components={SCALAR:1,VEC2:2,VEC3:3,VEC4:4};
const attributes=new Set(['POSITION','NORMAL','TANGENT','TEXCOORD_0','TEXCOORD_1']);
function add(map,key,value){if(!map.has(key))map.set(key,[]);map.get(key).push(value);}

export function compressSurfaceModule(inputBytes,{expectedInputSha256}={}){
 const input=Buffer.from(inputBytes);assert(/^[a-f0-9]{64}$/.test(expectedInputSha256||''),'Pinned input transport SHA256 required');assert.equal(sha(input),expectedInputSha256,'Pinned source module identity');
 const source=parseGlb(input),j=source.json;
 assert.equal(j.buffers?.length,1,'One raw embedded geometry buffer required');assert(!j.buffers[0].uri,'No external geometry buffer');assert.equal(j.buffers[0].byteLength,source.binary.length,'Exact original BIN byte length');
 assert(!j.extensionsUsed?.includes('EXT_meshopt_compression')&&!j.extensionsUsed?.includes('KHR_draco_mesh_compression'),'Input must be raw geometry before compression');
 assert(!j.extensionsUsed?.includes('KHR_mesh_quantization'),'Module must retain original Float32 attributes');
 for(const key of['skins','animations','cameras'])assert.equal(j[key]?.length||0,0,`No ${key} in this surface module`);
 assert(!j.extensions,'No unreviewed root extension payload');
 assert.deepEqual(j.materials?.map(m=>m.name).sort(),[...names].sort(),'Exactly the two reviewed platform-surface material families');
 assert.equal(j.meshes?.length,1,'One reviewed baked architecture mesh');assert.equal(j.nodes?.length,1,'One reviewed baked architecture node');
 assert(j.extensionsUsed?.includes('KHR_texture_basisu')&&j.extensionsRequired?.includes('KHR_texture_basisu'),'External KTX2 textures are already required');
 assert(j.images?.length>0&&j.textures?.length>0,'PBR texture references required');
 for(const image of j.images){assert(image.bufferView===undefined&&/^textures\/[0-9a-f]{20}\.ktx2$/.test(image.uri||''),'Only canonical shared external KTX2 images');assert(!image.mimeType||image.mimeType==='image/ktx2','KTX2 image declaration');}
 for(const texture of j.textures){assert(texture.extensions?.KHR_texture_basisu?.source!==undefined,'Every module texture uses KHR_texture_basisu');const index=texture.extensions.KHR_texture_basisu.source;assert(Number.isInteger(index)&&j.images[index],'Texture source exists');}
 const uses=new Map(),refs=new Map(),materialTriangles=new Map();let triangleCount=0;
 for(const node of j.nodes){assert(Number.isInteger(node.mesh)&&j.meshes[node.mesh],'Node has one existing authored mesh');assert(node.skin===undefined&&!node.extensions&&node.weights===undefined,'No skin, node extension or morph payload');}
 for(const mesh of j.meshes){assert(mesh.weights===undefined,'No mesh morph weights');assert.equal(mesh.primitives.length,2,'Two reviewed baked material batches');for(const p of mesh.primitives){
  assert((p.mode??4)===4&&Number.isInteger(p.indices),'Indexed source triangle lists');assert(!p.targets&&!p.extensions,'No morph or primitive extension layout');assert(names.includes(j.materials[p.material]?.name),'Reviewed material binding');
  const position=j.accessors[p.attributes?.POSITION],normal=j.accessors[p.attributes?.NORMAL];assert(position&&normal,'Positions and normals are required');
  for(const[semantic,index]of Object.entries(p.attributes)){assert(attributes.has(semantic),'Only standard reviewed surface attributes');const a=j.accessors[index];assert(a&&a.componentType===5126&&!a.normalized&&a.count===position.count,'Every authored attribute stays Float32 with its original vertex count');assert(a.type===(semantic.startsWith('TEXCOORD')?'VEC2':semantic==='TANGENT'?'VEC4':'VEC3'),'Standard attribute component shape');add(uses,index,'attribute');}
  const a=j.accessors[p.indices];assert(a&&a.type==='SCALAR'&&[5123,5125].includes(a.componentType)&&!a.normalized&&a.count%3===0,'Complete unsigned triangle indices');const indexView=j.bufferViews[a.bufferView],indexWidth=sizes[a.componentType];assert(indexView,'Existing index buffer view');for(let i=0;i<a.count;i++){const offset=(indexView.byteOffset||0)+(a.byteOffset||0)+i*indexWidth,value=indexWidth===2?source.binary.readUInt16LE(offset):source.binary.readUInt32LE(offset);assert(value<position.count,'Every index refers to an actual source vertex');}add(uses,p.indices,'indices');triangleCount+=a.count/3;const name=j.materials[p.material].name;materialTriangles.set(name,(materialTriangles.get(name)||0)+a.count/3);
 }}
 assert.equal(triangleCount,2426,'Reviewed baked module triangle count');assert.equal(materialTriangles.get(names[0]),2256,'Reviewed concrete geometry count');assert.equal(materialTriangles.get(names[1]),170,'Reviewed dressing geometry after six documented hidden-interface removals');
 assert.equal(uses.size,j.accessors.length,'No orphan/unreviewed geometry accessor');
 for(const[i,a]of j.accessors.entries()){
  assert(!a.sparse&&Number.isInteger(a.bufferView),'No sparse or absent standard accessor');const view=j.bufferViews[a.bufferView];assert(view&&view.buffer===0&&!view.extensions,'Raw embedded standard view');assert(Number.isInteger(a.count)&&a.count>0&&sizes[a.componentType]&&components[a.type],'Known complete accessor layout');assert(new Set(uses.get(i)).size===1,'Index/attribute aliases cannot share an accessor');add(refs,a.bufferView,{index:i,a,kind:uses.get(i)[0]});
 }
 assert.equal(refs.size,j.bufferViews.length,'No orphan/image/extension buffer view remains');
 const ordered=j.bufferViews.map((v,i)=>({...v,index:i})).sort((a,b)=>(a.byteOffset||0)-(b.byteOffset||0));let end=0;
 for(const v of ordered){const start=v.byteOffset||0;assert(Number.isInteger(start)&&start>=end&&Number.isInteger(v.byteLength)&&v.byteLength>0&&start+v.byteLength<=source.binary.length,'Nonoverlapping complete original view ranges');assert(source.binary.subarray(end,start).every(v=>v===0),'Only zero alignment padding outside reviewed views');end=start+v.byteLength;}assert(source.binary.subarray(end).every(v=>v===0),'No unknown trailing BIN payload');
 const json=structuredClone(j),chunks=[],proof=[];let size=0,scalarCount=0;
 for(const[i,view]of j.bufferViews.entries()){
  const list=refs.get(i),kinds=new Set(list.map(r=>r.kind));assert.equal(kinds.size,1,'A view cannot mix attributes and triangle indices');const kind=list[0].kind,elementSizes=new Set(list.map(r=>sizes[r.a.componentType]*components[r.a.type]));
  let stride;
  if(kind==='indices'){assert(view.byteStride===undefined&&view.target===34963&&elementSizes.size===1,'Tightly packed one-width unsigned index view');stride=[...elementSizes][0];assert([2,4].includes(stride));}
  else{assert(view.target===34962,'Standard vertex attribute view');if(view.byteStride!==undefined)stride=view.byteStride;else{assert.equal(elementSizes.size,1,'A packed view has one exact element width');stride=[...elementSizes][0];}assert(Number.isInteger(stride)&&stride>=4&&stride<=252&&stride%4===0,'Valid unfiltered attribute stride');}
  assert.equal(view.byteLength%stride,0,'Complete compression elements only');const covered=new Uint8Array(view.byteLength);
  for(const{a}of list){const width=sizes[a.componentType]*components[a.type],offset=a.byteOffset||0;assert(Number.isInteger(offset)&&offset>=0&&offset%sizes[a.componentType]===0&&width<=stride&&offset+(a.count-1)*stride+width<=view.byteLength,'Accessor fits its exact declared stride/range');for(let n=0;n<a.count;n++){covered.fill(1,offset+n*stride,offset+n*stride+width);if(kind==='attribute')for(let k=0;k<components[a.type];k++)assert(Number.isFinite(source.binary.readFloatLE((view.byteOffset||0)+offset+n*stride+k*4)),'Finite original Float32 surface attributes');}scalarCount+=a.count*components[a.type];}
  const raw=source.binary.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);assert(raw.every((v,k)=>covered[k]||v===0),'Undeclared view padding must be zero');
  const count=view.byteLength/stride,mode=kind==='indices'?'INDICES':'ATTRIBUTES',encoded=Buffer.from(MeshoptEncoder.encodeGltfBuffer(raw,count,stride,mode)),decoded=new Uint8Array(raw.length);MeshoptDecoder.decodeGltfBuffer(decoded,count,stride,encoded,mode);assert(Buffer.from(decoded).equals(raw),'Every decoded original view byte is EXACT');
  const changed=json.bufferViews[i];changed.buffer=1;changed.extensions={EXT_meshopt_compression:{buffer:0,byteOffset:size,byteLength:encoded.length,count,byteStride:stride,mode}};chunks.push(encoded);size+=encoded.length;const pad=(4-size%4)%4;if(pad){chunks.push(Buffer.alloc(pad));size+=pad;}
  proof.push({view:i,kind,mode,filter:'NONE',count,stride,decodedBytes:raw.length,decodedSha256:sha(raw),encodedBytes:encoded.length});
 }
 const binary=Buffer.concat(chunks);json.buffers=[{byteLength:binary.length},{byteLength:source.binary.length,extensions:{EXT_meshopt_compression:{fallback:true}}}];
 for(const name of['extensionsUsed','extensionsRequired'])json[name]=[...j[name],'EXT_meshopt_compression'];
 const bytes=writeGlb(json,binary),check=parseGlb(bytes);
 for(const[i,v]of j.bufferViews.entries()){const raw=source.binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength);assert(Buffer.from(decodeView(check,i)).equals(raw),'Written GLB retains exact decoded buffer-view bytes');}
 for(const key of Object.keys(j).filter(k=>!['buffers','bufferViews','extensionsUsed','extensionsRequired'].includes(k)))assert.deepEqual(check.json[key],j[key],`Original ${key} stays exact`);
 return {bytes,report:{schema:1,status:'LOSSLESS MODULE COMPRESSION PASS; no geometry generation, quantization, simplification or filtering',inputSha256:expectedInputSha256,decodedInputSha256:sha(source.bytes),outputSha256:sha(bytes),triangleCount,accessors:j.accessors.length,decodedAccessorScalars:scalarCount,viewCount:proof.length,allDecodedViewBytesExact:true,allAccessorDefinitionsIndicesAttributesTransformsMaterialsTexturesExact:true,sourcePositions:'Float32 retained exactly',indexEncoding:'Meshopt INDICES, sequence-preserving',views:proof}};
}
async function main(){
 const args={};for(let i=2;i<process.argv.length;i+=2){assert(['--input','--input-sha256','--out'].includes(process.argv[i])&&process.argv[i+1]);args[process.argv[i].slice(2)]=process.argv[i+1];}for(const k of['input','input-sha256','out'])assert(args[k],`Missing ${k}`);
 const input=path.resolve(args.input),out=path.resolve(args.out),repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');assert(out!==repo&&!out.startsWith(repo+path.sep),'Use a new external output directory');const original=await fs.readFile(input),result=compressSurfaceModule(original,{expectedInputSha256:args['input-sha256']});await fs.mkdir(out,{recursive:false});
 await fs.writeFile(path.join(out,'platform-surface-module.glb'),result.bytes,{flag:'wx'});await fs.writeFile(path.join(out,'platform-surface-module.glb.gz'),gzipSync(result.bytes,{level:9}),{flag:'wx'});await fs.writeFile(path.join(out,'lossless-proof.json'),JSON.stringify(result.report,null,2)+'\n',{flag:'wx'});assert((await fs.readFile(input)).equals(original),'Input remains unchanged');console.log(JSON.stringify(result.report,null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
