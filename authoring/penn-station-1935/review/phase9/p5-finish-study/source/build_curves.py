"""CPU-only west-P5 lower-haunch/handrail appearance study from frozen flatv2.

Only6declared handrail meshes change. Structural I-beams, girders, anchors,
treads, landing tops and every other source component remain exact. The two
haunches are additive visible-outline interpretations; no fabrication claim.
"""
from pathlib import Path
import argparse,ast,copy,hashlib,json,math,struct,time
from collections import Counter,defaultdict
import bpy,numpy as np
from mathutils import Vector

ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--flat-glb',type=Path,required=True);ap.add_argument('--flat-blend',type=Path,required=True);ap.add_argument('--flat-builder',type=Path,required=True);ap.add_argument('--feasibility',type=Path,required=True);ap.add_argument('--source-proof',type=Path,required=True);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--expected-frozen-manifest',type=Path,required=True);ap.add_argument('--flat-reference-manifest',type=Path,required=True);a=ap.parse_args();assert not a.out.exists();a.out.mkdir(parents=True)
H=lambda b:hashlib.sha256(b).hexdigest();start_time=time.monotonic();flat_bytes=a.flat_glb.read_bytes();assert H(flat_bytes)=='ba851616344808c23d2fb1868f29c30f8cfbe0ca7b4f5645d5f64677700f610f';assert a.flat_blend.is_file();expected_curve=json.loads(a.expected_frozen_manifest.read_text());expected_flat=json.loads(a.flat_reference_manifest.read_text());f=json.loads(a.feasibility.read_text());proof=json.loads(a.source_proof.read_text());stair=next(s for s in proof['stairs']if s['ordinal']==5 and s['side']=='west')
# Exact reviewed helper definitions; none of its top-level import/build work runs.
helper_names={'parse_glb','matrix','vec','gltf_vec','value_array','source_state','safe_props','material_state','signed_volume','geometric_components','contact'}
for node in ast.parse(a.flat_builder.read_text()).body:
 if isinstance(node,ast.FunctionDef)and node.name in helper_names:exec(compile(ast.Module(body=[node],type_ignores=[]),str(a.flat_builder),'exec'))
j,binary=parse_glb(flat_bytes);widths={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4};types={5123:'<u2',5125:'<u4',5126:'<f4'}
def acc(index):
 row=j['accessors'][index];v=j['bufferViews'][row['bufferView']];dtype=np.dtype(types[row['componentType']]);w=widths[row['type']];assert not row.get('normalized');return np.ndarray((row['count'],w),dtype,binary,v.get('byteOffset',0)+row.get('byteOffset',0),strides=(v.get('byteStride',w*dtype.itemsize),dtype.itemsize))
node_by_name={n['name']:n for n in j['nodes']}
def vertices(name):
 node=node_by_name[name];assert not any(k in node for k in['matrix','translation','rotation','scale']);return np.unique(np.concatenate([acc(p['attributes']['POSITION'])for p in j['meshes'][node['mesh']]['primitives']]),axis=0).astype(float)
owned=[]
for stem in['Arrival row5 west west flight1 rounded top rail','Arrival row5 west west flight2 rounded top rail','Arrival row5 west Arrival intermediate landing top rail']:
 owned += [stem,stem+'.001']
