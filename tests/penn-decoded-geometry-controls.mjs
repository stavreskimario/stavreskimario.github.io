import assert from 'node:assert/strict';
import { accessors, decodedTriangles } from './helpers/penn-decoded-geometry.mjs';
const binary = Buffer.alloc(60);
for (const [i, point] of [[0,[0,0,0]], [1,[0,0,1]], [2,[1,0,0]]]) {
  point.forEach((value,k) => binary.writeFloatLE(value,i*16+k*4));
  binary.writeFloatLE(999,i*16+12); // ignored interleaved padding
}
[0,1,2].forEach((value,i) => binary.writeUInt16LE(value,48+i*2));
[-32768,0,32767].forEach((value,i) => binary.writeInt16LE(value,54+i*2));
const model = { binary, json: {
  bufferViews:[{buffer:0,byteLength:48,byteStride:16},{buffer:0,byteOffset:48,byteLength:6},{buffer:0,byteOffset:54,byteLength:6}],
  accessors:[{bufferView:0,componentType:5126,type:'VEC3',count:3},{bufferView:1,componentType:5123,type:'SCALAR',count:3},{bufferView:2,componentType:5122,type:'VEC3',count:1,normalized:true}],
  materials:[{name:'PublicFloorMarble'}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1,material:0}]}],
  nodes:[{matrix:[1,0,0,0,0,1,0,0,0,0,1,0,-1,5,2,1],children:[1]},
    {translation:[10,0,20],rotation:[0,Math.SQRT1_2,0,Math.SQRT1_2],children:[2]},
    {translation:[2,3,4],scale:[2,1,2],mesh:0}],scenes:[{nodes:[0]}],scene:0,
}};
const triangle=[...decodedTriangles(model,new Set(['PublicFloorMarble']))][0].triangle;
const expected=[[13,8,20],[15,8,20],[13,8,18]];
assert(triangle.every((p,i)=>p.every((value,k)=>Math.abs(value-expected[i][k])<1e-12)), 'Raw strided positions follow the hand-computed matrix/parent quaternion/child TRS chain');
assert.deepEqual(accessors(model)(2)(0),[-1,0,1], 'Signed normalization clamps its minimum correctly');
const nonIndexed=structuredClone(model.json);delete nonIndexed.meshes[0].primitives[0].indices;
assert.deepEqual([...decodedTriangles({binary,json:nonIndexed})][0].triangle,triangle, 'Nonindexed triangles retain the same actual vertices');
const mirrored=structuredClone(model.json);mirrored.nodes[2].scale=[-2,1,2];
const [a,b,c]=[...decodedTriangles({binary,json:mirrored})][0].triangle;
assert((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])>0, 'Mirrored transforms retain the rendered outward floor orientation');
assert.equal([...decodedTriangles(model,new Set(['ConcourseOpaqueCirculationConcrete']))].length,0, 'Material ownership filtering excludes unrelated primitives');
console.log('PASS raw/interleaved accessor offsets, normalized extrema, indexed/nonindexed geometry, complete matrix/TRS hierarchy and mirrored outward winding');
