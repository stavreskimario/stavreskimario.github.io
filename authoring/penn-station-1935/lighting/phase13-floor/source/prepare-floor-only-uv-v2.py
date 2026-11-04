from pathlib import Path
import bpy,bmesh,json,numpy as np,hashlib,struct,time,math
D=Path(__file__).parent;B=D/'bake-run-v2';control=json.loads((B/'raw/prepared-scene-control.json').read_text());started=time.monotonic();bpy.ops.wm.open_mainfile(filepath=str(B/'raw/enclosure-prebake-scene.blend'));o=bpy.data.objects[control['architecture']]
def triangle_digest(objects,light=False):
 out=[]
 for obj in objects:
  m=obj.data;m.calc_loop_triangles();nm=obj.matrix_world.to_3x3().inverted().transposed()
  for t in m.loop_triangles:
   c=[]
   for v,l in zip(t.vertices,t.loops):
    p=obj.matrix_world@m.vertices[v].co;n=nm@m.corner_normals[l].vector;u=m.uv_layers[0].data[l].uv;values=[*p,*n,*u]
    if light:values+=list(m.uv_layers[1].data[l].uv)
    c.append(struct.pack('<'+'f'*len(values),*values))
   out.append(m.materials[t.material_index].name.encode()+min(c[0]+c[1]+c[2],c[1]+c[2]+c[0],c[2]+c[0]+c[1]))
 return hashlib.sha256(b''.join(sorted(out))).hexdigest()
physical_before=triangle_digest([o]);m=o.data
bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.context.scene.tool_settings.mesh_select_mode=(False,False,True);previous=set(bpy.context.scene.objects);bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='DESELECT');bm=bmesh.from_edit_mesh(m)
for f in bm.faces:
 if'Enclosure13'in m.materials[f.material_index].name:f.select_set(True)
bm.select_flush_mode();bmesh.update_edit_mesh(m,loop_triangles=False,destructive=False);bpy.ops.mesh.separate(type='SELECTED');bpy.ops.object.mode_set(mode='OBJECT');new=set(bpy.context.scene.objects)-previous;assert len(new)==1;floor=new.pop();floor.name='Exact three floor receivers for independent contact GI';o.name='Twenty-four source structural owners retained as physical context';assert len(floor.data.polygons)==402;assert len(o.data.polygons)==24996;assert triangle_digest([o,floor])==physical_before
# Remove unused material slots, preserving actual material identities and assignments.
fm=floor.data;used=sorted({p.material_index for p in fm.polygons});mats=[fm.materials[i]for i in used];indices=[used.index(p.material_index)for p in fm.polygons];fm.materials.clear()
for mat in mats:fm.materials.append(mat)
for p,i in zip(fm.polygons,indices):p.material_index=i
assert len(fm.materials)==3;assert triangle_digest([o,floor])==physical_before;structure_light_before=triangle_digest([o],True);old=np.empty(len(fm.loops)*2,np.float32);fm.uv_layers[1].data.foreach_get('uv',old);old=old.reshape(-1,2);walk=[]
for p in fm.polygons:
 n=(floor.matrix_world.to_3x3().inverted().transposed()@p.normal).normalized();walk.append('StippledGranolithic'in fm.materials[p.material_index].name and n.z>.95)
assert sum(walk)==16
parent=list(range(len(fm.polygons)))
def root(i):
 while parent[i]!=i:parent[i]=parent[parent[i]];i=parent[i]
 return i
edges={}
for p in fm.polygons:
 ls=list(p.loop_indices)
 for a,b in zip(ls,ls[1:]+ls[:1]):
  key=tuple(sorted((tuple(old[a]),tuple(old[b]))))
  if key in edges:parent[root(p.index)]=root(edges[key])
  else:edges[key]=p.index
