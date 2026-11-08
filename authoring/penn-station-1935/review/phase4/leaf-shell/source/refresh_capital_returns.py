"""Patch only existing capital-leaf backs/closures in a batched editable scene.

The visible front grid, unrelated architecture and scene registration stay fixed.
Use a pre-repair source snapshot to identify exact old components, never guess by
proximity. The independent lighting UV helper is not changed by this repair.
"""
from pathlib import Path
from types import SimpleNamespace
import argparse,ast,hashlib,json,math
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--scene',type=Path,required=True)
parser.add_argument('--before-source',type=Path,required=True)
parser.add_argument('--source',type=Path,default=Path(__file__).with_name('build_station.py'))
parser.add_argument('--out',type=Path,required=True)
args=parser.parse_args();args.out.mkdir(parents=True,exist_ok=True)
def sha(b):return hashlib.sha256(b).hexdigest()
def leaf_function(path):
 tree=ast.parse(path.read_text());node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='capital_leaf')
 def captured(name,verts,faces,material):return SimpleNamespace(vertices=np.asarray(verts,dtype=np.float32),faces=faces,data=SimpleNamespace(polygons=[]))
 ns={'Vector':Vector,'np':np,'math':math,'mesh':captured,'LIMESTONE':None,'INTERIOR_CAPITAL':2.5146}
 exec(compile(ast.Module(body=[node],type_ignores=[]),str(path),'exec'),ns)
 return ns['capital_leaf']
old_fn,new_fn=leaf_function(args.before_source),leaf_function(args.source)
bpy.ops.wm.open_mainfile(filepath=str(args.scene.resolve()))
hall=bpy.data.collections['02 Main waiting room'];stone=[o for o in hall.objects if o.type=='MESH' and o.data.materials and o.data.materials[0].name=='Travertine'];assert len(stone)==1
obj=stone[0];mesh=obj.data;assert not mesh.has_custom_normals
assert np.allclose(np.asarray(obj.matrix_world.to_3x3()),np.eye(3));assert abs(obj.location.z+4.2672)<1e-5

def mesh_hash(data):
 h=hashlib.sha256()
 for label,size,dtype,collection,attribute in [('positions',3,np.float32,data.vertices,'co'),('loops',1,np.int32,data.loops,'vertex_index'),('loopStarts',1,np.int32,data.polygons,'loop_start'),('loopTotals',1,np.int32,data.polygons,'loop_total'),('materialSlots',1,np.int32,data.polygons,'material_index'),('smooth',1,np.bool_,data.polygons,'use_smooth'),('normals',3,np.float32,data.corner_normals,'vector')]:
  values=np.empty(len(collection)*size,dtype=dtype);collection.foreach_get(attribute,values);h.update(label.encode());h.update(values.tobytes())
 for uv in data.uv_layers:
  values=np.empty(len(data.loops)*2,np.float32);uv.data.foreach_get('uv',values);h.update(uv.name.encode());h.update(values.tobytes())
 h.update(json.dumps([m.name if m else None for m in data.materials]).encode());return h.hexdigest()
def other_scene_hash():
 cache={};records=[]
 for o in sorted(bpy.context.scene.objects,key=lambda o:o.name):
  if o==obj:continue
  if o.type=='MESH':
   key=o.data.as_pointer()
   if key not in cache:cache[key]=mesh_hash(o.data)
   records.append((o.name,cache[key],np.asarray(o.matrix_world,dtype=np.float64).tobytes().hex()))
  else:records.append((o.name,o.type,np.asarray(o.matrix_world,dtype=np.float64).tobytes().hex()))
 return sha(json.dumps(records).encode()),len(records),len(cache)
