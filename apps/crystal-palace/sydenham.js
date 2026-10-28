import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

/* Sydenham Crystal Palace, photographic-era (post-1866), interpretive reconstruction.
   World coordinates are historical feet. Based on contemporary guidebooks:
   1,608 ft nave, 312 ft general body width, 390 x 120 ft central transept,
   72-ft nave vault, 175-ft central transept crown, 282-ft water towers.
   Elements without documented as-built detail remain artistic interpretation. */
const stage=document.querySelector('#model-stage');
const canvas=document.querySelector('#palace-canvas');
const status=document.querySelector('#model-status');
const readout=document.querySelector('#view-readout');
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.4));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.06;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
const skyCanvas=document.createElement('canvas');
skyCanvas.width=8;skyCanvas.height=512;
const skyG=skyCanvas.getContext('2d');
const skyGradient=skyG.createLinearGradient(0,0,0,512);
skyGradient.addColorStop(0,'#aabfc7');
skyGradient.addColorStop(.45,'#c5d4d7');
skyGradient.addColorStop(1,'#e1dfd4');
skyG.fillStyle=skyGradient;skyG.fillRect(0,0,8,512);
const daylightSky=new THREE.CanvasTexture(skyCanvas);
daylightSky.colorSpace=THREE.SRGBColorSpace;
scene.background=daylightSky;
scene.fog=new THREE.Fog('#c3d7dd',2100,5500);
const camera=new THREE.PerspectiveCamera(36,1,2,8500);
const controls=new OrbitControls(camera,canvas);
controls.enableDamping=!reduced.matches;
controls.dampingFactor=.08;
controls.minDistance=85;
controls.maxDistance=4700;
controls.maxPolarAngle=Math.PI*.494;
controls.screenSpacePanning=true;
controls.target.set(0,66,0);
const hemi=new THREE.HemisphereLight(0xf6f2e6,0x79765d,1.55);
const sun=new THREE.DirectionalLight(0xfff0d5,2.6);
sun.position.set(-620,950,760);
sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);
Object.assign(sun.shadow.camera,{left:-1800,right:1800,top:1000,bottom:-1000,near:1,far:3200});
sun.shadow.bias=-.0003;
scene.add(hemi,sun);
const palette={
 iron:new THREE.MeshStandardMaterial({color:0x506667,metalness:.64,roughness:.34}),
 frame:new THREE.MeshStandardMaterial({color:0x9daa9f,metalness:.35,roughness:.45}),
 cornice:new THREE.MeshStandardMaterial({color:0xcac7b9,metalness:.12,roughness:.61}),
 glazing:new THREE.MeshPhysicalMaterial({color:0xaec6c8,metalness:.04,roughness:.13,transparent:true,opacity:.26,depthWrite:false,side:THREE.DoubleSide,clearcoat:1,clearcoatRoughness:.08}),
 roof:new THREE.MeshPhysicalMaterial({color:0xc1d3d0,metalness:.08,roughness:.18,transparent:true,opacity:.4,depthWrite:false,side:THREE.DoubleSide,clearcoat:.92,clearcoatRoughness:.12}),
 inside:new THREE.MeshStandardMaterial({color:0x4c6465,roughness:.82,side:THREE.DoubleSide}),
 base:new THREE.MeshStandardMaterial({color:0xb6ada0,roughness:.93}),
 pale:new THREE.MeshStandardMaterial({color:0xd4cbbb,roughness:.95}),
 tower:new THREE.MeshStandardMaterial({color:0xb3b5ae,metalness:.10,roughness:.73}),
 brick:new THREE.MeshStandardMaterial({color:0xbdb5a5,roughness:.95}),
 green:new THREE.MeshStandardMaterial({color:0x667d53,roughness:1}),
 hedge:new THREE.MeshStandardMaterial({color:0x496740,roughness:1}),
 leaf1:new THREE.MeshStandardMaterial({color:0x506746,roughness:1}),
 leaf2:new THREE.MeshStandardMaterial({color:0x6e8454,roughness:1}),
 leaf3:new THREE.MeshStandardMaterial({color:0x7d875b,roughness:1}),
 wood:new THREE.MeshStandardMaterial({color:0x665843,roughness:.94}),
 pathway:new THREE.MeshStandardMaterial({color:0xbeac92,roughness:1}),
 water:new THREE.MeshPhysicalMaterial({color:0x7c9ea2,metalness:.18,roughness:.16,transparent:true,opacity:.94}),
 brass:new THREE.MeshStandardMaterial({color:0xb5a681,metalness:.61,roughness:.26}),
 visitor:new THREE.MeshStandardMaterial({color:0x454848,roughness:.91})
};
// Repeating, deterministic material microtexture gives ground and stone a natural scale
// without external images or large downloads. This is illustrative, not a material survey.
function surfaceTexture(paper,grain,repeat=1){
 const c=document.createElement('canvas');c.width=c.height=256;
 const g=c.getContext('2d');g.fillStyle=paper;g.fillRect(0,0,256,256);
 for(let i=0;i<3400;i++){
  const x=(i*97+((i*i*13)%257))%256,y=(i*53+(i*i*7)%259)%256;
  const tone=(i*73)%100;g.fillStyle=tone%2?'rgba(255,255,255,.035)':'rgba(30,37,31,.046)';
  const side=1+(tone%4);g.fillRect(x,y,side,side);
 }
 for(let i=0;i<120;i++){
  g.strokeStyle='rgba(47,56,42,.035)';g.lineWidth=.5;
  const x=(i*53)%256,y=(i*71)%256;
  g.beginPath();g.moveTo(x,y);g.lineTo(x+11,y+((i%7)-3));g.stroke();
 }
 const texture=new THREE.CanvasTexture(c);
 texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
 texture.repeat.set(repeat,repeat);
 texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=Math.min(renderer.capabilities.getMaxAnisotropy(),4);
 return texture;
}
palette.green.map=surfaceTexture('#a0b399',20,22);
palette.pathway.map=surfaceTexture('#c9c0ac',20,7);
palette.base.map=surfaceTexture('#c2bcb4',20,5);
palette.tower.map=surfaceTexture('#d6d3ca',12,3);
palette.brick.map=surfaceTexture('#b9b2a7',8,4);
for(const key of ['green','pathway','base','tower','brick'])palette[key].needsUpdate=true;
const pmrem=new THREE.PMREMGenerator(renderer);
const reflectionScene=new THREE.Scene();
reflectionScene.background=new THREE.Color('#a8cdd9');
for(const [x,y,z,w,h] of [[-32,24,-24,22,13],[30,19,16,15,25],[-15,33,33,22,8]]){
 const panel=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:'#fff8e6',side:THREE.DoubleSide}));
 panel.position.set(x,y,z);panel.lookAt(0,8,0);reflectionScene.add(panel);
}
const illumination=pmrem.fromScene(reflectionScene,.05,.1,90);
scene.environment=illumination.texture;
pmrem.dispose();

