/* Sydenham park material system.
 * Local, deterministic GLSL procedural detail. No external photos, textures, or tracking.
 * The stone/ground material hooks preserve Three.js PBR lighting and shadowing.
 * Artistic reconstruction, not a measured historic material survey. */

const GLSL_NOISE = `
float archiveHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.yzx + 33.33);
  return fract((p.x + p.y) * p.z);
}
float archiveNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(
    mix(mix(archiveHash(i),archiveHash(i+vec3(1.,0.,0.)),f.x),
        mix(archiveHash(i+vec3(0.,1.,0.)),archiveHash(i+vec3(1.,1.,0.)),f.x),f.y),
    mix(mix(archiveHash(i+vec3(0.,0.,1.)),archiveHash(i+vec3(1.,0.,1.)),f.x),
        mix(archiveHash(i+vec3(0.,1.,1.)),archiveHash(i+vec3(1.,1.,1.)),f.x),f.y),f.z);
}
float archiveFBM(vec3 p) {
  float n=0.0, w=0.52;
  for(int i=0; i<4; i++) { n+=archiveNoise(p)*w; p=p*2.05+10.3; w*=0.48; }
  return n;
}
`;

function tintSurface(material,kind,worldFrequency,contrast) {
  if (!material || !material.isMeshStandardMaterial) return;
  material.onBeforeCompile = shader => {
    const anchor = '#include <common>';
    shader.vertexShader=shader.vertexShader.replace(anchor,anchor+`
varying vec3 vArchiveWorldPosition;
`);
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`
#include <worldpos_vertex>
vArchiveWorldPosition = (modelMatrix*vec4(position,1.0)).xyz;
`);
    shader.fragmentShader=shader.fragmentShader.replace(anchor,anchor+`
varying vec3 vArchiveWorldPosition;
${GLSL_NOISE}
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
#include <color_fragment>
vec3 archived = vArchiveWorldPosition * ${worldFrequency.toFixed(5)};
float archiveMottle = archiveFBM(archived);
float archiveFine = archiveNoise(archived*9.3);
float archiveWear = archiveNoise(archived*0.16+vec3(6.9,0.4,10.1));
float archiveFactor = 0.78 + archiveMottle*0.45 + (archiveFine-0.5)*${contrast.toFixed(3)};
${kind==='grass'? `float grassStripe=0.03*sin(vArchiveWorldPosition.x*0.19+archiveWear*7.0);
diffuseColor.rgb *= vec3(archiveFactor*0.89+grassStripe,archiveFactor+grassStripe,archiveFactor*0.86);
`:kind==='stone'? `float cracks=smoothstep(0.93,0.98,archiveFine)*0.09;
diffuseColor.rgb *= (archiveFactor-cracks)*(0.88+archiveWear*0.23);
`:kind==='gravel'? `float aggregate=smoothstep(0.65,0.92,archiveFine)*0.18;
diffuseColor.rgb *= archiveFactor+aggregate;
`: `diffuseColor.rgb *= archiveFactor;`}
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
#include <roughnessmap_fragment>
roughnessFactor=clamp(roughnessFactor+(archiveFine-0.5)*0.18,0.12,1.0);
`);
  };
  material.customProgramCacheKey=()=>`archive-${kind}-${worldFrequency}-${contrast}-v1`;
  material.needsUpdate=true;
}

