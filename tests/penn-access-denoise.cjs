/* Synthetic access-atlas controls invoked by penn-denoise-records.cjs. No
 * fixture images are committed; final baked geometry/browser acceptance is separate. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const {gzipSync} = require('node:zlib');
const {createHash} = require('node:crypto');
const {createRequire} = require('node:module');
const tools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
const sharp = tools('sharp');
const {denoisePolicy, checkDenoiseStatistics, checkBakeStatistics, retainedHdr,
  verifyDenoiseDerivative, verifyAccessSource, validateDenoising} = require('./penn-assets.cjs');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const denoisedDirectory = 'authoring/penn-station-1935/lighting/phase6/denoised';
const rawDirectory = 'authoring/penn-station-1935/lighting/phase6/raw';

function constantHdr(label) {
  // Valid 2048-square Radiance RLE at exactly0.125, not a header-only stub.
  const header = Buffer.from(`#?RADIANCE\n# Synthetic validator ${label}\nFORMAT=32-bit_rle_rgbe\n\n-Y 2048 +X 2048\n`);
  const scanline = [2,2,8,0];
  for (const value of [128,128,128,126]) {
    for (let i=0;i<16;i++) scanline.push(255,value);
    scanline.push(144,value);
  }
  return Buffer.concat([header,...Array.from({length:2048},()=>Buffer.from(scanline))]);
}

module.exports = async function accessControls({assets, illumination, repositoryDirectory, sampleRecord, report}) {
  const source = path.join(repositoryDirectory,denoisedDirectory), raw = path.join(repositoryDirectory,rawDirectory);
  await fs.mkdir(source,{recursive:true}); await fs.mkdir(raw,{recursive:true});
  const record = structuredClone(sampleRecord), rawHdr = constantHdr('raw'), retained = constantHdr('denoised');
  Object.assign(record,{zone:'concourse-access',authoringDirectory:denoisedDirectory,rawAuthoringDirectory:rawDirectory,
    source:'lighting-concourse-access-sky.hdr',sourceArchiveFile:'lighting-concourse-access-sky.hdr.gz',sourceSha256:hash(rawHdr),inputTransfer:'linear'});
  for (const key of ['sourceStored','originalLinear','denoisedLinear']) record[key]={mean:.125,minimum:.125,maximum:.125};
  record.retainedHdr={file:'lighting-concourse-access-sky-denoised-linear.hdr',archiveFile:'lighting-concourse-access-sky-denoised-linear.hdr.gz',sha256:hash(retained),decodedLinear:{mean:.125,minimum:.125,maximum:.125}};
  record.relativeMeanChange=0;
  const accessIllumination = new Set(illumination);
  for (const variant of ['full','low']) {
    const n=variant==='full'?2048:512,suffix=variant==='full'?'':'-low';
    record[variant]={png:`lighting-concourse-access-sky${suffix}.png`,webp:`lighting-concourse-access-sky${suffix}.webp`,width:n,height:n,clippedRGBSamples:0};
    await sharp({create:{width:n,height:n,channels:3,background:{r:99,g:99,b:99}}}).png().toFile(path.join(source,record[variant].png));
    await sharp(path.join(source,record[variant].png)).webp({lossless:true,effort:0}).toFile(path.join(assets,record[variant].webp));
    accessIllumination.add(record[variant].webp);
  }
  const bake = JSON.parse(await fs.readFile(path.join(assets,'lighting-concourse.json')));
  Object.assign(bake,{zone:'concourse-access',resolution:2048,fixturePurpose:'Synthetic validator control, not an actual access bake'});
  const bakeBytes=Buffer.from(JSON.stringify(bake,null,2)+'\n');record.bakeReportSha256=hash(bakeBytes);
  const recordFile=path.join(assets,'lighting-concourse-access-denoise.json'),recordBytes=Buffer.from(JSON.stringify(record,null,2)+'\n');
  await fs.writeFile(recordFile,recordBytes); await fs.writeFile(path.join(assets,'lighting-concourse-access.json'),bakeBytes);
  await fs.writeFile(path.join(raw,'lighting-concourse-access.json'),bakeBytes);
  await fs.writeFile(path.join(raw,record.sourceArchiveFile),gzipSync(rawHdr)); await fs.writeFile(path.join(source,record.retainedHdr.archiveFile),gzipSync(retained));
  assert.deepEqual(denoisePolicy(record,'concourse-access'),{authoringDirectory:denoisedDirectory,fresh:true,fullDimensions:[2048],inputTransfer:'linear'});
  checkDenoiseStatistics(record,'linear');
  const checked=await validateDenoising({assetsDirectory:assets,illumination:accessIllumination,repositoryDirectory});
  assert.equal(checked.atlases.length,5);assert.equal(checked.groups.length,5);
  const atlas=checked.atlases.find(x=>x.zone==='concourse-access');assert.equal(atlas.rawSource.decodedSha256,hash(rawHdr));assert.equal(atlas.retainedHdr.sha256,hash(retained));
  assert.equal(atlas.retainedWidth,2048);assert.deepEqual(atlas.derivatives.map(x=>x.width),[2048,512]);
  report.checks.push('Optional referenced access atlas validates exact Phase6 raw/denoised directories, linear input,2048/512 lossless pixels, raw+retained decoded HDR hashes and byte-identical raw/runtime bake reports');

  // Existing four-group operation must ignore an unreferenced optional record.
  await fs.writeFile(recordFile,'{"deliberately":"invalid optional record"}');
  const absent=await validateDenoising({assetsDirectory:assets,illumination,repositoryDirectory});assert.equal(absent.atlases.length,4);
  await fs.writeFile(recordFile,recordBytes);
  await assert.rejects(()=>validateDenoising({assetsDirectory:assets,illumination:new Set([...illumination,record.full.webp]),repositoryDirectory}),/both full and low/);
  await fs.rename(recordFile,recordFile+'.held');
  try { await assert.rejects(()=>validateDenoising({assetsDirectory:assets,illumination:accessIllumination,repositoryDirectory}),/ENOENT/); }
  finally { await fs.rename(recordFile+'.held',recordFile); }
  report.checks.push('Unreferenced access records do not change legacy validation; a half-referenced atlas or missing matching access report is rejected');

  for (const directory of [denoisedDirectory+'/',denoisedDirectory+'/../denoised','../'+denoisedDirectory])
    assert.throws(()=>denoisePolicy({...record,authoringDirectory:directory},'concourse-access'),/supported local authoring directory/);
  for (const zone of ['exterior','waiting-room-vault','waiting-room-masonry','waiting-room-order','concourse','platform'])
    assert.throws(()=>denoisePolicy({zone,authoringDirectory:denoisedDirectory},zone.startsWith('waiting-room')?'waiting-room':zone),/supported local authoring directory/);
  assert.throws(()=>denoisePolicy({...record,authoringDirectory:'authoring/penn-station-1935/lighting/phase4/denoised'},'concourse-access'),/exact Phase6/);
  for (const [key,value,pattern] of [
    ['rawAuthoringDirectory',rawDirectory+'/../raw',/exact Phase6/],
    ['sourceArchiveFile','../raw/'+record.sourceArchiveFile,/exact lossless/],
    ['sourceSha256','0'.repeat(64),/decoded bytes match/],
    ['bakeReportSha256','0'.repeat(64),/reported SHA/],
    ['inputTransfer','srgb',/remains linear/],
  ]) await assert.rejects(()=>verifyAccessSource({record:{...record,[key]:value},bakeBytes,repositoryDirectory}),pattern);
  await assert.rejects(()=>verifyAccessSource({record:{...record,retainedHdr:{...record.retainedHdr,archiveFile:undefined}},bakeBytes,repositoryDirectory}),/exact lossless/);
  const rawBakeFile=path.join(raw,'lighting-concourse-access.json');await fs.writeFile(rawBakeFile,Buffer.concat([bakeBytes,Buffer.from(' ')]));
  try { await assert.rejects(()=>verifyAccessSource({record,bakeBytes,repositoryDirectory}),/byte-for-byte/); }
  finally { await fs.writeFile(rawBakeFile,bakeBytes); }
  const sourceFile=path.join(raw,record.sourceArchiveFile);await fs.writeFile(sourceFile,gzipSync(Buffer.concat([rawHdr,Buffer.from([1])])));
  try { await assert.rejects(()=>verifyAccessSource({record,bakeBytes,repositoryDirectory}),/decoded bytes match/); }
  finally { await fs.writeFile(sourceFile,gzipSync(rawHdr)); }
  await assert.rejects(()=>retainedHdr({...record,retainedHdr:{...record.retainedHdr,sha256:'0'.repeat(64)}},source),/original reported SHA/);
  report.checks.push('Access traversal/alias paths,wrong zones or transfer,missing archive fields,corrupted raw/retained HDR hashes and unequal bake-report bytes are rejected');

  const wrongBake={...bake,resolution:4096};assert.throws(()=>checkBakeStatistics(wrongBake,record,{width:4096,height:4096}),/exactly2048/);
  for (const [variant,n] of [['full',1024],['low',256]]) {
    const bad=structuredClone(record);bad[variant].width=bad[variant].height=n;
    await assert.rejects(()=>verifyDenoiseDerivative({record:bad,variant,sourceDirectory:source,assetsDirectory:assets,illumination:accessIllumination,fullDimensions:[2048]}),/atlas dimension/);
  }
  await sharp({create:{width:2048,height:2048,channels:3,background:'#777777'}}).png().toFile(path.join(source,record.full.png));
  await assert.rejects(()=>verifyDenoiseDerivative({record,variant:'full',sourceDirectory:source,assetsDirectory:assets,illumination:accessIllumination,fullDimensions:[2048]}),/pixels match/);
  report.checks.push('Access source resolution cannot exceed2048; undersized full/low derivatives and changed same-size source pixels are rejected');
  report.accessControl={synthetic:true,rawSourceSha256:hash(rawHdr),retainedHdrSha256:hash(retained),bakeReportSha256:hash(bakeBytes),validatedAtlas:atlas};
};

module.exports.constantHdr = constantHdr;
