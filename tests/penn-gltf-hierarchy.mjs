import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import path from 'node:path';
import {worldNodes} from '../penn-station-1935/model/gltf_hierarchy.mjs';
import {worldNodes as decodedWorldNodes} from './helpers/penn-decoded-geometry.mjs';
const requireTools=createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools','package.json'));
const {Vector3}=requireTools('three');
assert.equal(worldNodes,decodedWorldNodes,'Packager and triangle decoder share the exact hierarchy implementation');
const graph={nodes:[{matrix:[1,0,0,0,0,1,0,0,0,0,1,0,-1,5,2,1],children:[1]},
 {translation:[10,0,20],rotation:[0,Math.SQRT1_2,0,Math.SQRT1_2],children:[2]},
 {translation:[2,3,4],scale:[2,1,2]}],scenes:[{nodes:[0]}],scene:0};
const copy=structuredClone(graph),result=worldNodes(graph);
assert.deepEqual(result.map(n=>n.index),[0,1,2]);
const point=new Vector3(0,0,0).applyMatrix4(result[2].matrix);
assert(point.distanceTo(new Vector3(13,8,20))<1e-12,'Hand-computed complete matrix/parent-quaternion/child-scale chain');
assert.deepEqual(graph,copy,'Hierarchy decoding never mutates input JSON');
assert.deepEqual(worldNodes({nodes:[{children:[1]},{},{}]}).map(n=>n.index),[0,1,2],'Absent scene uses actual parentless roots');
assert.deepEqual(worldNodes({nodes:[{children:[1]},{},{}],scenes:[{nodes:[0]},{nodes:[2]}],scene:1}).map(n=>n.index),[2],'Only selected active scene contributes transforms');
assert.throws(()=>worldNodes({nodes:[{children:[1]},{children:[0]}],scenes:[{nodes:[0]}]}),/acyclic/,'Active cycles rejected');
assert.throws(()=>worldNodes({nodes:[{children:[1,1]},{}],scenes:[{nodes:[0]}]}),/one parent/,'Repeated child rejected');
assert.throws(()=>worldNodes({nodes:[{children:[2]},{children:[2]},{}],scenes:[{nodes:[0,1]}]}),/one parent/,'Multiple active parents rejected');
assert.throws(()=>worldNodes({nodes:[{children:[5]}],scenes:[{nodes:[0]}]}),/Child node exists/,'Invalid active node rejected');
console.log('PASS shared active hierarchy, hand-computed nested transforms, scene isolation, immutability and malformed active graph controls');