export function installSydenhamShaders(THREE,palette) {
  // Each material receives compiled GLSL, not another repeated texture lookup.
  for (const [name,kind,freq,contrast] of [
    ['green','grass',0.042,0.15],
    ['hedge','grass',0.12,0.19],
    ['pathway','gravel',0.10,0.18],
    ['base','stone',0.09,0.11],
    ['pale','stone',0.12,0.13],
    ['brick','stone',0.17,0.23],
    ['tower','stone',0.085,0.16],
    ['cornice','stone',0.18,0.08],
    ['wood','wood',0.13,0.15],
    ['leaf1','grass',0.10,0.22],
    ['leaf2','grass',0.11,0.24],
    ['leaf3','grass',0.10,0.19]
  ]) tintSurface(palette[name],kind,freq,contrast);

  const time={value:0};
  const water=new THREE.MeshPhysicalMaterial({
    color:0x688c93,metalness:0.05,roughness:0.075,
    clearcoat:1,clearcoatRoughness:0.075,envMapIntensity:1.55,
    transparent:false,side:THREE.DoubleSide
  });
  water.onBeforeCompile=shader=>{
    shader.uniforms.uArchiveTime=time;
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`
#include <common>
varying vec3 vArchiveWorldPosition;
`);
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>',`
#include <worldpos_vertex>
vArchiveWorldPosition=(modelMatrix*vec4(position,1.0)).xyz;
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`
#include <common>
uniform float uArchiveTime;
varying vec3 vArchiveWorldPosition;
${GLSL_NOISE}
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
#include <color_fragment>
vec2 basin=vArchiveWorldPosition.xz;
float waveA=sin(basin.x*0.105+basin.y*0.069+uArchiveTime*0.35);
float waveB=sin(basin.x*0.19-basin.y*0.13-uArchiveTime*0.42);
float waveC=archiveFBM(vec3(basin*0.05,uArchiveTime*0.09));
float ripple=0.5+0.5*(0.46*waveA+0.27*waveB+0.27*(waveC*2.0-1.0));
float glint=smoothstep(0.74,0.98,ripple);
vec3 deep=vec3(0.14,0.27,0.31),sky=vec3(0.53,0.69,0.72);
diffuseColor.rgb=mix(deep,sky,clamp(0.27+0.57*ripple,0.0,1.0));
diffuseColor.rgb+=glint*vec3(0.17,0.17,0.16);
`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
#include <roughnessmap_fragment>
roughnessFactor=clamp(0.07+0.065*archiveNoise(vArchiveWorldPosition*0.13),0.06,0.17);
`);
  };
  water.customProgramCacheKey=()=> 'sydenham-water-r180-v1';
  return {water,time};
}

// Instanced botanical geometry. A fixed seed makes historic comparisons repeatable.
function randomGenerator(seed) {
  return ()=>{seed=(seed+0x6d2b79f5)|0;let v=seed;v=Math.imul(v^(v>>>15),v|1);
    v^=v+Math.imul(v^(v>>>7),v|61);return ((v^(v>>>14))>>>0)/4294967296;};
}

function populateInstances(THREE,parent,geometry,material,poses,shadow=false) {
  if(!poses.length)return null;
  const instanced=new THREE.InstancedMesh(geometry,material,poses.length);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();
  for(let i=0;i<poses.length;i++){
    const p=poses[i];position.set(p[0],p[1],p[2]);
    quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),p[6]||0);
    scale.set(p[3],p[4],p[5]);
    matrix.compose(position,quaternion,scale);instanced.setMatrixAt(i,matrix);
  }
  instanced.instanceMatrix.needsUpdate=true;
  instanced.castShadow=shadow;instanced.receiveShadow=false;
  instanced.frustumCulled=false;
  parent.add(instanced);return instanced;
}

export function plantDetailedPark(THREE,grounds,palette,{quality='high'}={}) {
  const r=randomGenerator(18541866);
  const treeBark=[];
  const canopies=[[],[],[]];
  const twigs=[];
  const shrubs=[[],[],[]];
  const flowerHeads=[[],[],[]];
  const treeCount=quality==='high'?70:34;
  // Irregular broadleaf silhouettes with layered boughs and variable height;
  // garden planting is interpretive, not a reconstructed 1900 planting survey.
  for(let side of [-1,1])for(let i=0;i<treeCount/2;i++){
    const x=side*(1180+(i%4)*84+(r()-.5)*110);
    const z=165+i*43+(r()-.5)*75;
    if(z>1420)continue;
    const h=24+r()*23;
    treeBark.push([x,h*.37-5,z,2.6+r()*1.7,h*.74,2.6+r()*1.5,r()*6.28]);
    const tiers=13+Math.floor(r()*9);
    for(let j=0;j<tiers;j++){
      const angle=r()*Math.PI*2,rad=Math.sqrt(r())*(13+h*.18);
      const px=x+Math.cos(angle)*rad,pz=z+Math.sin(angle)*rad;
      const py=h*.65+3+r()*(h*.54);
      const size=7+r()*10;
      canopies[j%3].push([px,py,pz,size,size*(0.8+r()*.8),size,r()*6.28]);
      if(j%4===0)twigs.push([x+(px-x)*.53,h*.6+(py-h*.6)*.44-3,z+(pz-z)*.53,.7,9+r()*8,.8,r()*6.28]);
    }
  }
  // Dense planted parterre edges, using subtle variation rather than perfect rows.
  const n=quality==='high'?4900:1800;
  for(let i=0;i<n;i++){
    const band=i%4;
    const row=band<2?580:720;
    const x=-1030+r()*2060;
    const z=row+(band%2?27:-28)+(r()-.5)*49;
    const nearPool=Math.hypot(x+410,z-895)<200;
    const nearStairs=Math.abs(x)<88&&z>365&&z<610;
    if(nearPool||nearStairs)continue;
    const size=1.6+r()*3.5;
    const idx=Math.floor(r()*3);
    shrubs[idx].push([x,-0.4+size*.18,z,size,1.8+r()*2.1,size,r()*6.28]);
    if(i%5===0){
      const type=Math.floor(r()*3),d=1.0+r()*1.1;
      flowerHeads[type].push([x,1.9+r()*2.5,z,d,d,d,r()*6.28]);
    }
  }
  const trunkGeometry=new THREE.CylinderGeometry(0.9,1.15,1,7);
  const foliageGeometry=new THREE.IcosahedronGeometry(1,2);
  const twigGeometry=new THREE.CylinderGeometry(.45,.65,1,6);
  populateInstances(THREE,grounds,trunkGeometry,palette.wood,treeBark,true);
  for(let k=0;k<3;k++)populateInstances(THREE,grounds,foliageGeometry,palette['leaf'+(k+1)],canopies[k],false);
  populateInstances(THREE,grounds,twigGeometry,palette.wood,twigs,false);
  for(let k=0;k<3;k++)populateInstances(THREE,grounds,foliageGeometry,palette['leaf'+(k+1)],shrubs[k],false);
  const colors=[0xc3ab72,0xd8c4b0,0x8e8493].map(color=>new THREE.MeshStandardMaterial({color,roughness:.94}));
  for(let k=0;k<3;k++)populateInstances(THREE,grounds,new THREE.IcosahedronGeometry(1,1),colors[k],flowerHeads[k],false);
  return {trees:treeBark.length,shrubs:shrubs.reduce((a,b)=>a+b.length,0)};
}

// True turned balusters, not rectangular fence posts. Architectural detail is interpretive.
export function dressTerraces(THREE,grounds,palette) {
  const lathePoints=[
    [0,0],[2.4,0],[2.7,1.4],[1.8,2.1],[1.1,4.2],[1.9,7.0],
    [1.7,9.1],[1.15,10.5],[1.8,12.5],[2.6,13.8],[2.5,15]
  ].map(([r,y])=>new THREE.Vector2(r,y));
  const geometry=new THREE.LatheGeometry(lathePoints,12);
  const placements=[];
  for(const z of [210,430])for(let x=-1120;x<=1120;x+=13){
    if(Math.abs(x)<84&&z===430)continue;
    placements.push([x,3,z,1,1,1,0]);
  }
  populateInstances(THREE,grounds,geometry,palette.pale,placements,false);
  // Stone urns on the balustrades give the very long terrace some Victorian rhythm.
  const urnBase=new THREE.LatheGeometry([[1.5,0],[2.4,1],[4,3],[4.8,5],[3.5,8],[2,8.5],[4.2,10]].map(([x,y])=>new THREE.Vector2(x,y)),16);
  const urns=[];
  for(const z of [210,430])for(let x=-1040;x<=1040;x+=104)urns.push([x,17,z,1,1,1,0]);
  populateInstances(THREE,grounds,urnBase,palette.pale,urns,false);
}
