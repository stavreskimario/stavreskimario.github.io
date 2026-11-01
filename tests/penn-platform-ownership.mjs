// Exact source-to-delivered ownership and protected-neighbour controls.
// PENN_TOOLS=/path/to/tools PENN_PLATFORM_OWNERSHIP_INPUTS=/frozen/inputdir PENN_PLATFORM_OWNERSHIP_REPORT=/external/report.json node tests/penn-platform-ownership.mjs
// Inputdir contains the pinned OLD full/low platform transports and the two
// unchanged raw source exports. Do not substitute later published models.
import assert from'node:assert/strict';
import fs from'node:fs/promises';
import path from'node:path';
import{fileURLToPath}from'node:url';
import{createRequire}from'node:module';
import{createHash}from'node:crypto';
import{projectPlatformOwnership,certifyProjectedVertex,certifyProjectedTriangle}from'../penn-station-1935/model/project_platform_ownership.mjs';
import{removePlatformAccess}from'../penn-station-1935/model/remove_platform_access.mjs';
import{parseGlb}from'../penn-station-1935/model/meshopt_patch_io.mjs';
import{writeGlb}from'../penn-station-1935/asset_io.mjs';
import{decodedTriangles}from'./helpers/penn-decoded-geometry.mjs';
const requireTools=createRequire(path.join(process.env.PENN_TOOLS||'/private/tmp/penn-station-tools','package.json')),{Matrix4,Vector3}=requireTools('three');
const sha=b=>createHash('sha256').update(b).digest('hex'),negative=[];
function reject(label,fn,pattern){assert.throws(fn,pattern,label);negative.push(label);}
const matrix=new Matrix4().makeScale(32767,32767,32767),target={matrix,inverse:matrix.clone().invert(),step:1,points:new Set(['1,2,3'])};
const projected=certifyProjectedVertex(new Vector3(1.49,2.4,2.51),target);assert.deepEqual(projected.q,[1,2,3]);assert.deepEqual(projected.actual.toArray(),[1,2,3]);
reject('nearest existing vertex is not a substitute for actual lattice rounding',()=>certifyProjectedVertex(new Vector3(1.50001,2,3),target),/exist exactly/);
reject('one missing actual decoded vertex rejects source ownership',()=>certifyProjectedVertex(new Vector3(1,2,3),{...target,points:new Set()}),/exist exactly/);
reject('nonfinite source vertex',()=>certifyProjectedVertex(new Vector3(NaN,2,3),target),/Finite/);
reject('projection outside normalized source lattice',()=>certifyProjectedVertex(new Vector3(32768,2,3),target),/signed normalized/);
reject('a wrong projection transform cannot exceed the half-cell bound',()=>certifyProjectedVertex(new Vector3(1,2,3),{...target,matrix:new Matrix4().makeScale(65534,65534,65534)}),/half-cell/);
const tri=[[0,0,0],[2,0,0],[0,2,0]],triangles=new Map([['0,0,0;2,0,0;0,2,0',true]]);
assert.equal(certifyProjectedTriangle(tri,triangles),'0,0,0;2,0,0;0,2,0');
assert.equal(certifyProjectedTriangle([tri[1],tri[2],tri[0]],triangles),'0,0,0;2,0,0;0,2,0','Cyclic codec rotations preserve orientation');
reject('same points with reversed surface orientation are not owned',()=>certifyProjectedTriangle([tri[0],tri[2],tri[1]],triangles),/oriented triangle/);
reject('an adjacent nonowned triangle is never accepted',()=>certifyProjectedTriangle([[0,0,0],[2,0,0],[0,3,0]],triangles),/oriented triangle/);
reject('quantization cannot collapse source geometry into a line',()=>certifyProjectedTriangle([[0,0,0],[1,0,0],[2,0,0]],triangles),/collapse/);
const inputDirectory=process.env.PENN_PLATFORM_OWNERSHIP_INPUTS;assert(inputDirectory,'Set PENN_PLATFORM_OWNERSHIP_INPUTS to the retained old base/source input directory');
const names=['model-platform.glb.gz','model-platform-low.glb.gz','platform-section-owned-old.glb','platform-retained-occluder.glb'],input=await Promise.all(names.map(n=>fs.readFile(path.join(inputDirectory,n))));
reject('explicit variant is required',()=>projectPlatformOwnership(...[input[0],input[2],input[3]]),/Explicit/);
reject('variant cannot claim a different pinned base',()=>projectPlatformOwnership(input[1],input[2],input[3],{variant:'full'}),/base identity/);
const changed=Buffer.from(parseGlb(input[0]).bytes);changed[changed.length-1]^=1;
reject('altered decoded base cannot reuse pinned ownership',()=>projectPlatformOwnership(changed,input[2],input[3],{variant:'full'}),/base identity/);
reject('owned and protected source authorities cannot be swapped',()=>projectPlatformOwnership(input[0],input[3],input[2],{variant:'full'}),/owned raw source/);
const badOwned=Buffer.from(input[2]);badOwned[badOwned.length-1]^=1;
reject('altered source bytes are not a historical authority',()=>projectPlatformOwnership(input[0],badOwned,input[3],{variant:'full'}),/owned raw source/);
const materials=new Set(['Railway platform concrete interpretation','Railway unpainted stone coping','Railway smooth concrete track base']);
function canonical(triangle){const p=triangle.map(v=>v.join(','));return[p,[p[1],p[2],p[0]],[p[2],p[0],p[1]]].map(p=>p.join(';')).sort()[0];}
function census(model){const map=new Map();let count=0;for(const t of decodedTriangles(model,materials)){const key=t.material+'|'+canonical(t.triangle);map.set(key,(map.get(key)||0)+1);count++;}return{count,map};}
const variants=[];
for(const[variant,bytes]of[['full',input[0]],['low',input[1]]]){
 const result=projectPlatformOwnership(bytes,input[2],input[3],{variant}),base=parseGlb(bytes),owned=parseGlb(result.files.get('owned-delivered-lattice-authority.glb')),protectedModel=parseGlb(result.files.get('protected-delivered-lattice-authority.glb'));
 if(variant==='full'){
  reject('default departure scope still rejects platform component materials',()=>removePlatformAccess(base,owned,protectedModel),/Unreviewed old-access material/);
  reject('concourse-circulation scope cannot silently acquire railway materials',()=>removePlatformAccess(base,owned,protectedModel,{scope:'concourse-circulation'}),/Unreviewed old-access material/);
  reject('platform scope cannot widen the six-millimetre global contract',()=>removePlatformAccess(base,owned,protectedModel,{scope:'platform-sections',tolerance:.006001}),/at most6mm/);
  reject('platform scope cannot lower existing source-coverage requirement',()=>removePlatformAccess(base,owned,protectedModel,{scope:'platform-sections',minimumCoverage:.979}),/below98/);
  reject('platform scope cannot relax oriented normals',()=>removePlatformAccess(base,owned,protectedModel,{scope:'platform-sections',normalCosine:.84}),/Normals must preserve/);
 }
 const b=census(base),o=census(owned),p=census(protectedModel);assert.equal(b.count,7224);assert.equal(o.count,5216);assert.equal(p.count,2008);
 for(const[k,n]of b.map){assert.equal((o.map.get(k)||0)+(p.map.get(k)||0),n,'Independent decoded world-space oriented triangle multiplicity');assert(!(o.map.has(k)&&p.map.has(k)),'No same-oriented surface is both owned and protected');}
 assert.equal(o.map.size+p.map.size,b.map.size,'No projected source triangle falls outside the actual base');
 const removed=removePlatformAccess(base,owned,protectedModel,{scope:'platform-sections',tolerance:.00002,minimumCoverage:1,sourceOffsetY:0}),output=parseGlb(writeGlb(removed.json,removed.binary)),r=census(output);
 assert.equal(removed.report.removedTriangles,5216);assert.equal(removed.report.protectedAmbiguousTriangles,0);assert.equal(r.count,2008);assert.deepEqual(r.map,p.map,'Every retained same-material triangle is EXACTLY the protected decoded source; no neighbour deleted');
 assert(output.binary.subarray(0,base.binary.length).equals(base.binary),'All original BIN payloads remain byte-exact');
 assert.deepEqual(output.json.nodes,base.json.nodes,'Every current fixture/instance transform and binding stays exact');
 for(const name of['materials','images','textures','samplers','scenes','extensionsUsed','extensionsRequired'])assert.deepEqual(output.json[name],base.json[name]);
 assert.deepEqual(output.json.accessors.slice(0,base.json.accessors.length),base.json.accessors);
 assert.deepEqual(output.json.bufferViews.slice(0,base.json.bufferViews.length),base.json.bufferViews);
 for(const m of Object.values(removed.report.materials)){assert.equal(m.sourceCentroidCoverage,1);assert.equal(m.quantizedSliversRemoved,0);assert.equal(m.orientationOnlyRetained,0);assert.equal(m.orientationOnlyProtected,0);}
 variants.push({variant,inputSha256:sha(bytes),authority:result.proof,removal:removed.report,retainedDecodedSha256:sha(output.bytes),independentWorldTriangleCounts:{base:b.count,owned:o.count,protected:p.count,retained:r.count},allRetainedWorldTrianglesExactlyProtected:true});
}
const after=await Promise.all(names.map(n=>fs.readFile(path.join(inputDirectory,n))));after.forEach((b,i)=>assert(b.equals(input[i])));
const report={status:'PASS',scope:'Pinned old full/low platform source ownership projected onto the actual delivered grid. Geometry matching uses20micrometre tolerance and100percent source-centroid coverage; no model translation or relaxed remover contract. Original raw sources remain byte-exact.',negativeControls:negative,variants};
if(process.env.PENN_PLATFORM_OWNERSHIP_REPORT){const out=path.resolve(process.env.PENN_PLATFORM_OWNERSHIP_REPORT),repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');assert(!out.startsWith(repo+path.sep));await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({status:report.status,negativeControls:negative.length,variants:variants.map(v=>({variant:v.variant,counts:v.independentWorldTriangleCounts,retainedSha256:v.retainedDecodedSha256,maximumMatchResidualMetres:Math.max(...Object.values(v.removal.materials).map(m=>m.maximumRemovalResidual))}))},null,2));
