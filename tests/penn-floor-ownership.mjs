// Actual exported Main-level finish ownership. The same samples reject the
// released overlapping model and preserve four intentional stair apertures.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseGlb } from '../penn-station-1935/model/meshopt_patch_io.mjs';
import { decodedTriangles } from './helpers/penn-decoded-geometry.mjs';
const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const directory = process.env.PENN_FLOOR_INPUT || path.join(repo, 'penn-station-1935/assets');
const output = process.env.PENN_FLOOR_REPORT;
const materialNames = new Set(['PublicFloorMarble', 'ConcourseOpaqueCirculationConcrete']);
const expectedVoids = [[-44.13,-15.13],[-43.13,-15.13],[-44.13,.13],[-43.13,.13]];
const key = ([x,z]) => `${x},${z}`;
const report = { created: new Date().toISOString(), input: directory,
  scope: 'Actual decoded desktop/fallback Main-level top triangles. Exactly one finish owns each sampled solid location; four authored stair void samples must stay empty. Same-material tessellation edges do not count as competing finishes.', variants: [] };
for (const suffix of ['', '-low']) {
  const file = `model-concourse${suffix}.glb.gz`, bytes = await readFile(path.join(directory,file)), model = parseGlb(bytes);
  const triangles = [];
  for (const { material, node, triangle } of decodedTriangles(model,materialNames)) {
    if (triangle.some(p=>Math.abs(p[1])>.02)) continue;
    const [a,b,c]=triangle;
    if ((b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2])<=1e-9) continue;
    triangles.push({material,node,triangle,x0:Math.min(...triangle.map(p=>p[0])),x1:Math.max(...triangle.map(p=>p[0])),z0:Math.min(...triangle.map(p=>p[2])),z1:Math.max(...triangle.map(p=>p[2]))});
  }
  function hits(x,z) {
    const result=[];
    for (const t of triangles) {
      if(x<t.x0||x>t.x1||z<t.z0||z>t.z1)continue;
      const[a,b,c]=t.triangle,den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);
      if(Math.abs(den)<1e-10)continue;
      const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;
      const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den;
      if(u>=-1e-7&&v>=-1e-7&&u+v<=1.0000001)result.push({material:t.material,node:t.node,height:u*a[1]+v*b[1]+(1-u-v)*c[1]});
    }
    return result;
  }
  const samples=[];
  for(const z of [-43.13,-35.13,-25.13,-15.13,-5.13,-2.13,.13,2.13,5.13,15.13,25.13,35.13,43.13])for(const x of [-44.13,-43.13,-42.13,-41.33,-41.13,-40.93]){
    const surfaces=hits(x,z),owners=[...new Set(surfaces.map(s=>s.material))];
    samples.push({x,z,surfaces,owners,overlap:owners.length>1});
  }
  const emptySamples=samples.filter(s=>!s.surfaces.length).map(s=>[s.x,s.z]);
  const variant={file,sha256:createHash('sha256').update(bytes).digest('hex'),topTriangles:triangles.length,
    tested:samples.length,overlappingSamples:samples.filter(s=>s.overlap).length,emptySamples,
    unexpectedlyUnsupported:samples.filter(s=>!s.surfaces.length&&!expectedVoids.some(p=>key(p)===key([s.x,s.z]))),
    filledVoids:expectedVoids.filter(p=>hits(...p).length),samples};
  report.variants.push(variant);
}
if(output){await mkdir(path.dirname(path.resolve(output)),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');}
for(const v of report.variants){
  assert.equal(v.tested,78,'The original evidence grid is unchanged');
  assert.equal(v.overlappingSamples,0,`${v.file}: ${v.overlappingSamples}/78 sampled positions have competing concrete/marble finishes`);
  assert.equal(v.unexpectedlyUnsupported.length,0,`${v.file}: no newly missing floor support`);
  assert.deepEqual(v.emptySamples.map(key).sort(),expectedVoids.map(key).sort(),`${v.file}: four actual stair voids remain empty`);
  assert.equal(v.filledVoids.length,0,`${v.file}: no floor plane fills an authored stair aperture`);
}
console.log('PASS 78 Main-level ownership samples per variant, zero competing finishes, four preserved stair voids and no new unsupported solid locations.');
