"""CPU-only partition of frozen primary into structure and real-floor light receivers."""
from pathlib import Path
import argparse,bpy,bmesh,numpy as np,json,hashlib,struct,math,time
p=argparse.ArgumentParser();p.add_argument('--scene',type=Path,required=True);p.add_argument('--scene-sha256',required=True);p.add_argument('--control',type=Path,required=True);p.add_argument('--contract',type=Path,required=True);p.add_argument('--out',type=Path,required=True);a=p.parse_args();H=lambda b:hashlib.sha256(b).hexdigest();assert H(a.scene.read_bytes())==a.scene_sha256;control=json.loads(a.control.read_text());contract=json.loads(a.contract.read_text());materials=set(contract['floorMaterialNames']);assert len(materials)==3;assert not a.out.exists();a.out.mkdir(parents=True);bpy.ops.wm.open_mainfile(filepath=str(a.scene));o=bpy.data.objects[control['architecture']]
def digest(objects,light=False):
 rows=[]
 for obj in objects:
  m=obj.data;m.calc_loop_triangles();nm=obj.matrix_world.to_3x3().inverted().transposed()
  for t in m.loop_triangles:
   cs=[]
   for v,l in zip(t.vertices,t.loops):
    values=[*(obj.matrix_world@m.vertices[v].co),*(nm@m.corner_normals[l].vector),*m.uv_layers[0].data[l].uv]
    if light:values+=list(m.uv_layers[1].data[l].uv)
    cs.append(struct.pack('<'+'f'*len(values),*values))
   rows.append(m.materials[t.material_index].name.encode()+min(cs[0]+cs[1]+cs[2],cs[1]+cs[2]+cs[0],cs[2]+cs[0]+cs[1]))
 return H(b''.join(sorted(rows)))
physical=digest([o]);bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.context.scene.tool_settings.mesh_select_mode=(False,False,True);previous=set(bpy.context.scene.objects);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='DESELECT');bm=bmesh.from_edit_mesh(o.data)
for f in bm.faces:
 if o.data.materials[f.material_index].name in materials:f.select_set(True)
bm.select_flush_mode();bmesh.update_edit_mesh(o.data,loop_triangles=False,destructive=False);bpy.ops.mesh.separate(type='SELECTED');bpy.ops.object.mode_set(mode='OBJECT');added=set(bpy.context.scene.objects)-previous;assert len(added)==1;floor=added.pop();floor.name='Continuity exact original floor receivers';o.name='Continuity exact source structure'
def compact(mesh):
 used=sorted({p.material_index for p in mesh.polygons});mats=[mesh.materials[i]for i in used];ids=[used.index(p.material_index)for p in mesh.polygons];mesh.materials.clear()
 for m in mats:mesh.materials.append(m)
 for p,i in zip(mesh.polygons,ids):p.material_index=i
for obj in [floor,o]:compact(obj.data);obj.data.calc_loop_triangles()
assert set(m.name for m in floor.data.materials)==materials;assert digest([floor,o])==physical;assert len(floor.data.loop_triangles)==contract['floorTriangles'];assert len(floor.data.loop_triangles)+len(o.data.loop_triangles)==contract['sourceTriangles'];floor_light=digest([floor],True);o.data.uv_layers.active_index=1;bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.context.scene.tool_settings.use_uv_select_sync=True;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.select_all(action='SELECT');bpy.ops.uv.pack_islands(rotate=True,margin_method='FRACTION',margin=4/4096,scale=True);bpy.ops.object.mode_set(mode='OBJECT');assert digest([floor,o])==physical;assert digest([floor],True)==floor_light;painted=[];groups={};o.data.calc_loop_triangles()
for t in o.data.loop_triangles:
 name=o.data.materials[t.material_index].name;ps=np.array([(o.matrix_world@o.data.vertices[v].co)[:]for v in t.vertices]);uv=np.array([o.data.uv_layers[1].data[l].uv[:]for l in t.loops]);e1=ps[1]-ps[0];e2=ps[2]-ps[0];area=float(np.linalg.norm(np.cross(e1,e2))/2);ua=abs(float(np.cross(uv[1]-uv[0],uv[2]-uv[0])))/2;g=groups.setdefault(name,{'area':0.,'uvArea':0.});g['area']+=area;g['uvArea']+=ua
 if name=='PaintedStructuralIronEighthAvenueBridge':
  axis=e1/np.linalg.norm(e1);normal=np.cross(e1,e2);normal/=np.linalg.norm(normal);other=np.cross(normal,axis);world=np.array([[np.dot(e1,axis),np.dot(e2,axis)],[np.dot(e1,other),np.dot(e2,other)]]);tex=np.column_stack((uv[1]-uv[0],uv[2]-uv[0]));painted.append(float(np.linalg.svd(tex@np.linalg.inv(world)*4096,compute_uv=False).min()))
for g in groups.values():g['areaEquivalentPixelsPerMetre']=4096*math.sqrt(g['uvArea']/g['area'])
assert painted;minimum=min(painted);r={'status':'PASS'if minimum>=12.2044 else'HOLD structure lighting density would fall below the accepted baseline','sourceSha256':contract['sourceSha256'],'sourceTriangles':contract['sourceTriangles'],'floorTriangles':len(floor.data.loop_triangles),'structureTriangles':len(o.data.loop_triangles),'floorObject':floor.name,'structureObject':o.name,'floorMaterialNames':[m.name for m in floor.data.materials],'structureMaterialNames':[m.name for m in o.data.materials],'physicalCornerDigestBeforeAndAfter':physical,'floorLightCornerDigestBeforeAndAfterStructurePacking':floor_light,'positionNormalUv0Exact':True,'floorLightUvExactThroughStructurePacking':True,'structureMinimumJacobianPixelsPerMetre':minimum,'structureMaterials':groups,'structureBaselineMinimum':12.2044,'contextControlSha256':H(a.control.read_bytes()),'sourceContractSha256':H(a.contract.read_bytes())};(a.out/'split-receivers-proof.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r),flush=True)
if r['status']!='PASS':raise SystemExit(2)
scene=a.out/'split-prebake-scene.blend';bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(scene),compress=True,check_existing=False);r['preparedScene']=str(scene);r['preparedSceneSha256']=H(scene.read_bytes());(a.out/'split-receivers-proof.json').write_text(json.dumps(r,indent=2)+'\n')
