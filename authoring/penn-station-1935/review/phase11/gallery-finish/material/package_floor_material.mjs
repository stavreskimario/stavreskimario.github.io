import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readGlb,writeGlb,shareGlbTextures} from '/Users/stavreskimario/Desktop/penn-station-reconstruction/penn-station-1935/asset_io.mjs';
const root=path.dirname(new URL(import.meta.url).pathname), out=path.join(root,'packaged-v1');
await fs.mkdir(out);
const tools='/Users/stavreskimario/Desktop/penn-station-work/tools';
const cli=path.join(tools,'node_modules/@gltf-transform/cli/bin/cli.js');
const ktx=path.join(tools,'ktx-extracted/KTX-Software-4.4.2-Darwin-arm64-tools.pkg/Payload/usr/local/bin');
const sha=b=>createHash('sha256').update(b).digest('hex');
const src=await fs.readFile(path.join(root,'authored-v1/gallery-floor-material.glb'));
const data=readGlb(src), m=data.json.materials[0];
assert.equal(m.name,'ConcourseOpaqueArrivalsConcrete');
// Blender4.3 exports the original color image but drops the legacy MixRGB tint.
// Carry the exact authored linear multiplier into glTF's standard factor.
const factor=[.9127208966262771,.9230927201616019,.8712335809540819,1];
m.pbrMetallicRoughness.baseColorFactor=factor;
await fs.writeFile(path.join(out,'calibrated-material.glb'),writeGlb(data.json,data.binary));
const report={sourceSha256:sha(src),material:m.name,baseColorFactor:factor,
  exporterCorrection:'Original color bytes retained; restore the exact authored MixRGB multiplier as standard baseColorFactor.',
  interpretedAppearance:true,originalFloorGeometryChanged:false,variants:[],commands:[]};
function run(args){const r=spawnSync(process.execPath,[cli,...args],{encoding:'utf8',env:{...process.env,PATH:ktx+path.delimiter+process.env.PATH},maxBuffer:4e6});report.commands.push({args,status:r.status,stdout:r.stdout,stderr:r.stderr});assert.equal(r.status,0,r.stderr);}
for(const low of [false,true]){
 const name=low?'low':'full',sized=path.join(out,name+'-sized.glb'),norm=path.join(out,name+'-normal.glb'),packed=path.join(out,name+'-packed.glb');
 run(['resize',path.join(out,'calibrated-material.glb'),sized,'--width',low?'512':'2048','--height',low?'512':'2048']);
 run(['uastc',sized,norm,'--slots','*normal*','--level',low?'1':'4','--zstd','6','--jobs','2']);
 run(['uastc',norm,packed,'--level','1','--zstd','6','--jobs','2']);
 const shared=await shareGlbTextures(await fs.readFile(packed),out);
 const file='material-'+name+'.glb';await fs.writeFile(path.join(out,file),shared.buffer);
 report.variants.push({name,file,sha256:sha(shared.buffer),textures:shared.textures});
}
await fs.writeFile(path.join(out,'packaging.json'),JSON.stringify(report,null,2)+'\n');
console.log('PASS gallery concrete material packaging; no station geometry appended');
