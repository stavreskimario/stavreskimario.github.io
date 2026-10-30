// Reproducible old-access removal controls. All fixture GLBs/reports are
// synthetic and created in a temporary directory that is removed on exit.
import assert from 'node:assert/strict';
import {writeFile,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {removePlatformAccess} from '../penn-station-1935/model/remove_platform_access.mjs';
import {parseGlb,MeshoptEncoder} from '../penn-station-1935/model/meshopt_patch_io.mjs';
import {writeGlb} from '../penn-station-1935/asset_io.mjs';
import {decodedTriangles} from './helpers/penn-decoded-geometry.mjs';
const req=createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools','package.json'));
const {NodeIO}=req('@gltf-transform/core'),{ALL_EXTENSIONS}=req('@gltf-transform/extensions'),{MeshoptDecoder}=req('meshoptimizer');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.decoder':MeshoptDecoder});
const out=await mkdtemp(path.join(tmpdir(),'penn-access-removal-'));
try {
const sha=b=>createHash('sha256').update(b).digest('hex');
function make(groups,{compressed=false,transformed=false,owned=false}={}){
 const parts=[];let size=0;const json={asset:{version:'2.0'},buffers:[{byteLength:0}],bufferViews:[],accessors:[],materials:[],meshes:[],nodes:[],scenes:[{nodes:[]}],scene:0};
 function add(b){const o=size;parts.push(b);size+=b.length;const pad=(4-size%4)%4;if(pad){parts.push(Buffer.alloc(pad));size+=pad;}return{buffer:0,byteOffset:o,byteLength:b.length};}
 for(const [index,g]of groups.entries()){
  const flat=g.triangles.flat(2),positions=Buffer.from(new Float32Array(flat).buffer),indices=Buffer.from(new Uint16Array(Array.from({length:flat.length/3},(_,i)=>i)).buffer);let view;
  if(compressed){const encoded=Buffer.from(MeshoptEncoder.encodeGltfBuffer(positions,flat.length/3,12,'ATTRIBUTES')),v=add(encoded);view={buffer:1,byteOffset:0,byteLength:positions.length,byteStride:12,target:34962,extensions:{EXT_meshopt_compression:{buffer:0,byteOffset:v.byteOffset,byteLength:v.byteLength,count:flat.length/3,byteStride:12,mode:'ATTRIBUTES'}}};json.buffers[1]={byteLength:Math.max(json.buffers[1]?.byteLength||0,positions.length),extensions:{EXT_meshopt_compression:{fallback:true}}};json.extensionsUsed=['EXT_meshopt_compression'];json.extensionsRequired=['EXT_meshopt_compression'];}
  else view={...add(positions),target:34962};
  const pi=json.bufferViews.push(view)-1,ii=json.bufferViews.push({...add(indices),target:34963})-1;
  const ai=json.accessors.length;json.accessors.push({bufferView:pi,componentType:5126,type:'VEC3',count:flat.length/3},{bufferView:ii,componentType:5123,type:'SCALAR',count:flat.length/3});
  const uv=Buffer.from(new Float32Array(Array.from({length:flat.length/3*2},(_,i)=>i/101)).buffer),uvi=json.bufferViews.push({...add(uv),target:34962})-1;
  const uva=json.accessors.length;json.accessors.push({bufferView:uvi,componentType:5126,type:'VEC2',count:flat.length/3});
  json.materials.push({name:owned?'REMOVAL_'+g.name:g.name,...(owned?{extras:{original_material_name:g.name}}:{}),pbrMetallicRoughness:{baseColorFactor:[.2,.3,.4,1],roughnessFactor:.63}});
  json.meshes.push({name:'batch'+index,primitives:[{attributes:{POSITION:ai,TEXCOORD_0:uva},indices:ai+1,material:index}]});
  json.nodes.push({name:'owned-or-retained'+index,mesh:index,extras:{arbitrary:'must stay exact'}});
 }
 if(transformed){const count=json.nodes.length;json.nodes.push({translation:[3,1,5],children:Array.from({length:count},(_,i)=>i),scale:[2,1,2]});json.scenes[0].nodes=[count];}
 else json.scenes[0].nodes=json.nodes.map((_,i)=>i);
 const binary=Buffer.concat(parts);json.buffers[0].byteLength=binary.length;return parseGlb(writeGlb(json,binary));
}
const t=x=>[[x,0,0],[x,0,2],[x+2,0,0]],world=t=>t.map(([x,y,z])=>[3+2*x,1+y,5+2*z]);
const a=t(0),b=t(4),outside=[[1.5,0,1.5],[1.5,0,2],[2,0,1.5]],far=t(10),clock=t(20),pier=t(30);
const base=make([{name:'AgedBronze',triangles:[a,b,outside,far]},{name:'ClockFace',triangles:[clock]},{name:'PaintedStructuralIron',triangles:[pier]}],{compressed:true,transformed:true});
const owned=make([{name:'AgedBronze',triangles:[world(a),world(b)]},{name:'ClockFace',triangles:[world(clock)]}],{owned:true});
const protection=make([{name:'AgedBronze',triangles:[world(b)]},{name:'PaintedStructuralIron',triangles:[world(pier)]}]);
const result=removePlatformAccess(base,owned,protection,{minimumCoverage:1});
assert.equal(result.report.removedTriangles,2);assert.equal(result.report.protectedAmbiguousTriangles,1);
assert(result.binary.subarray(0,base.binary.length).equals(base.binary));
assert.deepEqual(result.json.materials,base.json.materials);assert.deepEqual(result.json.bufferViews.slice(0,base.json.bufferViews.length),base.json.bufferViews);assert.deepEqual(result.json.accessors.slice(0,base.json.accessors.length),base.json.accessors);
assert.deepEqual(result.json.nodes[0],base.json.nodes[0]);assert.deepEqual(result.json.nodes[2],base.json.nodes[2]);assert.deepEqual(result.json.nodes[3],base.json.nodes[3]);assert.equal(result.json.nodes[1].mesh,undefined);assert.deepEqual(result.json.nodes[1].extras,base.json.nodes[1].extras);
const decoded=[...decodedTriangles(result)],expected=[['AgedBronze',world(b)],['AgedBronze',world(outside)],['AgedBronze',world(far)],['PaintedStructuralIron',world(pier)]];
assert.deepEqual(decoded.map(x=>[x.material,x.triangle]),expected,'Independent decoder must retain exact expected transformed triangles');
await writeFile(out+'/filtered.glb',writeGlb(result.json,result.binary));const doc=await io.read(out+'/filtered.glb');assert.equal(doc.getRoot().listNodes().find(n=>n.getName()==='owned-or-retained0').getMesh().listPrimitives()[0].getIndices().getCount(),9);
const controls=['actual Meshopt positions plus nested TRS correspondence','same material outside target triangle retained despite overlapping bounding box','coincident protected face retained','unrelated iron pier retained exactly','target-only ClockFace node detached without changing unrelated node indices','original BIN prefix/views/accessors/materials/UV payloads exact','independent test decoder agrees with every retained actual triangle','separate glTF Transform reader accepts appended raw index view'];
function rejects(label,fn,pattern){assert.throws(fn,pattern,label);controls.push(label);}
rejects('tolerance over6mm rejected',()=>removePlatformAccess(base,owned,protection,{tolerance:.02}),/tolerance/);
rejects('coverage below98percent rejected',()=>removePlatformAccess(base,owned,protection,{minimumCoverage:.5}),/coverage/);
const shifted=make([{name:'AgedBronze',triangles:[world(a).map(([x,y,z])=>[x,y+.05,z]),world(b).map(([x,y,z])=>[x,y+.05,z])]},{name:'ClockFace',triangles:[world(clock).map(([x,y,z])=>[x,y+.05,z])]}],{owned:true});
rejects('source shifted50mm cannot remove nearby geometry',()=>removePlatformAccess(base,shifted,protection),/No current geometry|No owned/);
const reversed=make([{name:'AgedBronze',triangles:[world(a).toReversed(),world(b).toReversed()]},{name:'ClockFace',triangles:[world(clock)]}],{owned:true});
rejects('opposite oriented source rejected',()=>removePlatformAccess(base,reversed,protection),/No owned AgedBronze/);
const invalid=structuredClone(owned);invalid.json.materials[0].extras.original_material_name='HistoricGlass';rejects('unreviewed removal material alias rejected',()=>removePlatformAccess(base,invalid,protection),/Removal material/);
const skinned=structuredClone(base);skinned.json.nodes[0].skin=0;rejects('skin index0 is rejected',()=>removePlatformAccess(skinned,owned,protection),/skinned/);
const wrongHierarchy=structuredClone(base);wrongHierarchy.json.nodes[3].translation=[4,1,5];rejects('wrong hierarchy registration fails closed',()=>removePlatformAccess(wrongHierarchy,owned,protection),/No current geometry|No owned|coverage/);
const mixed=Array.from({length:32},(_,i)=>i%2?[[i*10,0,0],[i*10+2,0,0],[i*10,2,0]]:t(i*10));
const mixedBase=make([{name:'AgedBronze',triangles:mixed}],{compressed:true});
const mixedOwned=make([{name:'AgedBronze',triangles:mixed.toReversed()}],{owned:true});
const mixedResult=removePlatformAccess(mixedBase,mixedOwned,make([]),{minimumCoverage:1});
assert.equal(mixedResult.report.removedTriangles,32,'Indirect BVH face normals must match original face indices after reordering');
controls.push('32 shuffled mixed-normal faces expose indirect-BVH normal indexing errors');
const thin=[[0,0,0],[0,0,.002],[2,0,0]],wide=t(10);
const sliverBase=make([{name:'AgedBronze',triangles:[thin,wide]}],{compressed:true});
const sliverOwned=make([{name:'AgedBronze',triangles:[thin.toReversed(),wide]}],{owned:true});
const sliverResult=removePlatformAccess(sliverBase,sliverOwned,make([]),{minimumCoverage:1});
assert.equal(sliverResult.report.materials.AgedBronze.quantizedSliversRemoved,1);assert(sliverResult.report.materials.AgedBronze.maximumSliverAltitude<.004);
controls.push('orientation-ambiguous sub4mm sliver requires all seven positional samples');
const vetoResult=removePlatformAccess(sliverBase,sliverOwned,make([{name:'AgedBronze',triangles:[thin.toReversed()]}]),{minimumCoverage:1});
assert.equal(vetoResult.report.removedTriangles,1);assert.equal(vetoResult.report.protectedAmbiguousTriangles,1);assert.equal(vetoResult.report.materials.AgedBronze.quantizedSliversRemoved,0);
controls.push('protected competitor vetoes thin sliver despite opposite face normal');
const largeThin=[[0,0,0],[0,0,.005],[2,0,0]];
rejects('orientation exception rejects altitude above4mm',()=>removePlatformAccess(make([{name:'AgedBronze',triangles:[largeThin]}],{compressed:true}),make([{name:'AgedBronze',triangles:[largeThin.toReversed()]}],{owned:true}),make([])),/No current geometry|No owned/);
const tinyPatch=(a,b,c)=>[a,a.map((v,i)=>v+(b[i]-v)*.001),a.map((v,i)=>v+(c[i]-v)*.001)];
const centre=thin[0].map((_,i)=>(thin[0][i]+thin[1][i]+thin[2][i])/3);
const sparsePatches=[tinyPatch(thin[0],thin[1],thin[2]),tinyPatch(thin[1],thin[2],thin[0]),tinyPatch(thin[2],thin[0],thin[1]),tinyPatch(centre,thin[1],thin[2])].map(x=>x.toReversed());
rejects('matching corners and centroid cannot substitute for all three edge midpoints',()=>removePlatformAccess(make([{name:'AgedBronze',triangles:[thin]}],{compressed:true}),make([{name:'AgedBronze',triangles:sparsePatches}],{owned:true}),make([])),/No current geometry|No owned/);
const reused=structuredClone(base);reused.json.nodes.push({mesh:0,name:'inactive unrelated mesh user'});
rejects('inactive shared-mesh binding cannot be changed incidentally',()=>removePlatformAccess(reused,owned,protection),/Shared meshes/);
rejects('nonfinite source registration rejected',()=>removePlatformAccess(base,owned,protection,{sourceOffsetY:NaN}),/finite/);
assert.deepEqual(result.json.buffers.slice(1,base.json.buffers.length),base.json.buffers.slice(1));
assert.equal(result.report.appendedVirtualBuffer,base.json.buffers.length);
for(const view of result.json.bufferViews.slice(base.json.bufferViews.length)){assert.equal(view.buffer,base.json.buffers.length);assert.equal(view.extensions.EXT_meshopt_compression.mode,'INDICES');assert.equal(view.extensions.EXT_meshopt_compression.buffer,0);}
assert.equal(mixedResult.report.appendedVirtualBuffer,null,'No empty fallback buffer when every owned batch detaches');
controls.push('sequence-preserving compressed index views append one fallback buffer and preserve every old virtual buffer');
const wallBase=make([{name:'BedfordLimestoneConcourse',triangles:[a,b]},{name:'PaintedStructuralIron',triangles:[pier]}],{compressed:true});
const wallOwned=make([{name:'BedfordLimestoneConcourse',triangles:[a]}],{owned:true}),wallProtection=make([{name:'BedfordLimestoneConcourse',triangles:[b]},{name:'PaintedStructuralIron',triangles:[pier]}]);
rejects('departure scope cannot acquire wall-removal ownership',()=>removePlatformAccess(wallBase,wallOwned,wallProtection),/Removal material/);
const wallResult=removePlatformAccess(wallBase,wallOwned,wallProtection,{scope:'concourse-circulation',minimumCoverage:1});
assert.equal(wallResult.report.removedTriangles,1);assert.equal(wallResult.report.removalScope,'concourse-circulation');
assert(wallResult.binary.subarray(0,wallBase.binary.length).equals(wallBase.binary));
assert.deepEqual([...decodedTriangles(wallResult)].map(v=>[v.material,v.triangle]),[['BedfordLimestoneConcourse',b],['PaintedStructuralIron',pier]]);
assert.deepEqual(wallResult.json.materials,wallBase.json.materials);
controls.push('explicit circulation scope removes only selected wall faces and retains unrelated pier, wall, original BIN and material bindings');
rejects('circulation scope cannot acquire legacy furniture-removal ownership',()=>removePlatformAccess(base,owned,protection,{scope:'concourse-circulation'}),/Removal material/);
rejects('unreviewed removal scope rejected',()=>removePlatformAccess(wallBase,wallOwned,wallProtection,{scope:'all'}),/Unreviewed/);
const contactBase=make([{name:'BedfordLimestoneConcourse',triangles:[a,a.toReversed(),far]}],{compressed:true});
const contactProtected=make([{name:'BedfordLimestoneConcourse',triangles:[a.toReversed(),far]}]);
const contactResult=removePlatformAccess(contactBase,wallOwned,contactProtected,{scope:'concourse-circulation',minimumCoverage:1});
assert.equal(contactResult.report.removedTriangles,1);
assert.equal(contactResult.report.materials.BedfordLimestoneConcourse.orientationOnlyProtected,1);
assert.equal(contactResult.report.materials.BedfordLimestoneConcourse.orientationOnlyRetained,0);
assert.deepEqual([...decodedTriangles(contactResult)].map(v=>v.triangle),[a.toReversed(),far]);
controls.push('opposite-facing closed neighbour is retained only with seven-sample oriented protection; owned face still removed');
rejects('unexplained opposite-facing geometry remains a hard failure',()=>removePlatformAccess(contactBase,wallOwned,make([]),{scope:'concourse-circulation',minimumCoverage:1}),/Unresolved oriented/);
const report={status:'passed',controls,fixtureBaseSha256:sha(writeGlb(base.json,base.binary)),outputSha256:sha(writeGlb(result.json,result.binary)),removal:result.report};await writeFile(out+'/controls.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,controls:controls.length,fixtureBaseSha256:report.fixtureBaseSha256,outputSha256:report.outputSha256}));

} finally {
  await rm(out,{recursive:true,force:true});
}
