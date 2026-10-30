// Offline navigation metadata for the qualified Blender departure module.
// This helper never changes an input, model payload, or production directory.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function patchDepartureManifest(base, recipe, proof, recipeHash) {
  const plan = recipe.workingDepartureCandidate;
  assert.equal(proof.recipeSha256, recipeHash, 'Source module must use this exact recipe');
  assert.equal(plan.rootAcceptedInterpretation, true);
  assert.equal(base.accessStairs.length, 9);
  assert.equal(base.stairSupportFlights.length, 27);
  assert.equal(plan.rows.length, 9);
  assert.equal(proof.stairSupportFlights.length, 27);
  assert.equal(base.levels.mainWorld, recipe.coordinates.mainWorldY, 'Main world datum retained');
  assert.deepEqual(base.chunkOffsets.concourse, [0, recipe.coordinates.mainWorldY, 0], 'Concourse raw Main=0 transform retained');
  assert.equal(base.levels.platformWorld, recipe.coordinates.platformWorldY, 'Retained platform world datum');
  assert.equal(plan.flights.length, 3);
  const offset = recipe.coordinates.mainWorldY;
  const flights = plan.rows.flatMap(row => plan.flights.map(f => ({
    row: row.workingPlatform, label: `Departure platform${row.workingPlatform} flight${f.flight}`,
    start: [f.startX, f.startMainRelativeY + offset, row.centreWorldZ],
    end: [f.endX, f.endMainRelativeY + offset, row.centreWorldZ],
    width: f.clearWidth, physicalTreadWidth: f.clearWidth + .14, steps: f.risers,
  })));
  const near = (a,b) => Math.abs(a-b) < 1e-9;
  for (const [i,f] of flights.entries()) {
    const source = proof.stairSupportFlights[i];
    assert.equal(source.row, f.row);
    assert.equal(source.steps, f.steps);
    assert.equal(source.width, f.width);
    assert(near(source.physicalTreadWidth, f.physicalTreadWidth), 'Physical authored tread width retained');
    for (const key of ['start','end']) assert(f[key].every((v,k) => near(v,source[key][k])), `Exact source flight ${i} ${key}`);
  }
  for (const [i,row] of plan.rows.entries()) assert(near(base.accessStairs[i].centerZ,row.centreWorldZ), 'Existing unequal N–S centres retained');
  const patched = structuredClone(base);
  const removed = patched.walkable.filter(a => a.label === 'Lower platform-access doglegs');
  assert.equal(removed.length,9,'Remove exactly the obsolete nine dogleg permissions');
  patched.walkable = patched.walkable.filter(a => a.label !== 'Lower platform-access doglegs');
  for (const row of plan.rows) patched.walkable.push({
    label: `Independent departure stairs to working platform ${row.workingPlatform}`,
    bounds: [plan.gateX,plan.platformLanding.endX,row.centreWorldZ-plan.clearWidth/2,row.centreWorldZ+plan.clearWidth/2],
    floor: recipe.coordinates.platformWorldY,
    surface: 'Three independent eastward departure flights and landings; actual authored support rays required. No connection to provisional arrival Exit deck.',
  });
  patched.accessStairs = plan.rows.map(row => {
    const rowFlights=flights.filter(f=>f.row===row.workingPlatform);
    const landing = a => ({
      bounds: [a.startX,a.endX,row.centreWorldZ-plan.clearWidth/2,row.centreWorldZ+plan.clearWidth/2],
      floorWorld: a.mainRelativeY+offset, joinsExitConcourse:false,
    });
    return { workingPlatform:row.workingPlatform,centerZ:row.centreWorldZ,
      mainOpening:[...plan.upperApertureX,...row.upperOpeningZ],
      mainFlight:structuredClone(rowFlights[0]), departureFlights:rowFlights,
      intermediateLandings:plan.intermediateLandings.map(landing),
      platformLanding:{...landing(plan.platformLanding),surfaceOwner:'Retained actual railway platform; no duplicate receiving slab'},
      topology:'Main -> west/court-facing gate -> eastward departure flights -> platform; independent of provisional arrivals',
      historicalStatus:row.mappingStatus,
    };
  });
  patched.stairSupportFlights=flights;
  patched.departureAccess={
    revision:recipe.revision,sourceRecipeSha256:recipeHash,
    sourceModuleSha256:proof.outputs['departure-access-module.glb'].sha256,
    status:'Qualified departure reconstruction; decoded geometry and browser acceptance recorded separately.',
    sources:recipe.sources.map(({id,url,controls,catalogDate,warning})=>({id,url,controls,...catalogDate?{catalogDate}:{},...warning?{warning}:{}})),
    sourceNominalGateX:recipe.sourceRegistration.departureReadings.nominalGateX,
    candidateGateX:plan.gateX,
    indicatorPlacement:{x:plan.indicatorX??plan.gateX,offsetEastOfGate:(plan.indicatorX??plan.gateX)-plan.gateX,
      status:'Paired shaft/cabinet/card/numeral assemblies on supported flanks; exact placement interpreted for physical circulation, separate from stair gate/aperture registration.'},
    registrationUncertainty:plan.whyNotSourceNominalGate,
    dimensionsStatus:plan.implementationInferences,
    arrivalStatus:proof.retainedExitDeck,
  };
  // All unrelated manifest fields, including platform endpoint polygons and
  // existing main/waiting stairs, retain their exact JSON values.
  const allowed=new Set(['walkable','accessStairs','stairSupportFlights','departureAccess']);
  for(const key of Object.keys(base))if(!allowed.has(key))assert.deepEqual(patched[key],base[key],`Retained ${key}`);
  assert.deepEqual(patched.railway,base.railway);
  assert.equal(patched.walkable.filter(a=>a.label==='Exit concourse').length,1);
  return patched;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const options={};for(let i=2;i<process.argv.length;i+=2){assert(process.argv[i].startsWith('--'));options[process.argv[i].slice(2)]=process.argv[i+1];}
  for(const name of ['base','recipe','proof','out'])assert(options[name],`--${name} required`);
  const read=p=>JSON.parse(fs.readFileSync(p));
  const patched=patchDepartureManifest(read(options.base),read(options.recipe),read(options.proof),sha(fs.readFileSync(options.recipe)));
  const out=path.resolve(options.out),repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
  assert(!out.startsWith(repo+'/'),'Outside-only candidate output');
  assert(!fs.existsSync(out),'Never overwrite an existing manifest');
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(patched,null,2)+'\n');
  console.log(JSON.stringify({out,sha256:sha(fs.readFileSync(out)),accessStairs:patched.accessStairs.length,stairSupportFlights:patched.stairSupportFlights.length,platformPolygonsUnchanged:true}));
}
