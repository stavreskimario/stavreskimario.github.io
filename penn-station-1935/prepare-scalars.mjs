// Lossless scalar-role separation before UASTC. No geometry, resolution, material
// factor, texture-coordinate or sampler changes. Nonzero metal is never folded.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const tools = process.env.PENN_TOOLS || '/private/tmp/penn-station-tools';
const requireTools = createRequire(path.join(tools, 'package.json'));
const { NodeIO, PropertyType } = requireTools('@gltf-transform/core');
const { ALL_EXTENSIONS } = requireTools('@gltf-transform/extensions');
const { prune, listTextureSlots, listTextureInfoByMaterial } = requireTools('@gltf-transform/functions');
const sharp = requireTools('sharp');
const prefixes = ['MilfordGranite', 'InteriorGranite', 'Travertine', 'PublicFloorMarble', 'TennesseeMarble', 'BotticinoMarble', 'BedfordLimestone', 'IndianaLimestoneContext', 'HotelBuffBrick', 'CitySidewalkStone', 'FarleyGranite'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const helperSourceSha256 = hash(await readFile(fileURLToPath(import.meta.url)));
const canonical = value => JSON.stringify(sort(value));
function sort(value) {
  if (Array.isArray(value)) return value.map(sort);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key,sort(value[key])]));
  return value;
}
function refs(value, prefix = []) {
  const found = [];
  for (const [key,item] of Object.entries(value || {})) {
    if (/Texture$/i.test(key) && item && Number.isInteger(item.index)) found.push({ path:[...prefix,key].join('.'), info:item });
    else if (item && typeof item === 'object' && !Array.isArray(item)) found.push(...refs(item,[...prefix,key]));
  }
  return found;
}
function jsonFromGlb(bytes) {
  assert.equal(bytes.toString('ascii',0,4),'glTF'); assert.equal(bytes.readUInt32LE(4),2);
  return JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
}
function scalarBytes(decoded, channel) {
  assert.equal(decoded.depth,'uchar','Scalar carriers require an 8-bit source; higher precision must not be reduced');
  const out=Buffer.alloc(decoded.width*decoded.height);
  const index=decoded.channels<3?0:channel;
  for(let i=0;i<out.length;i++)out[i]=decoded.data[i*decoded.channels+index];
  return out;
}

