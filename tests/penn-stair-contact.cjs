/* Finite-foot stair contact controls using actual ray intersections with a
 * triangulated quantized nosing and horizontal tread. Requires pinned Three:
 * PENN_TOOLS=/path/to/tools node tests/penn-stair-contact.cjs
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const requireTools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
const THREE = requireTools('three');
const root = path.resolve(__dirname, '..');
const report = { created: new Date().toISOString(), cases: [], scope: 'Ray intersections with triangulated support controls, supplemented by real full/mobile station route tests.' };
(async () => {
  const { findStairBevelSupport } = await import(pathToFileURL(path.join(root, 'penn-station-1935/src/stair-contact.mjs')));
  const flight = { label:'Registered interpreted access flight', start:[.304,.16,0], end:[-.3,-.1768,0], width:3 };
  const shiftedFlight = shift => ({ ...flight, start:[flight.start[0],flight.start[1]+shift,flight.start[2]], end:[flight.end[0],flight.end[1]+shift,flight.end[2]] });
  function plane(x0, x1, y0, y1, zHalf = 3) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([x0,y0,-zHalf, x1,y1,-zHalf, x1,y1,zHalf, x0,y0,zHalf],3));
    geometry.setIndex([0,2,1,0,3,2]);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({side:THREE.DoubleSide})); mesh.updateMatrixWorld(); return mesh;
  }
  function scenario({flat=true, flatStart=.00883695, flatHeight=0, shift=0, point=[.002,1.68,0], flights=[flight], floor=.168, invertedFlat=false} = {}) {
    const objects = [plane(0,.00883695,-.0176739+shift,shift)];
    if (flat) { const tread=plane(flatStart,.304,flatHeight+shift,flatHeight+shift); if(invertedFlat)tread.geometry.setIndex([0,1,2,0,2,3]); objects.push(tread); }
    let probes = 0;
    const ray = new THREE.Raycaster();
    function sample(at) {
      ray.set(new THREE.Vector3(at[0],floor+.25,at[2]),new THREE.Vector3(0,-1,0)); ray.far=.65;
      return ray.intersectObjects(objects,false).map(hit => ({height:hit.point.y,normalY:hit.face.normal.y}));
    }
    const central = sample(point);
    const result = findStairBevelSupport(point,floor,central,flights,at => {probes++;return sample(at);});
    for (const mesh of objects) {mesh.geometry.dispose();mesh.material.dispose();}
    return {result,probes,central};
  }
  const positive = scenario();
  assert(positive.central.length && Math.abs(Math.abs(positive.central[0].normalY)-.4472136)<.00001, 'Fixture reproduces the actual quantized 2:1 nosing slope');
  assert(positive.result && Math.abs(positive.result.height)<.000001, 'A foot rests on the real adjacent flat tread');
  assert(Math.abs(positive.result.offset)<=.02, 'Contact never samples beyond20mm');
  report.cases.push({name:'Quantized nosing with adjacent actual tread',...positive});
  for (const [name,options,expectNoProbe] of [
    ['Void even when real support lies within20mm',{point:[-.005,1.68,0]},true],
    ['Central bevel with no actual neighbouring tread',{flat:false},false],
    ['Neighbouring ledge at a different height',{flatHeight:.2},false],
    ['Downward-facing underside is not a tread',{invertedFlat:true},false],
    ['Tread farther than the finite contact limit',{flatStart:.03},false],
    ['Actual geometry outside the registered flight',{point:[.002,1.68,2]},true],
    ['Unregistered floor has no stair fallback',{flights:[]},true],
    ['Excessive downward step',{shift:-.20,flights:[shiftedFlight(-.20)]},true],
    ['Excessive upward step',{shift:.425,flights:[shiftedFlight(.425)]},true],
  ]) {
    const observed=scenario(options); assert.equal(observed.result,null,name);
    if(expectNoProbe)assert.equal(observed.probes,0,`${name}: no neighbour query is allowed`);
    if(name.startsWith('Excessive'))assert(observed.central.length,'Step-limit controls must actually intersect the central bevel');
    report.cases.push({name,...observed});
  }
  const manifest=JSON.parse(await fs.readFile(path.join(root,'penn-station-1935/assets/scene-manifest.json'),'utf8'));
  assert.equal(manifest.stairSupportFlights?.length,27,'Delivered manifest supplies the actual three flights for each of nine access stairs');
  for(const item of manifest.stairSupportFlights)assert(item.label && item.start.length===3 && item.end.length===3 && [...item.start,...item.end,item.width].every(Number.isFinite) && item.width>0,'Each flight has finite world endpoints and width');
  report.registeredFlights=manifest.stairSupportFlights.length;
  report.status='passed'; console.log(`PASS ${report.cases.length} finite-foot contact controls and27 authored flight registrations`);
})().catch(error=>{report.status='failed';report.error=error.stack;console.error(error);process.exitCode=1;}).finally(async()=>{
  if(process.env.PENN_STAIR_CONTACT_REPORT)await fs.writeFile(process.env.PENN_STAIR_CONTACT_REPORT,JSON.stringify(report,null,2));
});