assert len(owned)==6
bpy.context.preferences.filepaths.use_scripts_auto_execute=False;bpy.ops.wm.open_mainfile(filepath=str(a.flat_blend));scene=bpy.context.scene;source_objects=[o for o in scene.objects if o.name not in owned];before={o.name:source_state(o)for o in source_objects};source_materials={m for o in scene.objects if o.type=='MESH'for m in o.data.materials if m};material_before={m.name:material_state(m)for m in source_materials};assert len(source_objects)==4055;assert before==expected_curve['nonownedImportedSourceHashes'];assert material_before==expected_flat['importedSourceMaterialHashes']
collection=bpy.data.collections.new('P5 west curves — inferred lower outline and rail bends');scene.collection.children.link(collection)
# Editable Bezier spine + Geometry Nodes Circle→CurveToMesh. Only owned curves
# use this graph; untouched source meshes are never converted or remeshed.
nodegroup=bpy.data.node_groups.new('P5 west editable circular rail profile','GeometryNodeTree');nodegroup.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry');nodegroup.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry');nodes=nodegroup.nodes;links=nodegroup.links;inp=nodes.new('NodeGroupInput');profile=nodes.new('GeometryNodeCurvePrimitiveCircle');profile.inputs['Resolution'].default_value=32;profile.inputs['Radius'].default_value=.026;to_mesh=nodes.new('GeometryNodeCurveToMesh');to_mesh.inputs['Fill Caps'].default_value=True;output=nodes.new('NodeGroupOutput');links.new(inp.outputs['Geometry'],to_mesh.inputs['Curve']);links.new(profile.outputs['Curve'],to_mesh.inputs['Profile Curve']);links.new(to_mesh.outputs['Mesh'],output.inputs['Geometry'])
guard=bpy.data.materials['PaintedStructuralIronArrivalsGuard'];steel=bpy.data.materials['PaintedStructuralIronArrivalsStructure'];new_curves=[];curve_records=[];haunches=[];haunch_records=[]
set_material=nodes.new('GeometryNodeSetMaterial');set_material.inputs['Material'].default_value=guard;links.remove(next(l for l in links if l.to_node==output));links.new(to_mesh.outputs['Mesh'],set_material.inputs['Geometry']);links.new(set_material.outputs['Geometry'],output.inputs['Geometry'])
evaluated_surface_materials={}

def split_curve(control):
 p=np.asarray(control,float);q=(p[:-1]+p[1:])/2;r=(q[:-1]+q[1:])/2;s=(r[0]+r[1])/2;return np.array([p[0],q[0],r[0],s]),np.array([s,r[1],q[2],p[3]])
def straight(p,q,left_length,right_length):
 u=(q-p)/np.linalg.norm(q-p);return np.array([p,p+u*left_length,q-u*right_length,q])
arcA=np.array(f['railFillets'][0]['arcCubicControlsMain0']);arcB=np.array(f['railFillets'][1]['arcCubicControlsMain0']);a1,a2=split_curve(arcA);b1,b2=split_curve(arcB);head=np.array([stair['headX'],-3.2004+1.06]);foot=np.array([stair['footX'],-7.718425+1.06]);ha=np.linalg.norm(a1[1]-a1[0]);hb=np.linalg.norm(b2[3]-b2[2]);whole=[straight(head,a1[0],ha,ha),a1,a2,straight(a2[3],b1[0],ha,np.linalg.norm(b1[1]-b1[0])),b1,b2,straight(b2[3],foot,hb,hb)]
for left,right in zip(whole,whole[1:]):
 assert np.linalg.norm(left[3]-right[0])<1e-12
 assert np.linalg.norm((left[3]-left[2])-(right[1]-right[0]))<1e-12,'Analytic C1 derivative mismatch'
