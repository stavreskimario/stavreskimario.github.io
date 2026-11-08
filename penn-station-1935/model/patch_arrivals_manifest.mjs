// Offline metadata patch for a receipt-bound arrivals candidate. Bounds permit
// real mesh queries; this helper never creates geometry or supplies a floor.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hashPattern = /^[a-f0-9]{64}$/;
const near = (a,b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a-b) < 1e-8;
const vector = (value, label) => assert(Array.isArray(value) && value.length === 3 && value.every(Number.isFinite), `${label}: finite three-coordinate vector`);
const sameVector = (a,b,label) => { vector(a,label); vector(b,label); assert(a.every((v,i)=>near(v,b[i])), `${label}: exact authored coordinates`); };
const bounds = (value,label) => assert(Array.isArray(value) && value.length === 4 && value.every(Number.isFinite) && value[0] < value[1] && value[2] < value[3], `${label}: ordered finite XZ bounds`);
const inside = (p,b) => p[0] >= b[0]-1e-8 && p[0] <= b[1]+1e-8 && p[2] >= b[2]-1e-8 && p[2] <= b[3]+1e-8;
const parse = (bytes,name) => { assert(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array, `${name}: original JSON bytes required`); return JSON.parse(Buffer.from(bytes).toString('utf8')); };

