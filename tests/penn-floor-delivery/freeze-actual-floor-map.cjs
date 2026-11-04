'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createRequire}=require('node:module'),{createHash}=require('node:crypto');
const tools=createRequire('/Users/stavreskimario/Desktop/penn-station-work/tools/package.json'),THREE=tools('three');
const {parseUncompressedGlb,bary3}=require('./replay-floor-transition.cjs');
const W='/Users/stavreskimario/Desktop/penn-station-work/phase13-track-enclosure';
const rawPath=path.join(W,'integration/floor-bake-v2/raw/model-platform-enclosure-floor.glb'),partPath=path.join(W,'geometry/floor-ownership-v1/partition-full.json');
const sha=b=>createHash('sha256').update(b).digest('hex'),raw=fs.readFileSync(rawPath),part=fs.readFileSync(partPath),source=JSON.parse(part),fresh=parseUncompressedGlb(raw,THREE);
assert.equal(sha(raw),'2647455bca48022e0effaaa746636482f49d5418c8b17f614d19d8a111bfed79');assert.equal(sha(part),'f7261ea341d621a20fd897d076323c8f635e0bf03ea610e608979f54f7c46a49');
const families={RailwayTrackBaseConcreteEnclosure13:['Railway smooth concrete track base',0],RailwayPlatformRubbedConcreteEnclosure13:['RailwayPlatformRubbedConcretePhase9',1],RailwayPlatformStippledGranolithicEnclosure13:['RailwayPlatformStippledGranolithicPhase9',1]};
const triangles=[];let maximumMappingResidual=0,maxAmbiguousUvError=0;const counts={};
for(const t of fresh){const [material,channel]=families[t.material],candidates=[];
 for(const row of source.rows.filter(r=>r.material===material)){
  try { const bc=t.corners.map(c=>bary3(c.world,...row.sourceCorners.map(x=>x.pos)));
   if(!row.sourceCorners.every(c=>Array.isArray(c[`uv${channel}`])))throw Error('Missing original active UV channel');
   const uvs=bc.map(b=>[0,1].map(k=>b.reduce((s,w,i)=>s+w*row.sourceCorners[i][`uv${channel}`][k],0)));
   candidates.push({row,bc,uvs});
  }catch(_){}
 }
 assert(candidates.length>0,`Original source face found for actual triangle ${t.node}/${t.primitive}/${t.triangleOffset}`);
 const chosen=candidates[0];
 for(const q of candidates.slice(1))for(let i=0;i<3;i++)for(let k=0;k<2;k++)maxAmbiguousUvError=Math.max(maxAmbiguousUvError,Math.abs(chosen.uvs[i][k]-q.uvs[i][k]));
 for(let i=0;i<3;i++)for(let k=0;k<3;k++){const p=chosen.bc[i].reduce((s,w,j)=>s+w*chosen.row.sourceCorners[j].pos[k],0);maximumMappingResidual=Math.max(maximumMappingResidual,Math.abs(p-t.corners[i].world[k]));}
 counts[t.material]=(counts[t.material]||0)+1;
 triangles.push({material:t.material,source:{node:chosen.row.node,primitive:chosen.row.primitive,triangleOffset:chosen.row.triangleOffset,activeAOChannel:channel},raw:{node:t.node,primitive:t.primitive,triangleOffset:t.triangleOffset},corners:t.corners.map((c,i)=>({world:c.world,normal:c.normal,uv0:c.uv0,uv:c.uv,legacyUV:chosen.uvs[i]}))});
}
assert.equal(triangles.length,402);assert(maximumMappingResidual<2e-5);assert(maxAmbiguousUvError<2e-6);
const mapping={schema:1,qualification:'Independently derived from every actual uncompressed exported floor triangle and canonical original source corners. World coordinates are Main0; weight uses XZ only. No hand-painted mask or producer weight is accepted.',rawFloorGlbSha256:sha(raw),decodedPartitionSha256:sha(part),triangles};
const bytes=Buffer.from(JSON.stringify(mapping)+'\n');fs.writeFileSync(path.join(__dirname,'402-floor-world-uv-map.json'),bytes);
const proof={schema:1,status:'PASS independently reconstructed every actual floor triangle, no GPU or root writes',actualTriangles:triangles.length,counts,sourceMeshPath:rawPath,sourceMeshBytes:raw.length,sourceMeshSha256:sha(raw),sourcePartitionPath:partPath,sourcePartitionBytes:part.length,sourcePartitionSha256:sha(part),maximumWorldReconstructionResidualM:maximumMappingResidual,maximumAmbiguousOriginalUvDifference:maxAmbiguousUvError,mappingFile:'402-floor-world-uv-map.json',mappingBytes:bytes.length,mappingSha256:sha(bytes)};
fs.writeFileSync(path.join(__dirname,'actual-floor-map-corner-proof.json'),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof,null,2));