const groups={glass:new THREE.Group(),roof:new THREE.Group(),iron:new THREE.Group(),grid:new THREE.Group(),labels:new THREE.Group()};
Object.values(groups).forEach(group=>scene.add(group));
const grounds=new THREE.Group();scene.add(grounds);
const cube=new THREE.BoxGeometry(1,1,1);
const instances=new Map();
function box(g,x,y,z,w,h,d,mat,shadow=false){
 const mesh=new THREE.Mesh(cube,mat);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);
 mesh.castShadow=shadow;mesh.receiveShadow=shadow||g===grounds;g.add(mesh);return mesh;
}
function beam(a,b,width=1,mat='frame'){
 const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),v=B.clone().sub(A),length=v.length();
 if(length<.001)return;
 const matrix=new THREE.Matrix4();
 matrix.compose(A.add(B).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.multiplyScalar(1/length)),new THREE.Vector3(width,length,width));
 if(!instances.has(mat))instances.set(mat,[]);
 instances.get(mat).push(matrix);
}
const surfaces={glass:[],roof:[]};
function face(kind,a,b,c,d){surfaces[kind].push(...a,...b,...c,...a,...c,...d)}
function flush(){
 for(const [kind,vertices] of Object.entries(surfaces)){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,palette[kind==='glass'?'glazing':'roof']);
  mesh.frustumCulled=false;groups[kind].add(mesh);
 }
 for(const [kind,matrixes] of instances){
  const inst=new THREE.InstancedMesh(cube,palette[kind],matrixes.length);
  matrixes.forEach((matrix,i)=>inst.setMatrixAt(i,matrix));inst.instanceMatrix.needsUpdate=true;inst.frustumCulled=false;
  groups.iron.add(inst);
 }
}
function windowWall(x1,x2,z,y0,y1,step=8){
 // Glass windows divided into three registers and narrow Victorian sash bars.
 for(let x=x1;x<x2-.01;x+=step){
  const next=Math.min(x+step,x2);
  for(let floor=y0;floor<y1-.01;floor+=20){
   const top=Math.min(floor+20,y1);
   face('glass',[x,floor,z],[next,floor,z],[next,top,z],[x,top,z]);
   beam([x,floor,z+.1],[x,top,z+.1],.56);
   beam([x,floor+(top-floor)*.5,z+.13],[next,floor+(top-floor)*.5,z+.13],.34,'iron');
  }
 }
 for(let y=y0;y<=y1;y+=20)beam([x1,y,z+.18],[x2,y,z+.18],.8,'frame');
 beam([x1,y1,z+.2],[x2,y1,z+.2],1.4,'cornice');
}
function barrelRoof(x1,x2,zcenter,r,spring,steps,kind='roof'){
 // A half-cylinder along the length of the hall (X axis).
 for(let x=x1;x<x2;x+=12){
  const xx=Math.min(x2,x+12);
  for(let i=0;i<steps;i++){
   const a=Math.PI*i/steps,b=Math.PI*(i+1)/steps;
   const za=zcenter-r*Math.cos(a),zb=zcenter-r*Math.cos(b);
   const ya=spring+r*Math.sin(a),yb=spring+r*Math.sin(b);
   face(kind,[x,ya,za],[xx,ya,za],[xx,yb,zb],[x,yb,zb]);
   if((x-x1)%24===0)beam([x,ya,za],[x,yb,zb],.55,'iron');
  }
 }
 for(let i=0;i<=steps;i++){
  const theta=Math.PI*i/steps,z=zcenter-r*Math.cos(theta),y=spring+r*Math.sin(theta);
  beam([x1,y,z],[x2,y,z],.4,'frame');
 }
 // High-detail radial rib pattern is especially visible at the building ends.
 for(const x of [x1,x2])for(let i=0;i<steps;i++){
  const a=Math.PI*i/steps,b=Math.PI*(i+1)/steps;
  beam([x,spring+r*Math.sin(a),zcenter-r*Math.cos(a)],[x,spring+r*Math.sin(b),zcenter-r*Math.cos(b)],1.1,'iron');
 }
}
function transept(x,r,spring,zStart,zEnd,facade=196){
 // Transverse barrel vaults run front-to-back and FACE the garden.
 const segments=40,depthStep=12;
 for(let z=zStart;z<zEnd;z+=depthStep){
  const zz=Math.min(zEnd,z+depthStep);
  for(let i=0;i<segments;i++){
   const a=i*Math.PI/segments,b=(i+1)*Math.PI/segments;
   const ax=x-r*Math.cos(a),bx=x-r*Math.cos(b);
   const ay=spring+r*Math.sin(a),by=spring+r*Math.sin(b);
   face('roof',[ax,ay,z],[bx,by,z],[bx,by,zz],[ax,ay,zz]);
   if(i%2===0)beam([ax,ay,z],[ax,ay,zz],.44,'frame');
  }
 }
 for(let z=zStart;z<=zEnd;z+=24){
  for(let i=0;i<segments;i++){
   const a=i*Math.PI/segments,b=(i+1)*Math.PI/segments;
   beam([x-r*Math.cos(a),spring+r*Math.sin(a),z],[x-r*Math.cos(b),spring+r*Math.sin(b),z],1,'iron');
  }
 }
 // Tall end wall, rounded arch head, fan-like iron glazing tracery.
 for(const z of [zStart,zEnd]){
  for(let i=0;i<segments;i++){
   const a=i*Math.PI/segments,b=(i+1)*Math.PI/segments;
   const ax=x-r*Math.cos(a),bx=x-r*Math.cos(b),ya=spring+r*Math.sin(a),yb=spring+r*Math.sin(b);
   face('glass',[ax,spring,z],[bx,spring,z],[bx,yb,z],[ax,ya,z]);
   beam([ax,spring,z+.22],[ax,ya,z+.22],.56,'iron');
  }
  beam([x-r,spring,z+.4],[x+r,spring,z+.4],1.3,'iron');
  // Concentric arch tracery follows surviving front elevations.
  for(const proportion of [.68,.82,.92]){
   for(let i=0;i<segments;i++){
    const a=i*Math.PI/segments,b=(i+1)*Math.PI/segments;
    beam([x-r*proportion*Math.cos(a),spring+r*proportion*Math.sin(a),z+1.4],
         [x-r*proportion*Math.cos(b),spring+r*proportion*Math.sin(b),z+1.4],
         .58,'frame');
   }
  }
  for(let t=0;t<=10;t++){
   const xx=x-r+(2*r*t/10);
   const sy=spring+Math.sqrt(Math.max(0,r*r-(xx-x)*(xx-x)));
   beam([xx,spring,z+.45],[xx,sy,z+.45],.72,'frame');
  }
  // Five levels of glazing below the lunette and deep reveal at the central portal.
  for(let x0=x-r;x0<x+r;x0+=8){
   for(let y=0;y<spring;y+=20){
    face('glass',[x0,y,z],[Math.min(x0+8,x+r),y,z],[Math.min(x0+8,x+r),Math.min(y+20,spring),z],[x0,Math.min(y+20,spring),z]);
    beam([x0,y,z+.6],[x0,Math.min(y+20,spring),z+.6],.55,'iron');
   }
  }
  for(let y=0;y<=spring;y+=20)beam([x-r,y,z+.55],[x+r,y,z+.55],1,'frame');
  for(const y of [22,45,68,91])if(y<spring)
   beam([x-r-17,y,z+2],[x+r+17,y,z+2],1.6,'cornice');
  for(let x0=x-r;x0<=x+r;x0+=24)beam([x0,0,z+1],[x0,spring,z+1],1.3,'frame');
 }
 // Solid tiered flanking wings and four square pylons of the transepts.
 for(const z of [zStart,zEnd])for(const side of [-1,1]){
  const px=x+side*(r+15);
  box(groups.iron,px,61,z,29,122,32,palette.inside,false);
  windowWall(px-14,px+14,z+17,0,118,7);
  for(const y of [24,48,72,96,120])beam([px-15,y,z+18],[px+15,y,z+18],1.5,'cornice');
 }
 // Return walls projecting toward gardens, creating deep facade shadows.
 for(const side of [-1,1]){
  const xx=x+side*(r+1);
  for(let z=zStart;z<zEnd;z+=16){
   face('glass',[xx,0,z],[xx,0,Math.min(z+16,zEnd)],[xx,spring,Math.min(z+16,zEnd)],[xx,spring,z]);
   beam([xx,0,z],[xx,spring,z],.6);
  }
 }
}
// Main 1,608-foot body. Overall general width 312 feet; 72-foot nave.
const LENGTH=1608,HALF=804,DEPTH=156;
function mainHall(){
 box(groups.iron,0,-1.8,0,LENGTH,4,312,palette.base,false);
 // Open two-storey galleries and deeply layered stepped facades.
 for(const z of [-156,156]){
  // Recessed dark interior produces layered glazing instead of a flat pale surface.
  box(groups.iron,0,36,z-Math.sign(z)*3,LENGTH,63,1.5,palette.inside,false);
  windowWall(-HALF,HALF,z,0,67,8);
  box(groups.iron,0,3,z+(z>0?4:-4),LENGTH,6,11,palette.base,false);
  for(const y of [23,46,67])box(groups.iron,0,y,z+(z>0?3:-3),LENGTH,1.75,5,palette.cornice,false);
 }
 for(const side of [-1,1]){
  // South and north tiers, plus high clerestory beneath the barrel nave.
  for(const [z0,z1,height,lower] of [[36,84,72,44],[84,156,46,24]]){
   const a=side*z0,b=side*z1;
   for(let x=-HALF;x<HALF;x+=24){
    const end=Math.min(HALF,x+24);
    // Fine 8-foot ridge and furrow panels visible from above.
    for(let z=Math.min(a,b);z<Math.max(a,b);z+=8){
     const zz=Math.min(Math.max(a,b),z+8),mid=(z+zz)/2;
     face('roof',[x,height,z],[end,height,z],[end,height+3,mid],[x,height+3,mid]);
     face('roof',[x,height+3,mid],[end,height+3,mid],[end,height,zz],[x,height,zz]);
     beam([x,height,z],[x,height+3,mid],.42);
     beam([x,height+3,mid],[x,height,zz],.42);
    }
   }
   for(const z of [a,b])windowWall(-HALF,HALF,z,lower,height,12);
  }
 }
 // Nave measured crown 110 ft 3 in above floor; 72-ft semicylindrical span.
 barrelRoof(-HALF,HALF,0,36,74.25,32);
 for(const z of [-36,36])windowWall(-HALF,HALF,z,46,68,12);
 // 72-foot transverse structural rhythm, plus paired projecting columns.
 for(let x=-HALF;x<=HALF;x+=24){
  for(const z of [-156,-84,-36,36,84,156]){
   const height=Math.abs(z)<=36?68:Math.abs(z)<=84?72:46;
   beam([x,0,z],[x,height,z],1.15,'frame');
   if(((x+HALF)/24)%3===0){
    beam([x,23,z],[Math.min(x+24,HALF),46,z],.6,'iron');
   }
  }
 }
 // Three-tier end galleries. Side towers bookend the building.
 for(const x of [-HALF,HALF]){
  box(groups.iron,x,0,0,17,112,312,palette.inside,false);
  for(let z=-156;z<=156;z+=12)beam([x,0,z],[x,108,z],.75,'iron');
  for(const y of [24,48,72,96])beam([x,y,-156],[x,y,156],.75,'cornice');
 }
}
function subsidiaryWing(start,finish,zCenter){
 const width=176,h=48;
 box(groups.iron,(start+finish)/2,21,zCenter,Math.abs(finish-start),42,width,palette.inside,false);
 for(const z of [zCenter-width/2,zCenter+width/2])windowWall(Math.min(start,finish),Math.max(start,finish),z,0,48,12);
 barrelRoof(Math.min(start,finish),Math.max(start,finish),zCenter,36,44,16);
 for(let x=Math.min(start,finish);x<Math.max(start,finish);x+=24){
  for(const z of [zCenter-88,zCenter+88])beam([x,0,z],[x,48,z],.8,'frame');
 }
}
// Brunel's massive tower, c.282 ft high.
function waterTower(x,z){
 const group=new THREE.Group();group.position.set(x,0,z);grounds.add(group);
 const polygon=32;
 const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(25,29,21,polygon),palette.brick);
 pedestal.position.y=10.5;pedestal.castShadow=true;group.add(pedestal);
 const shaft=new THREE.Mesh(new THREE.CylinderGeometry(17.2,19,224,polygon),palette.tower);
 shaft.position.y=132;shaft.castShadow=true;group.add(shaft);
 for(let y=24;y<=242;y+=23){
  const band=new THREE.Mesh(new THREE.CylinderGeometry(18.6,18.6,2.1,polygon),palette.cornice);
  band.position.y=y;group.add(band);
 }
 // Tall pierced lancet-window bands, vertical brick piers and metal mullions.
 for(let i=0;i<24;i++){
  const theta=i*2*Math.PI/24,c=Math.cos(theta),s=Math.sin(theta);
  const outer=18.5;
  for(let y=34;y<235;y+=23){
   beam([x+outer*c,y,z+outer*s],[x+outer*c,y+16,z+outer*s],i%3===0?1.35:.55,'iron');
  }
 }
 const drum=new THREE.Mesh(new THREE.CylinderGeometry(25.5,19,26,polygon),palette.tower);
 drum.position.y=255;drum.castShadow=true;group.add(drum);
 for(let i=0;i<16;i++){
  const a=i*2*Math.PI/16;
  const col=new THREE.Mesh(new THREE.CylinderGeometry(.8,1,24,8),palette.frame);
  col.position.set(23*Math.cos(a),255,23*Math.sin(a));group.add(col);
 }
 const cap=new THREE.Mesh(new THREE.ConeGeometry(29,20,polygon),palette.cornice);
 cap.position.y=278;cap.castShadow=true;group.add(cap);
 const finial=new THREE.Mesh(new THREE.SphereGeometry(2.5,12,8),palette.brass);
 finial.position.y=291;group.add(finial);
}
function terrace(){
 // Terraces on the photographed garden front, not an evenly spaced tree orchard.
 const land=box(grounds,0,-12,0,4500,20,3300,palette.green,false);
 const plinth=box(grounds,0,-1,0,2920,3,500,palette.base,false);
 const mainPromenade=box(grounds,0,1,350,2280,3,165,palette.pathway,false);
 const lowerPromenade=box(grounds,0,-11,650,2400,3,130,palette.pathway,false);
 for(const row of [210,430]){
  box(grounds,0,-2,row,2300,5,11,palette.pale,false);
  for(let x=-1120;x<=1120;x+=20){
   box(grounds,x,4,row,2.7,14,2.7,palette.cornice,false);
   if(x%80===0){box(grounds,x,12,row,7,3.2,7,palette.cornice,false)}
  }
  beam([-1120,12,row],[1120,12,row],2.4,'cornice');
 }
 // Central ceremonial staircase between levels, with stepped treads.
 for(let i=0;i<18;i++){
  const z=390+i*10;
  box(grounds,0,1-(i*.75),z,155,1.5,11,palette.pale,false);
 }
 // Winding walks, flowerbeds, and the conspicuous reflecting basin.
 const pond=new THREE.Mesh(new THREE.CircleGeometry(180,96),palette.water);
 pond.rotation.x=-Math.PI/2;pond.position.set(-410,-9,895);grounds.add(pond);
 const ring=new THREE.Mesh(new THREE.RingGeometry(180,189,96),palette.pale);
 ring.rotation.x=-Math.PI/2;ring.position.set(-410,-8.7,895);grounds.add(ring);
 const inner=new THREE.Mesh(new THREE.RingGeometry(169,172,96),palette.cornice);
 inner.rotation.x=-Math.PI/2;inner.position.set(-410,-8.5,895);grounds.add(inner);
 const fountainBase=new THREE.Mesh(new THREE.CylinderGeometry(15,17,8,32),palette.pale);
 fountainBase.position.set(-410,-3,895);grounds.add(fountainBase);
 const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(2.6,3.4,23,16),palette.cornice);
 pedestal.position.set(-410,12,895);grounds.add(pedestal);
 const fountainBowl=new THREE.Mesh(new THREE.CylinderGeometry(15,5,4,32),palette.pale);
 fountainBowl.position.set(-410,24,895);grounds.add(fountainBowl);
 // Classical terrace statues, drawn as small distant features, not replicas.
 const statueBody=new THREE.CylinderGeometry(1.9,2.9,10,10),head=new THREE.SphereGeometry(2.1,10,8);
 for(let x=-1070;x<1070;x+=105){
  for(const z of [232,470]){
   box(grounds,x,11,z,9,4,9,palette.pale,false);
   const body=new THREE.Mesh(statueBody,palette.cornice);body.position.set(x,22,z);grounds.add(body);
   const bust=new THREE.Mesh(head,palette.cornice);bust.position.set(x,30,z);grounds.add(bust);
  }
 }
 // Grassed parterres with formal border strips, allowing the terraces to dominate.
 for(let x=-1010;x<=1020;x+=230){
  for(const z of [570,690]){
   box(grounds,x,-4,z,160,2,65,palette.hedge,false);
   for(let t=0;t<12;t++){
    const xx=x-66+t*12;
    const flower=new THREE.Mesh(new THREE.IcosahedronGeometry(.9,1),t%3===0?palette.brass:palette.hedge);
    flower.position.set(xx,1,z+((t%3)-1)*10);grounds.add(flower);
   }
  }
 }
 // Individual, varied broad-leaf trees for context, kept away from photograph's axial lawns.
 const trunkGeometry=new THREE.CylinderGeometry(2.1,3.6,30,10);
 const foliage=new THREE.IcosahedronGeometry(1,2);
 for(let side of [-1,1])for(let i=0;i<15;i++){
  const x=side*(1120+(i%3)*85),z=270+i*91;
  const tree=new THREE.Group();tree.position.set(x,-5,z);
  const trunk=new THREE.Mesh(trunkGeometry,palette.wood);trunk.position.y=15;tree.add(trunk);
  for(let j=0;j<6;j++){
   const seed=(i*31+j*19)%37,leaf=new THREE.Mesh(foliage,[palette.leaf1,palette.leaf2,palette.leaf3][j%3]);
   leaf.position.set(Math.sin(seed*3)*11,36+(j%3)*9,Math.cos(seed*2)*9);
   leaf.scale.set(11+(j%4)*3,17+(j%2)*4,11+(j%3)*2);tree.add(leaf);
  }
  grounds.add(tree);
 }
 // Human-scale features with varied placements.
 const coatGeo=new THREE.CylinderGeometry(1.4,2,7,8),headGeo=new THREE.SphereGeometry(1.6,9,7);
 for(let i=0;i<95;i++){
  const x=-1080+((i*139)%2160),z=[325,550,705,925][i%4]+(i%5-2)*12;
  if(Math.abs(x+410)<210&&Math.abs(z-895)<200)continue;
  const person=new THREE.Group();person.position.set(x,-3,z);
  const coat=new THREE.Mesh(coatGeo,palette.visitor);coat.position.y=4;person.add(coat);
  const face=new THREE.Mesh(headGeo,palette.visitor);face.position.y=9.2;person.add(face);
  grounds.add(person);
 }
}
function build(){
 terrace();mainHall();
 // After the 1866 north-end fire: retain central and surviving south transept.
 // The lost northern transept is deliberately not generated for the photo-era view.
 transept(0,60,115,-192,192);
 transept(-560,36,75,-168,168);
 subsidiaryWing(-804,-1378,0);
 subsidiaryWing(804,1378,0);
 // Twin water towers appear in aerial and period photographs.
 waterTower(-1480,190);waterTower(1480,190);
 flush();
}
build();
const grid=new THREE.GridHelper(3200,80,0x86aca9,0xbacdc6);
grid.position.y=2;groups.grid.add(grid);groups.grid.visible=false;
function annotation(text,x,y,z){
 const c=document.createElement('canvas');c.width=500;c.height=86;
 const g=c.getContext('2d');g.fillStyle='#f1eee3';g.fillRect(0,0,500,86);
 g.strokeStyle='#67847e';g.lineWidth=3;g.strokeRect(2,2,496,82);
 g.font='bold 26px sans-serif';g.fillStyle='#3e686a';g.fillText(text,18,53);
 const tex=new THREE.CanvasTexture(c);
 const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthTest:false}));
 sprite.position.set(x,y,z);sprite.scale.set(120,21,1);groups.labels.add(sprite);
}
annotation('CENTRAL TRANSEPT · 175 FT',0,207,170);
annotation('SOUTH TRANSEPT · 110 FT',-560,133,170);
annotation('BRUNEL WATER TOWER',-1480,310,190);
annotation('FORMAL TERRACES',330,34,560);
groups.labels.visible=false;
let renderMode='reconstruction',presetName='isometric',frame=0,remaining=0;
const presets={
 isometric:{camera:[-600,300,2080],target:[-350,65,380]},
 elevation:{camera:[-130,165,1400],target:[-130,75,0]},
 plan:{camera:[1,1900,1],target:[0,0,100]},
 transept:{camera:[140,185,630],target:[0,98,130]}
};
function drawFrame(){
 frame=0;controls.update();renderer.render(scene,camera);
 if(remaining>0){remaining--;frame=requestAnimationFrame(drawFrame)}
}
function invalidate(){remaining=controls.enableDamping?22:0;if(!frame)frame=requestAnimationFrame(drawFrame)}
function setPreset(key){
 const p=presets[key];if(!p)return;
 presetName=key;camera.position.set(...p.camera);controls.target.set(...p.target);controls.update();
 document.querySelectorAll('[data-preset]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.preset===key)));
 readout.textContent=key.toUpperCase()+' · '+(renderMode==='blueprint'?'BLUEPRINT':'SYDENHAM');
 status.textContent=key+' view';invalidate();
}
function setMode(next){
 renderMode=next;const technical=next==='blueprint';
 scene.background=technical?new THREE.Color('#193849'):daylightSky;
 scene.fog.color.set(technical?'#193849':'#c3d7dd');
 grounds.visible=!technical;sun.intensity=technical?1.4:2.6;
 palette.glazing.opacity=technical?.09:.26;palette.roof.opacity=technical?.13:.4;
 palette.iron.color.set(technical?'#96e1e7':'#506667');
 palette.frame.color.set(technical?'#d0f4ee':'#9daa9f');
 document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===next)));
 readout.textContent=presetName.toUpperCase()+' · '+(technical?'BLUEPRINT':'SYDENHAM');invalidate();
}
document.querySelectorAll('[data-preset]').forEach(b=>b.addEventListener('click',()=>setPreset(b.dataset.preset)));
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
document.querySelectorAll('[data-layer]').forEach(b=>b.addEventListener('change',()=>{
 groups[b.dataset.layer].visible=b.checked;invalidate();
 status.textContent=b.dataset.layer+(b.checked?' shown':' hidden');
}));
const details=[
 {title:'The central transept',description:'The great transverse vault was approximately 120 feet wide and 175 feet tall above the ground floor. Its glazed semicircle was a defining feature of the Sydenham Palace.',camera:[205,175,640],target:[0,99,169]},
 {title:'The vaulted nave',description:'The 1,608-foot main nave carried a continuous rounded roof above the 72-foot central hall, rather than the rectangular central roof of the 1851 Hyde Park palace.',camera:[-880,230,450],target:[-240,80,0]},
 {title:'Victorian iron and glass',description:'A repeated structural grid, slender cast-iron columns, layered galleries, delicate sash bars and arched roof ribs created the original glasshouse effect. Fine connections and finishes remain interpretive.',camera:[-405,105,335],target:[-420,68,132]},
 {title:'Fountains and water towers',description:'The formal terraces and fountains were fed by Brunel’s monumental water towers. The garden in the model is an interpretive reconstruction of the photographic-era setting.',camera:[-600,230,990],target:[-420,24,510]}
];
document.querySelectorAll('[data-focus]').forEach((b,i)=>b.addEventListener('click',()=>{
 const f=details[i];document.querySelector('#feature-title').textContent=f.title;
 document.querySelector('#feature-index').textContent=String(i+1).padStart(2,'0')+' / 04';
 document.querySelector('#feature-description').textContent=f.description;
 presetName='detail';camera.position.set(...f.camera);controls.target.set(...f.target);controls.update();
 document.querySelectorAll('[data-preset]').forEach(n=>n.setAttribute('aria-pressed','false'));
 readout.textContent='DETAIL · SYDENHAM';status.textContent='Exploring '+f.title;invalidate();
}));
function zoom(scale){
 const v=camera.position.clone().sub(controls.target).multiplyScalar(scale);
 v.clampLength(85,4700);camera.position.copy(controls.target).add(v);controls.update();invalidate();
}
document.querySelector('#zoom-in').addEventListener('click',()=>zoom(.8));
document.querySelector('#zoom-out').addEventListener('click',()=>zoom(1.25));
document.querySelector('#reset-view').addEventListener('click',()=>setPreset('isometric'));
document.querySelector('#export-view').addEventListener('click',()=>{
 renderer.render(scene,camera);
 try{
  const a=document.createElement('a');a.href=canvas.toDataURL('image/png');
  a.download='crystal-palace-sydenham-1900.png';a.click();status.textContent='View saved as PNG.';
 }catch{status.textContent='PNG export is unavailable in this browser.'}
});
canvas.addEventListener('keydown',e=>{
 if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','_','0'].includes(e.key))return;
 e.preventDefault();
 if(e.key==='0')return setPreset('isometric');
 if(e.key==='+'||e.key==='=')return zoom(.85);
 if(e.key==='-'||e.key==='_')return zoom(1.18);
 const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
 spherical.theta+=(e.key==='ArrowLeft'?-.13:e.key==='ArrowRight'?.13:0);
 spherical.phi=THREE.MathUtils.clamp(spherical.phi+(e.key==='ArrowUp'?-.1:e.key==='ArrowDown'?.1:0),.06,Math.PI*.49);
 camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
 controls.update();invalidate();
});
controls.addEventListener('change',invalidate);
reduced.addEventListener?.('change',()=>{controls.enableDamping=!reduced.matches;invalidate()});
const observer=new ResizeObserver(()=>{
 const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();invalidate();
});
observer.observe(stage);
window.addEventListener('pagehide',()=>{observer.disconnect();renderer.dispose()},{once:true});
setPreset('isometric');status.textContent='Sydenham model ready. Drag to orbit, pinch or scroll to zoom.';
