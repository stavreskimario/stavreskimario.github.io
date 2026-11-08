import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {createRequire} from 'node:module';
import {parseGlb} from '/Users/stavreskimario/Desktop/penn-station-reconstruction/penn-station-1935/model/meshopt_patch_io.mjs';
import {accessors,worldNodes} from '/Users/stavreskimario/Desktop/penn-station-reconstruction/tests/helpers/penn-decoded-geometry.mjs';
const req=createRequire('/Users/stavreskimario/Desktop/penn-station-work/tools/package.json');
const {Vector3,BufferGeometry,Float32BufferAttribute,Triangle}=req('three');
const {MeshBVH}=req('three-mesh-bvh');
const ROOT='/Users/stavreskimario/Desktop/penn-station-reconstruction', OUT='/Users/stavreskimario/Desktop/penn-station-work/phase10-arrivals-exit/geometry-route-v1/cuts-v5';
await fs.mkdir(OUT,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const sourcePath='/Users/stavreskimario/Desktop/penn-station-work/phase9-interiors/arrivals-p5-curvature-study-v1/candidate-v3-material-fixed/west-p5-curved-study.glb';
const sourceBytes=await fs.readFile(sourcePath),source=parseGlb(sourceBytes),sr=accessors(source),sourceRows=[];
for(const {index,matrix} of worldNodes(source.json)){
 const n=source.json.nodes[index];if(!n.name?.startsWith('Temporary bounded-research end guard')||n.mesh===undefined)continue;
 for(const p of source.json.meshes[n.mesh].primitives){const pos=sr(p.attributes.POSITION),ix=sr(p.indices),count=source.json.accessors[p.indices].count;
  const ts=[];for(let k=0;k<count;k+=3){const t=[0,1,2].map(j=>new Vector3().fromArray(pos(ix(k+j)[0])).applyMatrix4(matrix));ts.push(t);}
  const zmin=Math.min(...ts.flat().map(v=>v.z));if(zmin<-35.9&&zmin>-36.1)sourceRows.push({name:n.name,node:index,triangles:ts});
 }
}
if(sourceRows.length!==24)throw Error('Expected24northsourceguardowners');
const coords=sourceRows.flatMap(r=>r.triangles.flatMap(t=>t.flatMap(v=>v.toArray()))),bg=new BufferGeometry();bg.setAttribute('position',new Float32BufferAttribute(coords,3));const bvh=new MeshBVH(bg,{maxLeafTris:8});
const sp=bg.getAttribute('position'),st=new Triangle(),sn=new Vector3(),qn=new Vector3(),tmp=new Vector3();
const bounds={min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]};for(const v of sourceRows.flatMap(r=>r.triangles.flat()))for(let a=0;a<3;a++){bounds.min[a]=Math.min(bounds.min[a],v.getComponent(a));bounds.max[a]=Math.max(bounds.max[a],v.getComponent(a));}
function sourceMatch(t,tol){
 const cx=(t[0].x+t[1].x+t[2].x)/3;
 if(tol>.004 && cx>-73.15 && cx<-54.962 && t.every(v=>v.x>=-73.205&&v.x<=-54.907&&Math.abs(v.y+3.0504)<.0155&&Math.abs(v.z+36)<.0155))return true;
 if(t.some(v=>[0,1,2].some(a=>v.getComponent(a)<bounds.min[a]-tol||v.getComponent(a)>bounds.max[a]+tol)))return false;
 const samples=[...t,t[0].clone().lerp(t[1],.5),t[1].clone().lerp(t[2],.5),t[2].clone().lerp(t[0],.5),t[0].clone().add(t[1]).add(t[2]).multiplyScalar(1/3)];
 for(const q of samples){const h=bvh.closestPointToPoint(q,{},0,tol);if(!h||h.distance>tol)return false;}
 const c=samples[6],h=bvh.closestPointToPoint(c,{},0,tol);if(!h)return false;
 st.setFromAttributeAndIndices(sp,bg.index.getX(h.faceIndex*3),bg.index.getX(h.faceIndex*3+1),bg.index.getX(h.faceIndex*3+2)).getNormal(sn);new Triangle(...t).getNormal(qn);
 return qn.lengthSq()<1e-20 || sn.dot(qn)>.84 || t.every(v=>(Math.abs(v.x+73.2)<.014||Math.abs(v.x+54.912)<.014)&&Math.abs(v.z+36)<.014&&v.y>=-3.253&&v.y<=-2.078);
}
function key(t){const p=t.map(v=>v.toArray().map(x=>x.toFixed(7)).join(','));return [p.join('|'),[p[1],p[2],p[0]].join('|'),[p[2],p[0],p[1]].join('|')].sort()[0];}
function pack(model,json,extra){let text=Buffer.from(JSON.stringify(json));text=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]);const bin=Buffer.concat([model.binary,...extra]);const bytes=Buffer.alloc(text.length+bin.length+28);bytes.write('glTF');bytes.writeUInt32LE(2,4);bytes.writeUInt32LE(bytes.length,8);bytes.writeUInt32LE(text.length,12);bytes.writeUInt32LE(0x4e4f534a,16);text.copy(bytes,20);const o=text.length+20;bytes.writeUInt32LE(bin.length,o);bytes.writeUInt32LE(0x004e4942,o+4);bin.copy(bytes,o+8);return bytes;}
function appender(model,json){const extra=[];let size=model.binary.length;function put(buf,target){const off=size;extra.push(buf);size+=buf.length;let pad=(4-size%4)%4;if(pad){extra.push(Buffer.alloc(pad));size+=pad;}const i=json.bufferViews.length;json.bufferViews.push({buffer:0,byteOffset:off,byteLength:buf.length,...(target?{target}:{})});json.buffers[0].byteLength=size;return i;}function index(values){const b=Buffer.alloc(values.length*4);values.forEach((v,i)=>b.writeUInt32LE(v,i*4));const view=put(b,34963),a=json.accessors.length;json.accessors.push({bufferView:view,componentType:5125,count:values.length,type:'SCALAR',min:[values.reduce((a,v)=>Math.min(a,v),Infinity)],max:[values.reduce((a,v)=>Math.max(a,v),-Infinity)]});return a;}return{extra,put,index};}
const reports=[];
for(const low of[false,true]){
 const file=`model-concourse${low?'-low':''}.glb.gz`,input=await fs.readFile(path.join(ROOT,'penn-station-1935/assets',file)),m=parseGlb(input),j=structuredClone(m.json),read=accessors(m),app=appender(m,j),rows=[];
 for(const {index:ni,matrix}of worldNodes(m.json)){
  const n=m.json.nodes[ni];if(n.mesh===undefined)continue;
  for(const[pi,p]of m.json.meshes[n.mesh].primitives.entries()){
   if(m.json.materials[p.material]?.name!=='PaintedStructuralIronArrivalsGuard')continue;
   const pos=read(p.attributes.POSITION),ix=read(p.indices),count=m.json.accessors[p.indices].count,trip=[],groups=new Map();
   for(let k=0;k<count;k+=3){const ids=[ix(k)[0],ix(k+1)[0],ix(k+2)[0]],t=ids.map(i=>new Vector3().fromArray(pos(i)).applyMatrix4(matrix));const matched=sourceMatch(t,low?.0045:.003);const row={offset:k,ids,matched,degenerate:new Triangle(...t).getArea()<1e-12};trip.push(row);if(matched){const kk=key(t);if(!groups.has(kk))groups.set(kk,[]);groups.get(kk).push(row);}}
   let duplicateGroups=0,removed=0;for(const g of groups.values()){if(g.length>1){duplicateGroups++;for(let i=0;i<Math.floor(g.length/2);i++)g[i].remove=true;}else if(!g[0].degenerate)g[0].remove=true;}
   const keep=[];for(const t of trip){if(t.remove)removed++;else keep.push(...t.ids);}
   if(removed){j.meshes[n.mesh].primitives[pi].indices=app.index(keep);rows.push({node:ni,primitive:pi,material:m.json.materials[p.material].name,originalTriangles:count/3,candidateMatchedTriangles:[...groups.values()].reduce((a,g)=>a+g.length,0),duplicateTriangleGroupsKeptOne:duplicateGroups,removedTriangles:removed,remainingTriangles:keep.length/3,allRetainedIndicesOriginalOrder:true});}
  }
 }
 const total=rows.reduce((a,r)=>a+r.removedTriangles,0);if(!total)throw Error('No guardsremoved');
 const bytes=pack(m,j,app.extra),gzip=gzipSync(bytes,{level:9,mtime:0}),out=path.join(OUT,file);await fs.writeFile(out,gzip);
 if(!bytes.subarray(28+bytes.readUInt32LE(12),28+bytes.readUInt32LE(12)+m.binary.length).equals(m.binary))throw Error('BINprefixchanged');
 reports.push({kind:'concourse-north-guard-removal',low,inputFile:file,inputSha256:sha(input),outputFile:out,outputSha256:sha(gzip),rawSha256:sha(bytes),sourceOwnerCount:24,sourceTriangles:sourceRows.reduce((a,r)=>a+r.triangles.length,0),removedTriangles:total,primitiveEdits:rows,originalBinPrefixExact:true,sourceMatchingToleranceM:low?.0045:.003});
}
const RECT=[-7.15,-1.45,-87.85,-85.3];
function mix(a,b,t){return{world:a.world.clone().lerp(b.world,t),attrs:Object.fromEntries(Object.keys(a.attrs).map(k=>[k,a.attrs[k].map((v,i)=>v+(b.attrs[k][i]-v)*t)]))};}
function clip(poly,axis,edge,insidePositive){if(!poly.length)return[];const r=[];let a=poly.at(-1),da=(a.world.getComponent(axis)-edge)*(insidePositive?1:-1),ina=da>=-1e-11;for(const b of poly){const db=(b.world.getComponent(axis)-edge)*(insidePositive?1:-1),inb=db>=-1e-11;if(ina!==inb)r.push(mix(a,b,da/(da-db)));if(inb)r.push(b);a=b;da=db;ina=inb;}return r;}
function difference(poly){const out=[];let remain=poly;for(const[axis,edge,positive]of[[0,RECT[0],true],[0,RECT[1],false],[2,RECT[2],true],[2,RECT[3],false]]){const piece=clip(remain,axis,edge,!positive);if(piece.length>=3)out.push(piece);remain=clip(remain,axis,edge,positive);if(!remain.length)break;}return{out,inside:remain};}
for(const low of[false,true]){
 const file=`model-context${low?'-low':''}.glb.gz`,input=await fs.readFile(path.join(ROOT,'penn-station-1935/assets',file)),m=parseGlb(input),j=structuredClone(m.json),read=accessors(m),app=appender(m,j),rows=[];
 for(const{index:ni,matrix}of worldNodes(m.json)){
  const n=m.json.nodes[ni];if(n.mesh===undefined)continue;
  for(const[pi,p]of m.json.meshes[n.mesh].primitives.entries()){
   const mat=m.json.materials[p.material]?.name;if(!['CitySidewalkStone','DarkGraniteCurb','PeriodAsphaltRoadSurface'].includes(mat))continue;
   const ix=read(p.indices),count=m.json.accessors[p.indices].count,pos=read(p.attributes.POSITION),keep=[],newTriangles=[];let touched=0,discarded=0;
   for(let k=0;k<count;k+=3){const ids=[ix(k)[0],ix(k+1)[0],ix(k+2)[0]],poly=ids.map(i=>({world:new Vector3().fromArray(pos(i)).applyMatrix4(matrix),attrs:Object.fromEntries(Object.entries(p.attributes).map(([name,ai])=>[name,read(ai)(i)]))}));
    const xmin=Math.min(...poly.map(v=>v.world.x)),xmax=Math.max(...poly.map(v=>v.world.x)),zmin=Math.min(...poly.map(v=>v.world.z)),zmax=Math.max(...poly.map(v=>v.world.z));
    if(xmax<RECT[0]-1e-10||xmin>RECT[1]+1e-10||zmax<RECT[2]-1e-10||zmin>RECT[3]+1e-10){keep.push(...ids);continue;}
    const{out,inside}=difference(poly);if(inside.length<3){keep.push(...ids);continue;}
    const area=inside.slice(1,-1).reduce((a,v,i)=>a+new Triangle(inside[0].world,v.world,inside[i+2].world).getArea(),0);if(area<1e-10){keep.push(...ids);continue;}
    touched++;if(!out.length)discarded++;for(const q of out)for(let a=1;a<q.length-1;a++){const t=[q[0],q[a],q[a+1]];if(new Triangle(...t.map(v=>v.world)).getArea()>1e-11)newTriangles.push(t);}
   }
   if(touched){if(mat!=='CitySidewalkStone')throw Error('Unexpectedroad/curbintersection '+mat);j.meshes[n.mesh].primitives[pi].indices=app.index(keep);const attrs={};
    for(const name of Object.keys(p.attributes)){const vals=newTriangles.flatMap(t=>t.flatMap(v=>v.attrs[name]));const dim=read(p.attributes[name])(0).length,b=Buffer.alloc(vals.length*4);vals.forEach((v,i)=>b.writeFloatLE(v,i*4));const ai=j.accessors.length;j.accessors.push({bufferView:app.put(b,34962),componentType:5126,count:vals.length/dim,type:{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[dim],...(name==='POSITION'?{min:Array.from({length:dim},(_,a)=>Math.min(...vals.filter((_,i)=>i%dim===a))),max:Array.from({length:dim},(_,a)=>Math.max(...vals.filter((_,i)=>i%dim===a)))}:{})});attrs[name]=ai;}
    const ip=app.index(Array.from({length:newTriangles.length*3},(_,i)=>i));j.meshes[n.mesh].primitives.push({attributes:attrs,indices:ip,material:p.material,mode:4});rows.push({node:ni,primitive:pi,material:mat,originalTriangles:count/3,touchedTriangles:touched,fullyDiscardedTriangles:discarded,retainedOriginalTriangles:keep.length/3,newClippedTriangles:newTriangles.length,allOutsideIndicesAndAttributesExact:true,oldMaterialAndTexturesUnchanged:true});
   }
  }
 }
 if(rows.length!==1)throw Error('ExpectedoneCitySidewalkStoneprimitiveedit');
 const bytes=pack(m,j,app.extra),gzip=gzipSync(bytes,{level:9,mtime:0}),out=path.join(OUT,file);await fs.writeFile(out,gzip);reports.push({kind:'context-north-sidewalk-opening',low,inputFile:file,inputSha256:sha(input),outputFile:out,outputSha256:sha(gzip),rawSha256:sha(bytes),apertureXZ:RECT,primitiveEdits:rows,originalBinPrefixExact:bytes.subarray(28+bytes.readUInt32LE(12),28+bytes.readUInt32LE(12)+m.binary.length).equals(m.binary),qualification:'Scopedpavingremovalonly. NewBlenderwellwalls/reveals and actualWalksupportlandings mustcompletephysicalinterface; no complete-routeacceptanceclaimed.'});
}
const report={status:'EXTERNAL CUT CANDIDATES; independent validation and integrated body/headroom checks required',sourceGuardFile:sourcePath,sourceGuardSha256:sha(sourceBytes),sourceGuardOwners:sourceRows.map(r=>({name:r.name,node:r.node,triangles:r.triangles.length})),reports,generatorSha256:sha(await fs.readFile(new URL(import.meta.url)))};await fs.writeFile(path.join(OUT,'cut-receipt.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
