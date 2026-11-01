"""Read-only canonical source exports with explicit bake-frame restoration."""
from pathlib import Path
import argparse,hashlib,json
import bpy,numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args();SOURCE=args.source.resolve();OUT=args.out.resolve()
H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
EXPECTED='c96fb37215d4ebfc7bbbba9154fe7f96a8daf8500e9c61778136e286c4a03739';DROP=4.2672
assert H(SOURCE)==EXPECTED
assert not OUT.exists(),'Preserve previous output directories'
assert SOURCE.parents[2]not in OUT.parents,'Outputs must be outside the repository'
OUT.mkdir(parents=True)
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.view_layer.update()
SCENE=bpy.context.scene
objects={o.name:o for o in SCENE.objects}
def mesh_sig(o):
 d=o.data;h=hashlib.sha256()
 for seq,key,n,kind in [(d.vertices,'co',3,'<f4'),(d.corner_normals,'vector',3,'<f4'),(d.loops,'vertex_index',1,'<i4'),(d.polygons,'material_index',1,'<i4')]:
  a=np.empty(len(seq)*n,np.dtype(kind));seq.foreach_get(key,a);h.update(a.tobytes())
 for uv in d.uv_layers:
  a=np.empty(len(uv.data)*2,np.float32);uv.data.foreach_get('uv',a);h.update(uv.name.encode());h.update(a.tobytes())
 h.update('|'.join(m.name if m else ''for m in d.materials).encode());return h.hexdigest()
mesh_before={d.name:mesh_sig(o)for o in objects.values()if o.type=='MESH'for d in [o.data]}
matrix_before={name:np.asarray(o.matrix_world,dtype='<f8').copy()for name,o in objects.items()}
tree_cache={}
def downward(selected,x,y,expected):
 origin=Vector((x,y,expected+.04));direction=Vector((0,0,-1));hits=[]
 for o in selected:
  if o.type!='MESH':continue
  p=o.matrix_world.inverted()@origin;d=(o.matrix_world.inverted().to_3x3()@direction).normalized()
  # Object bounding boxes provide only a cheap filter; actual contact is BVH.
  if not all(min(c[a]for c in o.bound_box)-.0001<=p[a]<=max(c[a]for c in o.bound_box)+.0001 for a in [0,1]):continue
  if o.data.name not in tree_cache:tree_cache[o.data.name]=BVHTree.FromPolygons([v.co.copy()for v in o.data.vertices],[tuple(f.vertices)for f in o.data.polygons])
  hit,n,face,distance=tree_cache[o.data.name].ray_cast(p,d,.12)
  if hit is None:continue
  point=o.matrix_world@hit;normal=(o.matrix_world.to_3x3().inverted().transposed()@n).normalized()
  if normal.z<.98:continue
  hits.append({'object':o.name,'height':point.z,'normalZ':normal.z,'deltaExpected':point.z-expected,'material':o.data.materials[o.data.polygons[face].material_index].name})
 assert hits,('No actual source floor hit',x,y,expected)
 r=min(hits,key=lambda r:abs(r['deltaExpected']))
 assert abs(r['deltaExpected'])<.00002,r
 return r
def selected(prefixes):return[o for o in objects.values()if o.type in ['MESH','FONT']and any(c.name.startswith(prefixes)for c in o.users_collection)]
groups={'waiting':selected(('02 Main waiting room','Phase5 photographed wall-bracket pair')),
 'concourse':selected(('03 Glass and iron concourse','Phase6 corrected departure access','Phase7 circulation correction','Phase7 first eight ARRIVALS')),
 'exterior':selected(('01 Exterior and context',))}
controls={'waiting':[(0,0,0)],'concourse':[(-44,30,0),(-70,-30,-3.2004)],'exterior':[]}
reports=[]
for zone,group in groups.items():
 shift=0 if zone=='exterior'else DROP
 original_selected=set(group)
 roots=[o for o in group if o.parent not in original_selected]
 before=[downward(group,x,y,z-DROP)for x,y,z in controls[zone]]
 # Restore the location field we actually change. Assigning matrix_world can
 # decompose/recompose existing rotations and introduce harmless float drift.
 originals={o.name:o.location.copy()for o in roots}
 for o in roots:o.location.z+=shift
 bpy.context.view_layer.update()
 after=[downward(group,x,y,z)for x,y,z in controls[zone]]
 temporary=bpy.data.scenes.new('Frozen '+zone+' bake occluder')
 for o in group:temporary.collection.objects.link(o)
 bpy.context.window.scene=temporary
 path=OUT/('current-'+zone+'-occluder.glb')
 try:
  bpy.ops.object.select_all(action='DESELECT')
  for o in group:o.select_set(True)
  bpy.context.view_layer.objects.active=group[0]
  print('EXPORT',zone,len(group),'SHIFT',shift,flush=True)
  bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_yup=True,export_materials='EXPORT',export_attributes=True,export_extras=True)
 finally:
  bpy.context.window.scene=SCENE;bpy.data.scenes.remove(temporary)
  for o in roots:o.location=originals[o.name]
  bpy.context.view_layer.update()
 restored=[downward(group,x,y,z-DROP)for x,y,z in controls[zone]]
 reports.append({'zone':zone,'meshObjects':sum(o.type=='MESH'for o in group),'fontObjects':sum(o.type=='FONT'for o in group),'objects':len(group),'rootObjects':len(roots),'sourceToExportHeightShift':shift,
 'sourceFrame':'Street0; Mainworld-4.2672m','exportFrame':'Street0'if zone=='exterior'else'Main0',
 'expectedBakerZoneOffset':DROP if zone=='exterior'else 0,'beforeSourceFloorControls':before,'exportFrameFloorControls':after,'restoredSourceFloorControls':restored,
 'output':path.name,'bytes':path.stat().st_size,'sha256':H(path)})
 print('EXPORTED',zone,path.stat().st_size,flush=True)
assert all(np.array_equal(np.asarray(o.matrix_world,dtype='<f8'),matrix_before[name])for name,o in objects.items()),'Source matrices were not restored'
assert all(mesh_sig(o)==mesh_before[o.data.name]for o in objects.values()if o.type=='MESH'),'Source geometry/normal/UV/material bindings changed'
assert H(SOURCE)==EXPECTED,'Source file changed'
result={'schema':1,'status':'PASS: read-only canonical exports; no saved source mutation','source':str(SOURCE),'sourceSha256':EXPECTED,'sourceSha256After':H(SOURCE),
 'generatorSha256':H(Path(__file__)),'allSourceObjectMatricesRestored':len(objects),'uniqueMeshAttributesRestored':len(mesh_before),'exports':reports,
 'limits':['Occluder geometry comes from current authored canonical source, not a historical scan.','Frame controls verify actual source floors; encoded runtime tolerances remain separate.','The source is never saved or overwritten.']}
(OUT/'canonical-occluder-frame-proof.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2),flush=True)