coords=np.empty(len(mesh.vertices)*3,np.float32);mesh.vertices.foreach_get('co',coords);coords=coords.reshape(-1,3);before_coords=coords.copy()
loops=np.empty(len(mesh.loops),np.int32);mesh.loops.foreach_get('vertex_index',loops)
normal_before=np.empty(len(mesh.loops)*3,np.float32);mesh.corner_normals.foreach_get('vector',normal_before);normal_before=normal_before.reshape(-1,3)
uv=mesh.uv_layers[0];uv_before=np.empty(len(mesh.loops)*2,np.float32);uv.data.foreach_get('uv',uv_before);uv_before=uv_before.reshape(-1,2)
other_before,other_objects,other_meshes=other_scene_hash()
leaves=[]
for sx in [-1,1]:
 for yy in [-42.216,-14.072,14.072,42.216]:
  for rank in [0,1]:
   for k in range(8):
    angle=(k+rank*.5)*math.pi/4;centre=(sx*14.2,yy,18.4658);old=old_fn(centre,angle,rank);new=new_fn(centre,angle,rank)
    assert old.faces==new.faces and np.array_equal(old.vertices[:861],new.vertices[:861]);leaves.append({'old':old,'new':new,'sx':sx,'y':yy,'rank':rank,'k':k,'angle':angle})
keys={tuple(x['old'].vertices[0]):[] for x in leaves}
for i,v in enumerate(coords):
 key=tuple(v)
 if key in keys:keys[key].append(i)
leaf_mask=np.zeros(len(coords),bool);back_mask=np.zeros(len(coords),bool);front_mask=np.zeros(len(coords),bool)
for leaf in leaves:
 old=leaf['old'].vertices;matches=[i for i in keys[tuple(old[0])] if i+len(old)<=len(coords) and np.array_equal(coords[i:i+len(old)],old)]
 assert len(matches)==1,('Exact old leaf component missing',leaf['sx'],leaf['y'],leaf['rank'],leaf['k'],matches)
 i=matches[0];leaf['offset']=i;assert not leaf_mask[i:i+len(old)].any();leaf_mask[i:i+len(old)]=True;front_mask[i:i+861]=True;back_mask[i+861:i+len(old)]=True;coords[i+861:i+len(old)]=leaf['new'].vertices[861:]
assert len(leaves)==128 and back_mask.sum()==128*861
mesh.vertices.foreach_set('co',coords.reshape(-1));mesh.update()
# Only altered back/closure faces need new physical surface coordinates.
leaf_polygons=np.array([all(leaf_mask[v] for v in p.vertices) for p in mesh.polygons],bool)
back_polygons=np.array([any(back_mask[v] for v in p.vertices) for p in mesh.polygons],bool)
for p in mesh.polygons:
 if not back_polygons[p.index]:continue
 axis=max(range(3),key=lambda k:abs(p.normal[k]));axes=[k for k in range(3) if k!=axis]
 for index in p.loop_indices:
  v=mesh.vertices[mesh.loops[index].vertex_index].co;uv.data[index].uv=(v[axes[0]]*.28,v[axes[1]]*.28)
