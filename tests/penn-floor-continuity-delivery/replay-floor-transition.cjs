'use strict';
// Independent consumer: does not execute the producer or trust recorded PASS flags.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const sha = b => createHash('sha256').update(b).digest('hex');
const EXPECTED_PARTITION_SHA = '0df7e730faf9ece5a8d43e8bb833f3274ee24d5be8f90ff5c0bbeebf6dd06572';
const EXPECTED_MAP_SHA = 'a95b13a98582cd4680d01dec32bf1904acd74bede13fee711731d1095b31867d';
const EXPECTED_PHYSICAL_RECORD_SHA = 'bb82a0a8c7f78973055f288bb88430648b8b7ca71e667639a6d19f7b45397f1f';
const ROOF = { x: [-152.2857,-121.4247], z:[6.1014,41.26878867924528] };
const APRON = { x: [-162.2857,-111.4247], z:[3.1014,45.3] };
const families = {
  RailwayTrackBaseConcreteEnclosure14: { source: 'Railway smooth concrete track base', legacy: 'platform', scale: 1, channel: 0 },
  RailwayPlatformRubbedConcreteEnclosure14: { source: 'RailwayPlatformRubbedConcretePhase9', legacy: 'surfaces', scale: 2, channel: 1 },
  RailwayPlatformStippledGranolithicEnclosure14: { source: 'RailwayPlatformStippledGranolithicPhase9', legacy: 'surfaces', scale: 2, channel: 1 },
};
const decode = a => a <= 0.04045 ? a / 12.92 : ((a + 0.055)/1.055) ** 2.4;
const decodeTable = Float64Array.from({length:256},(_,i)=>decode(i/255));
const encode = v => Math.round(255 * Math.max(0, Math.min(1, v <= 0.0031308 ? 12.92*v : 1.055*Math.max(0,v)**(1/2.4)-0.055)));
const clamp = t => Math.max(0, Math.min(1,t));
const smooth = t => { t=clamp(t); return t*t*(3-2*t); };
function roofWeight(x,z) {
 return smooth((x-APRON.x[0])/(ROOF.x[0]-APRON.x[0])) * smooth((APRON.x[1]-x)/(APRON.x[1]-ROOF.x[1])) * smooth((z-APRON.z[0])/(ROOF.z[0]-APRON.z[0])) * smooth((APRON.z[1]-z)/(APRON.z[1]-ROOF.z[1]));
}
function bary3(p,a,b,c) {
 const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]),w=p.map((x,i)=>x-a[i]);
 const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0), uu=dot(u,u),uv=dot(u,v),vv=dot(v,v),wu=dot(w,u),wv=dot(w,v),d=uu*vv-uv*uv;
 assert(Math.abs(d)>1e-18,'Original source triangle is nondegenerate');
 const b1=(vv*wu-uv*wv)/d,b2=(uu*wv-uv*wu)/d,b0=1-b1-b2;
 const rebuilt=a.map((x,i)=>b0*x+b1*b[i]+b2*c[i]);
 assert(Math.max(...rebuilt.map((x,i)=>Math.abs(x-p[i])))<2e-5,'Mapped point is on original source face');
 if(Math.min(b0,b1,b2)<0) {
  const distanceToSegment=(a,b)=>{const v=b.map((x,i)=>x-a[i]),w=p.map((x,i)=>x-a[i]),t=clamp(dot(v,w)/dot(v,v));return Math.sqrt(a.reduce((sum,x,i)=>sum+(x+t*v[i]-p[i])**2,0));};
  assert(Math.min(distanceToSegment(a,b),distanceToSegment(b,c),distanceToSegment(c,a))<2e-5,'Mapped point is inside original triangle within exported float precision');
 }
 return [b0,b1,b2];
}
async function image(sharp,b) {
 const r=await sharp(b).removeAlpha().raw().toBuffer({resolveWithObject:true});
 assert.equal(r.info.channels,3);return r;
}
function bilinearLinear(tex,uv,scale) {
 const xx=uv[0]*tex.info.width-.5, yy=uv[1]*tex.info.height-.5, ix=Math.floor(xx),iy=Math.floor(yy),fx=xx-ix,fy=yy-iy, out=[0,0,0];
 for(let dy=0;dy<2;dy++) for(let dx=0;dx<2;dx++) {
  const x=Math.max(0,Math.min(tex.info.width-1,ix+dx)),y=Math.max(0,Math.min(tex.info.height-1,iy+dy)),weight=(dx?fx:1-fx)*(dy?fy:1-fy), off=(y*tex.info.width+x)*3;
  for(let k=0;k<3;k++)out[k]+=decodeTable[tex.data[off+k]]*weight*scale;
 }
 return out;
}
function parseUncompressedGlb(bytes,THREE) {
 if(bytes[0]===0x1f&&bytes[1]===0x8b)bytes=gunzipSync(bytes);
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 const jlen=bytes.readUInt32LE(12),j=JSON.parse(bytes.subarray(20,20+jlen)),bin=bytes.subarray(28+jlen),triangles=[];
 function acc(id) {
  const a=j.accessors[id],bv=j.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],sz={5126:4,5125:4,5123:2,5121:1}[a.componentType],stride=bv.byteStride||n*sz,start=(bv.byteOffset||0)+(a.byteOffset||0),out=[];
  assert(!a.sparse&&!bv.extensions,'Source decoder expects retained uncompressed accessor data');
  for(let i=0;i<a.count;i++){let q=[];for(let k=0;k<n;k++){const o=start+i*stride+k*sz;q.push(a.componentType===5126?bin.readFloatLE(o):a.componentType===5125?bin.readUInt32LE(o):a.componentType===5123?bin.readUInt16LE(o):bin[o]);}out.push(q);}return out;
 }
 function visit(id,parent) {
  const node=j.nodes[id],m=node.matrix?new THREE.Matrix4().fromArray(node.matrix):new THREE.Matrix4().compose(new THREE.Vector3(...(node.translation||[0,0,0])),new THREE.Quaternion(...(node.rotation||[0,0,0,1])),new THREE.Vector3(...(node.scale||[1,1,1])));m.premultiply(parent);
  if(node.mesh!==undefined)j.meshes[node.mesh].primitives.forEach((p,pi)=>{
   assert(!p.extensions?.KHR_draco_mesh_compression,'Raw floor source must be uncompressed');const pos=acc(p.attributes.POSITION),norm=acc(p.attributes.NORMAL),uv0=acc(p.attributes.TEXCOORD_0),uv=acc(p.attributes.TEXCOORD_1),nm=new THREE.Matrix3().getNormalMatrix(m),ids=p.indices!==undefined?acc(p.indices).map(a=>a[0]):pos.map((_,i)=>i),material=j.materials[p.material].name;
   assert(families[material],`Known receiver family ${material}`);
   for(let t=0;t<ids.length;t+=3)triangles.push({material,node:id,primitive:pi,triangleOffset:t/3,corners:ids.slice(t,t+3).map(i=>({world:new THREE.Vector3(...pos[i]).applyMatrix4(m).toArray(),normal:new THREE.Vector3(...norm[i]).applyMatrix3(nm).normalize().toArray(),uv0:uv0[i],uv:uv[i]}))});
  });for(const child of node.children||[])visit(child,m);
 }
 for(const id of j.scenes[j.scene||0].nodes)visit(id,new THREE.Matrix4());return triangles;
}
function verifyMountedMap(document,mapping,THREE) {
 const actual=[];
 for(const node of document.getRoot().listNodes()) {
  const mesh=node.getMesh();if(!mesh)continue;
  const matrix=new THREE.Matrix4().fromArray(node.getWorldMatrix()),nm=new THREE.Matrix3().getNormalMatrix(matrix);
  for(const p of mesh.listPrimitives()) {
   const actualMaterial=p.getMaterial()?.getName(),material=actualMaterial?.replace(/Phase14Floor$/, '');if(!families[material])continue;
   assert.equal(actualMaterial, material+'Phase14Floor','Mounted floor material has the explicit source family suffix');
   assert.equal(p.getMaterial().getExtras().sky_illumination,'lighting-platform-continuity-floor-sky.webp','Actual mounted floor uses the transformed atlas');
   const pos=p.getAttribute('POSITION'),normal=p.getAttribute('NORMAL'),uv0=p.getAttribute('TEXCOORD_0'),uv1=p.getAttribute('TEXCOORD_1'),ids=p.getIndices();
   assert(pos&&normal&&uv0&&uv1&&ids,'Mounted receivers retain all required source attributes');
   const v=(a,i)=>a.getElement(i,[]);
   for(let i=0;i<ids.getCount();i+=3) {
    const corners=[0,1,2].map(k=>{const id=ids.getScalar(i+k);return {world:new THREE.Vector3(...v(pos,id)).applyMatrix4(matrix).toArray(),normal:new THREE.Vector3(...v(normal,id)).applyMatrix3(nm).normalize().toArray(),uv0:v(uv0,id),uv:v(uv1,id)};});
    actual.push({material,corners});
   }
  }
 }
 assert.equal(actual.length,600,'Currently mounted model contains exactly the frozen600 receiver triangles');
 const used=new Set(),maximum={world:0,normal:0,uv0:0,uv:0};
 for(const t of mapping.triangles) {
  let found=null;
  for(let i=0;i<actual.length&&!found;i++) {
   if(used.has(i)||actual[i].material!==t.material)continue;
   for(let rotation=0;rotation<3;rotation++) {
    const a=actual[i].corners;
    if(t.corners.every((c,k)=>['world','normal','uv0','uv'].every(key=>c[key].every((v,j)=>Math.abs(v-a[(k+rotation)%3][key][j])<({world:2e-5,normal:2e-6,uv0:2e-6,uv:2e-7}[key]))))) {found={i,rotation};break;}
   }
  }
  assert(found,'Frozen map matches actual mounted oriented P/N/UV0/UV1 corners');used.add(found.i);
  for(let k=0;k<3;k++)for(const key of Object.keys(maximum))for(let j=0;j<t.corners[k][key].length;j++)maximum[key]=Math.max(maximum[key],Math.abs(t.corners[k][key][j]-actual[found.i].corners[(k+found.rotation)%3][key][j]));
 }
 assert.equal(used.size,600);return {triangles:600,maximumAbsoluteDifference:maximum};
}
module.exports={roofWeight,decode,encode,bary3,parseUncompressedGlb,verifyMountedMap};
