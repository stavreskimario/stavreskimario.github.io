"""Normal-only maintenance on the already repaired source scene."""
from pathlib import Path
import json,hashlib,sys
import bpy,numpy as np
repo=Path('/Users/stavreskimario/Desktop/penn-station-reconstruction');work=Path('/Users/stavreskimario/Desktop/penn-station-work');out=work/'phase5-materials/normal-source';out.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(repo/'penn-station-1935/model'))
from surface_finish_normals import clamp_backfacing_corner_normals
scene=repo/'authoring/penn-station-1935/penn-station-phase4.blend';bpy.ops.wm.open_mainfile(filepath=str(scene))
hall=bpy.data.collections['02 Main waiting room'];targets=[o for o in hall.objects if o.type=='MESH' and any(m and m.name=='PaleVaultPlaster' for m in o.data.materials)];assert len(targets)==1;obj=targets[0]
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def data_hash(data,include_normals=True):
 h=hashlib.sha256()
 for size,dtype,collection,attribute in [(3,np.float32,data.vertices,'co'),(1,np.int32,data.loops,'vertex_index'),(1,np.int32,data.polygons,'loop_start'),(1,np.int32,data.polygons,'loop_total'),(1,np.int32,data.polygons,'material_index'),(1,np.bool_,data.polygons,'use_smooth')]:
  ar=np.empty(len(collection)*size,dtype);collection.foreach_get(attribute,ar);h.update(attribute.encode());h.update(ar.tobytes())
 if include_normals:
  ar=np.empty(len(data.loops)*3,np.float32);data.corner_normals.foreach_get('vector',ar);h.update(ar.tobytes())
 for uv in data.uv_layers:
  ar=np.empty(len(data.loops)*2,np.float32);uv.data.foreach_get('uv',ar);h.update(uv.name.encode());h.update(ar.tobytes())
 return h.hexdigest()
def others_hash():
 cache={};items=[]
 for o in sorted(bpy.context.scene.objects,key=lambda x:x.name):
  if o==obj:continue
  item=[o.name,o.type,list(np.asarray(o.matrix_world).reshape(-1))]
  if o.type=='MESH':
   key=o.data.as_pointer()
   if key not in cache:cache[key]=data_hash(o.data)
   item.append(cache[key])
  items.append(item)
 return hashlib.sha256(json.dumps(items).encode()).hexdigest(),len(items)
geometry_before=data_hash(obj.data,False);others_before,count=others_hash();print('Baselinehashesready',flush=True)
audit=clamp_backfacing_corner_normals(obj.data)
assert data_hash(obj.data,False)==geometry_before
assert others_hash()[0]==others_before
obj['coffer_shading_normal_revision']=5
bpy.context.scene['coffer_shading_normal_revision']=5
bpy.context.preferences.filepaths.save_version=0
blend=out/'penn-station-phase5-materials.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend),compress=True)
locations={o:tuple(o.location) for o in hall.objects}
for o in hall.objects:o.location.z+=4.2672
bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
for o in hall.all_objects:
 if o.type in {'MESH','FONT'} and not o.hide_render:o.select_set(True)
raw=out/'model-waiting-room.glb';bpy.ops.export_scene.gltf(filepath=str(raw),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO',export_extras=True)
for o,p in locations.items():o.location=p
bpy.context.view_layer.update();assert others_hash()[0]==others_before
report={'status':'PASS','scope':'Only rare PaleVaultPlaster corner normals bounded to their real triangle hemisphere; no positions/topology/UV0 change','inputScene':str(scene),'inputSceneSha256':sha(scene),'outputScene':str(blend),'outputSceneSha256':sha(blend),'outputRaw':str(raw),'outputRawSha256':sha(raw),'unchangedCofferGeometryTopologyUv0Sha256':geometry_before,'unrelatedSceneSha256':others_before,'unrelatedObjects':count,'normalAudit':audit,'sourceFiles':{p.name:sha(p) for p in [repo/'penn-station-1935/model/build_station.py',repo/'penn-station-1935/model/surface_finish_normals.py',repo/'penn-station-1935/model/bake_lighting.py']}}
(out/'normal-maintenance-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True)
