import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';
import {OrbitControls} from 'https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/controls/OrbitControls.js';

const stage=document.getElementById('model-stage'),canvas=document.getElementById('palace-canvas'),status=document.getElementById('model-status'),readout=document.getElementById('view-readout');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.24;
const scene=new THREE.Scene();scene.background=new THREE.Color('#bcd7de');scene.fog=new THREE.FogExp2('#c8dce0',.00038);
const camera=new THREE.PerspectiveCamera(43,1,2,7000);camera.position.set(820,410,850);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=!matchMedia('(prefers-reduced-motion: reduce)').matches;controls.dampingFactor=.09;controls.minDistance=90;controls.maxDistance=3300;controls.maxPolarAngle=Math.PI*.495;controls.target.set(0,30,0);controls.update();
const hemi=new THREE.HemisphereLight('#eafaff','#8d7d59',2.0);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff0cf',3.3);sun.position.set(-430,700,550);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-1150;sun.shadow.camera.right=1150;sun.shadow.camera.top=750;sun.shadow.camera.bottom=-750;sun.shadow.camera.far=2500;sun.shadow.bias=-.0002;scene.add(sun);
const mat={
 metal:new THREE.MeshStandardMaterial({color:0x7e958e,metalness:.77,roughness:.29}),
 cream:new THREE.MeshStandardMaterial({color:0xd9dfd3,metalness:.43,roughness:.34}),
 glass:new THREE.MeshPhysicalMaterial({color:0xb8dae0,metalness:.08,roughness:.12,transparent:true,opacity:.32,side:THREE.DoubleSide,depthWrite:false,clearcoat:1,clearcoatRoughness:.08}),
 roof:new THREE.MeshPhysicalMaterial({color:0xcde7e9,metalness:.03,roughness:.19,transparent:true,opacity:.48,side:THREE.DoubleSide,depthWrite:false,clearcoat:1}),
 stone:new THREE.MeshStandardMaterial({color:0xd0c9ae,roughness:.91}),
 grass:new THREE.MeshStandardMaterial({color:0x79966b,roughness:1}),
 path:new THREE.MeshStandardMaterial({color:0xb6a88d,roughness:1}),
 trunk:new THREE.MeshStandardMaterial({color:0x6c513d,roughness:1}),
 leaves:new THREE.MeshStandardMaterial({color:0x51754d,roughness:.96}),
 visitor:new THREE.MeshStandardMaterial({color:0x514c47,roughness:.9}),
 gold:new THREE.MeshStandardMaterial({color:0x9b8456,metalness:.7,roughness:.28})
};
const parts={glass:new THREE.Group(),roof:new THREE.Group(),iron:new THREE.Group(),grid:new THREE.Group(),labels:new THREE.Group()};
Object.values(parts).forEach(g=>scene.add(g));
const environment=new THREE.Group();scene.add(environment);
const cube=new THREE.BoxGeometry(1,1,1),sphere=new THREE.SphereGeometry(1,8,6);
function box(parent,x,y,z,w,h,d,m,shadows=true){
 const mesh=new THREE.Mesh(cube,m);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=shadows;mesh.receiveShadow=shadows;parent.add(mesh);return mesh;
}
function beam(parent,a,b,r,m){const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),v=B.clone().sub(A);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,v.length(),5),m);mesh.position.copy(A.add(B).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());mesh.castShadow=false;parent.add(mesh);return mesh}
function panel(parent,vertices,m){const shape=new THREE.BufferGeometry();shape.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3));shape.setIndex([0,1,2,0,2,3]);shape.computeVertexNormals();const mesh=new THREE.Mesh(shape,m);parent.add(mesh);return mesh}
function ground(){
 const grass=box(environment,0,-6,0,3600,10,2300,mat.grass,false);
 box(environment,0,-.65,-340,2300,.5,160,mat.path,false);
 box(environment,0,-.6,340,2300,.5,160,mat.path,false);
 box(environment,-1050,-.55,0,165,.5,700,mat.path,false);
 box(environment,1050,-.55,0,165,.5,700,mat.path,false);
 const facade=new THREE.MeshStandardMaterial({color:0xabb7a1,roughness:1});
 box(environment,0,.3,0,1868,1,426,mat.stone,false);
 const trunkGeo=new THREE.CylinderGeometry(2.3,3.9,24,7),topGeo=new THREE.SphereGeometry(1,8,6);
 // Deliberate, deterministic Hyde Park tree placement outside the footprint.
 for(let row=0;row<4;row++)for(let i=0;i<32;i++){
  const x=-1500+i*96+((row%2)*47),z=(row<2?-1:1)*(410+(row%2)*95);
  if(Math.abs(x)<110&&Math.abs(z)<470)continue;
  const tree=new THREE.Group();tree.position.set(x,0,z);
  const trunk=new THREE.Mesh(trunkGeo,mat.trunk);trunk.position.y=12;tree.add(trunk);
  for(let k=0;k<3;k++){const crown=new THREE.Mesh(topGeo,mat.leaves);crown.scale.set(13+(k%2)*4,17,12);crown.position.set((k-1)*9,31+k%2*7,((k+1)%3-1)*7);tree.add(crown)}
  environment.add(tree);
 }
 // A small number of period-inspired visitor silhouettes for scale.
 const coat=new THREE.CapsuleGeometry(1.7,6,3,6);
 for(let i=0;i<100;i++){
  const x=-1050+(i*67)%2100,z=(i%3===0?-290:290)+(i%7-3)*9;
  const person=new THREE.Group();person.position.set(x,0,z);
  const body=new THREE.Mesh(coat,mat.visitor);body.position.y=6;person.add(body);
  const head=new THREE.Mesh(sphere,mat.visitor);head.scale.set(1.55,1.55,1.55);head.position.y=11;person.add(head);environment.add(person);
 }
}
function buildPalace(){
 // 1,848 x 408 feet; successive roof tiers 24, 48 and 72 feet.
 const bays=[[-204,-144,24],[-144,-72,48],[-72,72,72],[72,144,48],[144,204,24]];
 const column=new THREE.CylinderGeometry(1.2,1.4,1,8);
 const columns=[];
 for(const [z1,z2,h] of bays){
  for(let x=-924;x<924;x+=24){
   const x2=x+24,zmid=(z1+z2)/2;
   panel(parts.roof,[[x,h,z1],[x2,h,z1],[x2,h+4,zmid],[x,h+4,zmid]],mat.roof);
   panel(parts.roof,[[x,h+4,zmid],[x2,h+4,zmid],[x2,h,z2],[x,h,z2]],mat.roof);
   if(x%96===-12||x%96===0){beam(parts.iron,[x,h,z1],[x,h+4,zmid],.45,mat.metal);beam(parts.iron,[x,h+4,zmid],[x,h,z2],.45,mat.metal)}
   for(const z of [z1,z2]){
    if(x===-924||x%48===0){
      const post=box(parts.iron,x,h/2,z,1.85,h,1.85,mat.cream,false);
      box(parts.iron,x,h-1.5,z,4,3,4,mat.metal,false);
    }
   }
  }
  // Stacked glazing along both edges of each roof tier.
  for(const z of [z1,z2]){
   for(let x=-924;x<924;x+=24){
    const adjacent=bays.find(b=>b[1]===z||b[0]===z);
    const low=z===-204||z===204?0:Math.min(...bays.filter(b=>b[0]===z||b[1]===z).map(b=>b[2]));
    if(low>=h)continue;
    panel(parts.glass,[[x,low,z],[x+24,low,z],[x+24,h,z],[x,h,z]],mat.glass);
    box(parts.iron,x+12,h,z,.62,1.5,1,mat.metal,false);
    if(h-low>10)box(parts.iron,x+12,(h+low)/2,z,24,.7,1,mat.cream,false);
   }
  }
 }
 for(let x=-924;x<=924;x+=24){
   for(const z of [-204,204]){
    panel(parts.glass,[[x,0,z],[Math.min(x+24,924),0,z],[Math.min(x+24,924),24,z],[x,24,z]],mat.glass);
    box(parts.iron,x,12,z,.8,24,1.1,mat.cream,false);
   }
   for(const [z1,z2,h] of bays){
     if(x%48===0)beam(parts.iron,[x,h,z1],[x,h+4,(z1+z2)/2],.48,mat.cream);
   }
 }
 for(const z of [-204,204]){
   box(parts.iron,0,24,z,1848,2,1.2,mat.cream,false);
   box(parts.iron,0,12,z,1848,.8,1,mat.metal,false);
 }
 // The vaulted transept crosses the main axis, rising to 108 feet.
 const vault=(z)=>72+36*Math.sqrt(Math.max(0,1-(z/204)**2));
 for(let z=-204;z<204;z+=8){
   panel(parts.roof,[[-36,vault(z),z],[36,vault(z),z],[36,vault(z+8),z+8],[-36,vault(z+8),z+8]],mat.roof);
 }
 for(let z=-204;z<=204;z+=12){
  beam(parts.iron,[-36,vault(z),z],[36,vault(z),z],.53,mat.cream);
 }
 for(const x of [-36,-24,-12,0,12,24,36])
  for(let z=-204;z<204;z+=6)beam(parts.iron,[x,vault(z),z],[x,vault(z+6),z+6],.42,mat.metal);
 for(const x of [-36,36])for(const z of [-204,204])box(parts.iron,x,36,z,2.2,72,2.2,mat.cream);
 // North-side 936-foot extension, visually distinct and low.
 for(let x=-468;x<468;x+=24){
   panel(parts.glass,[[x,0,252],[x+24,0,252],[x+24,24,252],[x,24,252]],mat.glass);
   panel(parts.roof,[[x,24,204],[x+24,24,204],[x+24,27,228],[x,27,228]],mat.roof);
   panel(parts.roof,[[x,27,228],[x+24,27,228],[x+24,24,252],[x,24,252]],mat.roof);
   box(parts.iron,x,12,252,1.2,24,1.2,mat.cream,false);
 }
 box(parts.iron,0,24,252,936,1.6,1.5,mat.cream,false);
 for(const z of [-204,204,252])box(parts.iron,0,1,z,1848,1,1,mat.stone,false);
}
ground();buildPalace();
const grid=new THREE.GridHelper(2500,100,0x79949a,0xabb5ad);grid.position.y=1;parts.grid.add(grid);parts.grid.visible=false;
const presets={
 isometric:{position:[850,425,865],target:[0,28,0]},
 elevation:{position:[0,130,1180],target:[0,39,0]},
 plan:{position:[2,1500,1],target:[0,0,0]},
 transept:{position:[790,210,430],target:[0,68,0]}
};
let currentPreset='isometric',currentMode='reconstruction';
let dirty=true,raf=0,resizeObserver;
function invalidate(){dirty=true;if(!raf)raf=requestAnimationFrame(draw)}
function draw(){raf=0;if(!dirty)return;dirty=false;controls.update();renderer.render(scene,camera)}
function animateWhileMoving(){if(controls.enableDamping){let count=0;function settle(){controls.update();renderer.render(scene,camera);if(++count<30)requestAnimationFrame(settle)}requestAnimationFrame(settle)}else invalidate()}
function preset(key){
 const v=presets[key];if(!v)return;currentPreset=key;camera.position.set(...v.position);controls.target.set(...v.target);controls.update();
 document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===key)));
 readout.textContent=key.toUpperCase()+' · '+currentMode.toUpperCase();status.textContent=key+' camera view';invalidate();
}
function mode(key){
 currentMode=key;const blueprint=key==='blueprint';
 scene.background=new THREE.Color(blueprint?'#163346':'#bcd7de');
 scene.fog.color.set(blueprint?'#163346':'#c8dce0');
 environment.visible=!blueprint;sun.intensity=blueprint?1.2:3.3;
 mat.roof.opacity=blueprint?.16:.48;mat.glass.opacity=blueprint?.1:.32;
 mat.metal.color.set(blueprint?'#8cdee3':'#7e958e');mat.cream.color.set(blueprint?'#c7f5f5':'#d9dfd3');
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===key)));
 readout.textContent=currentPreset.toUpperCase()+' · '+key.toUpperCase();invalidate();
}
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>preset(b.dataset.preset)));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>mode(b.dataset.mode)));
document.querySelectorAll('[data-layer]').forEach(b=>b.addEventListener('change',()=>{parts[b.dataset.layer].visible=b.checked;invalidate()}));
document.querySelectorAll('[data-focus]').forEach(b=>b.addEventListener('click',()=>{
 const index=Number([...document.querySelectorAll('[data-focus]')].indexOf(b));
 const labels=[
 ['The great transept','The 108-foot vaulted crossing formed the great centrepiece of the Exhibition. Its shape is modelled from the original Hyde Park geometry.',[260,160,270],[0,80,0]],
 ['The grand avenue','An astonishing 1,848-foot glass-and-iron exhibition hall, reproduced here with repeatable Victorian structural bays.',[950,230,290],[0,35,0]],
 ['Modular ironwork','The columns and ridge-and-furrow glazing follow a repeating 24-foot structural module.',[155,94,190],[0,50,-160]],
 ['The north projection','The 936-foot northern wing is represented schematically, retaining the historical footprint.',[600,185,630],[0,30,175]]
 ];
 const [title,description,position,target]=labels[index];document.getElementById('feature-title').textContent=title;document.getElementById('feature-description').textContent=description;document.getElementById('feature-index').textContent=String(index+1).padStart(2,'0')+' / 04';
 camera.position.set(...position);controls.target.set(...target);controls.update();currentPreset='detail';readout.textContent='DETAIL · '+currentMode.toUpperCase();
 document.querySelectorAll('[data-preset]').forEach(n=>n.setAttribute('aria-pressed','false'));invalidate();status.textContent='Viewing '+title;
}));
function zoom(f){const offset=camera.position.clone().sub(controls.target).multiplyScalar(f);offset.clampLength(90,3300);camera.position.copy(controls.target).add(offset);controls.update();invalidate()}
document.getElementById('zoom-in').addEventListener('click',()=>zoom(.8));
document.getElementById('zoom-out').addEventListener('click',()=>zoom(1.25));
document.getElementById('reset-view').addEventListener('click',()=>preset('isometric'));
document.getElementById('export-view').addEventListener('click',()=>{
 controls.update();renderer.render(scene,camera);
 try{const a=document.createElement('a');a.download='crystal-palace-1851-realistic.png';a.href=canvas.toDataURL('image/png');a.click();status.textContent='PNG image downloaded.'}catch(e){status.textContent='Image export unavailable in this browser.'}
});
canvas.addEventListener('keydown',e=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','_','0'].includes(e.key))return;e.preventDefault();
 if(e.key==='0')return preset('isometric');
 if(e.key==='+'||e.key==='=')return zoom(.86);
 if(e.key==='-'||e.key==='_')return zoom(1.16);
 const v=camera.position.clone().sub(controls.target),spherical=new THREE.Spherical().setFromVector3(v);
 spherical.theta+=(e.key==='ArrowLeft'?-.12:e.key==='ArrowRight'?.12:0);
 spherical.phi=THREE.MathUtils.clamp(spherical.phi+(e.key==='ArrowUp'?-.12:e.key==='ArrowDown'?.12:0),.05,Math.PI*.49);
 camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();invalidate();
});
controls.addEventListener('change',invalidate);
function resize(){const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);invalidate()}
resizeObserver=new ResizeObserver(resize);resizeObserver.observe(stage);resize();preset('isometric');status.textContent='Photorealistic 3D scene ready. Drag to orbit, pinch or scroll to zoom.';
window.addEventListener('pagehide',()=>{resizeObserver.disconnect();renderer.dispose()},{once:true});
