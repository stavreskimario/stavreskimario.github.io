import fs from'node:fs/promises';import os from'node:os';import path from'node:path';import assert from'node:assert/strict';import{createHash}from'node:crypto';import{pathToFileURL,fileURLToPath}from'node:url';import{spawnSync}from'node:child_process';
// Supply the frozen unpatched manifest and accepted source proof/freeze; output stays external.
const args={};for(let i=2;i<process.argv.length;i+=2){const k=process.argv[i]?.slice(2);assert(['repo','base','proof','freeze','out','helper','label'].includes(k)&&process.argv[i].startsWith('--')&&process.argv[i+1]&&!args[k],'Unique named test arguments');args[k]=process.argv[i+1];}
for(const k of ['base','proof','freeze','out'])assert(args[k],`Missing --${k}`);
const repo=await fs.realpath(path.resolve(args.repo||path.join(path.dirname(fileURLToPath(import.meta.url)),'..'))),D=path.resolve(args.out),actual=repo+'/penn-station-1935/model/patch_arcade_manifest.mjs',helper=args.helper||actual,label=args.label||'review';assert(/^[a-z0-9-]+$/.test(label));
let ancestor=D;const tail=[];while(!await fs.stat(ancestor).catch(()=>false)){tail.unshift(path.basename(ancestor));ancestor=path.dirname(ancestor);}const resolved=path.join(await fs.realpath(ancestor),...tail);assert(resolved!==repo&&!resolved.startsWith(repo+path.sep),'External test artifacts only');await fs.mkdir(D,{recursive:true});
const basePath=path.resolve(args.base),proofPath=path.resolve(args.proof),freezePath=path.resolve(args.freeze);
const sha=b=>createHash('sha256').update(b).digest('hex'),encode=j=>Buffer.from(JSON.stringify(j,null,2)+'\n'),pin=async p=>{let b=await fs.readFile(p);return{path:p,bytes:b.length,sha256:sha(b)}};
const helperB=await fs.readFile(helper),snapshot=D+'/helper-'+label+'.mjs';await fs.writeFile(snapshot,helperB);const{patchArcadeManifest}=await import(pathToFileURL(snapshot));
const baseB=await fs.readFile(basePath),baseSha=sha(baseB),proofB=await fs.readFile(proofPath),freezeB=await fs.readFile(freezePath),base=JSON.parse(baseB),proof=JSON.parse(proofB),freeze=JSON.parse(freezeB);
const invoke=c=>patchArcadeManifest({baseBytes:c.baseB||baseB,baseSha256:c.baseSha||baseSha,proofBytes:c.proofB||encode(c.proof||proof),freezeBytes:c.freezeB||encode(c.freeze||freeze)}),original=patchArcadeManifest({baseBytes:baseB,baseSha256:baseSha,proofBytes:proofB,freezeBytes:freezeB});
for(const k of Object.keys(base))if(k!=='walkable')assert.deepEqual(original[k],base[k]);assert.deepEqual(original.walkable.slice(0,base.walkable.length),base.walkable);assert.equal(original.walkable.length,base.walkable.length+5);assert.equal(sha(baseB),baseSha);assert.equal(original.arcadeInteriorDetails.sourceManifestSha256,baseSha);assert.equal(original.arcadeInteriorDetails.sourceProofSha256,sha(proofB));assert.equal(original.arcadeInteriorDetails.sourceFreezeSha256,sha(freezeB));assert(original.walkable.slice(base.walkable.length).every(a=>a.floor===0&&a.geometryBasedFloorRayRequired===true));
for(const a of proof.walkableAdditions)assert.deepEqual(a.bounds,[a.blenderBounds[0],a.blenderBounds[1],-a.blenderBounds[3],-a.blenderBounds[2]],'Actual source Blender->glTF horizontal sign conversion');
const negatives=[];function reject(label,mutate,{repin=true}={}){const c={proof:structuredClone(proof),freeze:structuredClone(freeze)};mutate(c);if(repin&&!c.proofB)c.freeze.files['source-proof.json'].sha256=sha(encode(c.proof));let error=null;try{invoke(c)}catch(e){error=String(e)}negatives.push({label,rejected:!!error,error});}
reject('Corrupted proof pin',c=>c.freeze.files['source-proof.json'].sha256='0'.repeat(64),{repin:false});
reject('Corrupted original module pin',c=>c.freeze.files['formal-arcade-module.glb'].sha256='0'.repeat(64));
reject('Core source preservation mismatch',c=>c.proof.sourceSha256After='1'.repeat(64));
reject('Retained material comparison failed',c=>c.proof.allRetainedMaterialNamesNodesPropertiesAndExtrasExact=false);
reject('Retained source-object comparison missing',c=>c.proof.unrelatedSourceObjectSignaturesExact=0);
for(const k of ['module','ownedExterior','protectedExterior','ownedMain','protectedMain'])reject('Wrong '+k+' coordinate frame',c=>c.freeze.frames[k]='WRONG_FRAME');
reject('Main0 floor substituted for Street0',c=>c.proof.walkableAdditions[0].floor=-4.2672);
reject('Wrong authored area frame',c=>c.proof.walkableAdditions[0].frame='gltf-world-main0-xz');
reject('Out-of-scope permission',c=>c.proof.walkableAdditions[0].bounds[1]=111.1817);
reject('Reversed bounds',c=>c.proof.walkableAdditions[0].bounds[0]=c.proof.walkableAdditions[0].bounds[1]);
reject('Missing permission',c=>c.proof.walkableAdditions.pop());
reject('Duplicate permission',c=>c.proof.walkableAdditions[4].bounds=[...c.proof.walkableAdditions[3].bounds]);
reject('Missing expected area laundered as another in-scope rectangle',c=>c.proof.walkableAdditions[4].bounds=[103,104,0,1]);
reject('Retained landing enlarged into unsupported space',c=>c.proof.walkableAdditions[0].bounds[3]=8);
reject('Incorrect retained mesh assigned while count remains one',c=>{c.proof.walkableAdditions[0].existingMeshUntouched=false;c.proof.walkableAdditions[1].existingMeshUntouched=true;});
reject('Incorrect semantic area label',c=>c.proof.walkableAdditions[1].label='Unreviewed room');
reject('Fourteen material entries with thirteen unique names',c=>{c.proof.newMaterialNames.push(c.proof.newMaterialNames[0]);c.freeze.newMaterialNames=[...c.proof.newMaterialNames];});
reject('Material names cannot be a thirteen-character string',c=>{c.proof.newMaterialNames='ABCDEFGHIJKLM';c.freeze.newMaterialNames=c.proof.newMaterialNames;});
reject('Material names cannot be thirteen numbers',c=>{c.proof.newMaterialNames=Array.from({length:13},(_,i)=>i);c.freeze.newMaterialNames=[...c.proof.newMaterialNames];});
reject('Prior field mutation cannot reuse frozen manifest pin',c=>{const b=structuredClone(base);b.levels.railWorld=123;c.baseB=encode(b);});
reject('Double application',c=>{c.baseB=encode(original);c.baseSha=sha(c.baseB);});
const sentinelBase=structuredClone(base);sentinelBase.reviewSentinel={text:'retained',nested:[false,0,{keep:'exact'}]};const sentinelB=encode(sentinelBase),sentinel=patchArcadeManifest({baseBytes:sentinelB,baseSha256:sha(sentinelB),proofBytes:proofB,freezeBytes:freezeB});assert.deepEqual(sentinel.reviewSentinel,sentinelBase.reviewSentinel);
const outManifest=D+'/candidate-'+label+'.json';await fs.writeFile(outManifest,encode(original));
const cli=[],scratch=await fs.mkdtemp(D+'/cli-');try{
 // CLI tests use the actual repository helper; its own path supplies the true repository boundary.
 if(sha(await fs.readFile(actual))===sha(helperB)){
  const options=['--base',basePath,'--base-sha',baseSha,'--proof',proofPath,'--freeze',freezePath];const run=tail=>spawnSync(process.execPath,[actual,...options,...tail],{encoding:'utf8'});
  const positive=path.join(scratch,'manifest.json'),good=run(['--out',positive]);assert.equal(good.status,0,good.stderr);assert.deepEqual(JSON.parse(await fs.readFile(positive)),original);cli.push({label:'External output positive matches function result',passed:true});
  let r=run(['--out',positive]);assert.notEqual(r.status,0);assert(/Never overwrite/.test(r.stderr));cli.push({label:'Existing output rejected without overwrite',passed:true});
  const inside=repo+'/authoring/penn-station-1935/review/phase9/storage/MUST-NOT-BE-CREATED.json';assert(!await fs.stat(inside).catch(()=>false));r=run(['--out',inside]);assert.notEqual(r.status,0);assert(/External candidate/.test(r.stderr));assert(!await fs.stat(inside).catch(()=>false));cli.push({label:'Direct repository output rejected',passed:true});
  await fs.symlink(repo,path.join(scratch,'repo-link'),'dir');const viaLink=path.join(scratch,'repo-link/authoring/penn-station-1935/review/phase9/storage/MUST-NOT-BE-CREATED.json');r=run(['--out',viaLink]);assert.notEqual(r.status,0);assert(/External candidate/.test(r.stderr));assert(!await fs.stat(inside).catch(()=>false));cli.push({label:'Symlink repository output rejected',passed:true});
  r=run(['--out',path.join(scratch,'extra.json'),'--base',basePath]);assert.notEqual(r.status,0);assert(/Unique paired/.test(r.stderr));cli.push({label:'Duplicate CLI input option rejected',passed:true});
  r=run(['--out',path.join(scratch,'unknown.json'),'--unknown','x']);assert.notEqual(r.status,0);assert(/Unique paired/.test(r.stderr));cli.push({label:'Unknown CLI option rejected',passed:true});
 }else cli.push({label:'Helper changed during audit; CLI needs current-version rerun',passed:false});
}finally{await fs.rm(scratch,{recursive:true,force:true});}
const accepted=negatives.filter(n=>!n.rejected),report={status:accepted.length?'VALIDATION GAPS':'PASS',helper:await pin(snapshot),base:await pin(basePath),proof:await pin(proofPath),freeze:await pin(freezePath),positive:{allPriorFieldsExact:true,allPriorWalkablePrefixExact:true,inputBytesUnchanged:true,newPermissions:5,allActualFloorRaysRequired:true,sourceHorizontalFrameConversionExact:true,sentinelPriorFieldPreserved:true},negativeControls:negatives,acceptedCorruptions:accepted,cli,candidate:await pin(outManifest)};await fs.writeFile(D+'/receipt-'+label+'.json',encode(report));console.log(JSON.stringify({status:report.status,negativeCount:negatives.length,rejected:negatives.length-accepted.length,accepted:accepted.map(n=>n.label),cli:cli.length,receipt:D+'/receipt-'+label+'.json'}));if(accepted.length)process.exitCode=1;
