// Reproduce the OLD delivered position lattice for ownership matching only.
// Historical Blender/raw sources stay immutable. Every projected vertex and
// oriented triangle must exist in the pinned delivered base; exact combined
// multiplicity separates owned geometry from protected neighbours. No nearest
// surface snapping, normal relaxation or remover tolerance increase is used.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {parseGlb,decodeView} from './meshopt_patch_io.mjs';
import {worldNodes} from './gltf_hierarchy.mjs';
import {writeGlb} from '../asset_io.mjs';
const requireTools=createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools','package.json'));
const {Vector3}=requireTools('three');
const sha=b=>createHash('sha256').update(b).digest('hex');
const wanted=new Set(['Railway platform concrete interpretation','Railway unpainted stone coping','Railway smooth concrete track base']);
const pinned={
 full:'0b0bc9fa2d6974c20edd05cab9af900991222e6b9245dc9c5e587c7226bdd9de',
 low:'974e1e637eb63ad4626744c2d47948647931641976b434e70db713a31f1f5c35',
 owned:'53814f12236f587dc596fd2ad5b5310525641eedf23fddfcf88251ceede58769',
 protected:'54dbafaaed019b69001041b7761cd661baabd920be7b3643794d3dbe8964382b',
};
function readers(model){
 const views=new Map(),cache=new Map();
 return index=>{
  if(cache.has(index))return cache.get(index);
  const a=model.json.accessors[index],v=model.json.bufferViews[a?.bufferView];
  assert(a&&v&&!a.sparse,'Complete non-sparse ownership accessor');
  const widths={5122:2,5123:2,5125:4,5126:4},methods={5122:'getInt16',5123:'getUint16',5125:'getUint32',5126:'getFloat32'},n={SCALAR:1,VEC3:3}[a.type],w=widths[a.componentType],method=methods[a.componentType];
  assert(n&&w&&method,'Reviewed scalar/vector layout');
  if(!views.has(a.bufferView)){if(v.extensions?.EXT_meshopt_compression)views.set(a.bufferView,decodeView(model,a.bufferView));else{assert.equal(v.buffer??0,0,'Raw input uses embedded buffer0');views.set(a.bufferView,model.binary.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength));}}
  const bytes=views.get(a.bufferView),data=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),stride=v.byteStride||w*n,divisor=a.normalized?({5122:32767,5123:65535}[a.componentType]):1;
  assert(divisor,'Known normalization rule');
  const read=i=>{assert(Number.isInteger(i)&&i>=0&&i<a.count);return Array.from({length:n},(_,k)=>{const value=data[method]((a.byteOffset||0)+i*stride+k*w,true)/divisor;return a.normalized&&a.componentType===5122?Math.max(-1,value):value;});};cache.set(index,read);return read;
 };
}
export function certifyProjectedVertex(world,target){
 assert(world?.isVector3&&world.toArray().every(Number.isFinite),'Finite source world vertex');
 const q=world.clone().applyMatrix4(target.inverse).toArray().map(v=>Math.round(v*32767));
 assert(q.every(v=>v>=-32767&&v<=32767),'Projection stays in declared signed normalized lattice');
 assert(target.points.has(q.join(',')),'Projected source vertex must exist exactly in the actual same-material delivered batch');
 const actual=new Vector3(...q.map(v=>v/32767)).applyMatrix4(target.matrix),delta=world.distanceTo(actual),axis=world.toArray().map((v,k)=>Math.abs(v-actual.getComponent(k)));
 // Only arithmetic roundoff is allowed in the analytic half-cell check.
 assert(axis.every(v=>v<=target.step/2+Number.EPSILON*1024),'Projection stays within the analytic half-cell displacement bound');
 return {q,actual,delta,axis};
}
function orientedKey(q){const k=q.map(p=>p.join(',')),rotations=[k,[k[1],k[2],k[0]],[k[2],k[0],k[1]]];return rotations.map(a=>a.join(';')).sort()[0];}
export function certifyProjectedTriangle(points,actualTriangles){
 assert(points.length===3&&points.every(p=>p.length===3&&p.every(Number.isSafeInteger)),'Exact three-corner integer triangle');
 assert(!degenerate(points),'A projected source triangle must not collapse');
 const key=orientedKey(points);assert(actualTriangles.has(key),'Projected oriented triangle must exist exactly in the actual delivered batch');return key;
}
function add(map,key,value){if(!map.has(key))map.set(key,[]);map.get(key).push(value);}
function degenerate(q){const a=q[1].map((v,k)=>BigInt(v-q[0][k])),b=q[2].map((v,k)=>BigInt(v-q[0][k]));return[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]].every(v=>v===0n);}