# Each source rail retains its original object identity. Split at the middle
# of the inferred arcs so the6owned parts also meet with matching tangents.
parts={'flight1':whole[:2],'landing':whole[2:5],'flight2':whole[5:]}
for suffix in['','.001']:
 for kind,stem in[('flight1','Arrival row5 west west flight1 rounded top rail'),('landing','Arrival row5 west Arrival intermediate landing top rail'),('flight2','Arrival row5 west west flight2 rounded top rail')]:
  name=stem+suffix;old=bpy.data.objects[name];old_points=vertices(name);z=float((old_points[:,2].min()+old_points[:,2].max())/2);properties={k:safe_props(old[k])for k in old.keys()};old_matrix=old.matrix_world.copy();assert np.max(np.abs(np.array(old_matrix)-np.eye(4)))<1e-12
  # Delete only this explicitly owned object from the NEW study scene.
  bpy.data.objects.remove(old,do_unlink=True)
  data=bpy.data.curves.new(name+' editable spine','CURVE');data.dimensions='3D';data.resolution_u=20;spline=data.splines.new('BEZIER');segments=parts[kind];spline.bezier_points.add(len(segments));points=[seg[0]for seg in segments]+[segments[-1][3]]
  for i,(bp,p)in enumerate(zip(spline.bezier_points,points)):
   bp.co=vec([p[0],p[1],z]);bp.handle_left_type=bp.handle_right_type='FREE'
   lp=segments[i-1][2]if i else p-(segments[0][1]-p);rp=segments[i][1]if i<len(segments)else p+(p-segments[-1][2]);bp.handle_left=vec([lp[0],lp[1],z]);bp.handle_right=vec([rp[0],rp[1],z]);bp.radius=1
  obj=bpy.data.objects.new(name,data);collection.objects.link(obj);data.materials.append(guard);mod=obj.modifiers.new('Editable Curve to Mesh •26mm profile','NODES');mod.node_group=nodegroup
  for k,v in properties.items():obj[k]=v
  obj['curvature_study']='Inferred150mm nominal bend radius; primary photo family, not authenticatedP5fabrication.';obj['owned_source_node']=name;new_curves.append(obj)
  curve_records.append({'name':name,'ownedOriginalNodeIndex':j['nodes'].index(node_by_name[name]),'ownedOriginalMeshIndex':node_by_name[name]['mesh'],'oldMeshJsonSha256':H(json.dumps(j['meshes'][node_by_name[name]['mesh']],sort_keys=True).encode()),'kind':kind,'zMain0':z,'profileRadiusM':.026,'profileResolution':32,'inferredBendRadiusM':.15,'segmentsMain0':[np.column_stack([seg[:,0],seg[:,1],np.full(4,z)]).tolist()for seg in segments],'sourceOwnership':'Only this top-rail mesh definition may change; node/matrix/material identity and all protected anchors retained.'})
