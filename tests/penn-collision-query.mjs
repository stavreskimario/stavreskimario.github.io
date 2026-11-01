// Finite segment neighbourhood controls. The independent Three.js Box/Ray
// checks cover grid boundaries, contact tolerance and conservative diagonals.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {COLLISION_CELL, nearbyCollisionObjects} from '../penn-station-1935/src/collision-query.mjs';
const requireTools=createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools','package.json'));
const {Box3,Vector3,Ray}=requireTools('three');
const vector=v=>new Vector3(...v);
function makeIndex(boxes) {
  const index={cells:new Map(),records:[],stats:{queries:0,lastCandidates:0,maximumCandidates:0}};
  for (const [i,[min,max]] of boxes.entries()) {
    const record={object:{id:i},bounds:new Box3(vector(min),vector(max))};index.records.push(record);
    for(let x=Math.floor(min[0]/COLLISION_CELL);x<=Math.floor(max[0]/COLLISION_CELL);x++)for(let z=Math.floor(min[2]/COLLISION_CELL);z<=Math.floor(max[2]/COLLISION_CELL);z++){
      const key=`${x}:${z}`;if(!index.cells.has(key))index.cells.set(key,[]);index.cells.get(key).push(record);
    }
  }
  return index;
}
const ids=(index,origin,direction,distance)=>nearbyCollisionObjects(index,vector(origin),vector(direction),distance).map(o=>o.id);
assert.deepEqual(nearbyCollisionObjects(null,vector([0,0,0]),vector([1,0,0]),1),[]);
const index=makeIndex([
 [[-.2,-.2,-.2],[.2,.2,.2]], // around ray origin
 [[.3,-.2,-.2],[.5,.2,.2]], // ray endpoint
 [[1,-.2,-.2],[2,.2,.2]], // same cell, beyond finite ray
 [[.1,-.2,1],[.2,.2,2]], // same cell, off-axis
 [[-.1,-1,-.1],[.1,-.5,.1]], // real lower support
 [[.1,.2005,-.1],[.2,.4,.1]], // 0.5 mm tolerance
 [[-7,-.2,-.2],[-5,.2,.2]], // crosses negative grid boundary
 [[-12,-.2,-12],[12,.2,12]], // spans cells, deduplicated
]);
assert.deepEqual(ids(index,[0,0,0],[1,0,0],.3),[0,1,7],'Finite forward ray keeps its origin/end contacts and discards off-axis neighbours');
assert.deepEqual(ids(index,[0,0,0],[0,-1,0],.5),[0,4,7],'Downward probe reaches exact support endpoint');
assert.deepEqual(ids(index,[0,.2,0],[1,0,0],.3),[0,1,5,7],'Millimetre allowance remains conservative at numerical joints');
assert.deepEqual(ids(index,[-6.2,0,0],[1,0,0],.5),[6,7],'Negative cells and crossing rays retain first-seen order without duplicate objects');
assert.deepEqual(ids(index,[0,0,0],[0,0,0],0),[0,7],'Degenerate segment retains origin-containing surfaces');
assert(index.stats.queries===5&&index.stats.lastCandidates===2&&index.stats.maximumCandidates===4,'Public query counters describe actual returned ray candidates');
const joint=makeIndex([[[.3005,-.1,.0005],[.4,.1,.1]],[[.302,-.1,.002],[.4,.1,.1]]]);
assert.deepEqual(ids(joint,[0,0,0],[1,0,0],.3),[0],'Horizontal endpoint/side cushions retain submillimetre contacts and reject farther neighbours');
// A segment envelope intentionally overestimates a diagonal, leaving exact
// triangle rejection to the real raycaster rather than risking false negatives.
const diagonal=makeIndex([[[.05,-.1,.8],[.1,.1,.9]]]);
assert.deepEqual(ids(diagonal,[0,0,0],[Math.SQRT1_2,0,Math.SQRT1_2],2),[0]);
assert.equal(new Ray(vector([0,0,0]),vector([Math.SQRT1_2,0,Math.SQRT1_2])).intersectBox(diagonal.records[0].bounds,new Vector3()),null);
// Deterministic geometric controls, independent of the implementation's
// scalar comparisons. Every removed former-grid neighbour must miss the
// actual finite ray; candidate order and uniqueness must stay deterministic.
let seed=98137;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
const boxes=Array.from({length:180},()=>{const min=[random()*48-24,random()*12-6,random()*48-24];return[min,min.map(v=>v+.03+random()*8)];}),world=makeIndex(boxes);
let controls=0;
for(let sample=0;sample<1200;sample++){
 const origin=vector([random()*48-24,random()*12-6,random()*48-24]),direction=vector([random()*2-1,random()*2-1,random()*2-1]).normalize(),distance=random()*12;
 const actual=nearbyCollisionObjects(world,origin,direction,distance),actualSet=new Set(actual);assert.equal(actual.length,actualSet.size);
 const end=origin.clone().addScaledVector(direction,distance),envelope=new Box3().setFromPoints([origin,end]).expandByScalar(.001),old=[],seen=new Set();
 for(let x=Math.floor(Math.min(origin.x,end.x)/6);x<=Math.floor(Math.max(origin.x,end.x)/6);x++)for(let z=Math.floor(Math.min(origin.z,end.z)/6);z<=Math.floor(Math.max(origin.z,end.z)/6);z++)for(const record of world.cells.get(`${x}:${z}`)||[]){if(record.bounds.max.y<Math.min(origin.y,end.y)-.001||record.bounds.min.y>Math.max(origin.y,end.y)+.001||seen.has(record))continue;seen.add(record);old.push(record);}
 assert.deepEqual(actual,old.filter(r=>r.bounds.intersectsBox(envelope)).map(r=>r.object),'Independent box envelope yields exactly the same ordered candidate list');
 for(const record of old)if(!actualSet.has(record.object)){const hit=new Ray(origin,direction).intersectBox(record.bounds,new Vector3());assert(!hit||hit.distanceTo(origin)>distance+1e-8,'Removed neighbour cannot intersect the finite ray');controls++;}
}
console.log(`PASS collision query: endpoint/joint/grid/diagonal controls,1200 randomized envelopes,${controls} independently excluded boxes`);