export function projectPlatformOwnership(baseBytes,ownedBytes,protectedBytes,{variant}={}){
 assert(['full','low'].includes(variant),'Explicit full/low variant required');
 const transport=Buffer.from(baseBytes),base=parseGlb(transport);
 assert.equal(sha(base.bytes),pinned[variant],'Pinned delivered base identity');
 const sources={owned:{file:'platform-section-owned-old.glb',sha:pinned.owned,model:parseGlb(Buffer.from(ownedBytes))},protected:{file:'platform-retained-occluder.glb',sha:pinned.protected,model:parseGlb(Buffer.from(protectedBytes))}};
 for(const [role,s]of Object.entries(sources)){
  assert.equal(sha(s.model.bytes),s.sha,`Pinned ${role} raw source identity`);
  assert.equal(s.model.json.buffers.length,1,'Historical source authority is raw embedded geometry');
  assert(!s.model.json.extensionsUsed?.includes('EXT_meshopt_compression'),'Historical source authority is not an optimized derivative');
 }
 const files=new Map();
 const br=readers(base),targets=new Map();
 for(const{index,matrix}of worldNodes(base.json)){const node=base.json.nodes[index];if(node.mesh===undefined)continue;for(const[pi,p]of base.json.meshes[node.mesh].primitives.entries()){const material=base.json.materials[p.material]?.name;if(!wanted.has(material))continue;assert(!targets.has(material),'One uninstanced source batch per target material');assert(!node.extensions?.EXT_mesh_gpu_instancing,'Target is not instanced');const a=base.json.accessors[p.attributes.POSITION];assert(a.componentType===5122&&a.normalized===true,'Actual delivered Int16 normalized position lattice');
  const e=matrix.elements;assert(e[0]>0&&e[0]===e[5]&&e[0]===e[10]&&[1,2,3,4,6,7,8,9,11].every(i=>e[i]===0)&&e[15]===1,'Reviewed uniform axis-aligned actual lattice matrix');
  const position=br(p.attributes.POSITION),vertices=Array.from({length:a.count},(_,i)=>{const p=position(i),q=p.map(v=>Math.round(v*32767));assert(q.every((v,k)=>v/32767===p[k]),'Every decoded position is an exact point of the declared integer lattice');return q;}),points=new Set(vertices.map(p=>p.join(','))),indices=br(p.indices),count=base.json.accessors[p.indices].count,triangles=new Map();
  for(let i=0;i<count;i+=3){const q=[0,1,2].map(k=>vertices[indices(i+k)[0]]);add(triangles,orientedKey(q),{offset:i/3,q});}
  targets.set(material,{node:index,mesh:node.mesh,primitive:pi,p,matrix,inverse:matrix.clone().invert(),step:e[0]/32767,points,vertices,triangles});
 }}
 const identities=[...targets.values()].map(t=>t.matrix.elements);assert(identities.every(a=>JSON.stringify(a)===JSON.stringify(identities[0])),'All reviewed materials share one actual position lattice');
 const proof={schema:1,status:'EXACT DELIVERED-LATTICE OWNERSHIP AUTHORITY; not historical source alteration or runtime publication',variant,base:{transportSha256:sha(transport),decodedSha256:sha(base.bytes)},sources:Object.fromEntries(Object.entries(sources).map(([role,s])=>[role,{file:s.file,sha256:s.sha}])),method:'Transform each unchanged source vertex to Main0 world, inverse-transform by actual delivered batch matrix, round normalized coordinates*32767 to nearest integer, require exact actual same-material decoded vertex and oriented-triangle membership. No nearest-surface snapping or matching-tolerance increase.',lattice:{matrix:identities[0],stepMetres:[...targets.values()][0].step,maximumHalfCellAxisMetres:[...targets.values()][0].step/2,maximumHalfCell3dMetres:[...targets.values()][0].step*Math.sqrt(3)/2},roles:{},materials:{},files:{}};
 const roleTriangles={},mapping=[];
 for(const[role,s]of Object.entries(sources)){
  const sr=readers(s.model),chunks=[],json={asset:{version:'2.0',generator:'Source ownership projected onto exact existing delivered Int16 lattice; source originals retained'},extensionsUsed:['KHR_mesh_quantization'],extensionsRequired:['KHR_mesh_quantization'],scene:0,scenes:[{nodes:[]}],nodes:[],meshes:[],materials:[...wanted].map(name=>({name})),accessors:[],bufferViews:[],buffers:[{byteLength:0}]},materialIds=new Map(json.materials.map((m,i)=>[m.name,i]));let size=0;
  function append(bytes,target){const view=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:size,byteLength:bytes.length,target});chunks.push(bytes);size+=bytes.length;const padding=(4-size%4)%4;if(padding){chunks.push(Buffer.alloc(padding));size+=padding;}return view;}
  const stats={sourceObjects:0,vertices:0,verticesExactlyPresentInBase:0,triangles:0,degenerateProjectedTriangles:0,maximumProjectionDeltaMetres:0,maximumAxisProjectionDeltaMetres:[0,0,0],sourceNegativeDeterminants:0};roleTriangles[role]=new Map();
  for(const{index,matrix}of worldNodes(s.model.json)){const node=s.model.json.nodes[index];if(node.mesh===undefined)continue;for(const[pi,p]of s.model.json.meshes[node.mesh].primitives.entries()){
   const material=s.model.json.materials[p.material]?.name;if(!wanted.has(material))continue;const target=targets.get(material),a=s.model.json.accessors[p.attributes.POSITION],position=sr(p.attributes.POSITION),projected=[],sourceWorld=[];assert(!node.extensions?.EXT_mesh_gpu_instancing,'Authority source objects are individual original components');assert((p.mode??4)===4,'Triangle list source');
   for(let i=0;i<a.count;i++){
    const world=new Vector3().fromArray(position(i)).applyMatrix4(matrix),{q,actual,delta:d,axis}=certifyProjectedVertex(world,target);stats.maximumProjectionDeltaMetres=Math.max(stats.maximumProjectionDeltaMetres,d);axis.forEach((v,k)=>stats.maximumAxisProjectionDeltaMetres[k]=Math.max(stats.maximumAxisProjectionDeltaMetres[k],v));stats.vertices++;stats.verticesExactlyPresentInBase++;projected.push(q);sourceWorld.push(world.toArray());
   }
   const ir=sr(p.indices),ic=s.model.json.accessors[p.indices].count,negative=matrix.determinant()<0,indices=[];if(negative)stats.sourceNegativeDeterminants++;
   for(let i=0;i<ic;i+=3){const ids=(negative?[0,2,1]:[0,1,2]).map(k=>ir(i+k)[0]),q=ids.map(i=>projected[i]),key=material+'|'+certifyProjectedTriangle(q,target.triangles);add(roleTriangles[role],key,{sourceNode:index,sourcePrimitive:pi,triangle:i/3,name:node.name});indices.push(...ids);stats.triangles++;if(degenerate(q))stats.degenerateProjectedTriangles++;}
   const pos=Buffer.alloc(projected.length*6);projected.forEach((q,i)=>q.forEach((v,k)=>pos.writeInt16LE(v,i*6+k*2)));const posView=append(pos,34962),posAccessor=json.accessors.length;json.accessors.push({bufferView:posView,componentType:5122,type:'VEC3',count:projected.length,normalized:true,min:[0,1,2].map(k=>Math.min(...projected.map(p=>p[k]))),max:[0,1,2].map(k=>Math.max(...projected.map(p=>p[k])))});
   const ix=Buffer.alloc(indices.length*2);indices.forEach((v,i)=>ix.writeUInt16LE(v,i*2));const ixView=append(ix,34963),ixAccessor=json.accessors.length;json.accessors.push({bufferView:ixView,componentType:5123,type:'SCALAR',count:indices.length});
   const mesh=json.meshes.length;json.meshes.push({name:node.name,primitives:[{attributes:{POSITION:posAccessor},indices:ixAccessor,mode:4,material:materialIds.get(material)}]});const ni=json.nodes.length;json.nodes.push({name:node.name,matrix:target.matrix.toArray(),mesh});json.scenes[0].nodes.push(ni);stats.sourceObjects++;mapping.push({role,sourceNode:index,sourcePrimitive:pi,name:node.name,material,sourceWorld,quantized:projected,sourceMatrix:matrix.toArray(),targetMatrix:target.matrix.toArray(),sourceIndices:indices});
  }}
  json.buffers[0].byteLength=size;const bytes=writeGlb(json,Buffer.concat(chunks)),file=role+'-delivered-lattice-authority.glb';files.set(file,bytes);proof.roles[role]=stats;proof.files[file]={sha256:sha(bytes),bytes:bytes.length};
 }
 for(const[material,t]of targets){const stats={baseTriangles:0,ownedTriangles:0,protectedTriangles:0,ambiguousOwnedProtectedSignatures:0,exactCombinedMultiplicity:true};for(const[key,list]of t.triangles){const qualified=material+'|'+key,o=roleTriangles.owned.get(qualified)||[],p=roleTriangles.protected.get(qualified)||[];assert.equal(o.length+p.length,list.length,`Exact source/base triangle multiplicity: ${material}/${key}`);stats.baseTriangles+=list.length;stats.ownedTriangles+=o.length;stats.protectedTriangles+=p.length;if(o.length&&p.length)stats.ambiguousOwnedProtectedSignatures++;}assert.equal(stats.ambiguousOwnedProtectedSignatures,0,'No same-oriented triangle is jointly owned and protected');proof.materials[material]=stats;}
 assert.equal(proof.roles.owned.sourceObjects,428);assert.equal(proof.roles.owned.triangles,5216);assert.equal(proof.roles.owned.vertices,10392);assert.equal(proof.roles.owned.degenerateProjectedTriangles,0);assert.equal(proof.roles.protected.degenerateProjectedTriangles,0);
 const mappingBytes=Buffer.from(JSON.stringify(mapping)),mappingFile='per-source-vertex-projection.json.gz';const compressedMapping=gzipSync(mappingBytes,{level:9});files.set(mappingFile,compressedMapping);proof.files[mappingFile]={sha256:sha(compressedMapping),decodedSha256:sha(mappingBytes)};

 files.set('authority-proof.json',Buffer.from(JSON.stringify(proof,null,2)+'\n'));
 return {files,proof};
}
async function main(){
 const args={};for(let i=2;i<process.argv.length;i+=2){assert(['--base','--owned','--protected','--variant','--out'].includes(process.argv[i])&&process.argv[i+1],'Expected named ownership arguments');args[process.argv[i].slice(2)]=process.argv[i+1];}
 for(const k of['base','owned','protected','variant','out'])assert(args[k],`Missing ${k}`);
 const out=path.resolve(args.out),repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');assert(out!==repo&&!out.startsWith(repo+path.sep),'Use a new external output directory');
 const inputs=await Promise.all(['base','owned','protected'].map(k=>fs.readFile(path.resolve(args[k]))));
 const result=projectPlatformOwnership(...inputs,{variant:args.variant});await fs.mkdir(out,{recursive:false});
 for(const [name,bytes]of result.files)await fs.writeFile(path.join(out,name),bytes,{flag:'wx'});
 const after=await Promise.all(['base','owned','protected'].map(k=>fs.readFile(path.resolve(args[k]))));after.forEach((b,i)=>assert(b.equals(inputs[i]),'Source inputs remain byte-exact'));
 console.log(JSON.stringify(result.proof,null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