uv_after=np.empty_like(uv_before);uv.data.foreach_get('uv',uv_after.reshape(-1));normal_after=np.empty_like(normal_before);mesh.corner_normals.foreach_get('vector',normal_after.reshape(-1))
assert np.array_equal(coords[~back_mask],before_coords[~back_mask]);assert np.array_equal(coords[front_mask],before_coords[front_mask])
front_face_loops=np.repeat(leaf_polygons & ~back_polygons,np.array([p.loop_total for p in mesh.polygons]))
assert np.array_equal(uv_after[front_face_loops],uv_before[front_face_loops])
assert np.array_equal(uv_after[~leaf_mask[loops]],uv_before[~leaf_mask[loops]]);assert np.array_equal(normal_after[~leaf_mask[loops]],normal_before[~leaf_mask[loops]])
# Exact actual float32 mesh proofs, including all orientations/registered columns.
results=[];temporary=bpy.data.meshes.new('Capital return intersection proof')
for leaf in leaves:
 points=coords[leaf['offset']:leaf['offset']+1722];temporary.clear_geometry();temporary.from_pydata(points.tolist(),[],leaf['new'].faces);temporary.update();temporary.calc_loop_triangles();tri=[tuple(t.vertices) for t in temporary.loop_triangles]
 bvh=BVHTree.FromPolygons([tuple(p) for p in points],tri,all_triangles=True,epsilon=1e-8);pairs=[(a,b) for a,b in bvh.overlap(bvh) if a<b and not set(tri[a])&set(tri[b])]
 assert not pairs,('Repaired leaf self-intersection',leaf['sx'],leaf['y'],leaf['rank'],leaf['k'],pairs[:3])
 centre=points.mean(axis=0);pp=points-centre;volume=sum(float(np.dot(pp[t[0]],np.cross(pp[t[1]],pp[t[2]])))/6 for t in tri);assert volume>0
 results.append({'column':[leaf['sx']*14.2,leaf['y']],'rank':leaf['rank'],'leaf':leaf['k'],'nonAdjacentTriangleIntersections':0,'signedVolumeM3':volume})
bpy.data.meshes.remove(temporary)
edges={}
for face in leaves[0]['new'].faces:
 for a,b in zip(face,face[1:]+face[:1]):edges.setdefault(tuple(sorted((a,b))),[]).append((a,b))
assert all(len(v)==2 and v[0]==tuple(reversed(v[1])) for v in edges.values())
other_after,_,_=other_scene_hash();assert other_before==other_after
report={'status':'PASS','scope':'Only hidden backs/closures of128existing acanthus leaves patched; visible front vertices and all unrelated geometry/normals/UV0 exact','inputScene':args.scene.name,'inputSceneSha256':sha(args.scene.read_bytes()),'beforeSourceSha256':sha(args.before_source.read_bytes()),'sourceSha256':sha(args.source.read_bytes()),'patchedLeaves':128,'changedVertices':int(back_mask.sum()),'frontVerticesExactlyUnchanged':int(front_mask.sum()),'frontSha256':sha(coords[front_mask].tobytes()),'allOtherVerticesExactlyUnchanged':True,'unrelatedStoneNormalsUv0ExactlyUnchanged':True,'otherSceneObjects':other_objects,'otherUniqueMeshes':other_meshes,'allOtherSceneGeometrySha256Before':other_before,'allOtherSceneGeometrySha256After':other_after,'closedManifoldConsistentWinding':True,'nonAdjacentTriangleSelfIntersections':0,'leafProofs':results,'returnInterpretation':'55mm bounded inward radial/vertical profile return; radial component clipped at downward curl to preserve outer XY silhouette. Hidden thickness is interpreted, not a historic measurement.','capitalOrderTopMainMetres':20.9804,'frontProfileUnchanged':True}
# Export only the existing waiting collection in its raw Main0 coordinate frame.
locations={o:tuple(o.location) for o in hall.objects}
for o in hall.objects:o.location.z+=4.2672
bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT')
for o in hall.all_objects:
 if o.type in {'MESH','FONT'} and not o.hide_render:o.select_set(True)
raw=args.out/'model-waiting-room.glb';bpy.ops.export_scene.gltf(filepath=str(raw.resolve()),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO',export_extras=True)
for o,location in locations.items():o.location=location
bpy.context.view_layer.update();assert other_scene_hash()[0]==other_before
bpy.context.scene['capital_leaf_return_revision']=1;bpy.context.scene['capital_leaf_return_interpretation']=report['returnInterpretation'];bpy.context.preferences.filepaths.save_version=0
blend=args.out/'penn-station-phase4.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend.resolve()),compress=True)
report['outputRaw']=raw.name;report['outputRawSha256']=sha(raw.read_bytes());report['outputBlend']=blend.name;report['outputBlendSha256']=sha(blend.read_bytes());(args.out/'leaf-return-maintenance-audit.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='leafProofs'},indent=2),flush=True)
