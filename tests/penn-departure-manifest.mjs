// Reproducible metadata controls; no persistent scratch inputs or 3D assets.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { patchDepartureManifest } from '../penn-station-1935/model/patch_departure_manifest.mjs';

const centres=[68.764528,54.791453,40.818378,27.149065,13.327870,-.341443,-13.555112,-27.224425,-40.321460];
const main=-4.2672,platform=main-7.718425;
const plan={rootAcceptedInterpretation:true,gateX:-48.4,indicatorX:-48.2,clearWidth:2,
  upperApertureX:[-48.4,-43.35],whyNotSourceNominalGate:'Unresolved1.6m plan/frame difference.',
  implementationInferences:['Three interpreted flights; separate provisional arrivals.'],
  flights:[[-48.4,-43.35,0,-7.718425/3],[-42.15,-37.1,-7.718425/3,-7.718425*2/3],[-35.9,-30.85,-7.718425*2/3,-7.718425]].map((v,i)=>({flight:i+1,startX:v[0],endX:v[1],startMainRelativeY:v[2],endMainRelativeY:v[3],clearWidth:2,risers:15})),
  intermediateLandings:[{startX:-43.35,endX:-42.15,mainRelativeY:-7.718425/3},{startX:-37.1,endX:-35.9,mainRelativeY:-7.718425*2/3}],
  platformLanding:{startX:-30.85,endX:-29.65,mainRelativeY:-7.718425},
  rows:centres.map((z,i)=>({workingPlatform:i+1,centreWorldZ:z,upperOpeningZ:[z-1.125,z+1.125],mappingStatus:'Fixture metadata; platform assignment not historically certified.'})),
};
const recipe={revision:'metadata-fixture',coordinates:{mainWorldY:main,platformWorldY:platform},workingDepartureCandidate:plan,
  sources:[{id:'Gibbs1910',url:'https://archive.org/details/transactionsofam69amer',controls:['Main departures and separate Exit arrivals']}],
  sourceRegistration:{departureReadings:{nominalGateX:-50}},
};
const proof={recipeSha256:createHash('sha256').update(JSON.stringify(recipe)).digest('hex'),retainedExitDeck:'Provisional Exit deck retained.',outputs:{'departure-access-module.glb':{sha256:'f'.repeat(64)}},
  stairSupportFlights:plan.rows.flatMap(row=>plan.flights.map(f=>({row:row.workingPlatform,start:[f.startX,f.startMainRelativeY+main,row.centreWorldZ],end:[f.endX,f.endMainRelativeY+main,row.centreWorldZ],width:2,physicalTreadWidth:2.14,steps:15}))),
};
const base={levels:{mainWorld:main,platformWorld:platform},chunkOffsets:{concourse:[0,main,0]},
  accessStairs:centres.map(z=>({centerZ:z,exitToPlatform:{obsolete:true}})),stairSupportFlights:Array.from({length:27},(_,i)=>({oldFlight:i})),
  walkable:[{label:'Main concourse',bounds:[-105,-40,-72,72],floor:main},{label:'Exit concourse',bounds:[-55.2563,-47.7563,-72.39,72.39],floor:-7.4676},...centres.map(z=>({label:'Lower platform-access doglegs',bounds:[-54.1563,-47.3563,z-1.85,z+1.85],floor:platform}))],
  railway:{platforms:Array.from({length:11},(_,i)=>({number:i+1,polygonXZ:[[-221-i,i],[-100,i+2],[92+i,i+1]],floorWorld:platform}))},
  mainStair:{bounds:[16.5,24.9,-6.0198,6.0198],risers:28},endEntranceStairs:{retained:true},waitingEndStairs:{retained:true},
  unrelated:{material:'Existing PBR/AO/GI stays authoritative',values:[.2,0,3.14159]},
};
const patch=(b=base,p=proof,h=proof.recipeSha256)=>patchDepartureManifest(b,recipe,p,h);
let count=0;
const check=(name,fn)=>{fn();count++;console.log('PASS',name);};
const output=patch();
check('Input metadata is not mutated',()=>{const snapshot=structuredClone(base);patch();assert.deepEqual(base,snapshot);});
check('All unrelated fields and 11 platform polygons remain exact',()=>{for(const key of ['levels','chunkOffsets','railway','mainStair','endEntranceStairs','waitingEndStairs','unrelated'])assert.deepEqual(output[key],base[key]);});
check('Nine obsolete dogleg permissions replaced by nine bounded departures',()=>{assert.equal(output.walkable.filter(a=>a.label==='Lower platform-access doglegs').length,0);assert.equal(output.walkable.filter(a=>a.label.startsWith('Independent departure stairs')).length,9);assert.deepEqual(output.walkable.find(a=>a.label==='Exit concourse'),base.walkable[1]);});
check('27 eastward flights, two independent landings, no false Exit link',()=>{assert.equal(output.stairSupportFlights.length,27);for(const a of output.accessStairs){assert.equal(a.exitToPlatform,undefined);assert.equal(a.departureFlights.length,3);assert.equal(a.intermediateLandings.length,2);assert(a.departureFlights.every(f=>f.end[0]>f.start[0]));assert(a.intermediateLandings.every(l=>!l.joinsExitConcourse));}});
check('All 54 flight endpoints are inside their actual route permission',()=>{for(const f of output.stairSupportFlights){const a=output.walkable.find(a=>a.label===`Independent departure stairs to working platform ${f.row}`);for(const p of [f.start,f.end])assert(p[0]>=a.bounds[0]&&p[0]<=a.bounds[1]&&p[2]>=a.bounds[2]&&p[2]<=a.bounds[3]);}});
check('Gate and interpreted indicator coordinates stay separate',()=>{assert.equal(output.departureAccess.candidateGateX,-48.4);assert.equal(output.departureAccess.indicatorPlacement.x,-48.2);assert(Math.abs(output.departureAccess.indicatorPlacement.offsetEastOfGate-.2)<1e-12);});
check('Unresolved registration and provisional arrival qualification retained',()=>{assert(output.departureAccess.registrationUncertainty.includes('1.6m'));assert(output.departureAccess.arrivalStatus.includes('Provisional'));});
check('Stale recipe rejected',()=>assert.throws(()=>patch(base,proof,'stale'),/exact recipe/));
check('Changed source endpoint rejected',()=>{const p=structuredClone(proof);p.stairSupportFlights[0].end[0]-=.05;assert.throws(()=>patch(base,p),/Exact source flight/);});
check('Changed physical tread width rejected',()=>{const p=structuredClone(proof);p.stairSupportFlights[0].physicalTreadWidth=1.9;assert.throws(()=>patch(base,p),/Physical authored tread width/);});
check('Changed raw-to-world transform rejected',()=>{const b=structuredClone(base);b.chunkOffsets.concourse[1]+=.1;assert.throws(()=>patch(b),/Concourse raw Main=0/);});
check('Changed platform datum rejected',()=>{const b=structuredClone(base);b.levels.platformWorld+=.1;assert.throws(()=>patch(b),/Retained platform world datum/);});
check('Wrong stair-row inventory rejected',()=>{const b=structuredClone(base);b.accessStairs.push(b.accessStairs[0]);assert.throws(()=>patch(b));});
check('Existing unequal N–S centre mismatch rejected',()=>{const b=structuredClone(base);b.accessStairs[2].centerZ+=.1;assert.throws(()=>patch(b),/N–S centres/);});
check('Repeated application rejected instead of duplicating departures',()=>assert.throws(()=>patch(output),/obsolete nine dogleg/));
console.log(`PASS ${count} departure-manifest controls`);
