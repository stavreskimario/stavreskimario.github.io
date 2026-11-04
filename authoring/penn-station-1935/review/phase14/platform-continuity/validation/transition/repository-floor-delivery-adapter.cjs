'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{gunzipSync}=require('node:zlib');
const {verifyFloorDeliveryTransform}=require('./verify-floor-delivery-transform.cjs');
// All paths are fixed to this known floor transform. No generic alternate-source fallback.
async function verifyRepositoryFloorDelivery({record,repositoryDirectory,assetsDirectory,sharp,THREE,mountedDocument}) {
 const base='authoring/penn-station-1935/lighting/phase14-floor',transition=`${base}/transition`,delivery=record.deliveryTransform;
 assert(delivery&&record.zone==='platform-continuity-floor');
 assert.equal(delivery.controlFile,`${transition}/floor-gi-transition-control.json.gz`);
 const controlBytes=await fs.readFile(path.join(repositoryDirectory,delivery.controlFile)),control=JSON.parse(gunzipSync(controlBytes)),inputs=new Map();
 for(const variant of['full','low']) {
  const suffix=variant==='low'?'-low':'',v=control.variants[variant];
  const physicalName=`lighting-platform-continuity-floor-sky${suffix}.png`;
  assert.equal(path.basename(v.physical.path),physicalName);inputs.set(v.physical.path,path.join(repositoryDirectory,base,'denoised',physicalName));
  for(const family of['track','surface']) {
   const name=`lighting-platform${family==='surface'?'-surfaces':''}-sky${suffix}.webp`;
   assert.equal(path.basename(v.legacy[family].path),name);inputs.set(v.legacy[family].path,path.join(assetsDirectory,name));
  }
  assert.equal(delivery[variant].derivedPng,`${transition}/lighting-platform-continuity-floor-sky-transition${suffix}.png`);
  assert.equal(delivery[variant].deliveredWebp,`lighting-platform-continuity-floor-sky${suffix}.webp`);
 }
 const proof=await verifyFloorDeliveryTransform({
  record,
  physicalRecordBytes:await fs.readFile(path.join(repositoryDirectory,base,'denoised','lighting-platform-continuity-floor-denoise.json')),
  controlBytes,
  mapBytes:await fs.readFile(path.join(repositoryDirectory,transition,'600-floor-world-uv-map.json.gz')),
  partitionFullBytes:await fs.readFile(path.join(repositoryDirectory,'authoring/penn-station-1935/review/phase14/platform-continuity/source/floor-ownership-v1/partition-full.json.gz')),
  partitionLowBytes:await fs.readFile(path.join(repositoryDirectory,'authoring/penn-station-1935/review/phase14/platform-continuity/source/floor-ownership-v1/partition-low.json.gz')),
  sharp,THREE,mountedDocument,
  load:async p=>{assert(inputs.has(p),`Only explicitly mapped physical/legacy input is allowed: ${p}`);return fs.readFile(inputs.get(p));},
  loadOutput:async(variant,type,name)=>{
   const suffix=variant==='low'?'-low':'';
   if(type==='png'){assert.equal(name,`lighting-platform-continuity-floor-sky-transition${suffix}.png`);return fs.readFile(path.join(repositoryDirectory,delivery[variant].derivedPng));}
   assert.equal(type,'webp');assert.equal(name,`lighting-platform-continuity-floor-sky${suffix}.webp`);return fs.readFile(path.join(assetsDirectory,name));
  }
 });
 return proof;
}
module.exports={verifyRepositoryFloorDelivery};