export async function prepareScalarTextures(inputPath, outputPath, reportPath) {
  const inputBytes=await readFile(inputPath), rawJson=jsonFromGlb(inputBytes);
  assert(!rawJson.extensionsUsed?.some(name=>['EXT_meshopt_compression','KHR_draco_mesh_compression','KHR_texture_basisu'].includes(name)),'Run scalar separation after resize and before Meshopt/UASTC compression');
  const supported=new Set(ALL_EXTENSIONS.map(type=>type.EXTENSION_NAME));
  for(const name of rawJson.extensionsUsed || [])assert(supported.has(name),`Unrecognized extension must be reviewed before round-trip: ${name}`);
  const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document=await io.read(inputPath);
  const decodedCache=new Map();
  async function pixels(bytes) {
    const digest=hash(bytes); if(decodedCache.has(digest))return decodedCache.get(digest);
    const metadata=await sharp(bytes).metadata();
    assert(['uchar','ushort'].includes(metadata.depth),`Unsupported decoded precision ${metadata.depth}`);
    const {data,info}=await sharp(bytes).raw({depth:metadata.depth}).toBuffer({resolveWithObject:true});
    const result={data,width:info.width,height:info.height,channels:info.channels,depth:metadata.depth,pixelSha256:hash(data)};
    decodedCache.set(digest,result);return result;
  }
  async function snapshot(doc) {
    const exported=await io.writeJSON(doc), json=structuredClone(exported.json), roles=[];
    const materials=doc.getRoot().listMaterials();
    for(let i=0;i<(json.materials || []).length;i++) {
      const material=json.materials[i], materialRefs=refs(material);
      assert.equal(materialRefs.length,listTextureInfoByMaterial(materials[i]).length,`${i}: every texture role must be inventoried`);
      for(const {path:slot,info} of materialRefs) {
        const texture=json.textures[info.index], image=json.images[texture.source];
        assert(image?.uri && exported.resources[image.uri],`${material.name}/${slot}: expected a lossless pre-compression image resource`);
        const bytes=Buffer.from(exported.resources[image.uri]);
        const decoded=await pixels(bytes);
        roles.push({key:`${i}:${slot}`,material:material.name || '',slot,
          textureInfo:{...structuredClone(info),index:0},sampler:structuredClone(json.samplers?.[texture.sampler] || {}),
          imageSha256:hash(bytes),pixels:decoded.pixelSha256,width:decoded.width,height:decoded.height,channels:decoded.channels,depth:decoded.depth,
          redSha256:decoded.depth==='uchar'?hash(scalarBytes(decoded,0)):null,
          greenSha256:decoded.depth==='uchar'?hash(scalarBytes(decoded,1)):null,
        });
        info.index=0;
      }
    }
    for(const key of ['images','textures','samplers','buffers','bufferViews'])delete json[key];
    for(const accessor of json.accessors || []) {delete accessor.bufferView;delete accessor.byteOffset;}
    if(json.extensionsUsed)json.extensionsUsed.sort();if(json.extensionsRequired)json.extensionsRequired.sort();
    const accessorRecord=accessor=>{
      if(!accessor)return null;
      const data=accessor.getArray();return {name:accessor.getName(),type:accessor.getType(),componentType:accessor.getComponentType(),normalized:accessor.getNormalized(),count:accessor.getCount(),extras:accessor.getExtras(),dataSha256:data?hash(Buffer.from(data.buffer,data.byteOffset,data.byteLength)):null};
    };
    // The writer groups indices and attributes in a different root order. Compare
    // exact accessor data as a multiset AND its actual semantic binding per mesh.
    const accessors=doc.getRoot().listAccessors().map(accessorRecord).sort((a,b)=>canonical(a).localeCompare(canonical(b)));
    const bindings=doc.getRoot().listMeshes().map(mesh=>({name:mesh.getName(),primitives:mesh.listPrimitives().map(primitive=>({mode:primitive.getMode(),indices:accessorRecord(primitive.getIndices()),attributes:Object.fromEntries(primitive.listSemantics().sort().map(semantic=>[semantic,accessorRecord(primitive.getAttribute(semantic))])),targets:primitive.listTargets().map(target=>Object.fromEntries(target.listSemantics().sort().map(semantic=>[semantic,accessorRecord(target.getAttribute(semantic))])))}))}));
    return {structureSha256:hash(canonical(json)),accessorsSha256:hash(canonical({accessors,bindings})),accessorCount:accessors.length,roles};
  }
  const before=await snapshot(document), root=document.getRoot(), originals=root.listTextures();
  const report={created:new Date().toISOString(),helperSha256:helperSourceSha256,toolLockSha256:hash(await readFile(path.join(tools,'package-lock.json'))),node:process.version,input:path.resolve(inputPath),inputSha256:hash(inputBytes),
    policy:{resolution:'unchanged',ao:'original red values copied into RGB carrier only when not already grayscale',roughness:'green values preserved with unused R/B fixed at255 only for named stone with metallicFactor exactly zero; already-canonical images retained',metal:'all factors unchanged; nonzero-metal MR images unchanged',prune:'unreferenced textures only; single-colour textures retained',prefixes},
    inventory:originals.map(texture=>({name:texture.getName(),mimeType:texture.getMimeType(),imageSha256:hash(texture.getImage()),slots:listTextureSlots(texture)})),changes:[],skippedMR:[]};
  const changed=new Set(), carriers=new Map();
  async function carrier(texture, channel, role) {
    assert(!texture.listExtensions().length,`${texture.getName()}: texture extensions require an explicit preservation path`);
    const decoded=await pixels(texture.getImage()), scalar=scalarBytes(decoded,channel), scalarHash=hash(scalar);
    const key=canonical({role,width:decoded.width,height:decoded.height,scalarHash,extras:texture.getExtras()});
    if(carriers.has(key))return carriers.get(key);
    let alreadyCanonical=true;
    for(let i=0;i<scalar.length && alreadyCanonical;i++) {
      const at=i*decoded.channels;
      const red=decoded.data[at], blue=decoded.data[at+(decoded.channels<3?0:2)];
      alreadyCanonical=role==='occlusion-red' ? decoded.channels<3 || (decoded.data[at+1]===red && blue===red) : red===255 && blue===255;
    }
    if(alreadyCanonical){carriers.set(key,texture);return texture;}
    const rgb=Buffer.alloc(scalar.length*3);
    for(let i=0;i<scalar.length;i++){rgb[i*3]=role==='occlusion-red'?scalar[i]:255;rgb[i*3+1]=scalar[i];rgb[i*3+2]=role==='occlusion-red'?scalar[i]:255;}
    const image=await sharp(rgb,{raw:{width:decoded.width,height:decoded.height,channels:3}}).png({compressionLevel:9,adaptiveFiltering:false}).toBuffer();
    const check=await pixels(image);assert.equal(hash(scalarBytes(check,channel)),scalarHash,`${role}: scalar values changed during PNG packaging`);
    const result=document.createTexture(`${role}-${scalarHash.slice(0,16)}`).setImage(image).setMimeType('image/png').setURI(`${role}-${scalarHash.slice(0,16)}.png`).setExtras(structuredClone(texture.getExtras()));
    carriers.set(key,result);return result;
  }
  for(let i=0;i<root.listMaterials().length;i++) {
    const material=root.listMaterials()[i], ao=material.getOcclusionTexture(), mr=material.getMetallicRoughnessTexture();
    if(ao) {
      const prepared=await carrier(ao,0,'occlusion-red');
      if(prepared!==ao){material.setOcclusionTexture(prepared);changed.add(`${i}:occlusionTexture`);report.changes.push({material:material.getName(),slot:'occlusionTexture',channel:'R',sourceSha256:hash(ao.getImage())});}
    }
    if(mr) {
      const eligible=prefixes.some(prefix=>material.getName().startsWith(prefix)) && material.getMetallicFactor()===0;
      if(eligible) {
        const prepared=await carrier(mr,1,'roughness-green');
        if(prepared!==mr){material.setMetallicRoughnessTexture(prepared);changed.add(`${i}:pbrMetallicRoughness.metallicRoughnessTexture`);report.changes.push({material:material.getName(),slot:'metallicRoughnessTexture',channel:'G',sourceSha256:hash(mr.getImage()),metallicFactor:material.getMetallicFactor()});}
        else report.skippedMR.push({material:material.getName(),metallicFactor:0,reason:'already canonical unused channels',sourceSha256:hash(mr.getImage())});
      } else report.skippedMR.push({material:material.getName(),metallicFactor:material.getMetallicFactor(),reason:material.getMetallicFactor()!==0?'nonzero metallic factor':'outside reviewed stone families',sourceSha256:hash(mr.getImage())});
    }
  }
  await document.transform(prune({propertyTypes:[PropertyType.TEXTURE],keepSolidTextures:true,keepAttributes:true,keepLeaves:true,keepExtras:false}));
  function verify(after,stage) {
    assert.equal(after.structureSha256,before.structureSha256,`${stage}: material factors, scene or texture-coordinate metadata changed`);
    assert.equal(after.accessorsSha256,before.accessorsSha256,`${stage}: decoded geometry/indices/normals/UVs changed`);
    assert.equal(after.roles.length,before.roles.length,`${stage}: a texture role disappeared`);
    const current=new Map(after.roles.map(role=>[role.key,role]));
    for(const old of before.roles) {
      const next=current.get(old.key);assert(next,`${stage}: ${old.key} missing`);
      assert.equal(canonical(next.textureInfo),canonical(old.textureInfo),`${stage}/${old.key}: UV set/transform/texture-info changed`);
      assert.equal(canonical(next.sampler),canonical(old.sampler),`${stage}/${old.key}: sampler changed`);
      assert.equal(next.width,old.width);assert.equal(next.height,old.height);
      if(changed.has(old.key))assert.equal(old.slot==='occlusionTexture'?next.redSha256:next.greenSha256,old.slot==='occlusionTexture'?old.redSha256:old.greenSha256,`${stage}/${old.key}: sampled scalar changed`);
      else {assert.equal(next.imageSha256,old.imageSha256,`${stage}/${old.key}: untouched image bytes changed`);assert.equal(next.pixels,old.pixels,`${stage}/${old.key}: untouched pixels changed`);}
    }
    return after;
  }
  verify(await snapshot(document),'in-memory');
  await mkdir(path.dirname(outputPath),{recursive:true});
  const output=changed.size ? Buffer.from(await io.writeBinary(document)) : inputBytes;await writeFile(outputPath,output);
  const savedDocument=await io.readBinary(output);
  const after=verify(await snapshot(savedDocument),'saved GLB round-trip');
  report.output=path.resolve(outputPath);report.outputSha256=hash(output);report.beforeBytes=inputBytes.length;report.afterBytes=output.length;
  report.beforeTextureCount=originals.length;report.afterTextureCount=savedDocument.getRoot().listTextures().length;report.verbatimInput=changed.size===0;report.uniqueScalarCarriers=carriers.size;report.newScalarImages=[...carriers.values()].filter(texture=>!originals.includes(texture)).length;
  report.geometry={beforeAccessorSha256:before.accessorsSha256,afterAccessorSha256:after.accessorsSha256,accessorCount:before.accessorCount};
  report.materialSceneMetadata={beforeSha256:before.structureSha256,afterSha256:after.structureSha256};
  report.roleProofs=before.roles.map(old=>({before:old,after:after.roles.find(next=>next.key===old.key),sampledChannelsPreserved:changed.has(old.key)?old.slot==='occlusionTexture'?'R':'G':'all encoded bytes and decoded pixels'}));
  report.status='passed';
  if(reportPath){await mkdir(path.dirname(reportPath),{recursive:true});await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');}
  return report;
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  const [input,output,proof]=process.argv.slice(2);if(!input || !output)throw new Error('Usage: node prepare-scalars.mjs INPUT.glb OUTPUT.glb [PROOF.json]');
  const report=await prepareScalarTextures(input,output,proof);
  console.log(JSON.stringify({status:report.status,roles:report.roleProofs.length,changes:report.changes.length,carriers:report.uniqueScalarCarriers,beforeBytes:report.beforeBytes,afterBytes:report.afterBytes,output:report.output}));
}