export function patchArrivalsManifest(inputs) {
  const names = ['base','ready','layout','proof','fixtures','fixtureSupport'];
  const records = Object.fromEntries(names.map(name=>[name,parse(inputs[`${name}Bytes`],name)]));
  const hashes = Object.fromEntries(names.map(name=>[name,sha(inputs[`${name}Bytes`])]));
  const {base,ready,layout,proof,fixtures,fixtureSupport} = records;
  assert.equal(ready.sourceProofSha256,hashes.proof,'READY pins exact source-proof bytes');
  assert.equal(ready.layoutSha256,hashes.layout,'READY pins exact layout bytes');
  assert.equal(layout.sourceProofSha256,hashes.proof,'Layout belongs to this source proof');
  assert.deepEqual(ready.outputs,proof.outputs,'READY and source proof pin identical artifacts');
  assert.equal(ready.generatorSha256,proof.generatorSha256,'READY pins the authoring generator');
  for(const name of ['arrivals-module.glb','old-exit-owned.glb','retained-protected.glb','fixture-relocation-recipe.json']) {
    const artifact=ready.outputs[name];
    assert(artifact && hashPattern.test(artifact.sha256) && artifact.bytes > 0,`Pinned ${name} identity`);
  }
  const fixtureArtifact=ready.outputs['fixture-relocation-recipe.json'];
  assert.equal(fixtureArtifact.sha256,hashes.fixtures,'Exact fixture-recipe bytes');
  assert.equal(fixtureArtifact.bytes,inputs.fixturesBytes.length,'Exact fixture-recipe length');
  assert.equal(fixtures.authoring.supportProofSha256,hashes.fixtureSupport,'Exact fixture-support proof bytes');
  const baseIdentity=proof.allSixPhysicalInputs['scene-manifest.json'];
  assert.equal(baseIdentity.sha256,hashes.base,'Exact frozen input manifest required');
  assert.equal(baseIdentity.bytes,inputs.baseBytes.length,'Exact frozen manifest length');
  assert.equal(proof.sourceSha256,proof.sourceSha256After,'Canonical authoring source remains unchanged');
  assert(hashPattern.test(proof.sourceSha256),'Canonical source SHA256');
  assert.equal(fixtures.authoring.sourceBlendSha256,proof.sourceSha256);
  assert.equal(fixtureSupport.sourceBlendSha256,proof.sourceSha256);
  assert.equal(fixtures.authoring.generatorSha256,proof.generatorSha256);
  for(const record of [layout,proof,fixtures,fixtureSupport]) assert.equal(record.schema,1,'Supported authored schema');
  assert(!base.arrivalAccess,'Do not apply arrivals twice');
  assert.equal(base.accessStairs.length,9,'Preserve nine departures');
  assert.equal(base.stairSupportFlights.length,27,'Preserve 27 departure flights');
  assert.equal(base.railway.trackCount,21); assert.equal(base.railway.tracks.length,21);
  assert.equal(base.railway.platformCount,11); assert.equal(base.railway.platforms.length,11);
  const offset=base.levels.mainWorld;
  assert.equal(offset,proof.frames.savedMainWorldY,'Raw-to-world Main offset');
  assert.deepEqual(base.chunkOffsets.concourse,[0,offset,0],'Retain concourse transform');
  assert.equal(proof.frames.raw,'Main0glTF:Xeast,Yup,Zsouth');
  assert.equal(layout.coordinateSpace,'world-glTF,exceptexplicitMainfields');
  const world = p => [p[0],p[1]+offset,p[2]];

  assert.equal(layout.stairSupportFlights.length,32,'Exactly 32 authored arrival flights');
  assert.equal(proof.flights.length,32,'Matching raw arrival flight inventory');
  assert.equal(layout.arrivalAccess.length,16,'Exactly 16 independent arrival profiles');
  assert.equal(proof.stairs.length,16,'Matching source stair inventory');
  const flightKey = f => `${f.rowOrdinal}:${f.side}:${f.flight}`;
  const sourceFlights=new Map(proof.flights.map(f=>[flightKey(f),f]));
  assert.equal(sourceFlights.size,32,'Unique raw arrival flights');
  const runtimeFlights=layout.stairSupportFlights.map(f=>{
    assert(Number.isInteger(f.rowOrdinal) && f.rowOrdinal>=1 && f.rowOrdinal<=8,'Only ordinary arrival rows 1–8');
    assert(['west','east'].includes(f.side) && [1,2].includes(f.flight),'Authored side and flight');
    assert.equal(f.coordinateSpace,'world-glTF');
    const source=sourceFlights.get(flightKey(f)); assert(source,'Source flight exists');
    sameVector(f.start,world(source.start),'World flight start'); sameVector(f.end,world(source.end),'World flight end');
    for(const field of ['risers','internalGoings','physicalTreadWidth','nominalClearWidth']) assert.equal(f[field],source[field],`Source flight ${field}`);
    assert.equal(f.width,f.nominalClearWidth); assert(f.width>0 && f.physicalTreadWidth>=f.width);
    assert(f.start[1]>f.end[1],'Arrival flight descends from Exit toward platform');
    assert(f.side==='west' ? f.end[0]<f.start[0] : f.end[0]>f.start[0],'Independent west/east direction');
    return {...structuredClone(f),row:f.rowOrdinal,steps:f.risers,route:'arrival'};
  });
  assert.equal(new Set(runtimeFlights.map(flightKey)).size,32,'No duplicated layout flight');
  const sourceStairs=new Map(proof.stairs.map(s=>[`${s.ordinal}:${s.side}`,s]));
  assert.equal(sourceStairs.size,16,'Unique source arrival stairs');
  const profiles=layout.arrivalAccess.map(profile=>{
    const key=`${profile.sourceOrdinal}:${profile.side}`,source=sourceStairs.get(key);
    assert(source,'Source access profile exists'); assert.equal(profile.workingPlatform,profile.sourceOrdinal);
    assert.equal(profile.sourceCenterZ,source.centerZ,'Separate authored west/east centre retained');
    const flights=runtimeFlights.filter(f=>f.rowOrdinal===profile.sourceOrdinal&&f.side===profile.side).sort((a,b)=>a.flight-b.flight);
    assert.equal(flights.length,2); assert.equal(profile.flights.length,2);
    for(let i=0;i<2;i++) assert.deepEqual(profile.flights[i],layout.stairSupportFlights.find(f=>flightKey(f)===flightKey(flights[i])),'Profile uses its exact layout flight');
    sameVector(profile.exitHeadWorld,flights[0].start,'Authored Exit head'); sameVector(profile.platformFootWorld,flights[1].end,'Authored platform foot');
    assert(near(profile.exitHeadWorld[1],base.levels.exitWorld)); assert(near(profile.platformFootWorld[1],base.levels.platformWorld));
    assert.equal(profile.geometryBasedFloorRayRequired,true,'No virtual stair floor');
    const landing=profile.intermediateLanding; bounds(landing.boundsXZ,'Landing');
    const expectedLanding=[Math.min(source.landing.startX,source.landing.endX),Math.max(source.landing.startX,source.landing.endX),source.centerZ-flights[0].physicalTreadWidth/2,source.centerZ+flights[0].physicalTreadWidth/2];
    assert.deepEqual(landing.boundsXZ,expectedLanding,'Landing matches authored stair');
    assert(near(landing.worldY,source.landing.mainY+offset),'Landing world height');
    assert(near(flights[0].end[1],landing.worldY)&&near(flights[1].start[1],landing.worldY));
    assert(inside(flights[0].end,landing.boundsXZ)&&inside(flights[1].start,landing.boundsXZ),'Two flights join actual landing');
    return {...structuredClone(profile),flights,boundsXZ:[Math.min(profile.exitHeadWorld[0],profile.platformFootWorld[0]),Math.max(profile.exitHeadWorld[0],profile.platformFootWorld[0]),source.centerZ-flights[0].width/2,source.centerZ+flights[0].width/2]};
  });
  assert.equal(new Set(profiles.map(p=>`${p.sourceOrdinal}:${p.side}`)).size,16,'Unique west/east profiles');
  const corridor=layout.ordinaryExitFloor,north=layout.retainedProvisionalNorthExit;
  bounds(corridor.boundsXZ,'Ordinary Exit'); bounds(north.boundsXZ,'Northern provisional deck');
  assert.deepEqual(corridor.boundsXZ,proof.corridor.boundsXZ,'Floor matches authored geometry bounds');
  assert(near(corridor.worldTopY,proof.corridor.topMainY+offset)&&near(corridor.worldTopY,base.levels.exitWorld));
  assert(near(corridor.boundsXZ[1]-corridor.boundsXZ[0],corridor.sourceWidth));
  assert(corridor.minimumPositionUncertainty>=1,'Retain at least one metre registration uncertainty');
  assert(near(north.worldTopY,base.levels.exitWorld)&&near(north.boundsXZ[3],corridor.boundsXZ[2]));
  assert.equal(north.exactOldCells,proof.oldExitOwnership.retainedExactCellCount);
  assert.equal(north.closedReplacementPartialCells,proof.oldExitOwnership.crossingRemovedAndClosedPartialCount);
  const retainedCells=[...proof.oldExitOwnership.retainedExactCells.map(c=>c.boundsMain),...proof.oldExitOwnership.newPartials.map(c=>c.newBoundsMain)];
  assert.equal(retainedCells.length,north.exactOldCells+north.closedReplacementPartialCells,'All northern cells accounted for');
  assert.deepEqual(north.boundsXZ,[Math.min(...retainedCells.map(b=>b[0][0])),Math.max(...retainedCells.map(b=>b[1][0])),Math.min(...retainedCells.map(b=>b[0][2])),Math.max(...retainedCells.map(b=>b[1][2]))],'Northern bounds derive from actual retained/replacement cell ownership');
  assert.equal(north.geometryBasedFloorRayRequired,true);
  assert.equal(layout.liftKeepouts.length,8); assert.deepEqual(layout.liftKeepouts,proof.corridor.liftKeepouts,'Individual source lift footprints');
  assert.equal(new Set(layout.liftKeepouts.map(l=>l.row)).size,8);
  for(const lift of layout.liftKeepouts){assert(lift.row>=1&&lift.row<=8);const b=[...lift.x,...lift.z];bounds(b,'Lift keepout');assert(inside([b[0],0,b[2]],corridor.boundsXZ)&&inside([b[1],0,b[3]],corridor.boundsXZ));}
  for(const profile of profiles) assert(inside(profile.exitHeadWorld,corridor.boundsXZ),'Arrival head meets bounded real Exit corridor');

  assert.equal(fixtures.coordinateSpace,'Main0-glTF'); assert.equal(fixtures.instanceCount,22);
  assert.deepEqual(fixtures.selectedInstanceIds,Array.from({length:16},(_,i)=>i));
  assert.deepEqual(fixtures.retainedInstances,[16,17,18,19,20,21]);
  assert.equal(fixtures.parts.length,7,'Complete seven-part fixture groups');
  assert.equal(new Set(fixtures.parts.map(p=>`${p.node}:${p.primitive}`)).size,7);
  assert.equal(fixtures.models.full.sha256,proof.allSixPhysicalInputs['model-platform.glb.gz'].sha256,'Fixture recipe uses frozen full platform asset');
  assert.equal(fixtures.groups.length,16); assert.equal(fixtureSupport.entries.length,16);
  assert.deepEqual(layout.fixtureGroups,fixtures.groups,'Layout keeps exact actual fixture coordinates');
  const originalFixtures=base.railway.platformNernstFixtures; assert.equal(originalFixtures.length,22);
  const glowerParts=fixtures.parts.filter(p=>p.material==='PlatformNernstGlower'); assert.equal(glowerParts.length,3);
  for(const [index,group] of fixtures.groups.entries()){
    assert.equal(group.instance,index,'Unique original fixture instance'); assert.equal(group.platform,Math.floor(index/2)+1);
    const source=originalFixtures[index],support=fixtureSupport.entries.find(e=>e.instance===index); assert(support,'Actual fixture support entry');
    assert.equal(source.platform,group.platform); sameVector(group.fromMain,source.positionLocal,'Original complete fixture mount');
    sameVector(group.toMain,support.actualMountMain,'Actual supporting underside'); sameVector(group.mountWorld,world(group.toMain),'Fixture world offset once');
    assert.equal(support.fullFlangeRingSamples,16); assert(Number.isFinite(support.maxCeilingMismatch)&&support.maxCeilingMismatch>=0&&support.maxCeilingMismatch<.00002,'Source full flange-ring contact tolerance');
    assert.equal(group.glowerCentresMain.length,3); assert.equal(group.glowerCentresWorld.length,3);
    for(const [i,part] of glowerParts.entries()){
      const expected=group.toMain.map((v,k)=>v+part.originOffsetMain[k]);
      sameVector(group.glowerCentresMain[i],expected,'Actual glower relative mount'); sameVector(group.glowerCentresWorld[i],world(expected),'Actual world glower');
    }
    sameVector(group.glowerCentreMain,group.glowerCentresMain[1],'Central practical glower'); sameVector(group.glowerCentreWorld,group.glowerCentresWorld[1],'Central world practical');
  }

  const oldExit=base.walkable.filter(area=>area.label==='Exit concourse'); assert.equal(oldExit.length,1,'Replace exactly one old Exit permission');
  const result=structuredClone(base);
  const actualPermission=(label,b)=>({label,bounds:structuredClone(b),geometryBasedFloorRayRequired:true,surface:'Permission bounds only; walk support and collisions require actual authored mesh intersections.'});
  result.walkable=base.walkable.flatMap(area=>area.label==='Exit concourse' ? [actualPermission('Exit concourse',corridor.boundsXZ),actualPermission('Retained provisional northern Exit deck',north.boundsXZ)] : [structuredClone(area)]);
  result.walkable.push(...profiles.map(p=>actualPermission(`Independent ${p.side} arrival stairs from working platform ${p.workingPlatform}`,p.boundsXZ)));
  result.stairSupportFlights=[...structuredClone(base.stairSupportFlights),...runtimeFlights];
  result.arrivalAccess={
    revision:'phase8-first-eight-ordinary-arrivals-1',
    status:'Qualified opening-era reconstruction of eight platform arrival pairs and a bounded Exit corridor; actual geometry, route, lighting and browser acceptance are separate.',
    sourceManifestSha256:hashes.base,sourceProofSha256:hashes.proof,layoutSha256:hashes.layout,
    fixtureRecipeSha256:hashes.fixtures,fixtureSupportProofSha256:hashes.fixtureSupport,
    sourceSceneSha256:proof.sourceSha256,moduleSha256:ready.outputs['arrivals-module.glb'].sha256,
    removedOldDeckModuleSha256:ready.outputs['old-exit-owned.glb'].sha256,
    sources:[
      {id:'S10',url:'https://ascelibrary.org/doi/10.1061/TACEAT.0002223',controls:['Printed242–244: separate Exit arrivals on both sides of platforms; Fig3 provides individual plan positions.','Printed252: Exit60ft width; plateLXXXIV Fig2: two straight flights and intermediate landing family.','Printed262: eleven lifts, eight Exit-only and three Main-reaching; individual identities are not established here.']},
      {id:'S9',url:'https://ascelibrary.org/doi/10.1061/TACEAT.0002221',controls:['PlateLXI: north Main319.01ft and Exit308.51ft, relative10.5ft; local grades vary.','Printed189: track-clearance column constraints and offset/transfer framing; exact new member sections remain interpreted.']},
      {id:'LOC071937',url:'https://www.loc.gov/item/2016815392/',catalogDate:'between1905and1915',warning:'071937 is a negative number, not a photograph dated1937.',controls:['Original arrival stair/landing, ornamental guards and lower supports continuing throughExit toMain underside.']},
    ],
    corridor:structuredClone(corridor),retainedProvisionalNorthExit:structuredClone(north),
    replacedProvisionalExitPermission:structuredClone(oldExit[0]),
    profiles,liftKeepouts:structuredClone(layout.liftKeepouts),
    liftStatus:'Enclosures accessible at Exit, not functioning elevators. Which three extend to Main remains held; no individual Main-reaching assignment is certified.',
    platformFixtures:structuredClone(fixtures.groups),retainedFixtureInstances:structuredClone(fixtures.retainedInstances),
    fixtureStatus:fixtures.qualification,
    structuralScope:{traced:proof.structuralSource.traced,lowerBuilt:proof.structuralSource.safeLowerBuilt,heldLowerIds:structuredClone(proof.structuralSource.heldIds),upperBuilt:proof.structuralSource.upperRecords.filter(r=>r.upperBuilt).length,upperHeld:proof.structuralSource.upperRecords.filter(r=>!r.upperBuilt).length,memberDimensions:proof.structuralSource.memberDimensions,status:'Actual contact is not certified original fabrication or structural capacity; unresolved transfer cases remain held.'},
    limits:[...structuredClone(layout.limits),'Registration retains at least ±1m uncertainty; minor stair/member dimensions are coordinated reconstruction choices.','Existing levels, railway, departure records and earlier evidence retain exact values; earlier provisional arrival statements remain chronological source evidence.'],
  };
  const changed=new Set(['walkable','stairSupportFlights']);
  for(const key of Object.keys(base))if(!changed.has(key))assert.deepEqual(result[key],base[key],`Preserve existing ${key}`);
  assert.deepEqual(result.stairSupportFlights.slice(0,27),base.stairSupportFlights,'Exact departure prefix');
  assert.deepEqual(result.walkable.filter(a=>a.label!=='Exit concourse'&&!a.label.startsWith('Independent west arrival')&&!a.label.startsWith('Independent east arrival')&&a.label!=='Retained provisional northern Exit deck'),base.walkable.filter(a=>a.label!=='Exit concourse'),'Preserve unrelated walk permissions');
  return result;
}

