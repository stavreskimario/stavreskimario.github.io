import assert from 'node:assert/strict';
import fs from 'node:fs';
import { platformPracticalAnchors } from '../penn-station-1935/src/platform-practicals.mjs';

const legacy = platformPracticalAnchors({});
assert.deepEqual(legacy.map(item => item.position), [
  [-54.5,-8.0916,13.327870361],[-54.5,-8.0916,-.341442588],
  [-48.404,-8.0916,13.327870361],[-48.404,-8.0916,-.341442588],
]);
assert.deepEqual(legacy.map(item => item.primaryShadow),[true,false,false,true]);

// Different heights deliberately catch reuse of the old constant ceiling plane.
const fixtures = Array.from({length:16},(_,instance) => ({instance, platform:Math.floor(instance/2)+1,
  glowerCentreWorld:[instance%2 ? -59.484 : -68.628,-8.0916-instance*.01,70-instance*6]}));
const manifest={arrivalAccess:{platformFixtures:fixtures}},before=structuredClone(manifest);
const actual=platformPracticalAnchors(manifest);
assert.deepEqual(actual.map(item=>item.position),[8,10,9,11].map(i=>fixtures[i].glowerCentreWorld));
assert.deepEqual(actual.map(item=>item.primaryShadow),[true,false,false,true]);
assert.deepEqual(manifest,before);
actual[0].position[0]=999;assert.deepEqual(manifest,before,'Returned positions do not alias the source manifest');
for(const mutate of [
  value=>{delete value.arrivalAccess.platformFixtures;},
  value=>value.arrivalAccess.platformFixtures.splice(8,1),
  value=>value.arrivalAccess.platformFixtures.push(value.arrivalAccess.platformFixtures[8]),
  value=>{value.arrivalAccess.platformFixtures[8].platform=6;},
  value=>{value.arrivalAccess.platformFixtures[8].glowerCentreWorld[1]=NaN;},
]){const bad=structuredClone(before);mutate(bad);assert.throws(()=>platformPracticalAnchors(bad));}

if(process.env.PENN_FIXTURE_RECIPE){
  const recipe=JSON.parse(fs.readFileSync(process.env.PENN_FIXTURE_RECIPE));
  const lights=platformPracticalAnchors({arrivalAccess:{platformFixtures:recipe.groups}});
  for(const light of lights){
    const group=recipe.groups.find(item=>light.id===`platform:${item.platform}:${item.instance}`);
    assert.deepEqual(light.position,group.glowerCentreWorld);
    assert(Math.abs(group.mountWorld[1]-light.position[1]-.324)<1e-10);
  }
}
console.log('PASS practical-light anchors follow source glowers, preserve the earlier layout and reject missing/ambiguous central fixtures');
