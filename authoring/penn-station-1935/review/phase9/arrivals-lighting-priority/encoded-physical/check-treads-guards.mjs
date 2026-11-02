// Physical outcomes on decoded geometry. No synthesized support or collider exclusions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadWorld,sha} from '/Users/stavreskimario/Desktop/penn-station-work/phase7-arrivals/arrivals-runtime-queries.mjs';
import {parseGlb} from '/Users/stavreskimario/Desktop/penn-station-reconstruction/penn-station-1935/model/meshopt_patch_io.mjs';
import {decodedTriangles} from '/Users/stavreskimario/Desktop/penn-station-reconstruction/tests/helpers/penn-decoded-geometry.mjs';

const work='/Users/stavreskimario/Desktop/penn-station-work',repo='/Users/stavreskimario/Desktop/penn-station-reconstruction',out=work+'/phase9-interiors/arrivals-encoded-physical-v2/treads-guards.json';
assert(!fs.existsSync(out),'Fresh receipt required');
const raw=work+'/phase7-arrivals/candidate-eight-v1/arrivals-module.glb',base=work+'/phase7-arrivals/packaging-v1/concourse-without-old-exit.glb.gz',full=work+'/phase9-interiors/arrivals-optimized-uv-priority-v2/model-concourse.glb',low=work+'/phase9-interiors/arrivals-optimized-uv-priority-v2/model-concourse-low.glb',manifest=repo+'/penn-station-1935/assets/scene-manifest.json',proofPath=work+'/phase7-arrivals/candidate-eight-v1/source-proof.json';
const pins=Object.fromEntries([raw,base,full,low,manifest,proofPath].map(p=>[p,sha(fs.readFileSync(p))]));
assert.equal(pins[full],'4b3f314ed5ea722729b351a3c6a26a21525490c6036ced76e87a6d249ee6cae8');
assert.equal(pins[low],'6d4d8f6f3c372b52fd4b651b71cbb31134ec29f90c064182b7d9072bcb632591');
const source=JSON.parse(fs.readFileSync(proofPath)),rawModel=parseGlb(fs.readFileSync(raw)),surfaces=new Map();
for(const r of decodedTriangles(rawModel,new Set(['TravertineArrivalsStairStone']))){
 const [a,b,c]=r.triangle,n=[(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]),(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]),(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])];
 if(n[1]/Math.hypot(...n)<.999999)continue;
 assert(Math.max(...r.triangle.map(p=>p[1]))-Math.min(...r.triangle.map(p=>p[1]))<1e-5);
 const node=rawModel.json.nodes[r.nodeIndex??r.node];
 const key=(node?.name??String(r.nodeIndex??r.node))+'|'+a[1].toFixed(5);
 let s=surfaces.get(key);if(!s){s={key,height:a[1],minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity,triangles:0};surfaces.set(key,s);}
 for(const p of r.triangle){s.minX=Math.min(s.minX,p[0]);s.maxX=Math.max(s.maxX,p[0]);s.minZ=Math.min(s.minZ,p[2]);s.maxZ=Math.max(s.maxZ,p[2]);}s.triangles++;
}
assert.equal(surfaces.size,416,'400 physical internal treads plus16 intermediate landings');
assert([...surfaces.values()].every(s=>s.triangles===2),'Each source tread/landing is one physical planar rectangle');
const treadProbes=[];
for(const s of surfaces.values())for(const lane of[-.55,0,.55])for(const fraction of[.1,.5,.9])treadProbes.push({surface:s.key,x:s.minX+(s.maxX-s.minX)*fraction,z:(s.minZ+s.maxZ)/2+lane,y:s.height,lane,fraction});
const guardProbes=[];
for(const stair of source.stairs){
 const segments=[...stair.flights.map((f,i)=>({...f,label:'flight'+(i+1)})),{startX:stair.landing.startX,endX:stair.landing.endX,startY:stair.landing.mainY,endY:stair.landing.mainY,label:'landing'}];
 for(const segment of segments)for(const side of[-1,1])for(let i=1;i<=9;i++){
  const t=i/10,x=segment.startX+(segment.endX-segment.startX)*t,y=segment.startY+(segment.endY-segment.startY)*t;
  guardProbes.push({row:stair.ordinal,stairSide:stair.side,segment:segment.label,edge:side,t,x,y:y+1.06,centreZ:stair.centerZ});
 }
}
const report={schema:1,status:'PENDING',scope:'Every source tread/landing at three actual public lanes and three length positions, plus physical side-guard rays/body stops. Actual raw source must pass the identical probes before encoded full/low are considered. No geometry/collider exceptions.',rules:{treadEncodingHeightBoundM:.002,lanesM:[-.55,0,.55],lengthFractions:[.1,.5,.9],guardRayRangeM:.3,guardBodyRadiusM:.32,guardBodyHeightM:1.85,guardBodyLowerBandM:.35,guardBodyOffsetFromStairCentreM:.85,normalMinimumY:.98},inputs:pins,sourceSurfaces:surfaces.size,publicTreadProbesPerVariant:treadProbes.length,sideGuardProbesPerVariant:guardProbes.length,variants:[]};
let baselineGuards;
for(const variant of['source','full','low']){
 const module=variant==='source'?raw:variant==='full'?full:low,isLow=variant==='low',parts=[base,module],world=loadWorld(repo,isLow,{assetOverrides:{concourse:parts,'concourse-low':parts},manifestFile:manifest,clipMinY:-10.5});
 const row={variant,files:world.files,treadSamples:0,treadSupportedWithinEncoding:0,maxTreadHeightResidualM:0,guardRays:0,guardHits:0,guardBodyProbes:0,guardBodyStops:0,maxGuardSurfaceDisplacementFromRawM:0,failures:[]},actualGuards=[];
 for(const p of treadProbes){
  row.treadSamples++;const hit=world.hits([p.x,p.y+.01,p.z],[0,-1,0],.02,{opaque:true}).find(h=>h.zone==='concourse'&&h.material==='TravertineArrivalsStairStone'&&h.normal[1]>.98),gap=hit?Math.abs(hit.point[1]-p.y):Infinity;
  if(gap<=.002){row.treadSupportedWithinEncoding++;row.maxTreadHeightResidualM=Math.max(row.maxTreadHeightResidualM,gap);}else row.failures.push({reason:'Missing/displaced actual tread surface',probe:p,gap,hit});
 }
 for(const[index,p]of guardProbes.entries()){
  const hit=world.hits([p.x,p.y,p.centreZ+p.edge*.9],[0,0,p.edge],.3,{opaque:true}).find(h=>h.zone==='concourse'&&h.material==='PaintedStructuralIronArrivalsGuard');
  row.guardRays++;if(hit)row.guardHits++;else row.failures.push({reason:'Actual side guard rail missing',probe:p});
  actualGuards.push(hit?.point??null);
  if(hit&&baselineGuards?.[index])row.maxGuardSurfaceDisplacementFromRawM=Math.max(row.maxGuardSurfaceDisplacementFromRawM,Math.hypot(...hit.point.map((v,k)=>v-baselineGuards[index][k])));
  const floor=world.floor(p.x,p.centreZ,p.y-1.06),body=floor&&world.body(p.x,p.centreZ+p.edge*.85,floor.point[1],.32,1.85,{physical:true});
  row.guardBodyProbes++;if(body&&body.zone==='concourse'&&body.material==='PaintedStructuralIronArrivalsGuard')row.guardBodyStops++;else row.failures.push({reason:'Side guard fails actual body stop',probe:p,floor,body});
 }
 if(variant==='source'){assert.equal(row.failures.length,0,'Actual raw-source baseline must pass all guard/tread probes');baselineGuards=actualGuards;}
 row.pass=row.failures.length===0;report.variants.push(row);world.dispose();console.log(JSON.stringify({...row,files:undefined,failures:row.failures.slice(0,2)}));
}
assert(Object.entries(pins).every(([p,value])=>sha(fs.readFileSync(p))===value),'Inputs unchanged during check');
report.status=report.variants.every(r=>r.pass)?'PASS: physical public treads, landings and side guards preserved':'HOLD: encoded physical outcome failure';report.generatorSha256=sha(fs.readFileSync(new URL(import.meta.url)));fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');assert(report.variants.every(r=>r.pass),report.status);
