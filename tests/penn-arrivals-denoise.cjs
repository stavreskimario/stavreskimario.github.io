/* Synthetic provenance checks for the wider arrivals corridor. The real baked
 * geometry, source lighting and browser result still require separate review. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {gzipSync}=require('node:zlib'),{createHash}=require('node:crypto'),{createRequire}=require('node:module');
const tools=createRequire(path.join(process.env.PENN_TOOLS||'/private/tmp/penn-station-tools','package.json')),sharp=tools('sharp');
const {constantHdr}=require('./penn-access-denoise.cjs');
const {denoisePolicy,checkBakeStatistics,verifyArrivalsSource,verifyDenoiseDerivative,validateDenoising}=require('./penn-assets.cjs');
const hash=b=>createHash('sha256').update(b).digest('hex');
module.exports=async function({assets,illumination,repositoryDirectory,sampleRecord,report}){
 const zone='concourse-arrivals',den='authoring/penn-station-1935/lighting/phase8/denoised',raw='authoring/penn-station-1935/lighting/phase8/raw';
 const source=path.join(repositoryDirectory,den),rawPath=path.join(repositoryDirectory,raw);await fs.mkdir(source,{recursive:true});await fs.mkdir(rawPath,{recursive:true});
 const record=structuredClone(sampleRecord),rawHdr=constantHdr('arrivals-raw',4096),hdr=constantHdr('arrivals-denoised',4096);
 Object.assign(record,{zone,authoringDirectory:den,rawAuthoringDirectory:raw,source:`lighting-${zone}-sky.hdr`,sourceArchiveFile:`lighting-${zone}-sky.hdr.gz`,sourceSha256:hash(rawHdr),inputTransfer:'linear',relativeMeanChange:0});
 for(const key of ['sourceStored','originalLinear','denoisedLinear'])record[key]={minimum:.125,mean:.125,maximum:.125};
 record.retainedHdr={file:`lighting-${zone}-sky-denoised-linear.hdr`,archiveFile:`lighting-${zone}-sky-denoised-linear.hdr.gz`,sha256:hash(hdr),decodedLinear:{minimum:.125,mean:.125,maximum:.125}};
 const referenced=new Set(illumination);
 for(const variant of ['full','low']){
  const size=variant==='full'?4096:512,suffix=variant==='full'?'':'-low';
  record[variant]={png:`lighting-${zone}-sky${suffix}.png`,webp:`lighting-${zone}-sky${suffix}.webp`,width:size,height:size,clippedRGBSamples:0};
  await sharp({create:{width:size,height:size,channels:3,background:'#636363'}}).png().toFile(path.join(source,record[variant].png));
  await sharp(path.join(source,record[variant].png)).webp({lossless:true,effort:0}).toFile(path.join(assets,record[variant].webp));referenced.add(record[variant].webp);
 }
 const bake={...JSON.parse(await fs.readFile(path.join(assets,'lighting-concourse.json'))),zone,resolution:4096,fixturePurpose:'Synthetic arrivals provenance control; not a station bake'};
 const bakeBytes=Buffer.from(JSON.stringify(bake,null,2)+'\n');record.bakeReportSha256=hash(bakeBytes);
 const bakeFile=`lighting-${zone}.json`,recordFile=path.join(assets,`lighting-${zone}-denoise.json`);
 await fs.writeFile(path.join(assets,bakeFile),bakeBytes);await fs.writeFile(path.join(rawPath,bakeFile),bakeBytes);
 await fs.writeFile(path.join(rawPath,record.sourceArchiveFile),gzipSync(rawHdr));await fs.writeFile(path.join(source,record.retainedHdr.archiveFile),gzipSync(hdr));
 const recordBytes=Buffer.from(JSON.stringify(record,null,2)+'\n');await fs.writeFile(recordFile,recordBytes);
 assert.deepEqual(denoisePolicy(record,zone),{authoringDirectory:den,fresh:true,fullDimensions:[4096],inputTransfer:'linear'});
 const checked=await validateDenoising({assetsDirectory:assets,illumination:referenced,repositoryDirectory});
 const atlas=checked.atlases.find(x=>x.zone===zone);assert.equal(atlas.rawSource.decodedSha256,hash(rawHdr));assert.equal(atlas.retainedWidth,4096);assert.deepEqual(atlas.derivatives.map(x=>x.width),[4096,512]);
 const all=new Set([...referenced,'lighting-concourse-access-sky.webp','lighting-concourse-access-sky-low.webp','lighting-concourse-circulation-sky.webp','lighting-concourse-circulation-sky-low.webp']);
 const joint=await validateDenoising({assetsDirectory:assets,illumination:all,repositoryDirectory});assert.equal(joint.atlases.length,7);
 for(const family of ['concourse-access','concourse-circulation','concourse-arrivals'])assert.equal(joint.atlases.filter(x=>x.zone===family).length,1);
 for(const directory of [den+'/',den+'/../denoised','authoring/penn-station-1935/lighting/phase7/denoised'])assert.throws(()=>denoisePolicy({...record,authoringDirectory:directory},zone),/supported local authoring directory/);
 assert.throws(()=>denoisePolicy({...record,authoringDirectory:'authoring/penn-station-1935/lighting/phase4/denoised'},zone),/exact Phase8/);
 for(const other of ['concourse','concourse-access','concourse-circulation','platform'])assert.throws(()=>denoisePolicy({zone:other,authoringDirectory:den},other),/supported local authoring directory/);
 for(const [key,value,pattern]of [['rawAuthoringDirectory',raw+'/../raw',/exact Phase8/],['sourceArchiveFile','../'+record.sourceArchiveFile,/exact lossless/],['sourceSha256','0'.repeat(64),/decoded bytes match/],['bakeReportSha256','0'.repeat(64),/reported SHA/],['inputTransfer','srgb',/remains linear/]])await assert.rejects(()=>verifyArrivalsSource({record:{...record,[key]:value},bakeBytes,repositoryDirectory}),pattern);
 const rawReport=path.join(rawPath,bakeFile);await fs.writeFile(rawReport,Buffer.concat([bakeBytes,Buffer.from(' ')]));
 try{await assert.rejects(()=>verifyArrivalsSource({record,bakeBytes,repositoryDirectory}),/byte-for-byte/);}finally{await fs.writeFile(rawReport,bakeBytes);}
 await assert.rejects(()=>verifyArrivalsSource({record:{...record,retainedHdr:{...record.retainedHdr,archiveFile:undefined}},bakeBytes,repositoryDirectory}),/exact lossless/);
 await assert.rejects(()=>validateDenoising({assetsDirectory:assets,illumination:new Set([...illumination,record.full.webp]),repositoryDirectory}),/both full and low/);
 assert.throws(()=>checkBakeStatistics({...bake,resolution:2048},record,{width:2048,height:2048}),/exactly4096/);
 const undersized=structuredClone(record);undersized.full.width=undersized.full.height=2048;
 await assert.rejects(()=>verifyDenoiseDerivative({record:undersized,variant:'full',sourceDirectory:source,assetsDirectory:assets,illumination:referenced,fullDimensions:[4096]}),/atlas dimension/);
 await fs.writeFile(recordFile,'{"wrong":"record"}');
 assert.equal((await validateDenoising({assetsDirectory:assets,illumination,repositoryDirectory})).atlases.length,4);
 await assert.rejects(()=>validateDenoising({assetsDirectory:assets,illumination:referenced,repositoryDirectory}),/zone matches its filename/);await fs.writeFile(recordFile,recordBytes);
 report.checks.push('Separate Phase8 arrivals4096/512 provenance coexists with Phase6 access and Phase7 circulation; rejects path/family/transfer substitutions, raw/report corruption, undersized sources/derivatives and half references');
 report.arrivalsControl={synthetic:true,sourceSha256:hash(rawHdr),retainedSha256:hash(hdr),bakeReportSha256:hash(bakeBytes),jointAtlasCount:joint.atlases.length};
};
