"""External CPU-only lighting atlas island census and optional weighted repack.

The authoritative input buffers are never modified. Island adjacency requires
an entire common physical edge with identical UV coordinates at both ends;
shared vertices alone do not connect charts. Any packing uses a disposable UV
mesh whose topology is reconstructed from exact source positions, so hard-normal
glTF vertex splits do not create fictitious islands. Geometry, surface UVs and
normals remain the original input when a UV-only candidate is written.
"""
import argparse,hashlib,json,sys,struct,math,time
from pathlib import Path
import bpy,numpy as np
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from glb_surface_io import read_glb
ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,required=True);ap.add_argument('--baked',type=Path,required=True);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--pack',action='store_true');ap.add_argument('--shape',choices=['CONCAVE','CONVEX','AABB'],default='CONCAVE');a=ap.parse_args();assert not a.out.exists();a.out.mkdir(parents=True);H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();started=time.monotonic()
assert H(a.source)=='ba0969961ed97c854742e86c43fd16326f142f8e4289b3acd55acb8a910f58cc'
assert H(a.baked)=='f346aaa4177460c3b965217486d7f5d1944d9657c15281705b2735a096e8050d'
data=read_glb(a.baked);b=a.baked.read_bytes();jl=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+jl]);off=20+jl;ln,_=struct.unpack_from('<II',b,off);buf=memoryview(b)[off+8:off+8+ln]
def acc(i):
 x=j['accessors'][i];v=j['bufferViews'][x['bufferView']];types={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'};width={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4}[x['type']];dt=np.dtype(types[x['componentType']]);return np.ndarray((x['count'],width),dt,buf,v.get('byteOffset',0)+x.get('byteOffset',0),strides=(v.get('byteStride',width*dt.itemsize),dt.itemsize))
node=j['nodes'][0];assert node['name']=='concourse-arrivals baked static architecture'and not any(k in node for k in ['matrix','translation','rotation','scale']);prims=j['meshes'][node['mesh']]['primitives'];uv=[];source_bindings=[]
for p in prims:
 ids=acc(p['indices']).astype(np.int64).reshape(-1,3);uv.append(acc(p['attributes']['TEXCOORD_1'])[ids]);source_bindings.append({'primitive':p,'triangles':len(ids),'uvAccessor':p['attributes']['TEXCOORD_1']})
uv=np.concatenate(uv).astype(np.float64);p=data['p'][:len(uv)];mat=data['mat'][:len(uv)];names=[m['name']for m in j['materials']];assert all(x=='concourse-arrivals baked static architecture'for x in data['node'][:len(uv)])
e1=p[:,1]-p[:,0];e2=p[:,2]-p[:,0];cross=np.cross(e1,e2);area=np.linalg.norm(cross,axis=1)*.5;normal=cross/np.maximum(2*area,1e-30)[:,None];cent=p.mean(axis=1);ua=np.abs(np.cross(uv[:,1]-uv[:,0],uv[:,2]-uv[:,0]))*.5
positions,geom_ids=np.unique(p.reshape(-1,3).astype('<f4'),axis=0,return_inverse=True);geom_ids=geom_ids.reshape(-1,3).astype(np.int32)
corner_fields=np.column_stack([geom_ids.reshape(-1).astype(np.uint64),uv.astype('<f4').reshape(-1,2).view('<u4').reshape(-1,2).astype(np.uint64)]);_,corner_ids=np.unique(corner_fields,axis=0,return_inverse=True);corner_ids=corner_ids.reshape(-1,3).astype(np.int32)
edges=np.concatenate([corner_ids[:,[0,1]],corner_ids[:,[1,2]],corner_ids[:,[2,0]]]);edges.sort(axis=1);edge_faces=np.tile(np.arange(len(p),dtype=np.int32),3);order=np.lexsort((edges[:,1],edges[:,0]));se=edges[order];sf=edge_faces[order];same=np.all(se[1:]==se[:-1],axis=1)
parent=np.arange(len(p),dtype=np.int32);rank=np.zeros(len(p),dtype=np.int8)
def find(x):
 while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
 return x
def union(x,y):
 x=find(int(x));y=find(int(y))
 if x==y:return
 if rank[x]<rank[y]:x,y=y,x
 parent[y]=x
 if rank[x]==rank[y]:rank[x]+=1
for k in np.flatnonzero(same):union(sf[k],sf[k+1])
roots=np.array([find(i)for i in range(len(p))]);_,island=np.unique(roots,return_inverse=True);count=int(island.max()+1)
category=np.full(len(p),'other_architecture',dtype=object);weight=np.full(len(p),.65)
for mi,name in enumerate(names):
 mask=mat==mi
 if name=='TravertineArrivalsStairStone':
  category[mask]='stair_other_faces';weight[mask]=1.0
  up=mask&(normal[:,1]>.5);category[up]='public_treads_landings';weight[up]=2.5
  riser=mask&(np.abs(normal[:,0])>.7);category[riser]='public_stair_risers';weight[riser]=2.0
  down=mask&(normal[:,1]<-.5);category[down]='stair_undersides';weight[down]=.65
 elif name=='PublicFloorMarbleArrivalsRetainedNorth':
  category[mask]='retained_floor_sides_and_undersides';weight[mask]=.6
  up=mask&(normal[:,1]>.5);category[up]='public_retained_floor';weight[up]=1.0
 elif name=='ConcourseOpaqueArrivalsConcrete':
  category[mask]='gallery_concrete_other_faces';weight[mask]=.65
  up=mask&(normal[:,1]>.5);category[up]='public_gallery_floor';weight[up]=1.0
 elif name=='ConcourseOpaqueArrivalsUpperSupports':
  category[mask]='upper_supports';weight[mask]=.6
floor=np.isin(category,['public_treads_landings','public_retained_floor','public_gallery_floor'])
island_area=np.bincount(island,weights=area,minlength=count);island_uv=np.bincount(island,weights=ua,minlength=count);island_weight=np.sqrt(np.bincount(island,weights=area*weight**2,minlength=count)/np.maximum(island_area,1e-30));public=weight>=2;public_area=np.bincount(island,weights=area*public,minlength=count);low_area=np.bincount(island,weights=area*(weight<=.5),minlength=count)
floor_islands=np.bincount(island,weights=area*floor,minlength=count)>0
floor_min=np.zeros(count);np.maximum.at(floor_min,island,weight*floor);island_weight[floor_islands]=np.maximum(island_weight[floor_islands],floor_min[floor_islands])
def summarize(u):
 uvarea=np.abs(np.cross(u[:,1]-u[:,0],u[:,2]-u[:,0]))*.5;rows=[]
 for label in sorted(set(category)):
  m=category==label;physical=float(area[m].sum());ua_=float(uvarea[m].sum());density=np.sqrt(uvarea[m]/np.maximum(area[m],1e-30))*4096;ar=area[m];sort=np.argsort(density);c=np.cumsum(ar[sort]);total=c[-1];q={str(v):float(density[sort[min(int(np.searchsorted(c,v*total)),len(sort)-1)]])for v in [.05,.5,.95]}
  rows.append({'class':label,'triangles':int(m.sum()),'worldArea':physical,'uvArea':ua_,'areaMeanGI4096TexelsPerMetre':math.sqrt(ua_*4096**2/max(physical,1e-30)),'areaWeightedDensityQuantiles':q,'sourceRequestedLinearWeight':float(weight[m][0])})
 return {'atlasSurfaceCoverage':float(uvarea.sum()),'classes':rows}
before=summarize(uv);report={'schema':1,'status':'CENSUS: no UV changes','source':{'path':str(a.source),'sha256':H(a.source)},'baked':{'path':str(a.baked),'sha256':H(a.baked)},'opaqueTriangles':len(p),'exactPositionTopologyVertices':len(positions),'uvCornerKeys':int(corner_ids.max()+1),'trueEdgeConnectedUVIslands':count,'sharedUVEdges':int(same.sum()),'islandsWithPublicAndLowPriorityFaces':int(((public_area>0)&(low_area>0)).sum()),'publicAreaInMixedIslands':float(public_area[low_area>0].sum()),'lowAreaInMixedIslands':float(low_area[public_area>0].sum()),'publicFloorContainingIslands':int(floor_islands.sum()),'weightRule':'Each complete existing UV island receives RMS(area-weighted requested linear weights), with minimum matching public-face priority for any chart containing an existing public tread, landing, retained floor or gallery top. No current seam is split. Classes are conservative actual geometric emphasis regions, not a certified visibility set.','before':before,'generatorSha256':H(Path(__file__)),'limits':['Input retained exactly; no source/runtime file is written.','A real UV repack invalidates old lighting and requires a fresh bake before any promotion.','Foundation and outer-face weights reduce atlas allocation only; all geometry remains and still participates in light transport.']}
np.savez_compressed(a.out/'census-arrays.npz',uv=uv.astype(np.float32),positions=positions.astype(np.float32),faces=geom_ids,island=island,island_weight=island_weight,area=area,category=category.astype(str))
if a.pack:
 bpy.ops.wm.read_factory_settings(use_empty=True);mesh=bpy.data.meshes.new('Disposable exact-position UV topology');mesh.from_pydata(positions.tolist(),[],geom_ids.tolist());mesh.update();layer=mesh.uv_layers.new(name='LightingPriorityReview');assert len(mesh.loops)==len(uv)*3;layer.data.foreach_set('uv',uv.astype(np.float32).reshape(-1));obj=bpy.data.objects.new('UV-only priority packing test',mesh);bpy.context.scene.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj;obj.select_set(True)
 # Scale complete islands about their own current UV centroids. Relative
 # sizes are then preserved by pack_islands' global fit-to-tile scale.
 sums=np.zeros((count,2));corners=np.zeros(count,dtype=np.int64)
 for k in range(3):np.add.at(sums,island,uv[:,k]);np.add.at(corners,island,1)
 centers=sums/np.maximum(corners,1)[:,None];weighted=(uv-centers[island,None,:])*island_weight[island,None,None]+centers[island,None,:];layer.data.foreach_set('uv',weighted.astype(np.float32).reshape(-1))
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.select_all(action='SELECT');bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM',rotate=True,rotate_method='ANY',scale=True,merge_overlap=False,margin_method='FRACTION',margin=4/4096,pin=False,shape_method=a.shape);bpy.ops.object.mode_set(mode='OBJECT')
 loops=np.empty(len(mesh.loops),dtype=np.int32);mesh.loops.foreach_get('vertex_index',loops);assert np.array_equal(loops.reshape(-1,3),geom_ids),'UV-only temporary packing changed face loop order';packed=np.empty(len(mesh.loops)*2,dtype=np.float32);layer=mesh.uv_layers['LightingPriorityReview'];layer.data.foreach_get('uv',packed);packed=packed.reshape(-1,3,2);assert np.isfinite(packed).all();np.save(a.out/'candidate-lighting-uv.npy',packed);report['after']=summarize(packed);report['status']='CANDIDATE: weighted UV packing completed; no bake';report['packArguments']={'shape':a.shape,'margin':4/4096,'marginMethod':'FRACTION','scale':True,'rotate':'ANY'};report['candidateUvSha256']=H(a.out/'candidate-lighting-uv.npy');report['uvRange']=[float(packed.min()),float(packed.max())]
report['elapsedSeconds']=time.monotonic()-started;(a.out/'atlas-review.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k]for k in ['status','opaqueTriangles','trueEdgeConnectedUVIslands','islandsWithPublicAndLowPriorityFaces','publicAreaInMixedIslands','lowAreaInMixedIslands','elapsedSeconds']}),flush=True)
for r in report.get('after',report['before'])['classes']:print(json.dumps(r),flush=True)
