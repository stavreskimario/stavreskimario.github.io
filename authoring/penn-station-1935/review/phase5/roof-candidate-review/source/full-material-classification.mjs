// Actual captured V3 room, all primitives/materials; no target-material filter.
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readGlb} from '../../../penn-station-reconstruction/penn-station-1935/asset_io.mjs';
import {accessors,worldNodes} from '../../../penn-station-reconstruction/tests/helpers/penn-decoded-geometry.mjs';
const work='/Users/stavreskimario/Desktop/penn-station-work',here=work+'/phase5-materials/guided-normal-v3',require=createRequire(work+'/tools/package.json');
const T=require('three'),{computeBoundsTree,acceleratedRaycast}=require('three-mesh-bvh');
const source=work+'/phase5-materials/merged-runtime-v3/model-waiting-room.glb',bytes=await readFile(source),model=readGlb(bytes),read=accessors(model);
const group=new T.Group(),materials=[];
for(const {index:nodeIndex,matrix}of worldNodes(model.json)){
 const node=model.json.nodes[nodeIndex];if(node.mesh===undefined)continue;
 for(const [primitiveIndex,primitive]of model.json.meshes[node.mesh].primitives.entries()){
  const material=model.json.materials[primitive.material],p=model.json.accessors[primitive.attributes.POSITION],position=read(primitive.attributes.POSITION);
  const info=material.occlusionTexture,channel=info?.extensions?.KHR_texture_transform?.texCoord??info?.texCoord??0,uvIndex=primitive.attributes[`TEXCOORD_${channel}`],uv=uvIndex===undefined?null:read(uvIndex);
  const positions=new Float32Array(p.count*3),uvs=new Float32Array(p.count*2),v=new T.Vector3();
  for(let i=0;i<p.count;i++){
   v.fromArray(position(i)).applyMatrix4(matrix);v.y-=4.2672;v.toArray(positions,i*3);if(uv)uvs.set(uv(i),i*2);
  }
  const indices=new Uint32Array(model.json.accessors[primitive.indices].count),index=read(primitive.indices);for(let i=0;i<indices.length;i++)indices[i]=index(i)[0];
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('uv',new T.BufferAttribute(uvs,2));geometry.setIndex(new T.BufferAttribute(indices,1));computeBoundsTree.call(geometry,{indirect:true});
  const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:material.doubleSided?T.DoubleSide:T.FrontSide}));mesh.raycast=acceleratedRaycast;
  mesh.userData={node:nodeIndex,primitive:primitiveIndex,material:material.name,skyFile:material.extras?.sky_illumination||null,atlasChannel:channel,
    literalControlReplaced:material.name.startsWith('PaleVaultPlaster'),hasAo:Boolean(material.occlusionTexture),hasNormal:Boolean(material.normalTexture)};
  group.add(mesh);materials.push(mesh.userData);
 }
}
group.updateMatrixWorld(true);
const browser=JSON.parse(await readFile(here+'/browser-comparison/diagnostic-report.json','utf8')),reference=browser.variants.find(v=>v.name==='v3-normal-guided'),cameraInfo=reference.camera;
const camera=new T.PerspectiveCamera(cameraInfo.fov,1280/816,.1,1000);camera.position.fromArray(cameraInfo.position);camera.quaternion.fromArray(cameraInfo.quaternion);camera.updateMatrixWorld(true);
const windows=[{label:'upper-left-coffer-band',centre:[590,150]},{label:'central-coffer-band',centre:[635,205]},
 {label:'rib-intersection-window',centre:[645,205]},{label:'lower-central-coffer-band',centre:[635,230]},
 {label:'left-haunch-coffer-band',centre:[510,330]}],records=[];
for(const window of windows){
 const samples=[],counts={};
 for(let y=-6;y<=6;y++)for(let x=-6;x<=6;x++){
  const screen=[window.centre[0]+x*.5,window.centre[1]+y*.5],ray=new T.Raycaster();ray.firstHitOnly=false;
  ray.setFromCamera(new T.Vector2(screen[0]/1280*2-1,-((screen[1]-84)/816*2-1)),camera);const hits=ray.intersectObject(group,true);if(!hits.length){counts.noHit=(counts.noHit||0)+1;continue;}
  const hit=hits[0],data=hit.object.userData;counts[data.material]=(counts[data.material]||0)+1;
  samples.push({screen,...data,world:hit.point.toArray(),uv:hit.uv?.toArray(),distance:hit.distance,face:hit.faceIndex,
    nextDifferentMaterial:hits.find(h=>h.object.userData.material!==data.material)?.object.userData.material||null});
 }
 records.push({...window,counts,samples});
}
const request=browser.requests.find(r=>r.file===source),sha=createHash('sha256').update(bytes).digest('hex');if(request&&request.sha256!==sha)throw new Error('Captured model hash changed');
const report={scope:'CPU reconstruction of the exact captured optimized V3 room: all opaque/window materials, actual material culling, nearest triangle across every room primitive; native halfCSS-pixel grid over5noisy windows',
 source,sourceSha256:sha,capturedResponseHashMatches:Boolean(request&&request.sha256===sha),camera:cameraInfo,materials,windows:records,
 attribution:'Only PaleVaultPlaster was changed to MeshBasic in previous literal controls. Travertine and all other material names remained standard-lit.'};
await writeFile(here+'/full-visible-materials.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(records.map(({label,centre,counts})=>({label,centre,counts})),null,2));
