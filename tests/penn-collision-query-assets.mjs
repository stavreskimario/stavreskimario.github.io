// Compare the original grid neighbourhood and the production conservative
// envelope using the delivered decoded geometry. Camera samples come from the
// retained native34-leg receipt; generated rays are cardinal body/floor probes,
// not a replay of native inputs or a rendered frame-rate certificate.
// PENN_TOOLS=/path/to/tools PENN_COLLISION_REPORT=/external/report.json node tests/penn-collision-query-assets.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools','package.json'));
const {Box3,Vector3,Matrix4,Quaternion,Ray,BufferGeometry,Float32BufferAttribute,Mesh,MeshBasicMaterial,DoubleSide,FrontSide,Raycaster,Matrix3}=require('three');
const {computeBoundsTree,acceleratedRaycast}=require('three-mesh-bvh');Mesh.prototype.raycast=acceleratedRaycast;
const {nearbyCollisionObjects}=await import(root+'/penn-station-1935/src/collision-query.mjs');
const {closedArcadeGlazing}=await import(root+'/penn-station-1935/src/collision-surfaces.mjs');
const {parseGlb}=await import(root+'/penn-station-1935/model/meshopt_patch_io.mjs');
const {accessors,worldNodes}=await import(root+'/tests/helpers/penn-decoded-geometry.mjs');
const CELL=6,sha=b=>createHash('sha256').update(b).digest('hex');
const index={cells:new Map(),records:[],stats:{queries:0,lastCandidates:0,maximumCandidates:0}},models=[],byObject=new Map();
const ignored=m=>!m||(!closedArcadeGlazing(m.name,m.extras)&&(m.name!=='SquareVaultLightGlass')&&((m.extensions?.KHR_materials_transmission?.transmissionFactor??0)>0||m.alphaMode==='BLEND'||/^(Railway (polished running head|worn steel web|embedded timber|tie plates|buffer timber)|Platform.?Nernst|ClockFace|Lettering)/i.test(m.name)));
function add(bounds,label,object){const record={bounds,label,object};index.records.push(record);byObject.set(object,record);for(let x=Math.floor(bounds.min.x/CELL);x<=Math.floor(bounds.max.x/CELL);x++)for(let z=Math.floor(bounds.min.z/CELL);z<=Math.floor(bounds.max.z/CELL);z++){const k=`${x}:${z}`;if(!index.cells.has(k))index.cells.set(k,[]);index.cells.get(k).push(record);}}
for(const zone of ['exterior','waiting-room','concourse','platform']){
 const file=`model-${zone}.glb.gz`,bytes=await fs.readFile(root+'/penn-station-1935/assets/'+file),model=parseGlb(bytes),read=accessors(model),offset=['waiting-room','concourse','platform'].includes(zone)?-4.2672:0;
 models.push({file,sha256:sha(bytes),bytes:bytes.length});
 for(const {index:ni,matrix}of worldNodes(model.json)){
  const n=model.json.nodes[ni];if(n.mesh===undefined)continue;
  const attrs=n.extensions?.EXT_mesh_gpu_instancing?.attributes,count=attrs?model.json.accessors[Object.values(attrs)[0]].count:1;
  for(const [pi,p]of model.json.meshes[n.mesh].primitives.entries()){
   const mat=model.json.materials[p.material];if(ignored(mat))continue;
   const a=model.json.accessors[p.attributes.POSITION],position=read(p.attributes.POSITION),base=new Box3(),verts=[];for(let v=0;v<a.count;v++){const point=position(v);verts.push(...point);base.expandByPoint(new Vector3().fromArray(point));}
   const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(verts,3));if(p.indices!==undefined){const ix=read(p.indices);geometry.setIndex(Array.from({length:model.json.accessors[p.indices].count},(_,i)=>ix(i)[0]));}geometry.boundingBox=base.clone();computeBoundsTree.call(geometry,{maxLeafTris:12});const material=new MeshBasicMaterial({side:mat.doubleSided?DoubleSide:FrontSide});material.name=mat.name;
   for(let i=0;i<count;i++){
    const local=attrs?new Matrix4().compose(new Vector3().fromArray(attrs.TRANSLATION===undefined?[0,0,0]:read(attrs.TRANSLATION)(i)),new Quaternion().fromArray(attrs.ROTATION===undefined?[0,0,0,1]:read(attrs.ROTATION)(i)),new Vector3().fromArray(attrs.SCALE===undefined?[1,1,1]:read(attrs.SCALE)(i))):new Matrix4();
    const world=matrix.clone().multiply(local);world.elements[13]+=offset;const bounds=base.clone().applyMatrix4(world);
    if(attrs&&Math.max(bounds.max.x-bounds.min.x,bounds.max.y-bounds.min.y,bounds.max.z-bounds.min.z)<.12)continue;
    const object=new Mesh(geometry,material);object.matrixAutoUpdate=false;object.matrixWorld.copy(world);object.name=`${zone}:${ni}:${pi}:${i}:${mat.name}`;add(bounds,object.name,object);
   }
  }
 }
}
assert(index.records.length>0&&index.cells.size>0,'Decoded source constructs the complete physical collision index');
const traceFile=path.join(root,'authoring/penn-station-1935/review/phase8/acceptance/native-browser-trace.json.gz'),archive=await fs.readFile(traceFile),source=gunzipSync(archive),trace=JSON.parse(source),queries=[];
for(const phase of trace.phases)for(const t of phase.trace){const p=t.camera.position,f=t.navigation.floorWorld;for(const [dx,dz]of[[1,0],[-1,0],[0,1],[0,-1]])for(const h of[.35,.55,1,1.6])queries.push({origin:{x:p[0],y:f+h,z:p[2]},direction:{x:dx,y:0,z:dz},distance:.44});queries.push({origin:{x:p[0],y:f+.25,z:p[2]},direction:{x:0,y:-1,z:0},distance:.65});}
function query(q,tight){const{origin:o,direction:d,distance:t}=q;if(tight)return nearbyCollisionObjects(index,o,d,t);const end={x:o.x+d.x*t,y:o.y+d.y*t,z:o.z+d.z*t},minY=Math.min(o.y,end.y)-.001,maxY=Math.max(o.y,end.y)+.001,found=new Set();for(let x=Math.floor(Math.min(o.x,end.x)/CELL);x<=Math.floor(Math.max(o.x,end.x)/CELL);x++)for(let z=Math.floor(Math.min(o.z,end.z)/CELL);z<=Math.floor(Math.max(o.z,end.z)/CELL);z++)for(const r of index.cells.get(`${x}:${z}`)||[]){if(r.bounds.max.y>=minY&&r.bounds.min.y<=maxY)found.add(r.object);}return [...found];}
const oldCounts=[],newCounts=[];let independentChecks=0;
for(const q of queries){const old=query(q,false),current=query(q,true);oldCounts.push(old.length);newCounts.push(current.length);const retained=new Set(current);for(const object of old)if(!retained.has(object)){const r=byObject.get(object);const ray=new Ray(new Vector3(q.origin.x,q.origin.y,q.origin.z),new Vector3(q.direction.x,q.direction.y,q.direction.z)),v=ray.intersectBox(r.bounds,new Vector3());assert(!v||v.distanceTo(ray.origin)>q.distance+1e-9,'Independent Three Ray confirms no removed candidate intersects finite segment');independentChecks++;}}
const stats=a=>{const s=[...a].sort((x,y)=>x-y);return{sum:a.reduce((x,y)=>x+y,0),mean:a.reduce((x,y)=>x+y,0)/a.length,p50:s[Math.floor(s.length*.5)],p95:s[Math.floor(s.length*.95)],max:s.at(-1)}};
for(let round=0;round<2;round++)for(const q of queries.slice(0,3000))query(q,round%2===1);
const timings=[];for(let round=0;round<6;round++){const tight=round%2===1,start=performance.now();let count=0;for(const q of queries)count+=query(q,tight).length;timings.push({tight,ms:performance.now()-start,count});}
const caster=new Raycaster();caster.firstHitOnly=true;const normal=new Matrix3();
function intersections(q,tight){caster.set(new Vector3(q.origin.x,q.origin.y,q.origin.z),new Vector3(q.direction.x,q.direction.y,q.direction.z));caster.near=0;caster.far=q.distance;return caster.intersectObjects(query(q,tight),false).filter(hit=>{const name=hit.object.material.name;if(['SquareVaultLightGlass','ConcourseReinforcedVaultLightConcrete','ConcourseOpaqueCirculationConcrete'].includes(name)){if(name!=='SquareVaultLightGlass'&&q.direction.y>=-.5)return true;return q.direction.y<-.5&&hit.face.normal.clone().applyNormalMatrix(normal.getNormalMatrix(hit.object.matrixWorld)).y>.98;}return true;}).map(hit=>({name:hit.object.name,distance:hit.distance,point:hit.point.toArray(),face:hit.faceIndex}));}
const sample=queries;let hitQueries=0,hitCount=0;for(const q of sample){const old=intersections(q,false),current=intersections(q,true);assert.deepEqual(current,old,'Actual source triangle ray hits and ordering remain exact');if(old.length)hitQueries++;hitCount+=old.length;}
const rayTimings=[];for(let round=0;round<6;round++){const tight=round%2===1,start=performance.now();let count=0;for(const q of sample)count+=intersections(q,tight).length;rayTimings.push({tight,ms:performance.now()-start,count});}
const report={scope:'CPU only: exact runtime collider bounds/BVH reconstructed from decoded delivered source geometry; actual new collision-query helper compared with original broad phase. Cardinal body/floor probes replay positions from prior34-leg real-input route. No complete native trace replay or end-to-end frame benchmark is implied.',created:new Date().toISOString(),models,trace:{sha256:sha(source),cameraSamples:queries.length/17},colliders:index.records.length,cells:index.cells.size,queries:queries.length,oldCandidates:stats(oldCounts),tightCandidates:stats(newCounts),independentRemovedBoxChecks:independentChecks,broadphaseTimings:timings,raycastComparison:{queries:sample.length,hitQueries,hitCount,exactOriginalHitsAndOrder:true},rayTimings};
if(process.env.PENN_COLLISION_REPORT){const out=path.resolve(process.env.PENN_COLLISION_REPORT);assert(!out.startsWith(root+path.sep),'Keep timing reports outside the public repository');await fs.mkdir(path.dirname(out),{recursive:true});await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');}console.log(JSON.stringify(report,null,2));
