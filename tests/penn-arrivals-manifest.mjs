// Contract controls for receipt-bound navigation metadata. No 3D assets or
// temporary fixture records are committed; actual geometry acceptance is separate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {patchArrivalsManifest} from '../penn-station-1935/model/patch_arrivals_manifest.mjs';

const hash=b=>createHash('sha256').update(b).digest('hex');
const bytes=j=>Buffer.from(JSON.stringify(j,null,2)+'\n');
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const helper=path.join(repo,'penn-station-1935/model/patch_arrivals_manifest.mjs');
const main=-4.2672,exit=-7.4676,platform=-11.985625;
const centres=[69.5,55.33,40.92,26.75,12.67,-.35,-14.02,-28.35];

function fixture(){
  const originalFixtures=Array.from({length:22},(_,i)=>({platform:Math.floor(i/2)+1,positionLocal:[i%2?-48.404:-54.5,-3.5004,70-i*5],positionWorld:[i%2?-48.404:-54.5,-7.7676,70-i*5],support:'Retained earlier evidence'}));
  const base={revision:3,levels:{streetWorld:0,mainWorld:main,exitWorld:exit,platformWorld:platform,railWorld:-13.154025,exitDatumStatus:'Earlier qualified datum statement'},chunkOffsets:{concourse:[0,main,0],trains:[0,-13.154025,8.690045261]},
    railway:{trackCount:21,platformCount:11,tracks:Array.from({length:21},(_,i)=>({number:i+1,unequalEndpoints:[-220-i,190+i]})),platforms:Array.from({length:11},(_,i)=>({number:i+1,polygonXZ:[[-220-i,i],[-100,i+2],[90+i,i+1]]})),platformNernstFixtures:originalFixtures,limits:['Existing railway uncertainties']},
    accessStairs:Array.from({length:9},(_,i)=>({workingPlatform:i+1,centerZ:70-i*13.6,departureFlights:[{original:i}],historicalStatus:'Prior source remains exact'})),
    stairSupportFlights:Array.from({length:27},(_,i)=>({label:`Original departure ${i}`,start:[i,main,i*.71],end:[i+5,platform,i*.71],width:2,steps:15})),
    walkable:[{label:'Main concourse',bounds:[-105,-40,-72,72],floor:main},{label:'Exit concourse',bounds:[-55.25,-47.75,-72.39,72.39],floor:exit},{label:'Independent departure stairs to working platform 1',bounds:[-48.4,-29.65,69,71],floor:platform}],
    departureAccess:{sources:[{id:'Gibbs1910',controls:['Exact earlier source wording']}],arrivalStatus:'Earlier provisional deck statement'},concourseCirculation:{retained:{columns:true},uncertainty:['Western Main correction held']},mainStair:{risers:28},verified:['Original evidence'],uncertain:['Target1935 retention unknown'],unrelated:{values:[Math.PI,0,.18],text:'No rewritten history'},
  };
  const liftKeepouts=centres.map((z,i)=>({row:i+1,x:[-65.5,-62.5],z:[z-1,z+1]}));
  const rawFlights=[],stairs=[],worldFlights=[],profiles=[];
  for(let row=1;row<=8;row++)for(const side of ['west','east']){
    const z=centres[row-1]-(side==='east'?.07:0),head=side==='west'?-73.2:-54.912,d=side==='west'?-1:1;
    const run1=3.692,run2=3.408,landing=1.2,intermediate=-5.543079629629629;
    const f=[{startX:head,endX:head+d*run1,startY:-3.2004,endY:intermediate,risers:14},{startX:head+d*(run1+landing),endX:head+d*(run1+landing+run2),startY:intermediate,endY:platform-main,risers:13}];
    const source={ordinal:row,side,centerZ:z,headX:head,direction:d,flights:f,landing:{startX:f[0].endX,endX:f[1].startX,mainY:intermediate},footX:f[1].endX};stairs.push(source);
    const current=f.map((flight,i)=>({side,flight:i+1,start:[flight.startX,flight.startY,z],end:[flight.endX,flight.endY,z],risers:flight.risers,internalGoings:flight.risers-1,physicalTreadWidth:2.14,nominalClearWidth:2,rowOrdinal:row}));rawFlights.push(...current);
    const wf=current.map(v=>({...structuredClone(v),start:[v.start[0],v.start[1]+main,z],end:[v.end[0],v.end[1]+main,z],label:`Arrival ${row} ${side} flight ${v.flight}`,width:2,coordinateSpace:'world-glTF'}));worldFlights.push(...wf);
    profiles.push({sourceOrdinal:row,workingPlatform:row,platformMappingStatus:'Unnumbered source correspondence, not certified gate numbers',side,sourceCenterZ:z,exitHeadWorld:wf[0].start,platformFootWorld:wf[1].end,flights:structuredClone(wf),intermediateLanding:{boundsXZ:[Math.min(f[0].endX,f[1].startX),Math.max(f[0].endX,f[1].startX),z-1.07,z+1.07],worldY:intermediate+main},geometryBasedFloorRayRequired:true});
  }
  const support={schema:1,sourceBlendSha256:'a'.repeat(64),entries:[]};
  const parts=Array.from({length:7},(_,i)=>({node:7+i,primitive:0,material:i<4?'Interpreted iron':'PlatformNernstGlower',originOffsetMain:i<4?[0,-i*.04,0]:[(i-5)*.035,-.324,0]}));
  const groups=Array.from({length:16},(_,i)=>{const from=originalFixtures[i].positionLocal,to=[i%2?-59.484:-68.628,-3.5004001,from[2]],glowers=parts.slice(4).map(p=>to.map((v,k)=>v+p.originOffsetMain[k]));support.entries.push({instance:i,actualMountMain:to,actualSupportingMesh:`Actual new underside ${i}`,fullFlangeRingSamples:16,maxCeilingMismatch:.0000001});return{instance:i,platform:Math.floor(i/2)+1,fromMain:from,toMain:to,mountWorld:[to[0],to[1]+main,to[2]],glowerCentreMain:glowers[1],glowerCentreWorld:[glowers[1][0],glowers[1][1]+main,glowers[1][2]],glowerCentresMain:glowers,glowerCentresWorld:glowers.map(g=>[g[0],g[1]+main,g[2]])};});
  const fixtures={schema:1,coordinateSpace:'Main0-glTF',authoring:{sourceBlendSha256:'a'.repeat(64),generatorSha256:'b'.repeat(64)},instanceCount:22,selectedInstanceIds:Array.from({length:16},(_,i)=>i),retainedInstances:[16,17,18,19,20,21],parts,models:{full:{sha256:'c'.repeat(64)},low:{sha256:'d'.repeat(64)}},groups,qualification:'Position inference; actual supporting underside coordinates; six northern groups retained'};
  const oldBounds=[[-55.25,-3.5004,-72.39],[-47.75,-3.2004,-36]];
  const proof={schema:1,sourceSha256:'a'.repeat(64),sourceSha256After:'a'.repeat(64),generatorSha256:'b'.repeat(64),allSixPhysicalInputs:{'model-platform.glb.gz':{sha256:'c'.repeat(64)}},frames:{savedMainWorldY:main,raw:'Main0glTF:Xeast,Yup,Zsouth'},flights:rawFlights,stairs,corridor:{boundsXZ:[-73.2,-54.912,-36,71],topMainY:-3.2004,liftKeepouts},oldExitOwnership:{retainedExactCellCount:5,crossingRemovedAndClosedPartialCount:3,retainedExactCells:Array.from({length:5},()=>({boundsMain:oldBounds})),newPartials:Array.from({length:3},()=>({newBoundsMain:oldBounds}))},structuralSource:{traced:49,safeLowerBuilt:47,heldIds:['C014','C025'],upperRecords:Array.from({length:47},(_,i)=>({upperBuilt:i<21})),memberDimensions:'Explicit minor fabrication inference'},outputs:{'arrivals-module.glb':{sha256:'e'.repeat(64),bytes:100},'old-exit-owned.glb':{sha256:'f'.repeat(64),bytes:10},'retained-protected.glb':{sha256:'1'.repeat(64),bytes:900}}};
  const layout={schema:1,coordinateSpace:'world-glTF,exceptexplicitMainfields',stairSupportFlights:worldFlights,arrivalAccess:profiles,ordinaryExitFloor:{boundsXZ:proof.corridor.boundsXZ,worldTopY:exit,sourceWidth:18.288,minimumPositionUncertainty:1,northEndStatus:'Temporary research guard'},retainedProvisionalNorthExit:{boundsXZ:[-55.25,-47.75,-72.39,-36],worldTopY:exit,exactOldCells:5,closedReplacementPartialCells:3,geometryBasedFloorRayRequired:true,status:'Northern arrangement unfinished'},liftKeepouts,fixtureGroups:structuredClone(groups),limits:['Western Main floor remains unchanged','P9/LIRR/street routes held','Minor fabrication inferred']};
  // Real receipts are separate JSON files, without shared in-memory arrays.
  return JSON.parse(JSON.stringify({base,proof,layout,fixtures,fixtureSupport:support}));
}
function seal(records){
  const r=structuredClone(records),baseBytes=bytes(r.base),fixtureSupportBytes=bytes(r.fixtureSupport);
  r.fixtures.authoring.supportProofSha256=hash(fixtureSupportBytes);const fixturesBytes=bytes(r.fixtures);
  r.proof.allSixPhysicalInputs['scene-manifest.json']={sha256:hash(baseBytes),bytes:baseBytes.length};
  r.proof.outputs['fixture-relocation-recipe.json']={sha256:hash(fixturesBytes),bytes:fixturesBytes.length};
  const proofBytes=bytes(r.proof);r.layout.sourceProofSha256=hash(proofBytes);const layoutBytes=bytes(r.layout);
  const ready={sourceProofSha256:hash(proofBytes),layoutSha256:hash(layoutBytes),outputs:r.proof.outputs,generatorSha256:r.proof.generatorSha256};
  return{baseBytes,readyBytes:bytes(ready),layoutBytes,proofBytes,fixturesBytes,fixtureSupportBytes};
}
const fixtureRecords=fixture(),input=seal(fixtureRecords),result=patchArrivalsManifest(input);
let count=0;const check=(label,fn)=>{fn();count++;console.log('PASS',label);};
check('Exact old levels, railway, departure routes and previous evidence retained',()=>{
  for(const key of Object.keys(fixtureRecords.base))if(!['walkable','stairSupportFlights'].includes(key))assert.deepEqual(result[key],fixtureRecords.base[key]);
  assert.equal(result.stairSupportFlights.length,59);assert.deepEqual(result.stairSupportFlights.slice(0,27),fixtureRecords.base.stairSupportFlights);assert.equal(result.accessStairs.length,9);
});
check('Input bytes are not mutated and returned records do not alias inputs',()=>{const snapshot=Object.fromEntries(Object.entries(input).map(([k,v])=>[k,Buffer.from(v)]));patchArrivalsManifest(input);for(const key of Object.keys(input))assert(input[key].equals(snapshot[key]));result.levels.mainWorld=123;assert.equal(JSON.parse(input.baseBytes).levels.mainWorld,main);result.levels.mainWorld=main;});
check('Only old broad Exit permission changes; new routes require actual meshes',()=>{
  const old=fixtureRecords.base.walkable.filter(a=>a.label!=='Exit concourse');for(const area of old)assert(result.walkable.some(a=>JSON.stringify(a)===JSON.stringify(area)));
  const newAreas=result.walkable.filter(a=>!old.some(b=>JSON.stringify(a)===JSON.stringify(b)));assert.equal(newAreas.length,18);assert(newAreas.every(a=>a.geometryBasedFloorRayRequired&&!('floor'in a)));
  assert.deepEqual(newAreas[0].bounds,[-73.2,-54.912,-36,71]);assert.deepEqual(newAreas[1].bounds,[-55.25,-47.75,-72.39,-36]);assert.equal(result.arrivalAccess.profiles.length,16);assert.equal(result.arrivalAccess.liftKeepouts.length,8);
});
check('World endpoints and all real fixture glowers retain source coordinates',()=>{const a=result.arrivalAccess;assert.deepEqual(a.platformFixtures,fixtureRecords.fixtures.groups);for(const p of a.profiles){assert.equal(p.flights.length,2);assert.equal(p.exitHeadWorld[1],exit);assert(Math.abs(p.platformFootWorld[1]-platform)<1e-9);}assert.equal(a.platformFixtures.filter(f=>[5,6].includes(f.platform)).length,4);assert(a.platformFixtures.every(f=>f.glowerCentresWorld.length===3));assert.deepEqual(a.replacedProvisionalExitPermission,fixtureRecords.base.walkable[1]);});
check('Changed JSON bytes or baseline evidence fail receipt identity',()=>{for(const key of ['baseBytes','layoutBytes','proofBytes','fixturesBytes','fixtureSupportBytes'])assert.throws(()=>patchArrivalsManifest({...input,[key]:Buffer.concat([input[key],Buffer.from(' ')])}),/exact|Exact|pins/);});
check('Repeated application and incorrect inventories are rejected',()=>{let r=structuredClone(fixtureRecords);r.base=patchArrivalsManifest(input);assert.throws(()=>patchArrivalsManifest(seal(r)),/twice/);r=structuredClone(fixtureRecords);r.layout.stairSupportFlights.pop();assert.throws(()=>patchArrivalsManifest(seal(r)),/32/);r=structuredClone(fixtureRecords);r.layout.arrivalAccess[1]=structuredClone(r.layout.arrivalAccess[0]);assert.throws(()=>patchArrivalsManifest(seal(r)),/Unique west\/east/);});
check('A rehashed double world offset or changed landing cannot invent support',()=>{let r=structuredClone(fixtureRecords);r.layout.stairSupportFlights[0].start[1]+=main;assert.throws(()=>patchArrivalsManifest(seal(r)),/World flight start/);r=structuredClone(fixtureRecords);r.layout.arrivalAccess[0].intermediateLanding.worldY+=.1;assert.throws(()=>patchArrivalsManifest(seal(r)),/Landing world height/);r=structuredClone(fixtureRecords);r.proof.frames.savedMainWorldY+=1;assert.throws(()=>patchArrivalsManifest(seal(r)),/Raw-to-world/);});
check('Expanded north permission and changed lift footprints reject source mismatch',()=>{let r=structuredClone(fixtureRecords);r.layout.retainedProvisionalNorthExit.boundsXZ[0]-=10;assert.throws(()=>patchArrivalsManifest(seal(r)),/actual retained/);r=structuredClone(fixtureRecords);r.layout.liftKeepouts[0].x[0]-=1;assert.throws(()=>patchArrivalsManifest(seal(r)),/Individual source lift/);});
check('Stale practical lights, incomplete groups or false mounting fail',()=>{let r=structuredClone(fixtureRecords);r.fixtures.groups[8].mountWorld[0]=-54.5;r.layout.fixtureGroups=structuredClone(r.fixtures.groups);assert.throws(()=>patchArrivalsManifest(seal(r)),/Fixture world offset/);r=structuredClone(fixtureRecords);r.fixtures.parts.pop();assert.throws(()=>patchArrivalsManifest(seal(r)),/seven-part/);r=structuredClone(fixtureRecords);r.fixtureSupport.entries[0].actualMountMain[1]+=.01;assert.throws(()=>patchArrivalsManifest(seal(r)),/Actual supporting underside/);});

