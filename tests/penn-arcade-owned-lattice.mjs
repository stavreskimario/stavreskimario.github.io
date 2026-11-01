import fs from'node:fs/promises';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{createRequire}from'node:module';import path from'node:path';
import{parseGlb}from'../penn-station-1935/model/meshopt_patch_io.mjs';
import{worldNodes,accessors}from'./helpers/penn-decoded-geometry.mjs';
const require=createRequire(path.join(process.env.PENN_TOOLS||'/private/tmp/penn-station-tools','package.json')),{Vector3}=require('three');
import{reconcileQuadPair}from'./helpers/penn-arcade-exact-quad.mjs';
const args={};for(let i=2;i<process.argv.length;i+=2){assert(['--bases','--sources','--out','--low'].includes(process.argv[i])&&process.argv[i+1]);args[process.argv[i].slice(2)]=process.argv[i+1];}for(const k of['bases','sources','out'])assert(args[k],`Missing ${k}`);const baseRoot=path.resolve(args.bases)+path.sep,source=path.resolve(args.sources)+path.sep,lod=args.low==='true'?'-low':'';
const sha=b=>createHash('sha256').update(b).digest('hex');
const key=q=>{let s=q.map(p=>p.join(','));return[s.join(';'),[s[1],s[2],s[0]].join(';'),[s[2],s[0],s[1]].join(';')].sort()[0];};
const family=n=>({'Travertine.001':'Travertine',...Object.fromEntries([-2,-1,0,1,2].map(i=>['TravertineAshlar'+i,'Travertine']))}[n]||n);
const outputs=[];
for(const [zone,ownedName]of [['exterior','old-arcade-owned-exterior-street0.glb'],['waiting-room','old-arcade-owned-main-main0.glb']]){
 let baseB=await fs.readFile(baseRoot+'model-'+zone+lod+'.glb.gz'),ownedB=await fs.readFile(source+ownedName),base=parseGlb(baseB),owned=parseGlb(ownedB),br=accessors(base),or=accessors(owned);
 const wanted=new Set(owned.json.materials.map(m=>family(m.name))),targets=[];
 for(const {index,matrix}of worldNodes(base.json)){let n=base.json.nodes[index];if(n.mesh===undefined)continue;for(const[pi,p]of base.json.meshes[n.mesh].primitives.entries()){
  let mat=base.json.materials[p.material].name;if(!wanted.has(mat))continue;
  let ar=base.json.accessors[p.attributes.POSITION],pos=br(p.attributes.POSITION),ir=br(p.indices),ix=base.json.accessors[p.indices].count;
  if(ar.componentType!==5122||!ar.normalized)throw Error('Unexpected position layout');
  const vertices=Array.from({length:ar.count},(_,i)=>pos(i).map(v=>Math.round(v*32767))),points=new Set(vertices.map(q=>q.join(','))),triangles=new Map();
  for(let i=0;i<ix;i+=3){const k=key([0,1,2].map(j=>vertices[ir(i+j)[0]]));triangles.set(k,(triangles.get(k)||0)+1);}
  targets.push({id:[index,n.mesh,pi,p.material].join(':'),material:mat,matrix,inverse:matrix.clone().invert(),vertices,points,triangles,grid:matrix.elements[0]/32767});
 }}
 const groups=[];
 for(const{index,matrix}of worldNodes(owned.json)){let n=owned.json.nodes[index];if(n.mesh===undefined)continue;for(const[pi,p]of owned.json.meshes[n.mesh].primitives.entries()){
  let mat=owned.json.materials[p.material].name,pa=owned.json.accessors[p.attributes.POSITION],pos=or(p.attributes.POSITION),ir=or(p.indices),ix=owned.json.accessors[p.indices].count,world=Array.from({length:pa.count},(_,i)=>new Vector3().fromArray(pos(i)).applyMatrix4(matrix));
  const tries=[];for(const t of targets.filter(t=>t.material===family(mat))){let q=world.map(v=>v.clone().applyMatrix4(t.inverse).toArray().map(v=>Math.round(v*32767))),hits=q.filter(v=>t.points.has(v.join(','))).length,missing=0,examples=[],unmatched=[],maxDelta=0,ownedKeys=new Map();for(let i=0;i<q.length;i++)maxDelta=Math.max(maxDelta,world[i].distanceTo(new Vector3(...q[i].map(v=>v/32767)).applyMatrix4(t.matrix)));
   for(let i=0;i<ix;i+=3){let ids=(matrix.determinant()<0?[0,2,1]:[0,1,2]).map(j=>ir(i+j)[0]),k=key(ids.map(i=>q[i]));if(!t.triangles.has(k)){missing++;unmatched.push({offset:i/3,q:ids.map(i=>q[i])});if(examples.length<3)examples.push({triangle:i/3,q:ids.map(i=>q[i]),source:ids.map(i=>world[i].toArray())});}else ownedKeys.set(k,(ownedKeys.get(k)||0)+1);}
   let duplicateExceeded=0;for(let[k,count]of ownedKeys)if(count>t.triangles.get(k))duplicateExceeded++;
   const used=new Set(),quadReconciliations=[];for(let i=0;i<unmatched.length;i++){if(used.has(i))continue;for(let j=i+1;j<unmatched.length;j++){if(used.has(j))continue;const proof=reconcileQuadPair(unmatched[i].q,unmatched[j].q,t.triangles);if(proof){used.add(i);used.add(j);quadReconciliations.push({sourceOffsets:[unmatched[i].offset,unmatched[j].offset],...proof});break;}}}
   tries.push({reverseCases:unmatched.filter(u=>t.triangles.has(key(u.q.toReversed()))).map(u=>({sourceTriangle:u.offset,sourceQ:u.q,retainedTargetOrientedKey:key(u.q.toReversed())})),reverseOrientedMatches:unmatched.filter(u=>t.triangles.has(key(u.q.toReversed()))).length,quadReconciledTriangles:used.size,quadReconciliations,target:t.id,material:t.material,step:t.grid,sourceVertices:pa.count,verticesPresent:hits,sourceTriangles:ix/3,missingTriangles:missing,duplicateExceeded,maxProjectionDelta:maxDelta,missingExamples:examples});
  }
  groups.push({sourceNode:index,sourcePrimitive:pi,sourceMaterial:mat,comparisonFamily:family(mat),targets:tries});
 }}
 const report={zone,lod,base:{transportSha:sha(baseB),decodedSha:sha(base.bytes)},ownedSha:sha(ownedB),sourceFrame:zone==='exterior'?'Street0':'Main0',groups,qualified:'Exploratory exact integer vertex/triangle membership only; normalization needs source provenance before authority publication'};outputs.push(report);console.log(JSON.stringify(report));
}
await fs.writeFile(args.out,JSON.stringify(outputs,null,2)+'\n');
