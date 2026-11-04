// Real material pixels through the installed resize CLI reproduce the loss.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { preserveNormalPixels } from '../penn-station-1935/preserve-normal-pixels.mjs';
import { readGlb, writeGlb } from '../penn-station-1935/asset_io.mjs';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tools = process.env.PENN_TOOLS || '/private/tmp/penn-station-tools';
const requireTools = createRequire(path.join(tools, 'package.json'));
const { Document, NodeIO } = requireTools('@gltf-transform/core');
const sharp = requireTools('sharp'), io = new NodeIO();
const out = process.env.PENN_NORMAL_PIXEL_OUT; assert(out, 'Set a fresh external PENN_NORMAL_PIXEL_OUT');
await mkdir(out, { recursive: false });
const sha = b => createHash('sha256').update(b).digest('hex');
const doc = new Document(), buffer = doc.createBuffer(), scene = doc.createScene();
const pos = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,0,1,0,0,0,1,0])).setBuffer(buffer);
const normal = doc.createAccessor().setType('VEC3').setArray(new Float32Array([0,0,1,0,0,1,0,0,1])).setBuffer(buffer);
const uv = doc.createAccessor().setType('VEC2').setArray(new Float32Array([0,0,1,0,0,1])).setBuffer(buffer);
const idx = doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0,1,2])).setBuffer(buffer);
const colourBytes = await readFile(path.join(repo, 'authoring/penn-station-1935/materials/Travertine009/Travertine009_2K-JPG_Color.jpg'));
const colour = doc.createTexture('Unchanged colour').setImage(colourBytes).setMimeType('image/jpeg');
const originals = new Map();
for (const family of ['Travertine009','Marble018','Granite005A']) {
  const file = path.join(repo, `authoring/penn-station-1935/materials/${family}/${family}_2K-JPG_NormalGL.jpg`);
  const bytes = await readFile(file), decoded = await sharp(bytes).raw().toBuffer({ resolveWithObject: true });
  originals.set(family, { bytes, ...decoded });
  const texture = doc.createTexture(family).setImage(bytes).setMimeType('image/jpeg');
  const material = doc.createMaterial(family).setNormalTexture(texture).setNormalScale(.035).setBaseColorTexture(colour);
  scene.addChild(doc.createNode(family).setMesh(doc.createMesh().addPrimitive(doc.createPrimitive().setAttribute('POSITION',pos).setAttribute('NORMAL',normal).setAttribute('TEXCOORD_0',uv).setIndices(idx).setMaterial(material))));
}
const source = path.join(out,'source.glb'), baseline = path.join(out,'baseline-resize.glb'), carrier = path.join(out,'lossless-carrier.glb'), sized = path.join(out,'carrier-resize.glb');
await io.write(source,doc);
const resize = (input,output) => { const p=spawnSync(process.execPath,[path.join(tools,'node_modules/@gltf-transform/cli/bin/cli.js'),'resize',input,output,'--width','2048','--height','2048'],{encoding:'utf8'}); assert.equal(p.status,0,p.stdout+p.stderr); };
resize(source,baseline);
const proof = await preserveNormalPixels(source,carrier,path.join(out,'carrier-proof.json'));
assert.equal(proof.convertedNormals.length,3); assert(proof.oldBinaryPrefixExact);
const s=readGlb(await readFile(source)), c=readGlb(await readFile(carrier));
assert(c.binary.subarray(0,s.binary.length).equals(s.binary));
assert.deepEqual(c.json.accessors,s.json.accessors); assert.deepEqual(c.json.meshes,s.json.meshes); assert.deepEqual(c.json.nodes,s.json.nodes); assert.deepEqual(c.json.materials,s.json.materials);
const cdoc=await io.read(carrier); assert(Buffer.from(cdoc.getRoot().listMaterials()[0].getBaseColorTexture().getImage()).equals(colourBytes));
resize(carrier,sized); const fixed=await io.read(sized), bad=await io.read(baseline), pixels=[];
for (const material of fixed.getRoot().listMaterials()) {
  const name=material.getName(), expected=originals.get(name), actual=await sharp(material.getNormalTexture().getImage()).raw().toBuffer({resolveWithObject:true});
  assert(actual.data.equals(expected.data),`${name}: exact original normal pixels must survive PNG plus2048resize`);
  assert.equal(material.getNormalScale(),.035);
  const before=await sharp(bad.getRoot().listMaterials().find(m=>m.getName()===name).getNormalTexture().getImage()).raw().toBuffer();
  pixels.push({family:name,sourceImageSha256:sha(expected.bytes),sourcePixelSha256:sha(expected.data),afterPixelSha256:sha(actual.data),width:actual.info.width,height:actual.info.height,baselineJpegResizeLostPixels:!before.equals(expected.data),losslessCarrierResizePixelsExact:true});
}
assert(pixels.every(r=>r.baselineJpegResizeLostPixels),'Actual pinned JPEG resize reproduces all three source losses');
const repeat=await preserveNormalPixels(carrier,path.join(out,'repeat.glb')); assert(repeat.verbatimInput); assert.equal(repeat.input.sha256,repeat.output.sha256);
const mixed=readGlb(await readFile(source)); mixed.json.materials[0].pbrMetallicRoughness.baseColorTexture=structuredClone(mixed.json.materials[0].normalTexture);
const mixedPath=path.join(out,'mixed-role.glb');await writeFile(mixedPath,writeGlb(mixed.json,mixed.binary));
await assert.rejects(()=>preserveNormalPixels(mixedPath,path.join(out,'rejected.glb')),/non-normal role/);
const result={status:'PASS',scope:'Three actual original2KnormalJPEGs through real installed resizeCLI; no architecture generated or runtime changed',pixels,controls:['actualJPEG-loss-reproduced','allthreeRGBpixel-arrays-exact-afterPNG-andCLIresize','nonzero-geometry-BIN-prefix-exact','all-material-factors-bindings-exact','non-normal-JPEG-bytes-exact-before-resize','PNG-verbatim-repeat','mixed-normal-colour-image-rejected'],proof};
await writeFile(path.join(out,'controls.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({status:result.status,pixels,controls:result.controls}));
