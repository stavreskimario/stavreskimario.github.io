'use strict';
const assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{gunzipSync}=require('node:zlib');
const {verifyMountedMap,roofWeight,bary3,decode,encode}=require('./replay-floor-transition.cjs');
const H=b=>createHash('sha256').update(b).digest('hex');
const MAP_SHA='b0f979395ee2bc3db61440030883fd52e067ccf53b6a04749d236340f682e1af';
const PART_SHA={full:'f7261ea341d621a20fd897d076323c8f635e0bf03ea610e608979f54f7c46a49',low:'fd590ffdb987eb90cc284e23cdd71122b8b11bb0af77d04997ee21eba458a61b'};
const RECORD_SHA='7286ce7bd00ef23d7c11e8c31a6b90b4b66515d600b9f57306400eff456864b1';
const ROOF={x:[-152.2857,-121.4247],z:[6.1014,34.212321]},APRON={x:[-162.2857,-111.4247],z:[3.1014,37.212321]};
const F={RailwayTrackBaseConcreteEnclosure13:{source:'Railway smooth concrete track base',family:'track',channel:0,scale:1},RailwayPlatformRubbedConcreteEnclosure13:{source:'RailwayPlatformRubbedConcretePhase9',family:'surface',channel:1,scale:2},RailwayPlatformStippledGranolithicEnclosure13:{source:'RailwayPlatformStippledGranolithicPhase9',family:'surface',channel:1,scale:2}};
const D=Float64Array.from({length:256},(_,i)=>decode(i/255));
const maybeGunzip=b=>b[0]===31&&b[1]===139?gunzipSync(b):b;
async function image(sharp,bytes){const a=await sharp(bytes).removeAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(a.info.channels,3);return a;}
function sample(t,u,v,scale){const xx=u*t.info.width-.5,yy=v*t.info.height-.5,x=Math.floor(xx),y=Math.floor(yy),fx=xx-x,fy=yy-y,o=[0,0,0];for(let j=0;j<2;j++)for(let i=0;i<2;i++){const px=Math.max(0,Math.min(t.info.width-1,x+i)),py=Math.max(0,Math.min(t.info.height-1,y+j)),w=(i?fx:1-fx)*(j?fy:1-fy),idx=(py*t.info.width+px)*3;for(let k=0;k<3;k++)o[k]+=D[t.data[idx+k]]*w*scale;}return o;}
function validateControlMap(control,map,partitions){
 assert.equal(control.schema,1);assert.equal(control.type,'bounded-linear-radiance-stitch');assert.deepEqual(control.roof,ROOF);assert.deepEqual(control.apron,APRON);assert.equal(control.newRadianceScale,2);assert.equal(control.triangles.length,402);
 const rowMaps={};for(const variant of['full','low'])rowMaps[variant]=new Map(partitions[variant].rows.map(r=>[`${r.node}/${r.primitive}/${r.triangleOffset}`,r]));
 let maxOriginalCornerResidual=0,maxBaryUvError=0;
 for(let i=0;i<402;i++){
  const t=control.triangles[i],f=map.triangles[i],family=F[t.material];assert(family);assert.equal(t.material,f.material);assert.deepEqual([t.rawNode,t.rawPrimitive,t.rawTriangleOffset],[f.raw.node,f.raw.primitive,f.raw.triangleOffset]);
  for(let k=0;k<3;k++){
   assert.deepEqual(t.corners[k].pos,f.corners[k].world,'Control world position equals independently frozen actual mesh');assert.deepEqual(t.newUV[k],f.corners[k].uv,'Control newUV equals actual mesh');assert.deepEqual(t.corners[k].newUV,t.newUV[k]);
   assert(t.worldCorners[k].every((v,j)=>Math.abs(v-(f.corners[k].world[j]+(j===1?-4.2672:0)))<1e-9),'World datum offset applied exactly once');
  }
  for(const variant of['full','low']){
   const v=t.variants[variant],id=v.oldSource,row=rowMaps[variant].get(`${id.node}/${id.primitive}/${id.triangleOffset}`);assert(row);assert.equal(row.material,family.source);assert.equal(v.legacyFamily,family.family);assert.deepEqual(v.sourceCorners,row.sourceCorners,'Original source-corner record matches canonical geometry');
   const owned=row.ownedTriangles[id.ownedTriangleIndex];assert(owned&&owned.length===3,'Original owned triangle exists');const used=new Set();
   for(let k=0;k<3;k++){
    const p=t.corners[k].pos,dist=c=>Math.hypot(...p.map((x,j)=>x-c.pos[j]));let best=-1,bestd=Infinity;
    for(let j=0;j<3;j++)if(!used.has(j)&&dist(owned[j])<bestd){best=j;bestd=dist(owned[j]);}
    assert(bestd<2e-5,'Actual mesh corner matches actual original owned corner within float export precision');used.add(best);maxOriginalCornerResidual=Math.max(maxOriginalCornerResidual,bestd);
    assert.deepEqual(v.legacyUV[k],owned[best][`uv${family.channel}`],'Legacy UV comes exactly from original owned source corner');
    const bc=bary3(p,...row.sourceCorners.map(c=>c.pos));for(let u=0;u<2;u++){const expected=bc.reduce((s,w,j)=>s+w*row.sourceCorners[j][`uv${family.channel}`][u],0);maxBaryUvError=Math.max(maxBaryUvError,Math.abs(expected-v.legacyUV[k][u]));assert(Math.abs(expected-v.legacyUV[k][u])<2e-6,'Original UV agrees with independently computed source-face barycentrics');}
   }
  }
 }
 return{triangles:402,maxOriginalCornerResidualM:maxOriginalCornerResidual,maxBaryUvError};
}
async function replayVariant({variant,control,delivery,sharp,load,loadOutput}){
 const spec=control.variants[variant],W=variant==='full'?4096:512,Hh=W;
 const pin=async p=>{const b=await load(p.path);assert.equal(H(b),p.sha256,`Actual input hash ${p.path}`);assert.equal(b.length,p.bytes);return b;};
 const physical=await image(sharp,await pin(spec.physical));assert.equal(physical.info.width,W);assert.equal(physical.info.height,Hh);
 const legacy={};for(const family of['track','surface']){const a=spec.legacy[family];assert.equal(a.radianceScale,family==='track'?1:2);legacy[family]=await image(sharp,await pin(a));}
 const N=W*Hh,out=Buffer.from(physical.data),covered=new Uint8Array(N),transformed=new Uint8Array(N);let roofPixels=0,transitionPixels=0,overlapPixels=0,coveredPixels=0,analyticalEdgeCorners=0;
 for(const t of control.triangles){const [a,b,c]=t.newUV,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);assert(Math.abs(den)>1e-18);const uv=t.variants[variant].legacyUV,family=F[t.material];
  const x0=Math.max(0,Math.ceil(Math.min(a[0],b[0],c[0])*W-.5)),x1=Math.min(W-1,Math.floor(Math.max(a[0],b[0],c[0])*W-.5)),y0=Math.max(0,Math.ceil(Math.min(a[1],b[1],c[1])*Hh-.5)),y1=Math.min(Hh-1,Math.floor(Math.max(a[1],b[1],c[1])*Hh-.5));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   const idx=y*W+x,U=(x+.5)/W,V=(y+.5)/Hh,w0=((b[1]-c[1])*(U-c[0])+(c[0]-b[0])*(V-c[1]))/den,w1=((c[1]-a[1])*(U-c[0])+(a[0]-c[0])*(V-c[1]))/den,w2=1-w0-w1;if(Math.min(w0,w1,w2)<-1e-9)continue;if(covered[idx]){overlapPixels++;continue;}covered[idx]=1;coveredPixels++;
   const bc=[w0,w1,w2],wx=bc.reduce((s,w,k)=>s+w*t.corners[k].pos[0],0),wz=bc.reduce((s,w,k)=>s+w*t.corners[k].pos[2],0),weight=roofWeight(wx,wz),off=idx*3;
   if(weight===1){roofPixels++;continue;}transitionPixels++;transformed[idx]=1;
   const u=bc.reduce((s,w,k)=>s+w*uv[k][0],0),v=bc.reduce((s,w,k)=>s+w*uv[k][1],0),old=sample(legacy[family.family],u,v,family.scale);
   for(let k=0;k<3;k++)out[off+k]=encode((weight*D[physical.data[off+k]]*2+(1-weight)*old[k])/2);
  }
  for(let k=0;k<3;k++){
   const [x,,z]=t.corners[k].pos,onEdge=Math.min(Math.abs(x-APRON.x[0]),Math.abs(x-APRON.x[1]),Math.abs(z-APRON.z[0]),Math.abs(z-APRON.z[1]))<1e-5;
   if(onEdge){const w=roofWeight(x,z);assert(w<1e-9,'Apron outer edge has legacy weight1');analyticalEdgeCorners++;}
  }
 }
 assert(roofPixels>100,'Actual under-roof atlas pixels verified');assert(transitionPixels>100,'Actual apron pixels verified');assert(analyticalEdgeCorners>0,'Owned geometry reaches the declared apron edge');
 const radius=variant==='full'?4:1;assert.equal(control.padding[`${variant}Radius`],radius);
 const distance=new Uint8Array(N).fill(255),queue=new Int32Array(N);let head=0,tail=0,paddingPixels=0;
 for(let i=0;i<N;i++)if(transformed[i]){distance[i]=0;queue[tail++]=i;}
 while(head<tail){const p=queue[head++],d=distance[p];if(d>=radius)continue;const x=p%W,neighbors=[x>0?p-1:-1,x<W-1?p+1:-1,p>=W?p-W:-1,p<N-W?p+W:-1];for(const q of neighbors)if(q>=0&&!covered[q]&&distance[q]===255){distance[q]=d+1;queue[tail++]=q;out[q*3]=out[p*3];out[q*3+1]=out[p*3+1];out[q*3+2]=out[p*3+2];paddingPixels++;}}
 const replayedPngBytes=await sharp(out,{raw:{width:W,height:Hh,channels:3}}).png({compressionLevel:6}).toBuffer();assert.equal(H(replayedPngBytes),delivery[variant].derivedPngSha256,'Replayed deterministic derived PNG bytes match the retained source-checkpoint hash');
 let retainedDerivedPngPresent=false;try{const retained=await loadOutput(variant,'png',spec.derivedPng);assert.equal(H(retained),H(replayedPngBytes),'Optional current derived PNG is byte-exact');retainedDerivedPngPresent=true;}catch(e){if(e.code!=='ENOENT')throw e;}
 const deliveredBytes=await loadOutput(variant,'webp',spec.derivedWebp);assert.equal(H(deliveredBytes),delivery[variant].deliveredWebpSha256,'Delivered WebP hash');const derived=await image(sharp,deliveredBytes);assert.equal(derived.info.width,W);assert.equal(derived.info.height,Hh);
 let mismatchedSamples=0,maxError=0,unchangedRoofMismatches=0;
 for(let i=0;i<out.length;i++){const delta=Math.abs(out[i]-derived.data[i]);if(delta){mismatchedSamples++;maxError=Math.max(maxError,delta);}}
 // Separately inspect preserved bytes at actual under-roof pixels, independent of the blend replay.
 for(const t of control.triangles){const [a,b,c]=t.newUV,den=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);const x0=Math.max(0,Math.ceil(Math.min(a[0],b[0],c[0])*W-.5)),x1=Math.min(W-1,Math.floor(Math.max(a[0],b[0],c[0])*W-.5)),y0=Math.max(0,Math.ceil(Math.min(a[1],b[1],c[1])*W-.5)),y1=Math.min(W-1,Math.floor(Math.max(a[1],b[1],c[1])*W-.5));for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const U=(x+.5)/W,V=(y+.5)/W,w0=((b[1]-c[1])*(U-c[0])+(c[0]-b[0])*(V-c[1]))/den,w1=((c[1]-a[1])*(U-c[0])+(a[0]-c[0])*(V-c[1]))/den,w2=1-w0-w1;if(Math.min(w0,w1,w2)<-1e-9)continue;const ws=[w0,w1,w2],wx=ws.reduce((s,w,k)=>s+w*t.corners[k].pos[0],0),wz=ws.reduce((s,w,k)=>s+w*t.corners[k].pos[2],0);if(wx>=ROOF.x[0]&&wx<=ROOF.x[1]&&wz>=ROOF.z[0]&&wz<=ROOF.z[1]){const off=(y*W+x)*3;for(let k=0;k<3;k++)if(derived.data[off+k]!==physical.data[off+k])unchangedRoofMismatches++;}}}
 assert.equal(unchangedRoofMismatches,0,'Every actual under-roof RGB sample retains the original physical denoise byte');
 assert.equal(mismatchedSamples,0,`${variant}: every output RGB sample independently replays; mismatches=${mismatchedSamples},max=${maxError}`);
 assert.equal(H(out),delivery[variant].decodedRgbSha256,'Independent replay RGB matches the derived decoded identity');assert(derived.data.equals(out),'Delivered lossless WebP equals every independently replayed RGB byte');
 return{report:{variant,width:W,rgbSamples:out.length,coveredPixels,roofPixels,transitionPixels,paddingPixels,analyticalEdgeCorners,overlapPixels,mismatchedSamples,maxByteError:maxError,underRoofByteChanges:unchangedRoofMismatches,derivedPngSha256:H(replayedPngBytes),deliveredWebpSha256:H(deliveredBytes),retainedDerivedPngPresent},expectedRGB:out};
}
async function verifyFloorDeliveryTransform({record,physicalRecordBytes,controlBytes,mapBytes,partitionFullBytes,partitionLowBytes,sharp,THREE,mountedDocument,load,loadOutput}){
 assert.equal(H(physicalRecordBytes),RECORD_SHA);const physicalRecord=JSON.parse(physicalRecordBytes),unchanged={...record};delete unchanged.deliveryTransform;assert.deepEqual(unchanged,physicalRecord,'Runtime physical denoise record is unchanged except deliveryTransform');
 const delivery=record.deliveryTransform;assert(delivery&&delivery.schema===1&&delivery.type==='bounded-linear-radiance-stitch');assert.equal(delivery.physicalRecordSha256,RECORD_SHA);
 if(controlBytes[0]===31&&controlBytes[1]===139)assert.equal(H(controlBytes),delivery.controlArchiveSha256,'Exact compressed control archive');controlBytes=maybeGunzip(controlBytes);assert.equal(H(controlBytes),delivery.controlDecodedSha256,'Exact decoded control map');
 mapBytes=maybeGunzip(mapBytes);assert.equal(H(mapBytes),MAP_SHA,'Independently frozen actual402-triangle world/UV map');const map=JSON.parse(mapBytes),parts={full:maybeGunzip(partitionFullBytes),low:maybeGunzip(partitionLowBytes)};for(const v of['full','low'])assert.equal(H(parts[v]),PART_SHA[v]);
 const control=JSON.parse(controlBytes),geometry=validateControlMap(control,map,{full:JSON.parse(parts.full),low:JSON.parse(parts.low)}),mounted=verifyMountedMap(mountedDocument,map,THREE),variants=[],expectedRGB={};
 for(const variant of['full','low']){const v=await replayVariant({variant,control,delivery,sharp,load,loadOutput});variants.push(v.report);expectedRGB[variant]=v.expectedRGB;}
 return{report:{status:'PASS independent actual-map/source-corner and every-pixel delivery replay',physicalRecordSha256:H(physicalRecordBytes),controlSha256:H(controlBytes),mapSha256:H(mapBytes),geometry,mounted,variants},expectedRGB};
}
module.exports={verifyFloorDeliveryTransform,validateControlMap,replayVariant};
