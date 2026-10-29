// Usage: PENN_TOOLS=/path/to/tools node tests/penn-scalar-codec.mjs BEFORE.glb AFTER.glb OUT_DIR
// Compare the project's unchanged UASTC pipeline before/after scalar separation.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
const [beforeFile,afterFile,out]=process.argv.slice(2);if(!beforeFile||!afterFile||!out)throw new Error('Usage: prove-encoding.mjs SOURCE.glb PREPARED.glb OUT_DIR');
const tools=process.env.PENN_TOOLS,req=createRequire(path.join(tools,'package.json')),sharp=req('sharp'),ktx=req('ktx-parse');
const ktxBin=process.env.KTX_BIN || path.join(tools,'ktx-extracted/KTX-Software-4.4.2-Darwin-arm64-tools.pkg/Payload/usr/local/bin');
const hash=data=>createHash('sha256').update(data).digest('hex');
function parse(bytes){const len=bytes.readUInt32LE(12),json=JSON.parse(bytes.toString('utf8',20,20+len));return {json,bin:bytes.subarray(28+len,28+len+bytes.readUInt32LE(20+len))};}
function refs(value,prefix=[]){const result=[];for(const [key,item]of Object.entries(value||{})){if(/Texture$/i.test(key)&&item&&Number.isInteger(item.index))result.push({slot:[...prefix,key].join('.'),info:item});else if(item&&typeof item==='object'&&!Array.isArray(item))result.push(...refs(item,[...prefix,key]));}return result;}
function imageBytes(model,index){const image=model.json.images[index],view=model.json.bufferViews[image.bufferView];assert.equal(view.buffer,0);return model.bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);}
function role(model,index,info){const texture=model.json.textures[info.index],source=texture.source??texture.extensions?.KHR_texture_basisu?.source;assert(Number.isInteger(source));return {source,bytes:imageBytes(model,source)};}
function encodedPixelHash(bytes){const image=ktx.read(bytes);return hash(Buffer.concat([Buffer.from(JSON.stringify({width:image.pixelWidth,height:image.pixelHeight,depth:image.pixelDepth,faces:image.faceCount,layers:image.layerCount,dfd:image.dataFormatDescriptor})),...image.levels.map(level=>Buffer.from(level.levelData))]));}
function run(command,args,log){const result=spawnSync(command,args,{env:{...process.env,PATH:ktxBin+path.delimiter+process.env.PATH},encoding:'utf8',maxBuffer:20*1024*1024});if(log)return writeFile(log,(result.stdout||'')+'\n'+(result.stderr||'')).then(()=>{assert.equal(result.status,0,result.stdout+'\n'+result.stderr);});assert.equal(result.status,0,result.stdout+'\n'+result.stderr);}
function errors(a,b,channel){const histogram=new Uint32Array(256);let total=0,max=0,beforeSum=0,afterSum=0;for(let i=channel;i<a.length;i+=4){const error=Math.abs(a[i]-b[i]);histogram[error]++;total+=error;max=Math.max(max,error);beforeSum+=a[i];afterSum+=b[i];}const count=a.length/4;let cumulative=0,p99=0;for(let i=0;i<256;i++){cumulative+=histogram[i];if(cumulative>=count*.99){p99=i;break;}}return {mean:total/count,p99,max,sourceMean:beforeSum/count,decodedMean:afterSum/count};}
await mkdir(out,{recursive:true});const versions=spawnSync(path.join(ktxBin,'toktx'),['--version'],{encoding:'utf8'});assert.equal(versions.status,0);assert((versions.stdout+versions.stderr).includes('4.4.2'));
const report={created:new Date().toISOString(),tool:versions.stdout.trim()||versions.stderr.trim(),settings:{encoder:'UASTC',level:1,zstd:6,jobs:2,resizing:false},inputs:{before:{path:beforeFile,sha256:hash(await readFile(beforeFile))},after:{path:afterFile,sha256:hash(await readFile(afterFile))}},roles:[]};
const cli=path.join(tools,'node_modules/@gltf-transform/cli/bin/cli.js');
for(const [name,input]of [['before',beforeFile],['after',afterFile]])await run(process.execPath,[cli,'uastc',input,path.join(out,`${name}-uastc.glb`),'--level','1','--zstd','6','--jobs','2'],path.join(out,`${name}-uastc.log`));
const source=parse(await readFile(beforeFile)),prepared=parse(await readFile(afterFile)),before=parse(await readFile(path.join(out,'before-uastc.glb'))),after=parse(await readFile(path.join(out,'after-uastc.glb')));
const decodeCache=new Map();async function rgba(bytes,compressed){const digest=hash(bytes);if(decodeCache.has(digest))return decodeCache.get(digest);let file;if(compressed){file=path.join(out,`${digest.slice(0,20)}.ktx2`);await writeFile(file,bytes);const png=file.replace('.ktx2','.png');run(path.join(ktxBin,'ktx'),['extract','--transcode','rgba8',file,png]);file=png;}else file=bytes;const metadata=await sharp(file).metadata();assert.equal(metadata.depth,'uchar');const raw=await sharp(file).raw().toBuffer({resolveWithObject:true}),info=raw.info,data=Buffer.alloc(info.width*info.height*4);for(let i=0;i<info.width*info.height;i++){const offset=i*info.channels;data[i*4]=raw.data[offset];data[i*4+1]=raw.data[offset+(info.channels<3?0:1)];data[i*4+2]=raw.data[offset+(info.channels<3?0:2)];data[i*4+3]=info.channels===2?raw.data[offset+1]:info.channels===4?raw.data[offset+3]:255;}const result={data,width:info.width,height:info.height};decodeCache.set(digest,result);return result;}
for(let i=0;i<source.json.materials.length;i++)for(const ref of refs(source.json.materials[i])){
 const lookup=model=>refs(model.json.materials[i]).find(item=>item.slot===ref.slot),old=role(source,i,ref.info),next=role(prepared,i,lookup(prepared).info),encodedBefore=role(before,i,lookup(before).info),encodedAfter=role(after,i,lookup(after).info);
 const entry={material:source.json.materials[i].name,slot:ref.slot,sourceImageUnchanged:hash(old.bytes)===hash(next.bytes),encodedPixelBlocksUnchanged:encodedPixelHash(encodedBefore.bytes)===encodedPixelHash(encodedAfter.bytes)};
 if(entry.sourceImageUnchanged)assert(entry.encodedPixelBlocksUnchanged,`${entry.material}/${entry.slot}: untouched image encoding changed`);
 if(ref.slot==='occlusionTexture'||ref.slot==='pbrMetallicRoughness.metallicRoughnessTexture'){
  const raw=await rgba(old.bytes,false),encoded=await rgba(encodedAfter.bytes,true),baseline=await rgba(encodedBefore.bytes,true);assert.equal(raw.width,encoded.width);assert.equal(raw.height,encoded.height);
  const channels=ref.slot==='occlusionTexture'?[0]:(source.json.materials[i].pbrMetallicRoughness?.metallicFactor??1)!==0?[1,2]:[1];entry.size=[raw.width,raw.height];entry.channels={};
  for(const channel of channels)entry.channels['RGBA'[channel]]={preparedVsSource:errors(raw.data,encoded.data,channel),baselineVsSource:errors(raw.data,baseline.data,channel),preparedVsBaseline:errors(baseline.data,encoded.data,channel)};
 }
 report.roles.push(entry);
}
function uniqueBytes(model){const files=new Map();for(let i=0;i<(model.json.images||[]).length;i++){const bytes=imageBytes(model,i);files.set(hash(bytes),bytes.length);}return {count:files.size,bytes:[...files.values()].reduce((a,b)=>a+b,0)};}
report.images={before:uniqueBytes(before),after:uniqueBytes(after)};report.savedImageBytes=report.images.before.bytes-report.images.after.bytes;report.status='passed';await writeFile(path.join(out,'codec-proof.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:report.status,roles:report.roles.length,images:report.images,savedImageBytes:report.savedImageBytes}));