islands={}
for p in fm.polygons:islands.setdefault(root(p.index),[]).append(p.index)
results=[];best=None
for weight in [4]:
 uv=old.copy()
 for polys in islands.values():
  if not any(walk[i]for i in polys):continue
  loops=[l for i in polys for l in fm.polygons[i].loop_indices];centre=uv[loops].mean(axis=0);uv[loops]=centre+(uv[loops]-centre)*weight
 fm.uv_layers[1].data.foreach_set('uv',uv.reshape(-1));fm.uv_layers.active_index=1;bpy.ops.object.select_all(action='DESELECT');floor.select_set(True);bpy.context.view_layer.objects.active=floor;bpy.context.scene.tool_settings.use_uv_select_sync=True;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.select_all(action='SELECT');bpy.ops.uv.pack_islands(rotate=True,margin_method='FRACTION',margin=4/4096,scale=True);bpy.ops.object.mode_set(mode='OBJECT');assert triangle_digest([o,floor])==physical_before;assert triangle_digest([o],True)==structure_light_before;uv=np.empty(len(fm.loops)*2,np.float32);fm.uv_layers[1].data.foreach_get('uv',uv);uv=uv.reshape(-1,2);densities=[];groups={};fm.calc_loop_triangles()
 for t in fm.loop_triangles:
  points=np.array([(floor.matrix_world@fm.vertices[v].co)[:]for v in t.vertices]);light=uv[list(t.loops)];e1=points[1]-points[0];e2=points[2]-points[0];pa=np.linalg.norm(np.cross(e1,e2))/2;ua=abs(float(np.cross(light[1]-light[0],light[2]-light[0])))/2;name=fm.materials[t.material_index].name;r=groups.setdefault(name,{'area':0.,'uvArea':0.});r['area']+=float(pa);r['uvArea']+=ua
  if walk[t.polygon_index]:
   axis=e1/np.linalg.norm(e1);normal=np.cross(e1,e2);normal/=np.linalg.norm(normal);other=np.cross(normal,axis);world=np.array([[np.dot(e1,axis),np.dot(e2,axis)],[np.dot(e1,other),np.dot(e2,other)]]);tex=np.column_stack((light[1]-light[0],light[2]-light[0]));densities.append(float(np.linalg.svd(tex@np.linalg.inv(world)*4096,compute_uv=False).min()))
 for r in groups.values():r['areaPixelsPerMetre']=4096*math.sqrt(r['uvArea']/r['area'])
 row={'walkingTopWeight':weight,'visibleTopTriangles':len(densities),'minimumJacobianPixelsPerMetre':min(densities),'maximumJacobianPixelsPerMetre':max(densities),'materials':groups,'physicalPositionNormalUV0Exact':True,'structureLightUVExact':True,'uvBounds':[float(uv.min()),float(uv.max())]};results.append(row);print(json.dumps(row),flush=True)
 if best is None or row['minimumJacobianPixelsPerMetre']>best[0]:best=(row['minimumJacobianPixelsPerMetre'],uv.copy(),row)
assert best[0]>=60,('Independent floor layout remains below gate',best[0]);fm.uv_layers[1].data.foreach_set('uv',best[1].reshape(-1));scene=D/'floor-bake-v1/independent-floor-prebake-scene.blend';bpy.ops.wm.save_as_mainfile(filepath=str(scene),compress=True,check_existing=False);r={'status':'PASS CPU-only independent floor UV density gate; no new transport yet','sourcePrimarySha256':control['sourceSha256'],'sourceFloorOwnerNames':[x for x in control['primaryAtlasScope']['primaryAtlasSourceNames']if x.startswith('Fresh true receiver')],'sourceFileMeshOwners':27,'selectedSourceFloorOwners':3,'selectedFloorTriangles':402,'retainedStructuralTriangles':24996,'architecture':floor.name,'contextArchitecture':o.name,'preparedScene':str(scene),'preparedSceneSha256':hashlib.sha256(scene.read_bytes()).hexdigest(),'physicalDigest':physical_before,'structureLightDigest':structure_light_before,'minimumVisibleTopDensity':best[0],'selectedTrial':best[2],'trials':results,'baseControl':str(B/'raw/prepared-scene-control.json'),'seconds':time.monotonic()-started};(D/'independent-floor-uv-preflight-v2.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'status':r['status'],'minimumDensity':best[0],'scene':str(scene),'seconds':r['seconds']}),flush=True)