# Lower haunch: loft a filled visible-outline cheek below the unchanged lower
# flange. Its top keeps a real8mm contact strip on the existing flange; the
# outward plane eases to the unchanged landing-girder end using a C1quintic.
coef=np.array(f['lowerHaunch']['cubicHermiteYPolynomialOverT']);x0=f['lowerHaunch']['xStart'];L=f['lowerHaunch']['xLength'];x1=x0+L;m=f['lowerHaunch']['startSlope'];c=f['lowerHaunch']['startMain0'][1]-m*x0
N=48
for side_suffix in['','.001']:
 host_name='Arrival row5 west west flight2 steel stringer'+side_suffix;p=vertices(host_name);lat=1 if p[:,2].mean()>stair['centerZ']else-1;label='plus'if lat>0 else'minus';outer0=float(p[:,2].max()if lat>0 else p[:,2].min());inner=float(np.float32(outer0-lat*.008));girder_name='Arrival row5 west west landing bearing girder.001';g=vertices(girder_name);outer1=float(g[:,2].max()if lat>0 else g[:,2].min());assert abs(x1-g[:,0].min())<1e-10
 origin=np.array([float(np.float32((x0+x1)/2)),float(np.float32(f['lowerHaunch']['startMain0'][1])),float(np.float32((outer0+outer1)/2))]);verts=[];lookup={};rings=[]
 def vid(point):
  key=tuple(float(np.float32(v))for v in np.array(point)-origin)
  if key not in lookup:lookup[key]=len(verts);verts.append(key)
  return lookup[key]
 for k in range(N+1):
  t=k/N;x=x0+L*t;top=m*x+c;bottom=float(sum(coef[i]*t**i for i in range(4)));smooth=t*t*t*(10-15*t+6*t*t);outer=outer0+(outer1-outer0)*smooth
  assert bottom<=top+1e-10
  rings.append([vid([x,top,inner]),vid([x,top,outer]),vid([x,bottom,outer]),vid([x,bottom,inner])])
 faces=[]
 def tri(a,b,c):
  if len({a,b,c})==3 and np.linalg.norm(np.cross(np.array(verts[b])-verts[a],np.array(verts[c])-verts[a]))>1e-12:faces.append((a,b,c))
 for aRing,bRing in zip(rings,rings[1:]):
  for i in range(4):
   a0,a1,b0,b1=aRing[i],aRing[(i+1)%4],bRing[i],bRing[(i+1)%4];tri(a0,a1,b1);tri(a0,b1,b0)
 for ring,reverse in[(rings[0],True),(rings[-1],False)]:
  for i in range(1,3):
   q=(ring[0],ring[i],ring[i+1]);tri(*(tuple(reversed(q))if reverse else q))
 if signed_volume(verts,faces)<0:faces=[tuple(reversed(q))for q in faces]
 comps=geometric_components(verts,faces);assert len(comps)==1
 mesh=bpy.data.meshes.new('P5 west lower haunch '+label+' mesh');mesh.from_pydata([tuple(vec(v))for v in verts],[],faces);mesh.update();mesh.materials.append(steel)
 for poly in mesh.polygons:poly.use_smooth=False
 obj=bpy.data.objects.new('P5Curve west lower haunch side-'+label,mesh);collection.objects.link(obj);obj.location=vec(origin);obj['curvature_study']='C1lower-outline appearance volume; variable lateral loft8..68mm, not authenticated fabrication.';obj['owned_source_node']=obj.name;haunches.append(obj)
 original_out=outer0;top_poly=[[x0,m*x0+c,inner],[x1,m*x1+c,inner],[x1,m*x1+c,original_out],[x0,m*x0+c,original_out]];end_poly=[[x1,float(coef.sum()),inner],[x1,m*x1+c,inner],[x1,m*x1+c,outer1],[x1,float(coef.sum()),outer1]]
 haunch_records.append({'name':obj.name,'hosts':[host_name,girder_name],'componentDetails':comps,'positiveVolumeM3':comps[0]['volumeM3'],'samples':N,'bottomCurve':f['lowerHaunch'],'outerZStart':outer0,'outerZEnd':outer1,'innerZ':inner,'localOriginMain0':origin.tolist(),'coordinateEncoding':'LocalFloat32 mesh + explicit new-node translation; avoids large-world-coordinate short-triangle normal jitter.','sourceContactRules':[contact(host_name,'haunch top8mm strip to unchanged lower flange',top_poly,[-m,1,0]),contact(girder_name,'haunch end to unchanged landing-girder side',end_poly,[1,0,0])],'interpretation':'Additive visible lower cheek with variable lateral loft; not a bent primary member or an8mmconstant sheet fabrication claim.'})
assert len(new_curves)==6 and len(haunches)==2
bpy.context.view_layer.update();assert before=={o.name:source_state(o)for o in source_objects};assert material_before=={m.name:material_state(m)for m in source_materials}
scene.name='WEST P5 lower haunch and C1rails — qualified study';scene.render.engine='BLENDER_WORKBENCH';bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(a.out/'editable-curves.blend'),compress=True)
# Owned evaluated meshes receive fresh architecturalUV0 and side-only smooth
# shading; this does not touch any original source mesh or normal/UV buffer.
new_objects=new_curves+haunches;temps=[];deps=bpy.context.evaluated_depsgraph_get()
for obj in new_objects:
 evaluated=obj.evaluated_get(deps);mesh=bpy.data.meshes.new_from_object(evaluated,preserve_all_data_layers=True,depsgraph=deps);mesh.name=obj.name+' evaluated mesh';expected_material=guard if obj in new_curves else steel;surface_names=sorted({mesh.materials[p.material_index].name if p.material_index<len(mesh.materials)and mesh.materials[p.material_index]else None for p in mesh.polygons});assert surface_names==[expected_material.name],('Evaluated geometry has incorrect actual surface material',obj.name,surface_names);evaluated_surface_materials[obj.name]=surface_names;mesh.materials.clear();mesh.materials.append(expected_material)
 if not mesh.uv_layers:
  uv=mesh.uv_layers.new(name='ArchitecturalUV')
  for polygon in mesh.polygons:
   polygon.use_smooth=obj in new_curves and polygon.loop_total==4
   axis=max(range(3),key=lambda k:abs(polygon.normal[k]));axes=[k for k in range(3)if k!=axis]
   for li in polygon.loop_indices:
    p=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(p[axes[0]]/1.5,p[axes[1]]/1.5)
 temp=bpy.data.objects.new('EXPORT '+obj.name,mesh);temp.matrix_world=obj.matrix_world.copy();scene.collection.objects.link(temp);temp['target_node']=obj.name;temps.append(temp)
