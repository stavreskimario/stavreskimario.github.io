// Package measured Non-Color finish derivatives; never rebuild architecture.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {canonicalKtx,readGlb,writeGlb} from '../asset_io.mjs';
const args={};
for(let i=2;i<process.argv.length;i+=2){assert(['--input','--out','--library','--work'].includes(process.argv[i])&&process.argv[i+1]);args[process.argv[i].slice(2)]=process.argv[i+1];}
for(const key of ['input','out','library','work'])assert(args[key],`Missing ${key}`);
assert.notEqual(path.resolve(args.input),path.resolve(args.out));
const tools=process.env.PENN_TOOLS||'/private/tmp/penn-station-tools';
const requireTools=createRequire(path.join(tools,'package.json'));
const sharp=requireTools('sharp'),ktx=requireTools('ktx-parse');
const binary=path.join(process.env.KTX_BIN||path.join(tools,'ktx-extracted/KTX-Software-4.4.2-Darwin-arm64-tools.pkg/Payload/usr/local/bin'),'ktx');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
for(const dir of [args.out,args.work,path.join(args.out,'textures')])await mkdir(dir,{recursive:true});
function run(params){const r=spawnSync(binary,params,{encoding:'utf8',maxBuffer:2e6});if(r.status!==0)throw new Error(r.stdout+'\n'+r.stderr);}
const textures=new Map(),report={scope:'Bounded interpreted linear roughness derivatives only; old geometry, nodes, normal/colour/AO/lightmap bindings and BIN bytes stay exact. Original CC0 source maps remain unchanged.',profiles:[],models:[]};
for(const profile of ['InteriorGranite','MilfordGranite','Travertine'])for(const low of [false,true]){
 const name=profile+(low?'-low':'');
 const source=path.join(args.library,`${profile}-roughness${low?'-low':''}.png`);
 const rgb=path.join(args.work,name+'-rgb.png'),encoded=path.join(args.work,name+'.ktx2'),decoded=path.join(args.work,name+'-decoded.png');
 await sharp(source).removeAlpha().toColourspace('srgb').png().toFile(rgb);
 const scalar=await sharp(source).raw().toBuffer({resolveWithObject:true});
 const carrier=await sharp(rgb).raw().toBuffer({resolveWithObject:true});
 assert.equal(scalar.info.width,carrier.info.width);assert.equal(scalar.info.height,carrier.info.height);
 for(let p=0;p<scalar.info.width*scalar.info.height;p++)
   assert.equal(carrier.data[p*carrier.info.channels+1],scalar.data[p*scalar.info.channels],'RGB carrier preserves the original Non-Color scalar exactly');
 run(['create','--format','R8G8B8_UNORM','--assign-tf','linear','--assign-primaries','bt709','--encode','uastc','--uastc-quality','2','--threads','2','--zstd','6','--generate-mipmap',rgb,encoded]);
 const data=canonicalKtx(await readFile(encoded)),container=ktx.read(data);
 assert.equal(container.dataFormatDescriptor[0].transferFunction,1,'Linear roughness transfer');
 run(['extract','--transcode','rgb8','--level','0',encoded,decoded]);
 const original=await sharp(rgb).raw().toBuffer(),roundtrip=await sharp(decoded).removeAlpha().toColourspace('srgb').raw().toBuffer();
 assert.equal(original.length,roundtrip.length);
 let total=0,maximum=0;
 for(let i=1;i<original.length;i+=3){const error=Math.abs(original[i]-roundtrip[i]);total+=error;maximum=Math.max(maximum,error);}
 const meanError=total/(original.length/3)/255;
 assert(meanError<.01,'Roughness UASTC mean error exceeds one percent');
 const uri=`textures/${hash(data).slice(0,20)}.ktx2`;
 await writeFile(path.join(args.out,uri),data);
 const entry={profile,low,sourceFile:path.basename(source),sourceSha256:hash(await readFile(source)),uri,sha256:hash(data),bytes:data.length,dimensions:[container.pixelWidth,container.pixelHeight],mipLevels:container.levels.length,transfer:'linear Non-Color',scalarCarrierPixelsExact:true,roughnessFactor:1,roundtripMeanAbsoluteError:meanError,roundtripMaximumAbsoluteError:maximum/255};
 textures.set(name,entry);report.profiles.push(entry);
}
for(const zone of ['exterior','waiting-room','concourse','context','platform','trains'])for(const low of [false,true]){
 const file=`model-${zone}${low?'-low':''}.glb.gz`,input=await readFile(path.join(args.input,file));
 const base=readGlb(gunzipSync(input)),json=structuredClone(base.json),bindings=[];
 const textureIndices=new Map();
 for(const material of json.materials){
  const profile=['InteriorGranite','MilfordGranite','Travertine'].find(p=>material.name.startsWith(p));
  if(!profile)continue;
  const pbr=material.pbrMetallicRoughness,old=pbr.metallicRoughnessTexture;assert(old,'Expected roughness texture');
  const entry=textures.get(profile+(low?'-low':''));
  const sampler=json.textures[old.index].sampler;
  const key=entry.uri+':'+sampler;
  if(!textureIndices.has(key)){
   const image=json.images.length;json.images.push({uri:entry.uri,mimeType:'image/ktx2'});
   const index=json.textures.length;json.textures.push({sampler,extensions:{KHR_texture_basisu:{source:image}}});textureIndices.set(key,index);
  }
  pbr.metallicRoughnessTexture={...old,index:textureIndices.get(key)};pbr.roughnessFactor=1;
  material.extras={...material.extras,surface_roughness_factor:1,surface_roughness_revision:5,surface_roughness_profile:profile+' bounded B interpretation',surface_roughness_source_sha256:entry.sourceSha256};
  bindings.push({material:material.name,profile,uri:entry.uri});
 }
 for(const key of ['accessors','nodes','meshes','bufferViews','buffers','scenes'])assert.deepEqual(json[key],base.json[key],`${file}: ${key} exact`);
 const output=bindings.length?gzipSync(writeGlb(json,base.binary),{level:9}):input;
 await writeFile(path.join(args.out,file),output);
 report.models.push({file,bindings,inputSha256:hash(input),outputSha256:hash(output),unchangedBinarySha256:hash(base.binary),unchangedBinaryBytes:base.binary.length});
}
await writeFile(path.join(args.out,'finish-roughness-packaging.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({textures:report.profiles.length,textureBytes:report.profiles.reduce((s,t)=>s+t.bytes,0),changedModels:report.models.filter(m=>m.bindings.length).length}));