const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'penn-arrivals-manifest-'));
try{
  const argNames={base:'baseBytes',ready:'readyBytes',layout:'layoutBytes',proof:'proofBytes',fixtures:'fixturesBytes','fixture-support':'fixtureSupportBytes'};const args=[];
  for(const [name,key] of Object.entries(argNames)){const file=path.join(scratch,name+'.json');fs.writeFileSync(file,input[key]);args.push('--'+name,file);}
  check('CLI writes one external candidate and refuses overwrite',()=>{const out=path.join(scratch,'candidate.json');const first=spawnSync(process.execPath,[helper,...args,'--out',out],{encoding:'utf8'});assert.equal(first.status,0,first.stderr);assert.deepEqual(JSON.parse(fs.readFileSync(out)),patchArrivalsManifest(input));const second=spawnSync(process.execPath,[helper,...args,'--out',out],{encoding:'utf8'});assert.notEqual(second.status,0);assert.match(second.stderr,/Never overwrite/);});
  check('CLI refuses production and symlink paths into repository',()=>{for(const out of [path.join(repo,'penn-station-1935/assets/scene-manifest.json'),path.join(scratch,'linked-assets','forbidden.json')]){if(out.includes('linked-assets'))fs.symlinkSync(path.join(repo,'penn-station-1935/assets'),path.join(scratch,'linked-assets'),'dir');const run=spawnSync(process.execPath,[helper,...args,'--out',out],{encoding:'utf8'});assert.notEqual(run.status,0);assert.match(run.stderr,/Outside-only/);}assert(!fs.existsSync(path.join(repo,'penn-station-1935/assets/forbidden.json')));});
  if(process.env.PENN_ARRIVALS_CANDIDATE){
    check('Actual frozen candidate receipts preserve prior manifest and expose all source routes',()=>{const dir=process.env.PENN_ARRIVALS_CANDIDATE;const files={base:'input-scene-manifest.json',ready:'READY.json',layout:'arrival-layout.json',proof:'source-proof.json',fixtures:'fixture-relocation-recipe.json',fixtureSupport:'fixture-support-proof.json'};const actual=Object.fromEntries(Object.entries(files).map(([key,file])=>[key+'Bytes',fs.readFileSync(path.join(dir,file))]));const out=patchArrivalsManifest(actual),base=JSON.parse(actual.baseBytes);assert.deepEqual(out.railway,base.railway);assert.deepEqual(out.departureAccess,base.departureAccess);assert.deepEqual(out.concourseCirculation,base.concourseCirculation);assert.equal(out.arrivalAccess.profiles.length,16);assert.equal(out.stairSupportFlights.length,59);assert.equal(out.arrivalAccess.platformFixtures.length,16);});
  }
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
console.log(`PASS ${count} arrivals-manifest contract groups; actual geometry/browser acceptance is separate.`);
