// Independent glTF reader checks for a bounded access-module append.
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {appendAccessModule} from '../penn-station-1935/model/append_access_module.mjs';
import {parseGlb} from '../penn-station-1935/model/meshopt_patch_io.mjs';
import {writeGlb} from '../penn-station-1935/asset_io.mjs';
import {decodedTriangles} from './helpers/penn-decoded-geometry.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const out=await mkdtemp(path.join(os.tmpdir(),'penn-access-append-'));
const input=path.join(root,'penn-station-1935/assets/model-concourse.glb.gz');
const base=parseGlb(await readFile(input));
// Deliberately tiny synthetic test data; this is not reconstruction geometry.
const binary=Buffer.alloc(44);new Float32Array(binary.buffer,binary.byteOffset,9).set([0,0,0,1,0,0,0,1,0]);
binary.writeUInt16LE(0,36);binary.writeUInt16LE(1,38);binary.writeUInt16LE(2,40);
const material='AccessAppendTestOnly';
const json={asset:{version:'2.0'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,translation:[2,3,4]}],meshes:[{primitives:[{attributes:{POSITION:0},indices:1,material:0}]}],materials:[{name:material,pbrMetallicRoughness:{baseColorFactor:[.5,.5,.5,1],metallicFactor:0,roughnessFactor:.7}}],buffers:[{byteLength:44}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36,target:34962},{buffer:0,byteOffset:36,byteLength:6,target:34963}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]},{bufferView:1,componentType:5123,count:3,type:'SCALAR'}]};
const modulePath=path.join(out,'module.glb'),output=path.join(out,'appended.glb.gz'),report=path.join(out,'report.json');
await writeFile(modulePath,writeGlb(json,binary));
await appendAccessModule(input,modulePath,output,report,{allowedNewMaterials:[material]});
const result=parseGlb(await readFile(output));
assert(result.binary.subarray(0,base.binary.length).equals(base.binary));
assert.deepEqual([...decodedTriangles(result,new Set([material]))].map(v=>v.triangle),[[[2,3,4],[3,3,4],[2,4,4]]],'Independent reader applies the appended transform and indices');
for(const key of ['nodes','materials','meshes','accessors','bufferViews'])assert.deepEqual(result.json[key].slice(0,base.json[key].length),base.json[key]);
await assert.rejects(appendAccessModule(input,modulePath,path.join(out,'forbidden.glb'),report),/explicitly allowed/,'Unlisted new material must fail');
await assert.rejects(appendAccessModule(input,modulePath,input,report,{allowedNewMaterials:[material]}),/Preserve/,'Input cannot be overwritten');
const unsafe=structuredClone(json);unsafe.extensions={KHR_lights_punctual:{lights:[{type:'point'}]}};
await writeFile(path.join(out,'lights.glb'),writeGlb(unsafe,binary));
await assert.rejects(appendAccessModule(input,path.join(out,'lights.glb'),path.join(out,'lights-output.glb'),report,{allowedNewMaterials:[material]}),/root lights/);
const incomplete=structuredClone(json);incomplete.materials[0].extras={sky_illumination:'lighting-concourse-access-sky.webp'};
await writeFile(path.join(out,'no-uv.glb'),writeGlb(incomplete,binary));
await assert.rejects(appendAccessModule(input,path.join(out,'no-uv.glb'),path.join(out,'no-uv-output.glb'),report,{allowedNewMaterials:[material]}),/explicit atlas UV/);
console.log('PASS independent appended geometry and exact station payload; reject unlisted material, input overwrite, live lights and incomplete illumination binding');
