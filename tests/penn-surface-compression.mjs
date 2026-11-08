// Byte-exact lossless codec controls. Synthetic texture URI is metadata only;
// real KTX2 payload and baked-input gates remain a separate packaging check.
import assert from'node:assert/strict';
import{createHash}from'node:crypto';
import{writeGlb}from'../penn-station-1935/asset_io.mjs';
import{parseGlb,decodeView}from'../penn-station-1935/model/meshopt_patch_io.mjs';
import{compressSurfaceModule}from'../penn-station-1935/model/compress_surface_module.mjs';
import{accessors}from'./helpers/penn-decoded-geometry.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
function fixture({interleaved=true,pad=false}={}){
 const points=[[-281.02386474609375,-7.7184247970581055,-30.11016845703125],[112.61929321289062,-7.7374749183654785,71.6502685546875],[-72.817,-7.7184247970581055,10.12003]],normals=[[0,1,-0],[-0,1,0],[0,1,0]],uv=[[.123456789,.000000371],[.999999341,.12457831],[.333333333,.666666666]],atlas=[[.00001,.99999],[.1234567,.7654321],[.400005,.600009]],chunks=[];
 const j={asset:{version:'2.0',generator:'Lossless codec synthetic controls'},scene:0,scenes:[{nodes:[0]}],nodes:[{mesh:0,name:'synthetic geometry precision control',extras:{retained:true}}],meshes:[{primitives:[]}],materials:[{name:'RailwayPlatformRubbedConcretePhase9'},{name:'RailwayPlatformStippledGranolithicPhase9'}],textures:[{extensions:{KHR_texture_basisu:{source:0}}}],images:[{uri:'textures/00000000000000000000.ktx2',mimeType:'image/ktx2'}],extensionsUsed:['KHR_texture_basisu'],extensionsRequired:['KHR_texture_basisu'],buffers:[{byteLength:0}],bufferViews:[],accessors:[]};let size=0;
 function view(bytes,target,stride){const id=j.bufferViews.length;j.bufferViews.push({buffer:0,byteOffset:size,byteLength:bytes.length,target,...(stride?{byteStride:stride}:{})});chunks.push(bytes);size+=bytes.length;return id;}
 if(interleaved){const stride=pad?44:40,bytes=Buffer.alloc(3*stride);for(let i=0;i<3;i++)[...points[i],...normals[i],...uv[i],...atlas[i]].forEach((v,k)=>bytes.writeFloatLE(v,i*stride+k*4));const id=view(bytes,34962,stride);for(const[type,offset]of[['VEC3',0],['VEC3',12],['VEC2',24],['VEC2',32]])j.accessors.push({bufferView:id,byteOffset:offset,componentType:5126,type,count:3});}
 else{for(const[type,values]of[['VEC3',points],['VEC3',normals],['VEC2',uv],['VEC2',atlas]]){const bytes=Buffer.alloc(values.flat().length*4);values.flat().forEach((v,i)=>bytes.writeFloatLE(v,i*4));const id=view(bytes,34962);j.accessors.push({bufferView:id,componentType:5126,type,count:3});}}
 const indices=Buffer.alloc(7278*2);for(let i=0;i<7278;i++)indices.writeUInt16LE([2,0,1,1,2,0,0,1,2][i%9],i*2);const ix=view(indices,34963);j.accessors.push({bufferView:ix,componentType:5123,type:'SCALAR',count:6768,byteOffset:0},{bufferView:ix,componentType:5123,type:'SCALAR',count:510,byteOffset:6768*2});
 j.meshes[0].primitives=[{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2,TEXCOORD_1:3},indices:4,mode:4,material:0},{attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2,TEXCOORD_1:3},indices:5,mode:4,material:1}];j.buffers[0].byteLength=size;return{j,binary:Buffer.concat(chunks)};
}
const positive=[];
for(const options of[{interleaved:true},{interleaved:false},{interleaved:true,pad:true}]){
 const f=fixture(options),bytes=writeGlb(f.j,f.binary),result=compressSurfaceModule(bytes,{expectedInputSha256:sha(bytes)}),output=parseGlb(result.bytes),original=parseGlb(bytes);assert(output.json.extensionsRequired.includes('EXT_meshopt_compression'));assert(output.json.extensionsUsed.includes('KHR_texture_basisu'));
 assert.deepEqual(output.json.accessors,original.json.accessors);assert.deepEqual(output.json.nodes,original.json.nodes);assert.deepEqual(output.json.meshes,original.json.meshes);assert.deepEqual(output.json.materials,original.json.materials);assert.deepEqual(output.json.images,original.json.images);
 for(const[i,v]of original.json.bufferViews.entries()){const raw=original.binary.subarray(v.byteOffset,v.byteOffset+v.byteLength);assert(Buffer.from(decodeView(output,i)).equals(raw));assert.equal(output.json.bufferViews[i].extensions.EXT_meshopt_compression.mode,v.target===34963?'INDICES':'ATTRIBUTES');assert.equal(output.json.bufferViews[i].extensions.EXT_meshopt_compression.filter,undefined,'No lossy filter');}
 const before=accessors(original),after=accessors(output);for(let a=0;a<original.json.accessors.length;a++)for(let v=0;v<original.json.accessors[a].count;v++)assert.deepEqual(after(a)(v),before(a)(v),'All positions/normals/UVs and exact index sequences remain identical');
 positive.push({options,...result.report});
}
const negative=[];
function reject(label,edit,pattern){const f=fixture();edit(f);const bytes=writeGlb(f.j,f.binary);assert.throws(()=>compressSurfaceModule(bytes,{expectedInputSha256:sha(bytes)}),pattern,label);negative.push(label);}
const valid=fixture(),validBytes=writeGlb(valid.j,valid.binary);
assert.throws(()=>compressSurfaceModule(validBytes),/Pinned input/);negative.push('missing input pin');assert.throws(()=>compressSurfaceModule(validBytes,{expectedInputSha256:'0'.repeat(64)}),/source module identity/);negative.push('wrong input pin');
reject('embedded raster is not an external shared KTX2',f=>{delete f.j.images[0].uri;f.j.images[0].bufferView=0;},/external KTX2/);
reject('PNG masquerading as shared geometry input',f=>f.j.images[0].uri='textures/00000000000000000000.png',/external KTX2/);
reject('external image path traversal',f=>f.j.images[0].uri='../textures/00000000000000000000.ktx2',/external KTX2/);
reject('unknown image source',f=>f.j.textures[0].extensions.KHR_texture_basisu.source=9,/source exists/);
reject('unrequired texture codec',f=>f.j.extensionsRequired=[],/already required/);
reject('orphan accessor',f=>f.j.accessors.push({...f.j.accessors[0]}),/orphan/);
reject('orphan buffer view',f=>f.j.bufferViews.push({...f.j.bufferViews[0]}),/orphan/);
reject('prequantized positions lose required source precision',f=>f.j.accessors[0].componentType=5122,/Float32/);
reject('unreviewed attribute semantic',f=>f.j.meshes[0].primitives[0].attributes.COLOR_0=0,/standard reviewed/);
reject('skin zero binding is still a skin',f=>f.j.nodes[0].skin=0,/No skin/);
reject('unknown node extension',f=>f.j.nodes[0].extensions={unreviewed:{}},/node extension/);
reject('unreviewed root extension',f=>f.j.extensions={unreviewed:{}},/root extension/);
reject('morph payload',f=>f.j.meshes[0].primitives[0].targets=[],/morph/);
reject('animations',f=>f.j.animations=[{}],/animations/);
reject('nonstandard interleaved stride',f=>f.j.bufferViews[0].byteStride=30,/attribute stride/);
reject('uncovered nonzero trailing payload',f=>{f.binary=Buffer.concat([f.binary,Buffer.from([1,0,0,0])]);f.j.buffers[0].byteLength+=4;},/trailing BIN/);
reject('overlapping view ranges',f=>f.j.bufferViews[0].byteLength+=4,/Nonoverlapping/);
reject('missing geometry attribute',f=>delete f.j.meshes[0].primitives[0].attributes.NORMAL,/normals are required/);
reject('sparse geometry layout',f=>f.j.accessors[0].sparse={},/sparse/);
reject('unreviewed architectural material',f=>f.j.materials[0].name='Unknown station geometry',/material families/);
reject('extra model geometry',f=>f.j.meshes.push(structuredClone(f.j.meshes[0])),/architecture mesh/);
reject('index outside the authored vertex array',f=>f.binary.writeUInt16LE(3,f.j.bufferViews.at(-1).byteOffset),/actual source vertex/);
reject('nonfinite authored Float32 data',f=>f.binary.writeFloatLE(NaN,0),/Finite original/);
reject('mesh morph weights',f=>f.j.meshes[0].weights=[],/morph weights/);
reject('changed baked triangle count',f=>f.j.accessors[5].count-=3,/module triangle count/);
const pad=fixture({pad:true});pad.binary[40]=1;const padBytes=writeGlb(pad.j,pad.binary);assert.throws(()=>compressSurfaceModule(padBytes,{expectedInputSha256:sha(padBytes)}),/Undeclared view padding/);negative.push('nonzero unreviewed stride padding');
console.log(JSON.stringify({status:'PASS',positiveLayouts:positive.length,negativeControls:negative.length,decodedViewBytesExact:true,allAccessorValuesAndIndexSequencesExact:true,checks:negative},null,2));
