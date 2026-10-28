import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';

/* Original Hyde Park building, 1851. All geometry uses historical feet as world units.
 * Envelope and structural system: Downes & Cowper (1852), Paxton/Cowper plans.
 * Unverified ornamental, colour, vegetation and interior detail is interpretive. */
const stage=document.getElementById('model-stage');
const canvas=document.getElementById('palace-canvas');
const status=document.getElementById('model-status');
const readout=document.getElementById('view-readout');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0xbcced3);
scene.fog=new THREE.Fog(0xbcced3,1700,4200);
const camera=new THREE.PerspectiveCamera(41,1,1,7000);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=!reduced.matches;
controls.dampingFactor=.085;
controls.minDistance=75;
controls.maxDistance=3400;
controls.maxPolarAngle=Math.PI*.49;
controls.screenSpacePanning=true;
controls.target.set(0,37,0);
const sun=new THREE.DirectionalLight(0xffedd1,3.35);
sun.position.set(-470,850,550);
sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-1200,right:1200,top:680,bottom:-680,near:5,far:2400});
sun.shadow.bias=-.00018;
scene.add(sun,new THREE.HemisphereLight(0xe7f5ff,0x7c8964,1.8));
const material={
 iron:new THREE.MeshStandardMaterial({color:0x61766e,metalness:.64,roughness:.32}),
 ironLight:new THREE.MeshStandardMaterial({color:0x9ba99d,metalness:.45,roughness:.4}),
 timber:new THREE.MeshStandardMaterial({color:0x9a8262,roughness:.75}),
 glazing:new THREE.MeshPhysicalMaterial({color:0xe1f0e9,roughness:.17,metalness:.08,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false,clearcoat:.55}),
 roof:new THREE.MeshPhysicalMaterial({color:0xe1f0ec,roughness:.16,metalness:.05,transparent:true,opacity:.52,side:THREE.DoubleSide,depthWrite:false,clearcoat:.6}),
 paving:new THREE.MeshStandardMaterial({color:0xbcb29e,roughness:.94}),
 grass:new THREE.MeshStandardMaterial({color:0x7c936a,roughness:1}),
 soil:new THREE.MeshStandardMaterial({color:0xb2a98e,roughness:1}),
 wood:new THREE.MeshStandardMaterial({color:0x5e4936,roughness:1}),
 leaf:new THREE.MeshStandardMaterial({color:0x536b42,roughness:1}),
 human:new THREE.MeshStandardMaterial({color:0x51483c,roughness:1})
};
const layers={iron:new THREE.Group(),glass:new THREE.Group(),roof:new THREE.Group(),grid:new THREE.Group(),labels:new THREE.Group()};
Object.values(layers).forEach(g=>scene.add(g));
const surroundings=new THREE.Group();scene.add(surroundings);
const beamEntries={iron:[],ironLight:[],timber:[]};
const unitBox=new THREE.BoxGeometry(1,1,1);
function box(group,w,h,d,x,y,z,mat,shadow=false){
 const mesh=new THREE.Mesh(unitBox,mat);
 mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=shadow;mesh.receiveShadow=shadow;
 group.add(mesh);return mesh;
}
function beam(a,b,r=.45,type='iron'){
 const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),v=q.clone().sub(p);
 if(v.lengthSq()===0)return;
 const m=new THREE.Matrix4();
 const pos=p.add(q).multiplyScalar(.5);
 const rot=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.clone().normalize());
 m.compose(pos,rot,new THREE.Vector3(r*2,v.length(),r*2));
 beamEntries[type].push(m);
}
function finishBeams(){
 for(const [key,mats] of Object.entries(beamEntries)){
  const mesh=new THREE.InstancedMesh(unitBox,material[key],mats.length);
  mats.forEach((m,i)=>mesh.setMatrixAt(i,m));
  mesh.instanceMatrix.needsUpdate=true;mesh.frustumCulled=false;
  layers.iron.add(mesh);
 }
}
// Roof sash-bar seam approximation: ~49-inch glass panes within 8-foot furrows.
function addSashBars(){
 const lines=[];
 const put=(a,b)=>lines.push(...a,...b);
 // Thin line geometry is significantly lighter than individual bar meshes.
 for(let x=-924;x<=924;x+=49/12){
  for(const [z0,z1,h] of section)for(let z=z0;z<z1;z+=8){
   const z2=Math.min(z+8,z1),mid=(z+z2)*.5;
   if(x>-36&&x<36)continue; // Opening beneath the transept vault.
   put([x,h+.08,z],[x,h+3.68,mid]);
   put([x,h+3.68,mid],[x,h+.08,z2]);
  }
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
 const sash=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0x829f99,transparent:true,opacity:.48}));
 sash.frustumCulled=false;layers.iron.add(sash);
}