bpy.ops.object.select_all(action='DESELECT')
for obj in temps:obj.select_set(True)
bpy.context.view_layer.objects.active=temps[0];addon=a.out/'curves-haunches-addon.glb';bpy.ops.export_scene.gltf(filepath=str(addon),export_format='GLB',use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True)
for obj in temps:bpy.data.objects.remove(obj,do_unlink=True)
addon_scene=bpy.data.scenes.new('WEST P5 editable curves and lower haunches only');addon_scene.collection.children.link(collection);bpy.data.libraries.write(str(a.out/'addon-curves.blend'),{addon_scene},fake_user=True,compress=True)
assert before=={o.name:source_state(o)for o in source_objects};assert material_before=={m.name:material_state(m)for m in source_materials}
# Append new buffers; replace ONLY the6owned source mesh definitions. All
# original node definitions and all other mesh definitions remain exact.
mod,add_binary=parse_glb(addon.read_bytes());assert len(mod['nodes'])==len(mod['meshes'])==8 and len(mod['scenes'])==1;assert not mod.get('images')and not mod.get('textures');result=copy.deepcopy(j);vOffset=len(j['bufferViews']);aOffset=len(j['accessors']);material_map={i:next(k for k,m in enumerate(j['materials'])if m['name']==material['name'])for i,material in enumerate(mod['materials'])}
for view in mod['bufferViews']:
 v=copy.deepcopy(view);assert not v.get('extensions')and v.get('buffer',0)==0;v['byteOffset']=v.get('byteOffset',0)+len(binary);result['bufferViews'].append(v)
for r in mod['accessors']:
 q=copy.deepcopy(r);q['bufferView']+=vOffset;result['accessors'].append(q)
owned_indices={node_by_name[name]['mesh']for name in owned};mesh_changes=[];new_nodes=[]
for node in mod['nodes']:
 name=node['extras']['target_node'];mesh=copy.deepcopy(mod['meshes'][node['mesh']]);
 for primitive in mesh['primitives']:
  primitive['material']=material_map[primitive['material']];primitive['attributes']={k:v+aOffset for k,v in primitive['attributes'].items()};primitive['indices']+=aOffset
 if name in owned:
  index=node_by_name[name]['mesh'];mesh['name']=j['meshes'][index].get('name',name);result['meshes'][index]=mesh;mesh_changes.append({'node':name,'meshIndex':index,'beforeMeshJsonSha256':H(json.dumps(j['meshes'][index],sort_keys=True).encode()),'afterMeshJsonSha256':H(json.dumps(mesh,sort_keys=True).encode())})
 else:
  assert name in{h.name for h in haunches};mesh_index=len(result['meshes']);result['meshes'].append(mesh);new_node={'mesh':mesh_index,'name':name,'extras':{'curvature_study':'C1lower-outline appearance interpretation; no authenticated radius/fabrication.'}};new_node.update({k:copy.deepcopy(node[k])for k in['matrix','translation','rotation','scale']if k in node});new_nodes.append(len(result['nodes']));result['nodes'].append(new_node)
