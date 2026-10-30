// Append an independently lit Blender access module without rewriting the station.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {gzipSync} from 'node:zlib';
import {parseGlb} from './meshopt_patch_io.mjs';
import {writeGlb} from '../asset_io.mjs';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const validIndex=(value,list,label)=>{assert(Number.isInteger(value)&&value>=0&&value<list.length,`Invalid ${label} index`);return value;};

export async function appendAccessModule(inputPath,modulePath,outputPath,reportPath,{allowedNewMaterials=[],lightingArtifact='concourse-access'}={}) {
  assert(['concourse-access','concourse-circulation','concourse-arrivals'].includes(lightingArtifact),'Unreviewed access lighting artifact');
  assert.notEqual(path.resolve(inputPath),path.resolve(outputPath),'Preserve the station input');
  assert.notEqual(path.resolve(modulePath),path.resolve(outputPath),'Preserve the Blender module');
  const input=await readFile(inputPath),incoming=await readFile(modulePath);
  const base=parseGlb(input),module=parseGlb(incoming),j=structuredClone(base.json),m=module.json;
  assert.equal(base.binary.length%4,0);assert.equal(m.scenes.length,1);
  assert(!m.extensions,'An access module cannot add root lights or other live features');
  for(const key of ['skins','animations','cameras'])assert.equal(m[key]?.length||0,0,`Access module cannot add ${key}`);
  assert(m.buffers?.length&& !m.buffers[0].uri,'Module BIN must be embedded');
  const allowedExtensions=new Set(['EXT_meshopt_compression','KHR_mesh_quantization','KHR_texture_basisu','KHR_texture_transform','EXT_mesh_gpu_instancing','KHR_materials_ior','KHR_materials_specular']);
  for(const name of m.extensionsUsed||[])assert(allowedExtensions.has(name),`Unreviewed access extension: ${name}`);
  const offset=base.binary.length,buffers=[0],counts={};
  for(const key of ['buffers','bufferViews','accessors','images','textures','samplers','materials','meshes','nodes']){j[key]||=[];counts[key]=j[key].length;}
  for(let i=1;i<m.buffers.length;i++){
    const b=m.buffers[i];assert(!b.uri&&b.extensions?.EXT_meshopt_compression?.fallback===true,'Only virtual Meshopt fallback buffers may follow BIN');
    assert.deepEqual(Object.keys(b.extensions),['EXT_meshopt_compression']);buffers[i]=j.buffers.length;j.buffers.push(structuredClone(b));
  }
  for(const original of m.bufferViews||[]){
    const view=structuredClone(original);validIndex(view.buffer??0,m.buffers,'buffer');
    assert((view.byteOffset||0)+view.byteLength<=m.buffers[view.buffer??0].byteLength,'Module view exceeds its buffer');
    view.buffer=buffers[view.buffer??0];if(view.buffer===0)view.byteOffset=(view.byteOffset||0)+offset;
    if(view.extensions){
      assert.deepEqual(Object.keys(view.extensions),['EXT_meshopt_compression']);const ext=view.extensions.EXT_meshopt_compression;
      assert.equal(ext.buffer,0);assert((ext.byteOffset||0)+ext.byteLength<=module.binary.length,'Compressed view exceeds module BIN');
      assert.equal(ext.count*ext.byteStride,view.byteLength);ext.byteOffset=(ext.byteOffset||0)+offset;
    }else assert.equal(view.buffer,0,'Virtual views require Meshopt compression');
    j.bufferViews.push(view);
  }
  for(const original of m.accessors||[]){const a=structuredClone(original);assert(!a.sparse,'Sparse accessors require separate review');if(a.bufferView!==undefined){validIndex(a.bufferView,m.bufferViews,'view');a.bufferView+=counts.bufferViews;}j.accessors.push(a);}
  const files=[];
  for(const original of m.images||[]){
    const image=structuredClone(original),match=/^textures\/([a-f0-9]{20})\.ktx2$/.exec(image.uri||'');
    assert(match&&image.mimeType==='image/ktx2'&&image.bufferView===undefined,'Only content-addressed KTX2 module images are allowed');
    const bytes=await readFile(path.join(path.dirname(modulePath),image.uri));assert.equal(hash(bytes).slice(0,20),match[1],'Texture content identity must match its filename');
    assert(bytes.subarray(0,12).equals(Buffer.from([0xab,0x4b,0x54,0x58,0x20,0x32,0x30,0xbb,0x0d,0x0a,0x1a,0x0a])),'Module image must contain KTX2');
    files.push({uri:image.uri,sha256:hash(bytes),bytes:bytes.length});j.images.push(image);
  }
  for(const sampler of m.samplers||[])j.samplers.push(structuredClone(sampler));
  for(const original of m.textures||[]){
    const t=structuredClone(original);assert(t.source===undefined&&t.extensions?.KHR_texture_basisu,'Module textures must use KTX2');
    assert.deepEqual(Object.keys(t.extensions),['KHR_texture_basisu']);validIndex(t.extensions.KHR_texture_basisu.source,m.images,'image');
    t.extensions.KHR_texture_basisu.source+=counts.images;
    if(t.sampler!==undefined){validIndex(t.sampler,m.samplers,'sampler');t.sampler+=counts.samplers;}j.textures.push(t);
  }
  const materialMap=[],names=new Set(allowedNewMaterials);
  assert.equal(names.size,allowedNewMaterials.length,'New material names must be unique');
  const remapTextures=object=>{for(const[key,value]of Object.entries(object)){if(value&&typeof value==='object'){if(key.endsWith('Texture')){validIndex(value.index,m.textures,'texture');value.index+=counts.textures;}else remapTextures(value);}}};
  const lighting=[];
  for(const original of m.materials||[]){
    const existing=j.materials.map((v,i)=>v.name===original.name?i:-1).filter(i=>i>=0);assert(existing.length<=1,'Existing material identity must be unique');
    if(existing.length){assert(!names.has(original.name),'A new access material cannot shadow an existing material');materialMap.push(existing[0]);continue;}
    assert(names.has(original.name),`New material must be explicitly allowed: ${original.name}`);
    const material=structuredClone(original);remapTextures(material);
    if(material.extras?.sky_illumination){
      const file=material.extras.sky_illumination;
      assert([`lighting-${lightingArtifact}-sky.webp`,`lighting-${lightingArtifact}-sky-low.webp`].includes(file),'New access illumination must use its selected artifact without overwriting another atlas');
      assert(material.occlusionTexture,'Illuminated surfaces need an explicit atlas UV binding');
      for(const name of new Set([file,file.replace('-sky.webp','-sky-low.webp')])){
        const bytes=await readFile(path.join(path.dirname(modulePath),name));lighting.push({file:name,bytes:bytes.length,sha256:hash(bytes)});
      }
    }
    materialMap.push(j.materials.length);j.materials.push(material);
  }
  for(const name of names)assert((m.materials||[]).some(v=>v.name===name),`Allowed material is absent: ${name}`);
  const accessor=i=>validIndex(i,m.accessors,'accessor')+counts.accessors;
  for(const original of m.meshes||[]){
    const mesh=structuredClone(original);mesh.primitives=mesh.primitives.map(p=>{
      assert(!p.targets&&!p.extensions,'Morph/primitive features require separate review');validIndex(p.material,m.materials,'material');
      const material=j.materials[materialMap[p.material]],info=material.occlusionTexture;
      if(material.extras?.sky_illumination){const channel=info.extensions?.KHR_texture_transform?.texCoord??info.texCoord??0;assert(p.attributes[`TEXCOORD_${channel}`]!==undefined,'Access primitive requires its actual lighting UV channel');}
      return {...p,material:materialMap[p.material],indices:p.indices===undefined?undefined:accessor(p.indices),attributes:Object.fromEntries(Object.entries(p.attributes).map(([k,v])=>[k,accessor(v)]))};
    });j.meshes.push(mesh);
  }
  for(const original of m.nodes||[]){
    const node=structuredClone(original);assert(node.skin===undefined&&node.camera===undefined,'Access nodes cannot add skin/camera');
    if(node.mesh!==undefined)node.mesh=validIndex(node.mesh,m.meshes,'mesh')+counts.meshes;
    if(node.children)node.children=node.children.map(i=>validIndex(i,m.nodes,'child')+counts.nodes);
    if(node.extensions){assert.deepEqual(Object.keys(node.extensions),['EXT_mesh_gpu_instancing']);node.extensions.EXT_mesh_gpu_instancing.attributes=Object.fromEntries(Object.entries(node.extensions.EXT_mesh_gpu_instancing.attributes).map(([k,v])=>[k,accessor(v)]));}
    j.nodes.push(node);
  }
  j.scenes[j.scene||0].nodes.push(...m.scenes[m.scene||0].nodes.map(i=>validIndex(i,m.nodes,'scene node')+counts.nodes));
  for(const key of ['extensionsUsed','extensionsRequired'])for(const name of m[key]||[]){assert((m.extensionsUsed||[]).includes(name),'Required extensions must be declared used');j[key]||=[];if(!j[key].includes(name))j[key].push(name);}
  const binary=Buffer.concat([base.binary,module.binary]);j.buffers[0].byteLength=binary.length;
  for(const key of ['bufferViews','accessors','images','textures','samplers','materials','meshes','nodes'])assert.deepEqual(j[key].slice(0,counts[key]),base.json[key]||[],`Existing ${key} must remain exact`);
  assert(binary.subarray(0,offset).equals(base.binary),'Original compressed station BIN prefix must remain exact');
  const decoded=writeGlb(j,binary),output=outputPath.endsWith('.gz')?gzipSync(decoded,{level:9}):decoded;
  for(const file of [outputPath,reportPath])await mkdir(path.dirname(file),{recursive:true});
  await writeFile(outputPath,output);
  const report={scope:'Independent Blender access module appended; original retained station BIN and existing bindings exact',inputSha256:hash(input),moduleSha256:hash(incoming),outputSha256:hash(output),decodedSha256:hash(decoded),originalBinaryPrefixSha256:hash(base.binary),originalBinaryPrefixBytes:offset,lightingArtifact,addedMaterials:allowedNewMaterials,addedNodes:m.nodes.length,addedMeshes:m.meshes.length,newTextures:files,newLighting:lighting,callerMustCopyExternalAssets:true};
  await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');return report;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  const args={};for(let i=2;i<process.argv.length;i+=2){assert(['--input','--module','--out','--report','--materials','--lighting-artifact'].includes(process.argv[i])&&process.argv[i+1],'Expected named arguments');args[process.argv[i].slice(2)]=process.argv[i+1];}
  for(const key of ['input','module','out','report','materials'])assert(args[key],`Missing ${key}`);
  const report=await appendAccessModule(args.input,args.module,args.out,args.report,{allowedNewMaterials:args.materials.split(','),lightingArtifact:args['lighting-artifact']??'concourse-access'});
  console.log(JSON.stringify({outputSha256:report.outputSha256,addedMeshes:report.addedMeshes,addedMaterials:report.addedMaterials}));
}
