"""Same authored coffers, same illumination; compare welded and preserved normals."""
from pathlib import Path
import ast,sys,math,json,hashlib
import bpy,numpy as np
from mathutils import Vector
repo=Path('/Users/stavreskimario/Desktop/penn-station-reconstruction');work=Path('/Users/stavreskimario/Desktop/penn-station-work');out=work/'phase5-materials/normal-proof-restored';out.mkdir(exist_ok=True)
sys.path.insert(0,str(repo/'penn-station-1935/model'))
from coffer_geometry import tessellate_profile
from surface_finish_normals import clamp_backfacing_corner_normals
from vault_lighting_uv import prepare_vault_uv
source=repo/'penn-station-1935/model/build_station.py';wanted=['mesh','coffer_cell','vault_z','vault_surface'];nodes=[n for n in ast.parse(source.read_text()).body if isinstance(n,ast.FunctionDef) and n.name in wanted]
bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene;mat=bpy.data.materials.new('Constant untextured plaster');mat.diffuse_color=(.68,.68,.68,1);mat.use_nodes=True;mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.68,.68,.68,1);mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.84
col=bpy.data.collections.new('Exact source coffer fixture');sc.collection.children.link(col)
ns={'bpy':bpy,'math':math,'Vector':Vector,'tessellate_profile':tessellate_profile,'clamp_backfacing_corner_normals':lambda data:None,'PALE':mat,'COL':col,'spring':30.35,'rise':143*.3048-30.35,'a':(108+8/12)*.3048/2,'b':277*.3048/6}
exec(compile(ast.Module(body=nodes,type_ignores=[]),str(source),'exec'),ns)
a,b=ns['a'],ns['b'];gx=round(2*a/(10*.3048));gy=round(2*b/(10*.3048));objs=[]
for iy in range(3,6):
 for ix in range(4,7):
  cx=-a+(ix+.5)*2*a/gx;yy=-b+(iy+.5)*2*b/gy;objs.append(ns['coffer_cell']('Actual crown coffer',cx,yy,a/gx,b/gy,lambda x,y,d:ns['vault_surface'](x,y,0,d)))
bpy.ops.object.select_all(action='DESELECT')
for o in objs:o.select_set(True)
bpy.context.view_layer.objects.active=objs[0];bpy.ops.object.join();obj=bpy.context.object;original=obj.data.copy()
def signature(m):
 m.calc_loop_triangles();p=np.asarray([v.co[:] for v in m.vertices],np.float32);t=np.asarray([list(q.vertices) for q in m.loop_triangles]);corners=np.sort(np.array([tuple(x.ravel()) for x in p[t]],dtype=[('v',np.float32,(9,))]),axis=0) if False else None
 values=np.asarray(sorted(min(tuple(tuple(p[v]) for v in np.roll(tri,shift)) for shift in range(3)) for tri in t),np.float32);return hashlib.sha256(values.tobytes()).hexdigest()
def norms(m):
 m.calc_loop_triangles();p=np.asarray([v.co[:] for v in m.vertices]);tri=np.asarray([list(t.vertices) for t in m.loop_triangles]);lo=np.asarray([list(t.loops) for t in m.loop_triangles]);v=p[tri];fn=np.cross(v[:,1]-v[:,0],v[:,2]-v[:,0]);fn/=np.linalg.norm(fn,axis=1)[:,None];n=np.asarray([n.vector[:] for n in m.corner_normals]);d=np.einsum('tj,tvj->tv',fn,n[lo]);return {'p1':float(np.percentile(d,1)),'p5':float(np.percentile(d,5)),'minimum':float(d.min()),'oppositeCorners':int((d<0).sum())}
cam=bpy.data.cameras.new('Fixture camera');camera=bpy.data.objects.new('Fixture camera',cam);sc.collection.objects.link(camera);sc.camera=camera;camera.location=(5,-7,34);target=Vector((0,0,43.1));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();cam.type='ORTHO';cam.ortho_scale=11
lamp=bpy.data.lights.new('Restrained relief daylight','AREA');lamp.energy=1500;lamp.shape='DISK';lamp.size=5;lo=bpy.data.objects.new('Restrained relief daylight',lamp);sc.collection.objects.link(lo);lo.location=(-5,-4,34);lo.rotation_euler=(Vector((0,0,43))-lo.location).to_track_quat('-Z','Y').to_euler()
world=bpy.data.worlds.new('Neutral fixture sky');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.58,.66,.76,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.18;sc.world=world
sc.render.engine='CYCLES';sc.cycles.device='CPU';sc.cycles.samples=32;sc.cycles.use_denoising=True;sc.render.threads_mode='FIXED';sc.render.threads=8;sc.render.resolution_x=720;sc.render.resolution_y=540;sc.render.resolution_percentage=100;sc.render.image_settings.file_format='PNG';sc.view_settings.view_transform='AgX';sc.view_settings.look='AgX - Medium High Contrast';sc.view_settings.exposure=0
records=[]
for mode in ['welded','preserved','welded-restored']:
 obj.data=original.copy()
 if mode=='welded':
  bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.00001);bpy.ops.object.mode_set(mode='OBJECT')
 elif mode=='welded-restored':
  clamp_backfacing_corner_normals(obj.data);prepare_vault_uv(obj,8192,8)
 else:clamp_backfacing_corner_normals(obj.data)
 obj.data.calc_loop_triangles(); np.save(out/(mode+'-triangles.npy'),np.asarray([[obj.data.vertices[v].co[:] for v in t.vertices] for t in obj.data.loop_triangles],dtype=np.float32)); record={'mode':mode,'geometryTriangleSignature':signature(obj.data),'normals':norms(obj.data),'vertices':len(obj.data.vertices),'triangles':len(obj.data.polygons)};records.append(record);sc.render.filepath=str(out/(mode+'.png'));bpy.ops.render.render(write_still=True);print(record,flush=True)
aa=np.load(out/'welded-triangles.npy');bb=np.load(out/'preserved-triangles.npy')
def keys(ar):return sorted(min(tuple(tuple(np.round(p,4)) for p in np.roll(t,shift,axis=0)) for shift in range(3)) for t in ar)
assert keys(aa)==keys(bb),'Source surfaces differ beyond0.1mm; inspect before accepting'
for record in records:record['sameSurfaceWithin0.1mm']=True
(out/'proof.json').write_text(json.dumps({'scope':'Nine actual authored crown coffers; constant white plaster; same CPU32sample illumination/camera. Only old bake welding versus preserved/coffer-bounded normals differs. Not a production browser image or calibrated historic daylight.','sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'records':records},indent=2)+'\n')
