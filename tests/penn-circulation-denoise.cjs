/* Independent provenance controls for the separate circulation light bake. */
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const {gzipSync}=require('node:zlib'),{createHash}=require('node:crypto'),{createRequire}=require('node:module');
const tools=createRequire(path.join(process.env.PENN_TOOLS||'/private/tmp/penn-station-tools','package.json')),sharp=tools('sharp');
const {constantHdr}=require('./penn-access-denoise.cjs');
const {denoisePolicy,verifyCirculationSource,validateDenoising}=require('./penn-assets.cjs');
const hash=b=>createHash('sha256').update(b).digest('hex');
module.exports=async function({assets,illumination,repositoryDirectory,sampleRecord,report}){
 const zone='concourse-circulation',den='authoring/penn-station-1935/lighting/phase7/denoised',raw='authoring/penn-station-1935/lighting/phase7/raw';
 const source=path.join(repositoryDirectory,den),rawPath=path.join(repositoryDirectory,raw);await fs.mkdir(source,{recursive:true});await fs.mkdir(rawPath,{recursive:true});
 const record=structuredClone(sampleRecord),rawHdr=constantHdr('circulation-raw'),hdr=constantHdr('circulation-denoised');
 Object.assign(record,{zone,authoringDirectory:den,rawAuthoringDirectory:raw,source:`lighting-${zone}-sky.hdr`,sourceArchiveFile:`lighting-${zone}-sky.hdr.gz`,sourceSha256:hash(rawHdr),inputTransfer:'linear',relativeMeanChange:0});
 for(const key of ['sourceStored','originalLinear','denoisedLinear'])record[key]={minimum:.125,mean:.125,maximum:.125};
 record.retainedHdr={file:`lighting-${zone}-sky-denoised-linear.hdr`,archiveFile:`lighting-${zone}-sky-denoised-linear.hdr.gz`,sha256:hash(hdr),decodedLinear:{minimum:.125,mean:.125,maximum:.125}};
 const referenced=new Set(illumination);
 for(const variant of ['full','low']){
  const size=variant==='full'?2048:512,suffix=variant==='full'?'':'-low';
  record[variant]={png:`lighting-${zone}-sky${suffix}.png`,webp:`lighting-${zone}-sky${suffix}.webp`,width:size,height:size,clippedRGBSamples:0};
  await sharp({create:{width:size,height:size,channels:3,background:'#636363'}}).png().toFile(path.join(source,record[variant].png));
  await sharp(path.join(source,record[variant].png)).webp({lossless:true,effort:0}).toFile(path.join(assets,record[variant].webp));referenced.add(record[variant].webp);
 }
 const bake={...JSON.parse(await fs.readFile(path.join(assets,'lighting-concourse.json'))),zone,resolution:2048,fixturePurpose:'Synthetic circulation provenance control; not a station bake'};
 const bakeBytes=Buffer.from(JSON.stringify(bake,null,2)+'\n');record.bakeReportSha256=hash(bakeBytes);
 const bakeFile=`lighting-${zone}.json`,recordFile=path.join(assets,`lighting-${zone}-denoise.json`);
 await fs.writeFile(path.join(assets,bakeFile),bakeBytes);await fs.writeFile(path.join(rawPath,bakeFile),bakeBytes);
 await fs.writeFile(path.join(rawPath,record.sourceArchiveFile),gzipSync(rawHdr));await fs.writeFile(path.join(source,record.retainedHdr.archiveFile),gzipSync(hdr));
 const recordBytes=Buffer.from(JSON.stringify(record,null,2)+'\n');await fs.writeFile(recordFile,recordBytes);
 assert.deepEqual(denoisePolicy(record,zone),{authoringDirectory:den,fresh:true,fullDimensions:[2048],inputTransfer:'linear'});
 let validated=await validateDenoising({assetsDirectory:assets,illumination:referenced,repositoryDirectory});assert.equal(validated.atlases.length,5);assert.equal(validated.atlases.find(x=>x.zone===zone).rawSource.decodedSha256,hash(rawHdr));
 // Restore the deliberate Phase6 pixel-negative control, then require BOTH
 // independently sourced families at once; their records cannot substitute.
 const accessSource=path.join(repositoryDirectory,'authoring/penn-station-1935/lighting/phase6/denoised');
 await sharp(path.join(assets,'lighting-concourse-access-sky.webp')).png().toFile(path.join(accessSource,'lighting-concourse-access-sky.png'));
 const both=new Set([...referenced,'lighting-concourse-access-sky.webp','lighting-concourse-access-sky-low.webp']);
 validated=await validateDenoising({assetsDirectory:assets,illumination:both,repositoryDirectory});assert.equal(validated.atlases.length,6);
 for(const family of ['concourse-access','concourse-circulation'])assert.equal(validated.atlases.filter(x=>x.zone===family).length,1);
 await assert.rejects(()=>validateDenoising({assetsDirectory:assets,illumination:new Set([...illumination,record.full.webp]),repositoryDirectory}),/both full and low/);
 for(const d of [den+'/',den+'/../denoised','authoring/penn-station-1935/lighting/phase6/denoised'])assert.throws(()=>denoisePolicy({...record,authoringDirectory:d},zone),/supported local authoring directory/);
 assert.throws(()=>denoisePolicy({...record,authoringDirectory:'authoring/penn-station-1935/lighting/phase4/denoised'},zone),/exact Phase7/);
 for(const [key,value,pattern]of [['rawAuthoringDirectory',raw+'/../raw',/exact Phase7/],['sourceArchiveFile','../'+record.sourceArchiveFile,/exact lossless/],['sourceSha256','0'.repeat(64),/decoded bytes match/],['bakeReportSha256','0'.repeat(64),/reported SHA/],['inputTransfer','srgb',/remains linear/]])await assert.rejects(()=>verifyCirculationSource({record:{...record,[key]:value},bakeBytes,repositoryDirectory}),pattern);
 await assert.rejects(()=>verifyCirculationSource({record:{...record,retainedHdr:{...record.retainedHdr,archiveFile:undefined}},bakeBytes,repositoryDirectory}),/exact lossless/);
 await fs.writeFile(path.join(rawPath,bakeFile),Buffer.concat([bakeBytes,Buffer.from(' ')]));
 await assert.rejects(()=>verifyCirculationSource({record,bakeBytes,repositoryDirectory}),/byte-for-byte/);await fs.writeFile(path.join(rawPath,bakeFile),bakeBytes);
 await fs.writeFile(recordFile,'{"wrong":"record"}');
 assert.equal((await validateDenoising({assetsDirectory:assets,illumination,repositoryDirectory})).atlases.length,4);
 await assert.rejects(()=>validateDenoising({assetsDirectory:assets,illumination:referenced,repositoryDirectory}),/zone matches its filename/);await fs.writeFile(recordFile,recordBytes);
 report.checks.push('Separate Phase7 circulation2048/512 source/derivatives pass alongside unchanged Phase6 access provenance; reject path aliases, wrong family/source transfer, raw/archive/report corruption, half references and mismatched records');
 report.circulationControl={synthetic:true,sourceSha256:hash(rawHdr),retainedSha256:hash(hdr),bakeReportSha256:hash(bakeBytes),jointAtlasCount:validated.atlases.length};
};
