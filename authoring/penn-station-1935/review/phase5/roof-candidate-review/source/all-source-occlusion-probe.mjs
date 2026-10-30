import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {readGlb} from '../../../penn-station-reconstruction/penn-station-1935/asset_io.mjs';
import {accessors,worldNodes} from '../../../penn-station-reconstruction/tests/helpers/penn-decoded-geometry.mjs';
const work='/Users/stavreskimario/Desktop/penn-station-work',here=work+'/phase5-materials/guided-normal-v3';
const require=createRequire(work+'/tools/package.json'),T=require('three'),{computeBoundsTree,acceleratedRaycast}=require('three-mesh-bvh');
const classification=JSON.parse(await readFile(here+'/visible-zero-classification.json','utf8'));
const chosen=classification.darkestSamplesWithLitPairs.slice(0,3),points=[];
for(const [i,p]of chosen.entries()){
 points.push({label:`zero-${i}`,world:p.world,normal:p.geometricNormal,radiance:p.rawBilinearLinearMean,face:p.faceIndex});
 const lit=p.nearbyLitComparison;points.push({label:`lit-${i}`,world:lit.world,normal:p.geometricNormal,radiance:lit.rawBilinearLinearMean,face:lit.faceIndex});
}
const targetSamples=JSON.parse(await readFile(here+'/visible-radiance-samples.json','utf8')).filter(p=>p.region[0]===645&&p.region[1]===205);
const region=new T.Box3().setFromPoints([...points,...targetSamples].map(p=>new T.Vector3().fromArray(p.world))).expandByScalar(2.01);
const sources=[
 ['waiting-room',work+'/phase5-materials/normal-source/model-waiting-room.glb',-4.2672,0],
 ['exterior',work+'/phase4-core-final/model-exterior.glb',0,0],
 ['concourse',work+'/phase4-core-floor-v3-ready/model-concourse.glb',-4.2672,0],
 ['platform',work+'/phase4-lighting-occluders/model-platform.glb',-4.2672,0],
 ['trains',work+'/phase4-lighting-occluders/model-trains.glb',-13.154025,8.690045261],
 ['context',work+'/phase4-context/model-context.glb',0,0],
];
const scene=new T.Group(),receipts=[];
for(const [zone,file,y,z]of sources){
 const bytes=await readFile(file),model=readGlb(bytes),read=accessors(model),receipt={zone,file,sha256:createHash('sha256').update(bytes).digest('hex'),worldOffset:[0,y,z],nodes:0,primitivesTested:0,primitiveInstancesIntersectingRegion:0,trianglesRetained:0};
 for(const {index:nodeIndex,matrix:nodeWorld}of worldNodes(model.json)){
  const node=model.json.nodes[nodeIndex];if(node.mesh===undefined)continue;receipt.nodes++;
  const attrs=node.extensions?.EXT_mesh_gpu_instancing?.attributes,instanceCount=attrs?model.json.accessors[Object.values(attrs)[0]].count:1;
  for(let instance=0;instance<instanceCount;instance++){
   const local=attrs?new T.Matrix4().compose(new T.Vector3().fromArray(attrs.TRANSLATION===undefined?[0,0,0]:read(attrs.TRANSLATION)(instance)),new T.Quaternion().fromArray(attrs.ROTATION===undefined?[0,0,0,1]:read(attrs.ROTATION)(instance)),new T.Vector3().fromArray(attrs.SCALE===undefined?[1,1,1]:read(attrs.SCALE)(instance))):new T.Matrix4();
   const matrix=new T.Matrix4().makeTranslation(0,y,z).multiply(nodeWorld).multiply(local);
   for(const [primitiveIndex,primitive]of model.json.meshes[node.mesh].primitives.entries()){
    receipt.primitivesTested++;const positionAccessor=model.json.accessors[primitive.attributes.POSITION];
    const box=new T.Box3(new T.Vector3().fromArray(positionAccessor.min),new T.Vector3().fromArray(positionAccessor.max)).applyMatrix4(matrix);
    if(!box.intersectsBox(region))continue;receipt.primitiveInstancesIntersectingRegion++;
    const readPosition=read(primitive.attributes.POSITION),position=new Float64Array(positionAccessor.count*3),v=new T.Vector3();
    for(let i=0;i<positionAccessor.count;i++)v.fromArray(readPosition(i)).applyMatrix4(matrix).toArray(position,i*3);
    const readIndex=primitive.indices===undefined?i=>[i]:read(primitive.indices),count=model.json.accessors[primitive.indices??primitive.attributes.POSITION].count,kept=[];
    const pa=new T.Vector3(),pb=new T.Vector3(),pc=new T.Vector3(),triangleBox=new T.Box3();
    for(let i=0;i<count;i+=3){
     const a=readIndex(i)[0],b=readIndex(i+1)[0],c=readIndex(i+2)[0];pa.fromArray(position,a*3);pb.fromArray(position,b*3);pc.fromArray(position,c*3);
     triangleBox.setFromPoints([pa,pb,pc]);if(!triangleBox.intersectsBox(region))continue;
     // Keep full straddling triangles. Only the conservative region broad phase
     // removes data; every two-metre ray remains entirely within this region.
     if(matrix.determinant()<0)kept.push(...pa.toArray(),...pc.toArray(),...pb.toArray());else kept.push(...pa.toArray(),...pb.toArray(),...pc.toArray());
    }
    if(!kept.length)continue;receipt.trianglesRetained+=kept.length/9;
    const materialName=model.json.materials[primitive.material]?.name||'',lower=materialName.toLowerCase();
    const bakeTransparent=(lower.includes('glass')||lower.includes('glazing')||lower.includes('window'))&&!lower.startsWith('opalcandelabra');
    const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(kept),3));computeBoundsTree.call(geometry);
    const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.raycast=acceleratedRaycast;mesh.userData={zone,node:nodeIndex,primitive:primitiveIndex,instance,material:materialName,bakeTransparent};scene.add(mesh);
   }
  }
 }
 receipts.push(receipt);console.log('REGISTERED',zone,receipt.trianglesRetained);
}
scene.updateMatrixWorld(true);
function trace(point,direction,offset=1e-5){
 const origin=new T.Vector3().fromArray(point).addScaledVector(direction,offset),ray=new T.Raycaster(origin,direction,0,2);ray.firstHitOnly=false;
 const hits=ray.intersectObject(scene,true).filter(hit=>hit.distance>1e-6).map(hit=>({distanceMetres:hit.distance,...hit.object.userData,normalDotRay:hit.face.normal.dot(direction),point:hit.point.toArray()}));
 return {firstAny:hits[0]||null,firstOpaque:hits.find(hit=>!hit.bakeTransparent)||null,firstHits:hits.slice(0,5)};
}
const results=[];
for(const p of points){
 const normal=new T.Vector3().fromArray(p.normal).normalize(),axis=Math.abs(normal.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0),u=new T.Vector3().crossVectors(normal,axis).normalize(),v=new T.Vector3().crossVectors(normal,u).normalize();
 const probes=[{label:'geometricFront',direction:normal},{label:'geometricBack',direction:normal.clone().negate()}];
 for(const polar of [30,60,80])for(let azimuth=0;azimuth<360;azimuth+=45){
  const a=polar*Math.PI/180,b=azimuth*Math.PI/180;probes.push({label:`front-${polar}-${azimuth}`,direction:normal.clone().multiplyScalar(Math.cos(a)).addScaledVector(u,Math.sin(a)*Math.cos(b)).addScaledVector(v,Math.sin(a)*Math.sin(b))});
 }
 const directions=probes.map(probe=>({label:probe.label,direction:probe.direction.toArray(),...trace(p.world,probe.direction)}));
 const towardCamera=new T.Vector3().fromArray(classification.camera.position).sub(new T.Vector3().fromArray(p.world)).normalize(),cameraSegmentProbe=trace(p.world,towardCamera);
 results.push({...p,cameraSegmentProbe,frontHemisphereOpaqueHits:directions.filter(probe=>probe.label!=='geometricBack'&&probe.firstOpaque).length,probes:directions});
}
const targetVisibility=targetSamples.map(p=>{const direction=new T.Vector3().fromArray(classification.camera.position).sub(new T.Vector3().fromArray(p.world)).normalize();return {screen:p.screen,rawBilinearLinearMean:p.rawBilinearLinearMean,firstLocalOpaqueTowardCamera:trace(p.world,direction).firstOpaque};});
const visibilityCounts={samples:targetVisibility.length,zeroOrNearZero:targetVisibility.filter(p=>p.rawBilinearLinearMean<=.0001).length,nearZeroOccluded:targetVisibility.filter(p=>p.rawBilinearLinearMean<=.0001&&p.firstLocalOpaqueTowardCamera).length,nearZeroWithoutLocalOccluder:targetVisibility.filter(p=>p.rawBilinearLinearMean<=.0001&&!p.firstLocalOpaqueTowardCamera).length,litWithoutLocalOccluder:targetVisibility.filter(p=>p.rawBilinearLinearMean>.02&&!p.firstLocalOpaqueTowardCamera).length};
const report={targetWindowVisibilityCounts:visibilityCounts,targetWindowVisibility:targetVisibility,scope:'CPU-only read-only all registered source occluders and all primary meshes; full source triangles conservatively retained if their world AABB intersects complete2m probe region',registration:'Same bake offsets expressed in browserWorld; Main0 isWorldY+4.2672. Train BlenderY-8.690045261 becomesglTFWorldZ+8.690045261.',maximumRayMetres:2,rayOriginOffsetMetres:1e-5,region:[region.min.toArray(),region.max.toArray()],sources:receipts,results,limitations:'Short first-hit probes can identify nearby opaque ribbons/enclosures, but do not compute global sky visibility or prove absence of all long-range shadowing. First-hit exit normals alone are not a closed-solid parity test.'};
await writeFile(here+'/all-source-occlusion.json',JSON.stringify(report,null,2)+'\n');console.log('TARGET_VISIBILITY',visibilityCounts);console.log('ALL_SOURCE_PROBES_READY',results.map(r=>[r.label,r.frontHemisphereOpaqueHits,r.probes[0].firstOpaque,r.probes[1].firstOpaque]));