function prospectiveRealPath(file){
  let parent=path.resolve(file);const tail=[];
  while(!fs.existsSync(parent)){tail.unshift(path.basename(parent));const next=path.dirname(parent);assert.notEqual(next,parent);parent=next;}
  return path.join(fs.realpathSync(parent),...tail);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const allowed=['base','ready','layout','proof','fixtures','fixture-support','out'],args={};
  for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i]?.replace(/^--/,'');assert(allowed.includes(key)&&process.argv[i].startsWith('--')&&process.argv[i+1]&&!args[key],`Valid unique paired option ${process.argv[i]}`);args[key]=process.argv[i+1];}
  for(const key of allowed)assert(args[key],`Missing --${key}`);
  const repo=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'));
  const destination=prospectiveRealPath(args.out);
  assert(destination!==repo&&!destination.startsWith(repo+path.sep),'Outside-only candidate output; production metadata is never overwritten');
  assert(!fs.existsSync(args.out),'Never overwrite an existing output');
  const inputs=Object.fromEntries(allowed.filter(k=>k!=='out').map(k=>[`${k==='fixture-support'?'fixtureSupport':k}Bytes`,fs.readFileSync(args[k])]));
  const result=patchArrivalsManifest(inputs);
  fs.mkdirSync(path.dirname(path.resolve(args.out)),{recursive:true});
  fs.writeFileSync(args.out,JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({out:path.resolve(args.out),sha256:sha(fs.readFileSync(args.out)),departureFlights:27,arrivalFlights:32,departureAccess:9,arrivalProfiles:16,tracks:21,platforms:11,actualFixtureGroups:16,geometryRequired:true}));
}
