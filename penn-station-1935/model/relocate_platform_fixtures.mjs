// Derived packaging only: use reviewed Blender-authored anchor deltas, never create geometry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {parseGlb,decodeView,MeshoptEncoder,MeshoptDecoder} from './meshopt_patch_io.mjs';
import {worldNodes} from './gltf_hierarchy.mjs';
const require=createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools','package.json'));
const {Matrix3,Vector3}=require('three');
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const hex=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
const nodes=[7,8,9,10,11,12,13];
const names=['Railway tie plates and bolts','Railway tie plates and bolts','Platform Nernst ceramic fittings','Railway tie plates and bolts','PlatformNernstGlower','PlatformNernstGlower','PlatformNernstGlower'];
const partOffsets=[[0,-.007,0],[0,-.100,0],[0,-.230,0],[0,-.286,0],[-.035,-.324,0],[0,-.324,0],[.035,-.324,0]];
const ids=Array.from({length:16},(_,i)=>i);
const finite3=v=>Array.isArray(v)&&v.length===3&&v.every(Number.isFinite);
const same=(a,b)=>assert.deepEqual(a,b);
function accessorUses(j,id){const uses=[];for(const[i,n]of j.nodes.entries())for(const[k,v]of Object.entries(n.extensions?.EXT_mesh_gpu_instancing?.attributes||{}))if(v===id)uses.push(`node${i}/${k}`);for(const[i,m]of j.meshes.entries())for(const[p,q]of m.primitives.entries()){for(const[k,v]of Object.entries(q.attributes||{}))if(v===id)uses.push(`mesh${i}/${p}/${k}`);if(q.indices===id)uses.push(`mesh${i}/${p}/indices`);for(const[t,target]of(q.targets||[]).entries())for(const[k,v]of Object.entries(target))if(v===id)uses.push(`mesh${i}/${p}/target${t}/${k}`);}for(const[i,s]of(j.skins||[]).entries())if(s.inverseBindMatrices===id)uses.push(`skin${i}`);for(const[i,a]of(j.animations||[]).entries())for(const[k,s]of a.samplers.entries())for(const n of['input','output'])if(s[n]===id)uses.push(`animation${i}/${k}/${n}`);return uses;}
function glb(json,binary){let j=Buffer.from(JSON.stringify(json));j=Buffer.concat([j,Buffer.alloc((4-j.length%4)%4,32)]);const result=Buffer.alloc(28+j.length+binary.length);result.write('glTF');result.writeUInt32LE(2,4);result.writeUInt32LE(result.length,8);result.writeUInt32LE(j.length,12);result.writeUInt32LE(0x4e4f534a,16);j.copy(result,20);result.writeUInt32LE(binary.length,20+j.length);result.writeUInt32LE(0x004e4942,24+j.length);binary.copy(result,28+j.length);return result;}
export function relocateFixtures(inputBytes,recipeBytes,{variant,expectedRecipeSha}={}){
 assert(['full','low'].includes(variant),'Explicit full/low variant required');
 assert(hex(expectedRecipeSha)&&sha(recipeBytes)===expectedRecipeSha,'Pinned recipe SHA mismatch');
 const recipe=JSON.parse(recipeBytes);assert.equal(recipe.schema,1);assert.equal(recipe.coordinateSpace,'Main0-glTF','Only Main0 source anchor positions accepted');
 assert.equal(recipe.authoring?.tool,'Blender','Positions must be authored by Blender source');for(const k of['sourceBlendSha256','generatorSha256','supportProofSha256'])assert(hex(recipe.authoring[k]),`Missing authoring ${k}`);
 assert.equal(recipe.instanceCount,22);same(recipe.selectedInstanceIds,ids);same(recipe.parts,nodes.map((node,i)=>({node,primitive:0,material:names[i],originOffsetMain:partOffsets[i]})));
 for(const v of['full','low'])assert(hex(recipe.models?.[v]?.sha256),`Pinned ${v} model SHA required`);
 assert.equal(sha(inputBytes),recipe.models[variant].sha256,'Pinned model SHA mismatch');
 assert(Array.isArray(recipe.groups)&&recipe.groups.length===16,'Exactly16 source relocation groups required');same(recipe.groups.map(g=>g.instance),ids);
 for(const g of recipe.groups){assert.equal(g.platform,Math.floor(g.instance/2)+1);assert(finite3(g.fromMain)&&finite3(g.toMain),'Finite Main0 anchors required');assert(g.fromMain.some((v,i)=>v!==g.toMain[i]),'Selected group must actually move');}
 const base=parseGlb(inputBytes),j=base.json;assert(j.buffers?.length>=2&&j.buffers[0].byteLength===base.binary.length,'Exact BIN length required');
 for(const b of j.buffers.slice(1))assert(!b.uri&&b.extensions?.EXT_meshopt_compression?.fallback===true,'Only virtual fallback buffers accepted');
 const active=new Map(worldNodes(j).map(n=>[n.index,n.matrix]));assert(nodes.every(n=>active.has(n)),'All fixture nodes must be active');
 const next=structuredClone(j),fallback=next.buffers.length;next.buffers.push({byteLength:7*22*12,extensions:{EXT_meshopt_compression:{fallback:true}}});
 const chunks=[Buffer.from(base.binary)],changes=[],worldDisplacements=ids.map(()=>[]);let size=base.binary.length,decodedOffset=0,maxWorldError=0,maxAnchorError=0;
 for(const[nodeIndexIndex,nodeIndex]of nodes.entries()){
  const n=j.nodes[nodeIndex],mesh=j.meshes[n.mesh];assert(mesh?.primitives?.length===1,'One reviewed fixture primitive per node');const p=mesh.primitives[0];assert.equal(j.materials[p.material]?.name,names[nodeIndexIndex],'Fixture material/node mismatch');
  const attrs=n.extensions?.EXT_mesh_gpu_instancing?.attributes;assert(attrs?.TRANSLATION!==undefined,'Instance translation required');for(const a of Object.values(attrs))assert.equal(j.accessors[a]?.count,22,'Every fixture attribute must retain22instances');
  const ai=attrs.TRANSLATION,a=j.accessors[ai],vi=a.bufferView,v=j.bufferViews[vi],ext=v?.extensions?.EXT_meshopt_compression;
  assert(a.type==='VEC3'&&a.componentType===5126&&!a.normalized&&!a.sparse&&(a.byteOffset||0)===0,'Only dedicated float32 VEC3 translations atoffset0 supported');
  same(accessorUses(j,ai),[`node${nodeIndex}/TRANSLATION`]);assert(j.accessors.filter(x=>x.bufferView===vi).length===1,'Translation view may not be shared/interleaved');
  assert(ext&&ext.buffer===0&&ext.mode==='ATTRIBUTES'&&(!ext.filter||ext.filter==='NONE')&&ext.byteStride===12&&ext.count===22,'Dedicated lossless ATTRIBUTES translation stream required');
  assert(v.buffer>0&&j.buffers[v.buffer]?.extensions?.EXT_meshopt_compression?.fallback===true&&v.byteLength===264&&(v.byteStride===undefined||v.byteStride===12),'Translation fallback view layout mismatch');
  assert(Number.isInteger(v.byteOffset||0)&&(v.byteOffset||0)>=0&&(v.byteOffset||0)+v.byteLength<=j.buffers[v.buffer].byteLength,'Fallback offset outofbounds');
  assert(Number.isInteger(ext.byteOffset||0)&&(ext.byteOffset||0)>=0&&(ext.byteOffset||0)%4===0&&Number.isInteger(ext.byteLength)&&ext.byteLength>0&&(ext.byteOffset||0)+ext.byteLength<=base.binary.length,'Compressed offset outofbounds/unaligned');
  const before=Buffer.from(decodeView(base,vi)),after=Buffer.from(before),matrix=active.get(nodeIndex),linear=new Matrix3().setFromMatrix4(matrix);assert(Number.isFinite(linear.determinant())&&Math.abs(linear.determinant())>1e-16,'Noninvertible active node transform');const inverse=linear.clone().invert();
  for(const g of recipe.groups){const i=g.instance,old=new Vector3(...[0,1,2].map(k=>before.readFloatLE(i*12+k*4))),oldWorld=old.clone().applyMatrix4(matrix),from=new Vector3(...g.fromMain),to=new Vector3(...g.toMain),delta=to.clone().sub(from);const partOffset=new Vector3(...recipe.parts[nodeIndexIndex].originOffsetMain);assert(oldWorld.clone().sub(partOffset).distanceTo(from)<=.00002,'Source anchor/part offset mismatch or wrong Main/world offset');const localDelta=delta.clone().applyMatrix3(inverse),value=old.clone().add(localDelta);for(let k=0;k<3;k++)after.writeFloatLE(value.getComponent(k),i*12+k*4);const actual=new Vector3(...[0,1,2].map(k=>after.readFloatLE(i*12+k*4))).applyMatrix4(matrix),displacement=actual.clone().sub(oldWorld),error=displacement.distanceTo(delta),anchorError=actual.clone().sub(partOffset).distanceTo(to);assert(error<=.00002&&anchorError<=.00002,'World relocation exceeds20micrometre bound');maxWorldError=Math.max(maxWorldError,error);maxAnchorError=Math.max(maxAnchorError,anchorError);worldDisplacements[i].push(displacement.toArray());}
  assert(after.subarray(16*12).equals(before.subarray(16*12)),'Six unselected local translations must be bit exact');
  const encoded=Buffer.from(MeshoptEncoder.encodeGltfBuffer(after,22,12,'ATTRIBUTES')),decoded=new Uint8Array(264);MeshoptDecoder.decodeGltfBuffer(decoded,22,12,encoded,'ATTRIBUTES');assert(Buffer.from(decoded).equals(after),'Encoded ATTRIBUTES must decode bit exact');
  const pad=(4-size%4)%4;if(pad){chunks.push(Buffer.alloc(pad));size+=pad;}const byteOffset=size;chunks.push(encoded);size+=encoded.length;const endPad=(4-size%4)%4;if(endPad){chunks.push(Buffer.alloc(endPad));size+=endPad;}
  const viewIndex=next.bufferViews.length;next.bufferViews.push({buffer:fallback,byteOffset:decodedOffset,byteLength:264,extensions:{EXT_meshopt_compression:{buffer:0,byteOffset,byteLength:encoded.length,mode:'ATTRIBUTES',byteStride:12,count:22}}});decodedOffset+=264;
  const accessorIndex=next.accessors.length,newAccessor={...structuredClone(a),bufferView:viewIndex,byteOffset:0};if(a.min)newAccessor.min=[0,1,2].map(k=>Math.min(...Array.from({length:22},(_,i)=>after.readFloatLE(i*12+k*4))));if(a.max)newAccessor.max=[0,1,2].map(k=>Math.max(...Array.from({length:22},(_,i)=>after.readFloatLE(i*12+k*4))));next.accessors.push(newAccessor);next.nodes[nodeIndex].extensions.EXT_mesh_gpu_instancing.attributes.TRANSLATION=accessorIndex;changes.push({node:nodeIndex,oldAccessor:ai,newAccessor:accessorIndex,oldView:vi,newView:viewIndex,unselectedDecodedBytesSha256:sha(before.subarray(16*12)),oldDecodedSha256:sha(before),newDecodedSha256:sha(after),compressedBytes:encoded.length});
 }
 let maxCoherenceError=0;for(const group of worldDisplacements)for(const d of group)maxCoherenceError=Math.max(maxCoherenceError,new Vector3(...d).distanceTo(new Vector3(...group[0])));assert(maxCoherenceError<=.00002,'Seven-part group displacement incoherent');
 next.buffers[0].byteLength=size;const binary=Buffer.concat(chunks);assert.equal(binary.length,size);assert(binary.subarray(0,base.binary.length).equals(base.binary),'Original BIN prefix must remain exact');same(next.bufferViews.slice(0,j.bufferViews.length),j.bufferViews);same(next.accessors.slice(0,j.accessors.length),j.accessors);same(next.buffers.slice(1,j.buffers.length),j.buffers.slice(1));
 const stripped=structuredClone(next);stripped.buffers=structuredClone(j.buffers);stripped.bufferViews=structuredClone(j.bufferViews);stripped.accessors=structuredClone(j.accessors);for(const c of changes)stripped.nodes[c.node].extensions.EXT_mesh_gpu_instancing.attributes.TRANSLATION=c.oldAccessor;same(stripped,j);
 const output=glb(next,binary);return{bytes:output,report:{schema:1,scope:'Blender-authored source anchor deltas only. Original geometry/materials/UVs/normals/rotations/scales and all other instances remain exact.',variant,inputSha256:sha(inputBytes),recipeSha256:sha(recipeBytes),decodedOutputSha256:sha(output),inputBinBytes:base.binary.length,originalBinPrefixSha256:sha(base.binary),appendedCompressedBytes:binary.length-base.binary.length,originalViewsUnchanged:j.bufferViews.length,originalAccessorsUnchanged:j.accessors.length,newFallbackBuffer:fallback,movedGroups:16,movedInstances:112,preservedGroups:6,preservedInstances:42,maxWorldDisplacementErrorMetres:maxWorldError,maxAnchorErrorMetres:maxAnchorError,maxSevenPartCoherenceErrorMetres:maxCoherenceError,changes,authoring:recipe.authoring,sourcePositionsAreNotSelectedByThisHelper:true}};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===path.resolve(process.argv[1])){
 const args={};for(let i=2;i<process.argv.length;i+=2){assert(process.argv[i].startsWith('--')&&process.argv[i+1],'Use named argument/value pairs');args[process.argv[i].slice(2)]=process.argv[i+1];}for(const k of['input','recipe','recipe-sha','variant','out','report'])assert(args[k],`Missing --${k}`);for(const k of['out','report']){assert(!fs.existsSync(args[k]),`Refuse existing ${k}`);assert(path.resolve(args[k])!==path.resolve(args.input)&&path.resolve(args[k])!==path.resolve(args.recipe),'Refuse input overwrite');}assert(path.resolve(args.out)!==path.resolve(args.report),'Distinct output/report paths required');
 const result=relocateFixtures(fs.readFileSync(args.input),fs.readFileSync(args.recipe),{variant:args.variant,expectedRecipeSha:args['recipe-sha']}),transport=args.out.endsWith('.gz')?gzipSync(result.bytes,{level:9}):result.bytes;result.report.output={path:args.out,sha256:sha(transport),bytes:transport.length};fs.writeFileSync(args.out,transport,{flag:'wx'});fs.writeFileSync(args.report,JSON.stringify(result.report,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result.report));
}
