"""CPU-only weighted lighting-UV packing of an isolated, already exact floor receiver.
UVMap0, positions, source corner normals and all other scene geometry stay unchanged.
Inputs are explicit frozen paths/names; no phase-specific owner counts are inferred.
"""
from pathlib import Path
import argparse,bpy,numpy as np,json,hashlib,struct,math,time
p=argparse.ArgumentParser();p.add_argument('--scene',type=Path,required=True);p.add_argument('--scene-sha256',required=True);p.add_argument('--floor-object',required=True);p.add_argument('--structure-object',required=True);p.add_argument('--out',type=Path,required=True);p.add_argument('--resolution',type=int,default=4096);p.add_argument('--walk-weight',type=float,default=4);p.add_argument('--minimum-density',type=float,default=60);a=p.parse_args();H=lambda b:hashlib.sha256(b).hexdigest();assert H(a.scene.read_bytes())==a.scene_sha256;assert a.resolution==4096 and a.minimum_density>=60 and a.walk_weight>=1;assert not a.out.exists();a.out.mkdir(parents=True);started=time.monotonic();bpy.ops.wm.open_mainfile(filepath=str(a.scene));floor=bpy.data.objects[a.floor_object];structure=bpy.data.objects[a.structure_object];assert floor!=structure and floor.type==structure.type=='MESH';fm=floor.data;assert len(fm.uv_layers)==2 and fm.uv_layers[0].name=='UVMap'and fm.uv_layers[1].name=='BakedLightingUV'
def digest(objects,light=False):
 rows=[]
 for o in objects:
  m=o.data;m.calc_loop_triangles();nm=o.matrix_world.to_3x3().inverted().transposed()
  for t in m.loop_triangles:
   cs=[]
   for vi,li in zip(t.vertices,t.loops):
    v=[*(o.matrix_world@m.vertices[vi].co),*(nm@m.corner_normals[li].vector),*m.uv_layers[0].data[li].uv]
    if light:v+=list(m.uv_layers[1].data[li].uv)
    cs.append(struct.pack('<'+'f'*len(v),*v))
   rows.append(m.materials[t.material_index].name.encode()+min(cs[0]+cs[1]+cs[2],cs[1]+cs[2]+cs[0],cs[2]+cs[0]+cs[1]))
 return H(b''.join(sorted(rows)))
physical=digest([floor,structure]);structlight=digest([structure],True);old=np.empty(len(fm.loops)*2,np.float32);fm.uv_layers[1].data.foreach_get('uv',old);old=old.reshape(-1,2);walk=[];up=[]
# Blender world Z is vertical. Select by transformed GEOMETRIC normal, not local axes/custom shading normals.
fm.calc_loop_triangles();polyup={}
for t in fm.loop_triangles:
 ps=[floor.matrix_world@fm.vertices[v].co for v in t.vertices];n=(ps[1]-ps[0]).cross(ps[2]-ps[0]);n.normalize();polyup[t.polygon_index]=n.z>.95
for poly in fm.polygons:walk.append('StippledGranolithic'in fm.materials[poly.material_index].name and polyup[poly.index])
assert sum(walk)>0,'No real world-up stippled walking faces selected';parent=list(range(len(fm.polygons)))
def root(i):
 while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
 return i
edges={}
for poly in fm.polygons:
 ls=list(poly.loop_indices)
 for x,y in zip(ls,ls[1:]+ls[:1]):
  key=tuple(sorted((tuple(old[x]),tuple(old[y]))))
  if key in edges:parent[root(poly.index)]=root(edges[key])
  else:edges[key]=poly.index
islands={}
for poly in fm.polygons:islands.setdefault(root(poly.index),[]).append(poly.index)
uv=old.copy()
for polys in islands.values():
 if any(walk[i]for i in polys):
  loops=[l for i in polys for l in fm.polygons[i].loop_indices];centre=uv[loops].mean(axis=0);uv[loops]=centre+(uv[loops]-centre)*a.walk_weight
fm.uv_layers[1].data.foreach_set('uv',uv.reshape(-1));fm.uv_layers.active_index=1;bpy.ops.object.select_all(action='DESELECT');floor.select_set(True);bpy.context.view_layer.objects.active=floor;bpy.context.scene.tool_settings.use_uv_select_sync=True;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.select_all(action='SELECT');bpy.ops.uv.pack_islands(rotate=True,margin_method='FRACTION',margin=4/a.resolution,scale=True);bpy.ops.object.mode_set(mode='OBJECT');assert digest([floor,structure])==physical;assert digest([structure],True)==structlight
uv=np.empty(len(fm.loops)*2,np.float32);fm.uv_layers[1].data.foreach_get('uv',uv);uv=uv.reshape(-1,2);densities=[];groups={};visible_area=0;fm.calc_loop_triangles()
for t in fm.loop_triangles:
 ps=np.array([(floor.matrix_world@fm.vertices[v].co)[:]for v in t.vertices]);light=uv[list(t.loops)];e1=ps[1]-ps[0];e2=ps[2]-ps[0];area=float(np.linalg.norm(np.cross(e1,e2))/2);ua=abs(float(np.cross(light[1]-light[0],light[2]-light[0])))/2;name=fm.materials[t.material_index].name;g=groups.setdefault(name,{'surfaceArea':0.,'uvArea':0.});g['surfaceArea']+=area;g['uvArea']+=ua
 if walk[t.polygon_index]:
  axis=e1/np.linalg.norm(e1);normal=np.cross(e1,e2);normal/=np.linalg.norm(normal);other=np.cross(normal,axis);world=np.array([[np.dot(e1,axis),np.dot(e2,axis)],[np.dot(e1,other),np.dot(e2,other)]]);tex=np.column_stack((light[1]-light[0],light[2]-light[0]));densities.append(float(np.linalg.svd(tex@np.linalg.inv(world)*a.resolution,compute_uv=False).min()));visible_area+=area
for g in groups.values():g['areaEquivalentPixelsPerMetre']=a.resolution*math.sqrt(g['uvArea']/g['surfaceArea'])
r={'status':'PASS'if min(densities)>=a.minimum_density else'HOLD insufficient floor lighting detail; split real receiver ownership into another4K atlas before transport','inputScene':str(a.scene),'inputSceneSha256':a.scene_sha256,'floorObject':floor.name,'floorTriangles':len(fm.loop_triangles),'walkingTopTriangles':len(densities),'walkingTopAreaM2':visible_area,'worldUpDefinition':'Blender Z-up; transformed geometric triangle normalZ>.95; source StippledGranolithic material family','walkingTopWeight':a.walk_weight,'minimumJacobianPixelsPerMetre':min(densities),'maximumJacobianPixelsPerMetre':max(densities),'materials':groups,'physicalCornerDigestBeforeAndAfter':physical,'structureLightCornerDigestBeforeAndAfter':structlight,'positionNormalUv0Exact':True,'structureLightUvExact':True,'selectedOnlyFloorObject':True,'uvBounds':[float(uv.min()),float(uv.max())],'seconds':time.monotonic()-started};(a.out/'floor-uv-preflight.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r),flush=True)
if not r['status']=='PASS':raise SystemExit(2)
scene=a.out/'independent-floor-prebake-scene.blend';bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(scene),compress=True,check_existing=False);r['preparedScene']=str(scene);r['preparedSceneSha256']=H(scene.read_bytes());(a.out/'floor-uv-preflight.json').write_text(json.dumps(r,indent=2)+'\n')
