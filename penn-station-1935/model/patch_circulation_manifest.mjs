// Add source-registered circulation evidence without changing navigation planes.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function patchCirculationManifest(base,proof,proofSha256){
  assert.equal(base.levels.mainWorld,-4.2672);
  assert.deepEqual(base.chunkOffsets.concourse,[0,-4.2672,0]);
  assert.equal(base.accessStairs.length,9);assert.equal(base.stairSupportFlights.length,27);
  assert.equal(proof.sourceSha256,'ab7af4ede715cd87337117053ddc8c46e4ba393a6d5a75f4200a92294fcf9c7d');
  assert.equal(proof.angleCount,176);assert.equal(proof.majorAngleCount,32);assert.equal(proof.minorAngleCount,144);
  assert.equal(proof.deferredOriginalAngleCount,16);assert.equal(proof.deferredOriginalMinorCentresBlenderXY.length,4);
  assert.equal(proof.allNewAngleVolumesPositive,true);assert.equal(proof.allAngleBaseCapContacts,true);
  assert.equal(proof.unrelatedObjectsExact,7137);
  assert.equal(proof.southOpeningsMainXZ.length,2);assert.equal(proof.rearGuards.rows,9);
  assert.equal(proof.rearGuards.postFootprints.length,63);assert.equal(proof.rearGuards.endConnections.length,18);
  for(const post of proof.rearGuards.postFootprints){assert.equal(post.checks.length,5);assert(post.checks.every(c=>c.errorMetres<.00002));}
  assert(proof.rearGuards.endConnections.every(c=>c.distanceMetres<.00001));
  assert(/^[a-f0-9]{64}$/.test(proofSha256));
  assert(/^[a-f0-9]{64}$/.test(proof.outputs['new-geometry-module.glb'].sha256));
  assert(!base.concourseCirculation,'Do not apply the correction twice');
  const result=structuredClone(base);
  result.concourseCirculation={
    revision:'phase7-southern-main-court-links-1',
    status:'Qualified opening-era reconstruction; exact source and route acceptance are recorded separately. Arrivals remain unfinished.',
    sourceSceneSha256:proof.sourceSha256,sourceProofSha256:proofSha256,
    moduleSha256:proof.outputs['new-geometry-module.glb'].sha256,
    sources:[
      {id:'Francis1910',url:'https://ascelibrary.org/doi/10.1061/TACEAT.0002221',control:'Printed198: principal columns3ft square, four8by8in angles.'},
      {id:'Gibbs1910',url:'https://archive.org/details/transactionsofam69amer',control:'Fig2 printed243: isolated piers/open intervals at eastern southern Main boundary; western compartments retained. Printed252 distinguishes Main475by125ft, court340by210ft and Exit480by60ft.'},
    ],
    southernOpenings:proof.southOpeningsMainXZ.map(bounds=>({boundsXZ:bounds,removedWallCellHeightMain:proof.removedWallCellHeightMain,clearanceStatus:'Retained sill/moulding remains below the removed cell top; actual body/headroom checks determine clearance.'})),
    principalAngleEnvelope:{metres:.9144,status:'Restored documented3ft envelope; original centres, heights, lattice, base/cap plates retained. Detailed shop section is not certified.'},
    minorAngleEnvelope:{metres:.62,correctedLegs:144,deferredOriginalLegs:16,deferredCentresBlenderXY:proof.deferredOriginalMinorCentresBlenderXY,status:'Interpreted envelope corrected on isolated secondary piers. Sixteen original legs remain exact at four close compound-edge piers pending joint reconstruction.'},
    rearWellGuards:{rows:9,x:proof.rearGuards.x,topMainRelative:proof.rearGuards.topRailHeightMain,sourceGeometry:proof.rearGuards.interpretation},
    retained:proof.retained,
    uncertainty:[...proof.qualifications,
      'Exact southern jambs are reconstructed; raster region has at least±0.75m placement uncertainty. The3.8m removed wall-cell height is not an unobstructed passage height.',
      'Approximately1.6m departure gate/pier registration difference remains unresolved; platform numbering is an existing interpreted fit.',
      'Western Main floor extent/open-to-tracks void and the separate lower arrivals corridor require coordinated follow-up. This correction does not verify the earlier whole-court prism extent.',
      'Opening-era evidence does not prove every detail remained unchanged in1935–1940.'
    ],
  };
  for(const key of Object.keys(base))assert.deepEqual(result[key],base[key],`Preserve existing ${key}`);
  return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args={};for(let i=2;i<process.argv.length;i+=2){assert(['--base','--proof','--out'].includes(process.argv[i])&&process.argv[i+1]);args[process.argv[i].slice(2)]=process.argv[i+1];}
  for(const key of ['base','proof','out'])assert(args[key],`Missing ${key}`);
  assert.notEqual(path.resolve(args.out),path.resolve(args.base));assert.notEqual(path.resolve(args.out),path.resolve(args.proof));
  const bytes=await readFile(args.proof),proof=JSON.parse(bytes),base=JSON.parse(await readFile(args.base,'utf8'));
  const patched=patchCirculationManifest(base,proof,createHash('sha256').update(bytes).digest('hex'));
  await mkdir(path.dirname(path.resolve(args.out)),{recursive:true});await writeFile(args.out,JSON.stringify(patched,null,2)+'\n');
  console.log('Preserved all existing navigation/railway metadata; added qualified source circulation evidence');
}