assert len(mesh_changes)==6 and len(new_nodes)==2
result['scenes'][result.get('scene',0)]['nodes']+=new_nodes;result['buffers'][0]['byteLength']=len(binary)+len(add_binary);encoded=json.dumps(result,separators=(',',':'),ensure_ascii=False).encode();encoded+=b' '*((-len(encoded))%4);outbin=binary+add_binary;assert len(outbin)%4==0;candidate=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(outbin))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(outbin),0x004e4942)+outbin;target=a.out/'west-p5-curved-study.glb';target.write_bytes(candidate);cj,cb=parse_glb(candidate)
for key in['bufferViews','accessors','materials','images','textures','samplers','nodes']:assert cj.get(key,[])[:len(j.get(key,[]))]==j.get(key,[])
assert all(cj['meshes'][i]==mesh for i,mesh in enumerate(j['meshes'])if i not in owned_indices);assert cb[:len(binary)]==binary
raw_surface_materials={}
for name in owned:
 material_names=sorted({cj['materials'][p['material']]['name']for p in cj['meshes'][node_by_name[name]['mesh']]['primitives']});assert material_names==[guard.name];raw_surface_materials[name]=material_names
report={'schema':1,'status':'QUALIFIED WEST P5 LOWER-HAUNCH/C1RAIL STUDY; upperhaunchheld; independentCPUreviewpending','source':{'path':str(a.flat_glb),'sha256':H(flat_bytes)},'feasibility':{'path':str(a.feasibility),'sha256':H(a.feasibility.read_bytes())},'candidate':{'path':str(target),'sha256':H(candidate),'bytes':len(candidate)},'artifacts':{p.name:{'path':str(p),'sha256':H(p.read_bytes()),'bytes':p.stat().st_size}for p in[a.out/'editable-curves.blend',a.out/'addon-curves.blend',addon]},'ownedRailChanges':mesh_changes,'curveParameters':curve_records,'haunches':haunch_records,'preservation':{'flatCandidateBinaryPrefixExact':True,'flatCandidateBinaryPrefixSha256':H(binary),'flatCandidateBinaryPrefixBytes':len(binary),'allOriginalNodeMaterialUvAccessorImageTexturePrefixesExact':True,'allNonownedMeshDefinitionsExact':True,'ownedOriginalMeshesChanged':6,'primaryIBeamMeshesChanged':0,'newObjectsAdded':2,'all4055NonownedImportedObjectStatesExact':True,'allImportedMaterialStatesExact':True,'treadLandingAnchorNewelCapGirderTrackChanges':0},'nonownedImportedSourceHashes':before,'analyticC1MaximumPositionResidualM':max(float(np.linalg.norm(left[3]-right[0]))for left,right in zip(whole,whole[1:])),'analyticC1MaximumHandleDerivativeResidualM':max(float(np.linalg.norm((left[3]-left[2])-(right[1]-right[0])))for left,right in zip(whole,whole[1:])),'evaluatedActualSurfaceMaterialNames':evaluated_surface_materials,'rawRailPrimitiveMaterialNames':raw_surface_materials,'geometryNodes':'ExplicitSetMaterial(existingguard) afterCurveToMesh;6editableBezier spine objects with sharedCircle26mm/32profile→CurveToMesh(fillcaps) modifier; evaluatedowned exports gainUV0 and side-only smooth normals.','upperHaunchHold':f['upperHaunchHold'],'limits':['Only the lower-flight→landing lower-outline and west handrail bends change; upperhaunchremainsheld.','No source photograph identifiesP5or authenticates a150mmbend radius/haunch polynomial/fabrication.','No primaryIbeamcentreline, tread/riser schedule, railprofilediameter, newel anchor, pad, cap/girderheight or rail/platform geometry changes.','Haunch-only new-node translations retain localFloat32 precision; every original source node remains exact.','New haunch loft varies laterally from8to68mm and is an inferred appearance volume, not an8mmconstant sheet construction claim.','No rendering/GPU/bake/lighting/encoding/native/browser/promotion performed.'],'blenderVersion':bpy.app.version_string,'elapsedSeconds':time.monotonic()-start_time,'generatorSha256':H(Path(__file__).read_bytes())};(a.out/'curve-study-manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k]for k in['status','candidate','artifacts','analyticC1MaximumPositionResidualM','analyticC1MaximumHandleDerivativeResidualM','elapsedSeconds']},indent=2),flush=True)