const panels={glass:[],roof:[]};
function quad(layer,a,b,c,d){panels[layer].push(...a,...b,...c,...a,...c,...d)}
function finishPanels(){
 for(const [layer,array] of Object.entries(panels)){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(array,3));
  geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material[layer==='glass'?'glazing':'roof']);
  mesh.frustumCulled=false;layers[layer].add(mesh);
 }
}
/* Section derived from the 1851 descriptions:
 * 408-ft-wide hall: 72-ft central nave at 64 ft,
 * 72-ft wings on each side at 44 ft,
 * 96-ft outer aisles at 24 ft. */
const section=[
 [-204,-108,24],[-108,-36,44],[-36,36,64],[36,108,44],[108,204,24]
];
function heightNear(z){
 const a=Math.abs(z);
 return a<=36?64:a<=108?44:24;
}
function frameBay(x,zlow,zhigh,h){
 // A visible 8-foot ridge and furrow; three such bays make a 24-foot module.
 for(let z=zlow;z<zhigh-.01;z+=8){
  const z1=Math.min(z+8,zhigh),mid=(z+z1)*.5;
  quad('roof',[x,h,z],[x+24,h,z],[x+24,h+3.6,mid],[x,h+3.6,mid]);
  quad('roof',[x,h+3.6,mid],[x+24,h+3.6,mid],[x+24,h,z1],[x,h,z1]);
  beam([x,h,z],[x+24,h,z],.28,'ironLight');
  beam([x,h+3.6,mid],[x+24,h+3.6,mid],.36,'iron');
 }
}
function facadeRun(z,base,top,x0,x1){
 const step=8;
 for(let x=x0;x<x1;x+=step){
  const x2=Math.min(x+step,x1);
  quad('glass',[x,base,z],[x2,base,z],[x2,top,z],[x,top,z]);
  beam([x,base,z],[x,top,z],.35,'iron');
  if((x-x0)%24===0)beam([x,base,z],[x,top,z],.8,'ironLight');
 }
 beam([x0,base,z],[x1,base,z],.48);
 beam([x0,top,z],[x1,top,z],.65);
 if(top-base>24)beam([x0,base+(top-base)/2,z],[x1,base+(top-base)/2,z],.42,'ironLight');
}
function construct(){
 box(layers.iron,1848,1.15,408,0,-.5,0,material.paving,false);
 // Vertical facades at each setback, appropriately tiered.
 for(const [lo,hi,h] of section)for(let x=-924;x<924;x+=24){
  // The transept roof replaces, rather than overlaps, these central 72 ft of the hall.
  if(x < -36 || x >= 36) frameBay(x,lo,hi,h);
  if(x%48===-12||x%48===0) {
   beam([x,0,lo],[x,h,lo],.85);
   beam([x,0,hi],[x,h,hi],.85);
  }
  // Interior iron posts on 24-foot bays and 24/48/72-foot girder spans.
  for(const z of [lo,hi]){
   if(Math.round(x/24)%2===0){
    const lower=heightNear(z+(z<0?-.01:.01));
    beam([x,0,z],[x,Math.min(h,lower),z],.8,'ironLight');
   }
  }
 }
 for(const z of [-204,-108,-36,36,108,204]){
  const adjacent=section.filter(([l,r])=>Math.abs(l-z)<.01||Math.abs(r-z)<.01).map(a=>a[2]);
  const high=Math.max(...adjacent),low=adjacent.length===2?Math.min(...adjacent):0;
  if(high>low)facadeRun(z,low,high,-924,924);
 }
 // Longitudinal horizontal girders and diagonal bracing follow columns.
 for(let x=-924;x<=924;x+=24){
  for(const z of [-204,-108,-36,36,108,204]){
   const h=heightNear(z+(z<0?-.01:.01));
   beam([x,Math.min(20,h),z],[x+Math.min(24,924-x),Math.min(20,h),z],.4);
   if(x<924&&x%48===0)beam([x,h-6,z],[x+24,h,z],.32,'iron');
  }
 }
 // A strong readable grid at both 408-ft end elevations.
 for(const x of [-924,924]){
  for(const [a,b,h] of section){
   for(let z=a;z<b;z+=8){
    const zz=Math.min(z+8,b);
    quad('glass',[x,0,z],[x,0,zz],[x,h,zz],[x,h,z]);
    beam([x,0,z],[x,h,z],.34,'ironLight');
   }
   beam([x,h,a],[x,h,b],.7);
   beam([x,Math.min(12,h),a],[x,Math.min(12,h),b],.48);
  }
 }
 // Transept axis runs NORTH–SOUTH across the full 408 feet.
 // 72-foot span across X: a TRUE semicircle radius 36 rising from a 72-ft spring.
 const spring=72,radius=36,sections=16;
 const vaultX=theta=>-36+radius*(1-Math.cos(theta));
 const vaultY=theta=>spring+radius*Math.sin(theta);
 // roof skin as longitudinal barrel-vault panels, one rib each 24-ft bay.
 for(let z=-204;z<204;z+=8)for(let i=0;i<sections;i++){
  const a=Math.PI*i/sections,b=Math.PI*(i+1)/sections;
  quad('roof',[vaultX(a),vaultY(a),z],[vaultX(b),vaultY(b),z],[vaultX(b),vaultY(b),z+8],[vaultX(a),vaultY(a),z+8]);
 }
 for(let z=-204;z<=204;z+=24)for(let i=0;i<sections;i++){
  const a=Math.PI*i/sections,b=Math.PI*(i+1)/sections;
  beam([vaultX(a),vaultY(a),z],[vaultX(b),vaultY(b),z],.75,'timber');
 }
 for(let i=0;i<=sections;i++)for(let z=-204;z<204;z+=24){
  const t=Math.PI*i/sections;
  beam([vaultX(t),vaultY(t),z],[vaultX(t),vaultY(t),z+24],.36,'iron');
 }
 for(const x of [-36,36])for(const z of [-204,204]){
  beam([x,0,z],[x,72,z],1.35,'ironLight');
 }
 // Transept end glazing and fine semicircular tracery.
 for(const z of [-204,204]){
  for(let i=0;i<sections;i++){
   const a=Math.PI*i/sections,b=Math.PI*(i+1)/sections;
   quad('glass',[vaultX(a),72,z],[vaultX(b),72,z],[vaultX(b),vaultY(b),z],[vaultX(a),vaultY(a),z]);
   beam([vaultX(a),72,z],[vaultX(a),vaultY(a),z],.27);
  }
  beam([-36,72,z],[36,72,z],.85);
  // Highlight the central public portal beneath the barrel.
  for(const x of [-24,24])beam([x,0,z],[x,35,z],.8);
  beam([-24,35,z],[24,35,z],.8);
 }
 // The 936x48 north projection: roof ridge and facade, supported by 24-ft bays.
 for(let x=-468;x<468;x+=24){
  quad('roof',[x,24,204],[x+24,24,204],[x+24,27,228],[x,27,228]);
  quad('roof',[x,27,228],[x+24,27,228],[x+24,24,252],[x,24,252]);
  beam([x,24,204],[x,27,228],.38);
  beam([x,27,228],[x,24,252],.38);
  for(const z of [204,252]){
   quad('glass',[x,0,z],[x+24,0,z],[x+24,24,z],[x,24,z]);
   beam([x,0,z],[x,24,z],.85,'ironLight');
  }
 }
 for(const z of [204,252])beam([-468,24,z],[468,24,z],.8,'ironLight');
 for(const x of [-468,468])for(const z of [204,252])beam([x,0,z],[x,24,z],.95,'iron');
 finishPanels();finishBeams();addSashBars();
}
function landscape(){
 box(surroundings,3600,5,2200,0,-6,0,material.grass,false);
 box(surroundings,2220,.4,150,0,-2,340,material.paving,false);
 box(surroundings,2220,.4,120,0,-2,-330,material.paving,false);
 for(const z of [-540,540])box(surroundings,2900,.2,115,0,-1.7,z,material.soil,false);
 const cone=new THREE.CylinderGeometry(2,3.7,24,7);
 const canopy=new THREE.IcosahedronGeometry(13,1);
 // Sparse suggested trees, rather than claiming precise 1851 planting positions.
 for(let row=0;row<4;row++)for(let i=0;i<20;i++){
  const x=-1490+i*151+(row%2)*65,z=(row<2?-1:1)*(485+(row%2)*140);
  const t=new THREE.Group();t.position.set(x,0,z);
  const trunk=new THREE.Mesh(cone,material.wood);trunk.position.y=12;t.add(trunk);
  for(let j=0;j<3;j++){
   const crown=new THREE.Mesh(canopy,material.leaf);
   crown.position.set((j-1)*8,30+j%2*5,(j-1)*6);crown.scale.set(1,1.45,1);t.add(crown);
  }
  surroundings.add(t);
 }
 // Human figures are simple scale references, not historical reconstructions.
 const bodyGeometry=new THREE.CylinderGeometry(1.8,2.5,7,6);
 const headGeometry=new THREE.SphereGeometry(1.8,6,5);
 for(let i=0;i<65;i++){
  const x=-1070+(i*167)%2140,z=(i%2?295:-285)+(i%5-2)*11;
  const figure=new THREE.Group();figure.position.set(x,-1,z);
  const coat=new THREE.Mesh(bodyGeometry,material.human);coat.position.y=5.5;figure.add(coat);
  const head=new THREE.Mesh(headGeometry,material.human);head.position.y=11;figure.add(head);surroundings.add(figure);
 }
}
construct();landscape();
// Camera-facing annotations are a separate, genuinely toggleable layer.
function addAnnotation(title,x,y,z){
 const c=document.createElement('canvas');c.width=440;c.height=88;
 const t=c.getContext('2d');
 t.fillStyle='rgba(252,250,238,.88)';t.fillRect(0,0,440,88);
 t.strokeStyle='#7b9790';t.lineWidth=2;t.strokeRect(2,2,436,84);
 t.fillStyle='#385e60';t.font='600 26px sans-serif';t.fillText(title,18,54);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false}));
 label.position.set(x,y,z);label.scale.set(105,21,1);layers.labels.add(label);
}
addAnnotation('THE GREAT TRANSEPT · 108 FT',8,126,0);
addAnnotation('24 FT IRON BAY',570,50,-204);
addAnnotation('936 FT NORTH PROJECTION',380,43,253);
const guide=new THREE.GridHelper(2400,100,0x698da0,0xa0b3ae);guide.position.y=.8;layers.grid.add(guide);layers.grid.visible=false;
const presets={
 isometric:{position:[870,360,860],target:[0,30,0]},
 elevation:{position:[0,110,1450],target:[0,36,0]},
 plan:{position:[0.2,1400,0],target:[0,0,0]},
 transept:{position:[480,140,445],target:[0,68,0]}
};
let activePreset='isometric',mode='reconstruction',raf=0,tail=0;
function render(){raf=0;controls.update();renderer.render(scene,camera);if(tail>0){tail--;raf=requestAnimationFrame(render)}}
function draw(){tail=controls.enableDamping?16:0;if(!raf)raf=requestAnimationFrame(render)}
function setView(name){
 const v=presets[name];if(!v)return;activePreset=name;
 controls.target.set(...v.target);camera.position.set(...v.position);controls.update();
 document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===name)));
 readout.textContent=name.toUpperCase()+' · '+mode.toUpperCase();status.textContent=name+' view';draw();
}
function setMode(name){
 mode=name;const blueprint=name==='blueprint';
 scene.background.set(blueprint?0x162f40:0xbcced3);scene.fog.color.set(blueprint?0x162f40:0xbcced3);
 surroundings.visible=!blueprint;sun.intensity=blueprint?1.25:3.35;
 material.iron.color.set(blueprint?0x90d7e2:0x61766e);
 material.ironLight.color.set(blueprint?0xc2eced:0x9ba99d);
 material.roof.opacity=blueprint?.13:.52;material.glazing.opacity=blueprint?.08:.35;
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===name)));
 readout.textContent=activePreset.toUpperCase()+' · '+(blueprint?'BLUEPRINT':'REALISTIC');
 status.textContent=blueprint?'Blueprint view':'Realistic architectural study';draw();
}
function zoom(factor){
 const offset=camera.position.clone().sub(controls.target).multiplyScalar(factor);
 offset.clampLength(75,3400);camera.position.copy(controls.target).add(offset);controls.update();draw();
}
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.preset)));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
document.querySelectorAll('[data-layer]').forEach(b=>b.addEventListener('change',()=>{layers[b.dataset.layer].visible=b.checked;draw()}));
document.querySelectorAll('[data-focus]').forEach((b,index)=>b.addEventListener('click',()=>{
 const features=[
 ['The great transept','This arch really spans 72 feet: its semicircular timber rib rises from 72 to 108 feet, extending across the 408-foot width of the hall.',[360,170,420],[0,82,0]],
 ['The grand avenue','The nave spans 72 feet, with two stepped tiers of aisles to either side, all arranged on a 24-foot structural module.',[925,265,430],[0,42,0]],
 ['Modular ironwork','The 24-foot column grid and 8-foot ridge-and-furrow roofs govern this reconstruction. Individual joints and painted decoration remain interpretive.',[150,90,210],[0,42,-108]],
 ['The north projection','The original building also had a 936-by-48-foot northern projection, separate from the later Sydenham additions.',[650,245,680],[0,29,192]]
 ];
 const [title,description,from,target]=features[index];
 document.getElementById('feature-title').textContent=title;
 document.getElementById('feature-index').textContent=String(index+1).padStart(2,'0')+' / 04';
 document.getElementById('feature-description').textContent=description;
 controls.target.set(...target);camera.position.set(...from);controls.update();activePreset='detail';
 document.querySelectorAll('[data-preset]').forEach(el=>el.setAttribute('aria-pressed','false'));
 readout.textContent='DETAIL · '+mode.toUpperCase();status.textContent=title;draw();
}));
document.getElementById('zoom-in').addEventListener('click',()=>zoom(.8));
document.getElementById('zoom-out').addEventListener('click',()=>zoom(1.25));
document.getElementById('reset-view').addEventListener('click',()=>setView('isometric'));
document.getElementById('export-view').addEventListener('click',()=>{
 renderer.render(scene,camera);
 try{const link=document.createElement('a');link.href=canvas.toDataURL('image/png');link.download='crystal-palace-hyde-park-1851.png';link.click();status.textContent='View exported to PNG.'}
 catch {status.textContent='PNG export unavailable in this browser.'}
});
canvas.addEventListener('keydown',e=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','_','0'].includes(e.key))return;
 e.preventDefault();if(e.key==='0')return setView('isometric');
 if(e.key==='+'||e.key==='=')return zoom(.83);
 if(e.key==='-'||e.key==='_')return zoom(1.2);
 const s=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
 s.theta+=(e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0);
 s.phi=THREE.MathUtils.clamp(s.phi+(e.key==='ArrowUp'?-.11:e.key==='ArrowDown'?.11:0),.06,Math.PI*.49);
 camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(s));controls.update();draw();
});
controls.addEventListener('change',draw);
reduced.addEventListener?.('change',()=>{controls.enableDamping=!reduced.matches;controls.update();draw()});
const resize=()=>{
 const width=stage.clientWidth,height=stage.clientHeight;if(!width||!height)return;
 camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);draw();
};
const observer=new ResizeObserver(resize);observer.observe(stage);
window.addEventListener('pagehide',()=>{observer.disconnect();renderer.dispose()},{once:true});
resize();setView('isometric');status.textContent='Historically proportioned 3D study ready. Drag to orbit.';
