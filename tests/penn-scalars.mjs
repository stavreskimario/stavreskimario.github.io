// Lossless channel/UV/sampler/geometry controls. Run with the existing pinned
// PENN_TOOLS; output defaults to the persistent sibling penn-station-work folder.
import {createRequire} from 'node:module';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {prepareScalarTextures} from '../penn-station-1935/prepare-scalars.mjs';
import {fileURLToPath} from 'node:url';
const base=process.env.PENN_SCALAR_TEST_OUT || path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../penn-station-work/scalar-controls'), requireTools=createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools','package.json'));
const {Document,NodeIO}=requireTools('@gltf-transform/core');
const {ALL_EXTENSIONS,KHRTextureTransform,KHRMaterialsClearcoat,KHRMaterialsTransmission}=requireTools('@gltf-transform/extensions');
const sharp=requireTools('sharp'),io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=new Document(),buffer=doc.createBuffer();
const width=64,height=64;
function raw(seed,greenSame=false){const out=Buffer.alloc(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;out[i]=(x*7+y*13+seed*17)%256;out[i+1]=(x*3+y*5)%256;out[i+2]=(x*11+y*19+seed*31)%256;out[i+3]=255;}return out;}
async function texture(name,data,w=width,h=height){return doc.createTexture(name).setImage(await sharp(data,{raw:{width:w,height:h,channels:4}}).png().toBuffer()).setMimeType('image/png');}
const packedA=await texture('Packed A',raw(1)),packedB=await texture('Packed B',raw(2));
const normal=await texture('Constant flat normal (must remain)',Buffer.from([128,128,255,255]),1,1);
const colour=await texture('Unmodified base colour',raw(4));
const transform=doc.createExtension(KHRTextureTransform),coat=doc.createExtension(KHRMaterialsClearcoat),trans=doc.createExtension(KHRMaterialsTransmission);
const make=(name,metal,mr=packedA)=>doc.createMaterial(name).setMetallicFactor(metal).setRoughnessFactor(.73).setOcclusionStrength(.81).setMetallicRoughnessTexture(mr).setOcclusionTexture(mr).setBaseColorTexture(colour).setNormalTexture(normal).setNormalScale(.025);
const stone=make('MilfordGraniteFixture',0);
stone.getMetallicRoughnessTextureInfo().setTexCoord(0).setWrapS(10497).setWrapT(33648).setMagFilter(9729).setMinFilter(9987).setExtension('KHR_texture_transform',transform.createTransform().setOffset([.11,.23]).setScale([2.4,3.7]).setRotation(.31));
stone.getOcclusionTextureInfo().setTexCoord(1).setWrapS(33071).setWrapT(10497).setMagFilter(9728).setMinFilter(9986).setExtension('KHR_texture_transform',transform.createTransform().setOffset([.08,.29]).setScale([.7,.9]).setRotation(-.12).setTexCoord(1));
stone.setExtension('KHR_materials_clearcoat',coat.createClearcoat().setClearcoatFactor(.3).setClearcoatRoughnessFactor(.22).setClearcoatRoughnessTexture(packedA).setClearcoatNormalTexture(normal));
const mats=[stone,make('InteriorGraniteFixture',0,packedB),make('PaintedStructuralIronControl',.82),make('MilfordGraniteNonzeroMetalControl',.1),make('UnreviewedNonmetalControl',0)];
// A packed texture also serving as base colour/normal must be cloned, not edited.
mats[1].setBaseColorTexture(packedB).setNormalTexture(packedB);
mats[4].setExtension('KHR_materials_transmission',trans.createTransmission().setTransmissionFactor(.71).setTransmissionTexture(packedA));
const pos=doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,0,1,0,0,0,1,0])).setBuffer(buffer),norm=doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,1,0,0,1,0,0,1])).setBuffer(buffer),uv0=doc.createAccessor().setType('VEC2').setArray(new Float32Array([0,0,1,0,0,1])).setBuffer(buffer),uv1=doc.createAccessor().setType('VEC2').setArray(new Float32Array([.2,.3,.7,.3,.2,.8])).setBuffer(buffer),indices=doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0,1,2])).setBuffer(buffer);
const scene=doc.createScene();for(let i=0;i<mats.length;i++){const primitive=doc.createPrimitive().setAttribute('POSITION',pos).setAttribute('NORMAL',norm).setAttribute('TEXCOORD_0',uv0).setAttribute('TEXCOORD_1',uv1).setIndices(indices).setMaterial(mats[i]);scene.addChild(doc.createNode(`Fixture ${i}`).setMesh(doc.createMesh().addPrimitive(primitive)).setTranslation([i,0,0]));}
await mkdir(base,{recursive:true});await io.write(path.join(base,'fixture-before.glb'),doc);
const report=await prepareScalarTextures(path.join(base,'fixture-before.glb'),path.join(base,'fixture-after.glb'),path.join(base,'fixture-proof.json'));
assert.equal(report.status,'passed');assert.equal(report.changes.filter(c=>c.slot==='metallicRoughnessTexture').length,2);
assert.equal(report.changes.filter(c=>c.slot==='occlusionTexture').length,5);
assert(report.skippedMR.some(c=>c.material==='MilfordGraniteNonzeroMetalControl'&&c.metallicFactor===.1));
assert.equal(report.uniqueScalarCarriers,3,'Two distinct AO fields but one shared exact roughness carrier');
assert(report.roleProofs.some(c=>c.before.slot.includes('clearcoatRoughnessTexture')&&c.sampledChannelsPreserved.startsWith('all')));
assert(report.roleProofs.some(c=>c.before.slot.includes('transmissionTexture')&&c.sampledChannelsPreserved.startsWith('all')));
assert(report.roleProofs.some(c=>c.before.material==='InteriorGraniteFixture'&&c.before.slot==='normalTexture'&&c.before.imageSha256===c.after.imageSha256));
const repeat=await prepareScalarTextures(path.join(base,'fixture-after.glb'),path.join(base,'fixture-repeat.glb'),path.join(base,'fixture-repeat-proof.json'));
assert.deepEqual(report.roleProofs.map(c=>({key:c.after.key,p:c.after.pixels,r:c.after.redSha256,g:c.after.greenSha256})),repeat.roleProofs.map(c=>({key:c.after.key,p:c.after.pixels,r:c.after.redSha256,g:c.after.greenSha256})), 'A repeat preparation cannot accumulate scalar loss');
assert.equal(repeat.newScalarImages,0,'Already-canonical images cannot create more scalar payloads');
assert.equal(repeat.verbatimInput,true,'An already-canonical document passes through verbatim');
assert.equal(repeat.outputSha256,repeat.inputSha256,'The no-op path preserves every input byte');
console.log(JSON.stringify({status:'passed',roles:report.roleProofs.length,changes:report.changes.length,carriers:report.uniqueScalarCarriers,geometry:report.geometry,bytes:[report.beforeBytes,report.afterBytes]}));
