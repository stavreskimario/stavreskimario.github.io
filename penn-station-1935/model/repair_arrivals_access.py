"""Reproduce the reviewed first-eight ordinary arrivals in an external directory.

Requires pinned Blender4.3/numpy. Preserves canonical/runtime assets and exact
retained source attributes. Source positions are qualified reconstructions, not
a historical fabrication or structural-capacity certificate.
"""
from pathlib import Path
from collections import Counter
import argparse,gzip,hashlib,json,math,shutil
import bpy
import numpy as np
from mathutils import Vector,Matrix
from mathutils.bvhtree import BVHTree
REPOSITORY=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',type=Path,required=True,help='Exact pre-arrivals editable scene, SHA256 f2e5a0e3…')
parser.add_argument('--out',type=Path,required=True,help='New review directory outside the repository')
parser.add_argument('--inputs',type=Path,default=REPOSITORY/'authoring/penn-station-1935/review/phase8/arrivals/sourceinputs',help='Frozen primary/source/fixture inputs, with optional lossless .gz archives')
args=parser.parse_args();ROOT=REPOSITORY;SOURCE=args.source.resolve();OUT=args.out.resolve();INPUTS=args.inputs.resolve()
SOURCE_SHA='f2e5a0e382b5d6771030055ed527546005cd18d2a3e2d77f204d570c0a9cc588'
H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert H(SOURCE)==SOURCE_SHA,'Use the exact reviewed pre-arrivals source'
assert OUT!=REPOSITORY and REPOSITORY not in OUT.parents,'Write review outputs outside the repository'
assert not OUT.exists(),'Use a new directory; preserve historical review candidates'
EXPECTED_INPUTS={'bounded-construction-recipe.json': '7b71199f6cccb90bc6ccda1216df300ba7d0e93113349f06efd4626be84a8e7f', 'reviewed-support-trace.json': '2c457abd0f7354353a943431aae6de33d229f93d87eb1aa7a1b71148abd9da6e', 'source-arrival-dependencies.json': '26de8ed782b4d29e76f105ee6f166943f011078be30be2dbcf1a1f55baf3a94e', 'runtime-arrival-fixture-census.json': 'b51b8b9787939f1818f78750603353606e8059f9672c9bd70e5a6de332986590', 'reviewed-support-point-summary.json': '1f1452ce994e1d5e82b863b97e0ee8629fe23286253ba6c56ec40d4631be96b2', 'input-scene-manifest.json': 'fdb502f1b0226f59f9102f9cea88493cd771b5d08323e074a7b9a19d0191de65', 'physical-input-hashes.json': 'b0c6c085018d7fee08ff659b1255033de59e0ec1b2466b19b70bb818a4081e30'}
def read_input(name):
 path=INPUTS/name
 data=path.read_bytes()if path.is_file()else gzip.decompress((INPUTS/(name+'.gz')).read_bytes())
 assert hashlib.sha256(data).hexdigest()==EXPECTED_INPUTS[name],('Frozen input hash changed',name)
 return data
input_bytes={name:read_input(name)for name in EXPECTED_INPUTS}
OUT.mkdir(parents=True)
for name,data in input_bytes.items():(OUT/name).write_bytes(data)
recipe=json.loads(input_bytes['bounded-construction-recipe.json']);trace=json.loads(input_bytes['reviewed-support-trace.json']);census=json.loads(input_bytes['source-arrival-dependencies.json'])
manifest=json.loads(input_bytes['input-scene-manifest.json']);physical_inputs=json.loads(input_bytes['physical-input-hashes.json'])
DROP=4.2672;EXIT=-3.2004;PLATFORM=-7.718425;FOUNDATION=-9.223375;RUN=8.3;LAND=1.2;RISE=(EXIT-PLATFORM)/27;GO=.284
XW,XE=-73.2,-54.912;ZN,ZS=-36.0,71.0
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.view_layer.update()
def sig(o):
 h=hashlib.sha256(np.asarray(o.matrix_world,dtype='<f8').tobytes())
 if o.type=='MESH':
  d=o.data;a=np.empty(len(d.vertices)*3,np.float32);d.vertices.foreach_get('co',a);h.update(a.tobytes())
  a=np.empty(len(d.corner_normals)*3,np.float32);d.corner_normals.foreach_get('vector',a);h.update(a.tobytes())
  for f in d.polygons:h.update(np.asarray(f.vertices,dtype='<i4').tobytes());h.update(str((f.material_index,f.use_smooth)).encode())
  for l in d.uv_layers:
   a=np.empty(len(l.data)*2,np.float32);l.data.foreach_get('uv',a);h.update(l.name.encode());h.update(a.tobytes())
 elif o.type=='FONT':h.update(str((o.data.body,o.data.size)).encode())
 if o.data is not None and hasattr(o.data,'materials'):h.update('|'.join(m.name if m else ''for m in o.data.materials).encode())
 return h.hexdigest()

def material(original,name):
 old=bpy.data.materials[original];m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');q=old.node_tree.nodes.get('Principled BSDF')
 for k in ['Base Color','Roughness','Metallic','Transmission Weight','IOR']:
  if q.inputs.get(k):p.inputs[k].default_value=q.inputs[k].default_value
 return m

def volume(v,faces):
 v=np.asarray(v);c=v.mean(axis=0);return sum(float(np.dot(v[f[0]]-c,np.cross(v[f[i]]-c,v[f[i+1]]-c)))/6 for f in faces for i in range(1,len(f)-1))

def mesh(name,vertices,faces,mat,smooth=False):
 v=np.asarray(vertices,dtype=np.float64);faces=[tuple(f)for f in faces]
 if volume(v,faces)<0:faces=[tuple(reversed(f))for f in faces]
 d=bpy.data.meshes.new(name);d.from_pydata(v.tolist(),[],faces);d.update();d.materials.append(mat)
 uv=d.uv_layers.new(name='ArchitecturalUV')
 for f in d.polygons:
  f.use_smooth=smooth and len(f.vertices)==4
  axis=max(range(3),key=lambda i:abs(f.normal[i]));axes=[i for i in range(3)if i!=axis]
  for k in f.loop_indices:
   p=d.vertices[d.loops[k].vertex_index].co;uv.data[k].uv=(p[axes[0]]/1.5,p[axes[1]]/1.5)
 o=bpy.data.objects.new(name,d);C.objects.link(o);objects.append(o);return o

def box(name,c,size,mat):
 c=Vector(c);r=Vector(size)/2
 return mesh(name,[tuple(c+Vector((x*r.x,y*r.y,z*r.z)))for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]],BOX_F,mat)

def section(name,a,b,profile,mat):
 a,b=Vector(a),Vector(b);t=(b-a).normalized();across=Vector((0,1,0));up=t.cross(across).normalized();n=len(profile)
 v=[tuple(p+across*u+up*w)for p in [a,b]for u,w in profile]
 if n==12:
  cap=[(0,1,3),(0,3,10),(0,10,11),(1,2,3),(10,3,4),(10,4,9),(8,9,7),(9,4,7),(4,6,7),(4,5,6)]
  f=[tuple(reversed(c))for c in cap]+[tuple(n+i for i in c)for c in cap]
 else:f=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
 f += [(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
 return mesh(name,v,f,mat)

def tube(name,a,b,r,mat,segments=12):
 a,b=Vector(a),Vector(b);t=(b-a).normalized();ref=Vector((0,0,1))if abs(t.z)<.9 else Vector((1,0,0));u=t.cross(ref).normalized();w=t.cross(u).normalized()
 v=[tuple(p+r*(u*math.cos(2*math.pi*i/segments)+w*math.sin(2*math.pi*i/segments)))for p in [a,b]for i in range(segments)]
 f=[tuple(range(segments-1,-1,-1)),tuple(range(segments,segments*2))]+[(i,(i+1)%segments,(i+1)%segments+segments,i+segments)for i in range(segments)]
 return mesh(name,v,f,mat,True)

def lathe(name,x,y,z,profile,mat,N=32):
 # Nonzero-radius end disks avoid duplicate pole vertices and collapsed faces.
 v=[(x+r*math.cos(2*math.pi*i/N),y+r*math.sin(2*math.pi*i/N),z+h)for h,r in profile for i in range(N)]
 f=[tuple(range(N-1,-1,-1)),tuple(range((len(profile)-1)*N,len(profile)*N))]
 f += [(k*N+i,k*N+(i+1)%N,(k+1)*N+(i+1)%N,(k+1)*N+i)for k in range(len(profile)-1)for i in range(N)]
 return mesh(name,v,f,mat,True)

def ring(name,x,y,z,r,thickness,mat,N=24,M=8):
 v=[(x+(r+thickness*math.cos(2*math.pi*j/M))*math.cos(2*math.pi*i/N),y+thickness*math.sin(2*math.pi*j/M),z+(r+thickness*math.cos(2*math.pi*j/M))*math.sin(2*math.pi*i/N))for i in range(N)for j in range(M)]
 f=[(i*M+j,((i+1)%N)*M+j,((i+1)%N)*M+(j+1)%M,i*M+(j+1)%M)for i in range(N)for j in range(M)]
 return mesh(name,v,f,mat,True)
BOX_F=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
IP=[(-.075,-.15),(.075,-.15),(.075,-.125),(.012,-.125),(.012,.125),(.075,.125),(.075,.15),(-.075,.15),(-.075,.125),(-.012,.125),(-.012,-.125),(-.075,-.125)]
before={o.name:sig(o)for o in bpy.context.scene.objects}
C=bpy.data.collections.new('Phase7 first eight ARRIVALS — SOURCE REVIEW');bpy.context.scene.collection.children.link(C);objects=[];supports=[];flights=[];landings=[]
STONE=material('Travertine','TravertineArrivalsStairStone');IRON=material('PaintedStructuralIron','PaintedStructuralIronArrivalsStructure');GUARD=material('PaintedStructuralIron','PaintedStructuralIronArrivalsGuard')
STONE['surface_identity']='Pale stone appearance interpreted; original arrival tread stone unverified.'
GUARD['source_identity']='Photo-backed diamond/circular-joint and round-newel family; profiles/cadence inferred.'
def neutral(name,c,r):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=r;return m
FLOOR=neutral('ConcourseOpaqueArrivalsConcrete',(.44,.445,.42),.82);FLOOR['surface_identity']='Neutral interpreted appearance; complete Exit floor finish unverified, not certified marble/granolithic.'
JACKET=neutral('PaintedStructuralIronArrivalsGroutJacket',(.09,.10,.095),.60);UPPER=neutral('ConcourseOpaqueArrivalsUpperSupports',(.42,.425,.40),.82)
JACKET['source_identity']='Gibbs255–256 grout/steel-plate jacket to8ft6aboveplatform, concreteabove;32cmsquare composite exterior inferred.'
NORTH=material('PublicFloorMarble','PublicFloorMarbleArrivalsRetainedNorth');NORTH['source_identity']='Appearance continuation of provisional retained north old Exit deck only; not verified historic marble.'
# Correct sixteen separate source rows; no P9/LIRR forced fit.
rows=[]
for r in recipe['firstSubsetRows']:
 for side in ['west','east']:rows.append({'ordinal':r['ordinal'],'side':side,'centerZ':r[side+'Z'],'headX':XW if side=='west'else XE,'direction':-1 if side=='west'else 1})
CURRENT_ROW=None;CURRENT_SIDE=None;base_mesh=mesh
def mesh(name,vertices,faces,mat,smooth=False):
 if CURRENT_ROW is not None:name=f'Arrival row{CURRENT_ROW} {CURRENT_SIDE} '+name.replace('Arrival P5 ','')
 o=base_mesh(name,vertices,faces,mat,smooth);o['penn_surface_revision']=3;o.data['penn_surface_revision']=3
 if CURRENT_ROW is not None:o['working_arrival_row']=CURRENT_ROW;o['arrival_side']=CURRENT_SIDE
 return o
for row in rows:
 CURRENT_ROW=row['ordinal'];CURRENT_SIDE=row['side']
 cy=-row['centerZ'];direction=row['direction'];x0=row['headX'];y0=EXIT
 f1={'startX':x0,'endX':x0+direction*GO*13,'startY':y0,'endY':y0-RISE*14,'risers':14}
 l={'startX':f1['endX'],'endX':f1['endX']+direction*LAND,'mainY':f1['endY']}
 f2={'startX':l['endX'],'endX':x0+direction*RUN,'startY':l['mainY'],'endY':PLATFORM,'risers':13}
 row['flights']=[f1,f2];row['landing']=l;row['footX']=f2['endX'];row['frame']='Main0glTF for proof; Blender Zup for raw authoring'
 for fi,f in enumerate([f1,f2],1):
  a,b=f['startX'],f['endX'];za,zb=f['startY'],f['endY'];n=f['risers'];dx=(b-a)/n;dz=(zb-za)/n
  # n risers use n-1 internal goings between terminal deck/landing surfaces.
  dx=(b-a)/(n-1)
  profile=[(a,za+dz)]
  for k in range(1,n):
   x=a+dx*k;profile.append((x,za+dz*k))
   if k<n-1:profile.append((x,za+dz*(k+1)))
  profile += [(b,zb-.23),(a,za+dz-.23)]
  from mathutils.geometry import tessellate_polygon
  pv=[Vector((x,z,0))for x,z in profile];lookup={tuple(v):i for i,v in enumerate(pv)}
  cap=[tuple(int(v)if isinstance(v,int)else lookup[tuple(v)]for v in t)for t in tessellate_polygon([pv])]
  nv=len(profile);vv=[(x,cy+side*1.07,z)for side in [-1,1]for x,z in profile]
  ff=[tuple(reversed(t))for t in cap]+[tuple(nv+i for i in t)for t in cap]+[(i,(i+1)%nv,(i+1)%nv+nv,i+nv)for i in range(nv)]
  mesh(f'Arrival P5 {row["side"]} flight{fi} closed stepped stone',vv,ff,STONE)
  for side in [-1,1]:
   yy=cy+side*1.035
   section(f'Arrival P5 {row["side"]} flight{fi} steel stringer',(a,yy,za-.18),(b,yy,zb-.18),IP,IRON)
   tube(f'Arrival P5 {row["side"]} flight{fi} rounded top rail',(a,yy,za+1.06),(b,yy,zb+1.06),.026,GUARD,16)
   tube(f'Arrival P5 {row["side"]} flight{fi} lower guard rail',(a,yy,za+.15),(b,yy,zb+.15),.010,GUARD)
   panels=max(3,round(abs(b-a)/.9));ts=np.linspace(0,1,panels+1)
   for t in ts:
    x=a+(b-a)*t;z=za+(zb-za)*t
    tube(f'Arrival P5 {row["side"]} vertical guard',(x,yy,z-.20),(x,yy,z+1.06),.013,GUARD)
   for ta,tb in zip(ts,ts[1:]):
    m=(ta+tb)/2;mid_x=a+(b-a)*m;mid_z=za+(zb-za)*m
    # Four diagonals around a circular central joint; family photo-supported,
    # exact repeat count, profile and joiner size explicitly interpreted.
    for t,zoff in [(ta,.18),(ta,.98),(tb,.18),(tb,.98)]:
     x=a+(b-a)*t;z=za+(zb-za)*t+zoff
     tube(f'Arrival P5 {row["side"]} diamond guard',(x,yy,z),(mid_x,yy,mid_z+.58),.008,GUARD,10)
    ring(f'Arrival P5 {row["side"]} circular guard joint',mid_x,yy,mid_z+.58,.045,.007,GUARD)
   for x,z in [(a,za),(b,zb)]:
    box('Arrival newel steel bearing pad',(x,yy,z-.22),(.20,.20,.025),IRON)
    lathe('Arrival rounded newel profile',x,yy,z-.22,[(0,.060),(.10,.060),(.14,.043),(.25,.035),(.98,.030),(1.24,.036),(1.27,.046),(1.30,.046)],GUARD,40)
    lathe('Arrival newel round finial',x,yy,z+1.08,[(.0,.008),(.01,.035),(.03,.054),(.06,.060),(.09,.054),(.11,.035),(.12,.008)],GUARD,40)
  flights.append({'side':row['side'],'flight':fi,'start':[a,za,row['centerZ']],'end':[b,zb,row['centerZ']],'risers':n,'internalGoings':n-1,'physicalTreadWidth':2.14,'nominalClearWidth':2.0})
 mid=(l['startX']+l['endX'])/2;z=l['mainY']
 box(f'Arrival P5 {row["side"]} real intermediate landing',(mid,cy,z-.15),(LAND,2.14,.30),STONE)
 for x in [l['startX'],l['endX']]:
  # Cross-girders use a Y-axis-specific frame; a closed rectangular bearing
  # chord is not mislabeled as a measured historic rolled section.
  box(f'Arrival P5 {row["side"]} landing bearing girder',(x,cy,z-.34),(.18,2.34,.30),IRON)
 box(f'Arrival P5 {row["side"]} CENTRAL support girder',(mid,cy,z-.34),(.18,2.34,.30),IRON)
 for side in [-1,1]:
  yy=cy+side*1.035
  tube('Arrival intermediate landing top rail',(l['startX'],yy,z+1.06),(l['endX'],yy,z+1.06),.026,GUARD,16)
  tube('Arrival intermediate landing lower rail',(l['startX'],yy,z+.15),(l['endX'],yy,z+.15),.010,GUARD)
  for x in [l['startX'],mid,l['endX']]:tube('Arrival intermediate landing upright',(x,yy,z-.15),(x,yy,z+1.06),.013,GUARD)
  box('Arrival intermediate landing actual support foot',(mid,yy,PLATFORM+.025),(.26,.26,.05),IRON)
  box('Arrival intermediate landing lower support',(mid,yy,(PLATFORM+.05+z-.49)/2),(.14,.14,z-.49-(PLATFORM+.05)),IRON)
  box('Arrival intermediate landing support cap',(mid,yy,z-.47),(.24,.24,.04),IRON)
  supports.append({'side':row['side'],'type':'intermediate landing post, fabrication inferred','foot':[mid,PLATFORM,row['centerZ']-side*1.035],'topMainY':z-.45})
 # Tread foot bears on a real platform, never an overlapping new nominal slab.
 for side in [-1,1]:
  box('Arrival lower stringer bearing plate',(row['footX'],cy+side*1.035,PLATFORM+.025),(.30,.24,.05),IRON)
 landings.append({'side':row['side'],'startX':l['startX'],'endX':l['endX'],'heightMain':z,'width':2.14})
 # Upper head cross-girder is a connection interface for the independently
 # registered corridor framing, not proof of a complete corridor floor.
 box('Arrival upper head connection girder',(row['headX'],cy,EXIT-.34),(.18,2.34,.30),IRON)
CURRENT_ROW=CURRENT_SIDE=None
for f in flights:
 r=next(r for r in rows if r['side']==f['side']and abs(r['centerZ']-f['start'][2])<1e-6);f['rowOrdinal']=r['ordinal']
print('STAIRS '+str(len(objects)),flush=True)
# Exact old Exit component ownership. Export/removal remains independent of
# all Main floor/glass, other marble, piers and departure atlas data.
original=bpy.data.objects['03 Glass and iron concourse — PublicFloorMarble'];old_data=original.data
old_cells=census['exitSlabComponents'];removed_cells=[r for r in old_cells if r['boundsMain'][1][2]>ZN+1e-5];kept_cells=[r for r in old_cells if r not in removed_cells];crossing=[r for r in removed_cells if r['boundsMain'][0][2]<ZN-1e-5]
assert len(removed_cells)==43 and len(kept_cells)==5 and len(crossing)==3
removed_faces={i for r in removed_cells for i in r['polygons']};keep_faces=[f.index for f in old_data.polygons if f.index not in removed_faces]
def subset(source,face_ids,name,collection,new_material=None):
 d=source.data;ids=sorted({v for p in face_ids for v in d.polygons[p].vertices});lookup={v:i for i,v in enumerate(ids)}
 n=bpy.data.meshes.new(name);n.from_pydata([tuple(d.vertices[i].co)for i in ids],[],[tuple(lookup[i]for i in d.polygons[p].vertices)for p in face_ids]);n.update()
 for m in d.materials:n.materials.append(new_material if new_material else m)
 source_loops=[]
 for old,new in zip(face_ids,n.polygons):
  source_loops+=list(d.polygons[old].loop_indices);new.use_smooth=d.polygons[old].use_smooth;new.material_index=d.polygons[old].material_index
 for layer in d.uv_layers:
  a=n.uv_layers.new(name=layer.name)
  for k,j in enumerate(source_loops):a.data[k].uv=layer.data[j].uv
 if d.has_custom_normals:n.normals_split_custom_set([tuple(d.corner_normals[i].vector)for i in source_loops])
 o=bpy.data.objects.new(name,n);collection.objects.link(o);o.matrix_world=source.matrix_world.copy();return o
ownedC=bpy.data.collections.new('ARRIVALS old-owned export only');bpy.context.scene.collection.children.link(ownedC)
alias='REMOVAL_PublicFloorMarble';orphan=bpy.data.materials.get(alias);orphan_name=None
if orphan:
 assert orphan.users==0;orphan_name=orphan.name;orphan.name='ARRIVALS_TEMP_ORPHAN_'+alias
ownedMat=material('PublicFloorMarble',alias);ownedMat['original_material_name']='PublicFloorMarble';assert ownedMat.name==alias
owned=subset(original,sorted(removed_faces),'Old Exit43ownedcells',ownedC,ownedMat);owned.matrix_world=Matrix.Translation((0,0,DROP))@owned.matrix_world
retained=subset(original,keep_faces,'Retained original marble temporary',ownedC);original.data=retained.data;bpy.data.objects.remove(retained,do_unlink=True)
# Prove exact retained corner coordinates, normals and all UV layers.
old_loops=[i for p in keep_faces for i in old_data.polygons[p].loop_indices]
new_d=original.data
assert np.array_equal(np.array([old_data.vertices[old_data.loops[i].vertex_index].co[:]for i in old_loops]),np.array([new_d.vertices[l.vertex_index].co[:]for l in new_d.loops]))
assert np.array_equal(np.array([old_data.corner_normals[i].vector[:]for i in old_loops]),np.array([n.vector[:]for n in new_d.corner_normals]))
for layer in old_data.uv_layers:assert np.array_equal(np.array([layer.data[i].uv[:]for i in old_loops]),np.array([v.uv[:]for v in new_d.uv_layers[layer.name].data]))
partials=[]
for r in crossing:
 a,b=np.array(r['boundsMain']);x0,x1=a[0],b[0];z0,z1=a[2],ZN;y0,y1=a[1],b[1]
 o=box('Closed provisional north partial Exit cell',((x0+x1)/2,-(z0+z1)/2,(y0+y1)/2),(x1-x0,z1-z0,y1-y0),NORTH)
 partials.append({'sourcePolygons':r['polygons'],'sourceBoundsMain':r['boundsMain'],'newBoundsMain':[[x0,y0,z0],[x1,y1,z1]]})
# Source-traced lift enclosures are independent keepouts, not arrival holes.
shafts=[{'row':r['rowOrdinal'],**r['enclosure']['workingBoundsXZ']}for r in trace['rows']]
holes=[(r['x'][0],r['x'][1],r['z'][0],r['z'][1])for r in shafts]
xs=sorted({XW,XE,*[h[i]for h in holes for i in [0,1]]});zs=sorted({ZN,ZS,*[h[i]for h in holes for i in [2,3]]})
# Merge vertically repeated filled runs, avoiding a per-cell slab explosion.
active={};rectangles=[]
for za,zb in zip(zs,zs[1:]):
 runs=[];start=None
 for xa,xb in zip(xs,xs[1:]):
  filled=not any(h[0]<(xa+xb)/2<h[1]and h[2]<(za+zb)/2<h[3]for h in holes)
  if filled and start is None:start=xa
  if start is not None and(not filled or xb==xs[-1]):
   end=xa if not filled else xb;runs.append((start,end));start=None
 fresh={}
 for run in runs:fresh[run]=[run[0],run[1],active[run][2]if run in active else za,zb]
 rectangles.extend(v for k,v in active.items()if k not in fresh);active=fresh
rectangles+=list(active.values())
frame_objects=[];floor_objects=[]
for a,b,c,d in rectangles:
 o=box('Source registered ordinary Exit slab around individual lift',((a+b)/2,-(c+d)/2,EXIT-.15),(b-a,d-c,.30),FLOOR);floor_objects.append(o);frame_objects.append(o)
print('FLOOR '+str(len(rectangles)),flush=True)
# Every support retains its traced coordinates; two lower paths are held.
points=[p for p in trace['points']if p['id']not in ['C014','C025']];assert len(points)==47
BIGIP=[(-.09,-.24),(.09,-.24),(.09,-.215),(.014,-.215),(.014,.215),(.09,.215),(.09,.24),(-.09,.24),(-.09,.215),(-.014,.215),(-.014,-.215),(-.09,-.215)]
def hbeam(name,a,b):
 a,b=Vector(a),Vector(b)
 if (b-a).length<.03:return None
 t=(b-a).normalized();u=Vector((0,0,1)).cross(t).normalized();up=t.cross(u).normalized();N=len(BIGIP)
 v=[tuple(p+u*x+up*z)for p in [a,b]for x,z in BIGIP];cap=[(0,1,3),(0,3,10),(0,10,11),(1,2,3),(10,3,4),(10,4,9),(8,9,7),(9,4,7),(4,6,7),(4,5,6)]
 f=[tuple(reversed(t))for t in cap]+[tuple(N+i for i in t)for t in cap]+[(i,(i+1)%N,(i+1)%N+N,i+N)for i in range(N)]
 o=mesh(name,v,f,IRON);frame_objects.append(o);return o

def clipped_beam(name,a,b):
 # Keep full flange clear of each known lift volume, then join the ends into
 # its perimeter frame. This is a qualified framing interpretation.
 a=np.array(a,float);b=np.array(b,float);cuts=[]
 for h in holes:
  low=np.array([h[0]-.10,-h[3]-.10]);high=np.array([h[1]+.10,-h[2]+.10]);enter,leave=0.,1.
  for i in [0,1]:
   d=b[i]-a[i]
   if abs(d)<1e-10:
    if not low[i]<a[i]<high[i]:enter,leave=1.,0.;break
   else:
    x,y=(low[i]-a[i])/d,(high[i]-a[i])/d;enter=max(enter,min(x,y));leave=min(leave,max(x,y))
  if enter<leave:cuts.append((max(0,enter),min(1,leave)))
 intervals=[];last=0
 for lo,hi in sorted(cuts):
  if lo>last:intervals.append((last,lo))
  last=max(last,hi)
 if last<1:intervals.append((last,1))
 for lo,hi in intervals:
  if hi-lo>1e-6:hbeam(name,tuple(a+(b-a)*lo),tuple(a+(b-a)*hi))
# Longitudinal inner beams follow actual unequal source positions, not a grid.
for band in [(-69,-64),(-64,-59)]:
 band_points=sorted([p for p in points if band[0]<p['workingWorldXZ']['x']<band[1]],key=lambda p:p['workingWorldXZ']['z'])
 coords=[p['workingWorldXZ']for p in band_points];coords=[{'x':coords[0]['x'],'z':ZN},*coords,{'x':coords[-1]['x'],'z':ZS}]
 for a,b in zip(coords,coords[1:]):clipped_beam('Unequal source support longitudinal transfer girder',(a['x'],-a['z'],EXIT-.54),(b['x'],-b['z'],EXIT-.54))
# Actual clustered source post rows define transverse framing. Small fit
# residuals are absorbed by the real460mm caps, not by moving any column.
clusters=[]
for p in sorted(points,key=lambda p:p['workingWorldXZ']['z']):
 z=p['workingWorldXZ']['z']
 if not clusters or z-clusters[-1][-1]['workingWorldXZ']['z']>.60:clusters.append([])
 clusters[-1].append(p)
for group in clusters:
 pp=np.array([[p['workingWorldXZ']['x'],p['workingWorldXZ']['z']]for p in group]);slope=np.polyfit(pp[:,0],pp[:,1],1)if len(group)>1 and np.ptp(pp[:,0])>1 else [0,pp[0,1]]
 za,zb=np.polyval(slope,[XW,XE]);clipped_beam('Source-post transverse transfer girder',(XW,-za,EXIT-.54),(XE,-zb,EXIT-.54))
for x in [XW,XE]:hbeam('Exit bridge continuous edge girder',(x,-ZN,EXIT-.54),(x,-ZS,EXIT-.54))
for z in [ZN,ZS]:hbeam('Exit review end transverse girder',(XW,-z,EXIT-.54),(XE,-z,EXIT-.54))
for r,h in zip(shafts,holes):
 a,b,c,d=h
 for z in [c-.11,d+.11]:hbeam('Individual source lift perimeter beam',(a-.11,-z,EXIT-.54),(b+.11,-z,EXIT-.54))
 for x in [a-.11,b+.11]:hbeam('Individual source lift perimeter beam',(x,-c+.11,EXIT-.54),(x,-d-.11,EXIT-.54))
# Upper continuations require full-cap contact with actual opaque Main bearing,
# deliberately excluding85mmvault-light webs and every glass pane.
main_trees=[]
for obj in bpy.context.scene.objects:
 if obj.type!='MESH'or not any(m and m.name=='ConcourseOpaqueCirculationConcrete'for m in obj.data.materials):continue
 v=[Matrix.Translation((0,0,DROP))@obj.matrix_world@p.co for p in obj.data.vertices]
 main_trees.append((obj.name,BVHTree.FromPolygons(v,[tuple(f.vertices)for f in obj.data.polygons])))
def upper_hit(x,z):
 hits=[]
 for name,t in main_trees:
  p,n,i,d=t.ray_cast(Vector((x,-z,EXIT+.05)),Vector((0,0,1)),4)
  if p is not None and -.65<p.z<-.001 and n.z<-.98:hits.append((p.z,name))
 return min(hits)if hits else None
upper_records=[];column_objects=[]
for p in points:
 x,z=p['workingWorldXZ']['x'],p['workingWorldXZ']['z'];y=-z;start=len(objects);id=p['id'];jacket_top=PLATFORM+8.5*.3048
 box(id+' foundation bearing plate',(x,y,FOUNDATION),(.50,.50,.08),IRON)
 box(id+' grouted steel-jacket lower support',(x,y,(FOUNDATION+.04+jacket_top)/2),(.32,.32,jacket_top-FOUNDATION-.04),JACKET)
 column_top=EXIT-.84
 box(id+' exposed concrete lower support',(x,y,(jacket_top+column_top)/2),(.32,.32,column_top-jacket_top),UPPER)
 box(id+' real lower girder cap',(x,y,EXIT-.81),(.46,.46,.06),IRON)
 sampled=[upper_hit(x+dx,z+dz)for dx in np.linspace(-.23,.23,5)for dz in np.linspace(-.23,.23,5)]
 eligible=all(q is not None for q in sampled)and max(q[0]for q in sampled)-min(q[0]for q in sampled)<.00003
 if eligible:
  top=min(q[0]for q in sampled)
  box(id+' source-family upper concrete continuation',(x,y,(EXIT-.30+top-.06)/2),(.32,.32,top-.06-(EXIT-.30)),UPPER)
  box(id+' actual opaque Main contact cap',(x,y,top-.03),(.46,.46,.06),IRON)
 upper_records.append({'id':id,'sourceXZ':p['workingWorldXZ'],'opaqueCapFootprintSamples':25,'opaqueCapSamplesHit':sum(q is not None for q in sampled),'upperBuilt':eligible,'targetTopMain':min(q[0]for q in sampled if q)if eligible else None,'status':'Physical opaque contact only, capacity/fabrication inferred'if eligible else 'Upper continuation/transfer held; no cap floating below glass/web'})
 column_objects+=objects[start:]
print('FRAME '+str(len(frame_objects))+' COLS '+str(len(column_objects)),flush=True)
# Reconstructed closed lift cages guard the reserved openings. They are not
# functioning elevator simulations or individually certified Main-reaching lifts.
for r,h in zip(shafts,holes):
 a,b,c,d=h;bottom=PLATFORM;top=EXIT+2.20
 for x in [a,b]:
  for z in [c,d]:box(f'Lift{r["row"]} source-outline corner frame',(x,-z,(bottom+top)/2),(.055,.055,top-bottom),IRON)
 for (x0,z0),(x1,z1)in zip([(a,c),(b,c),(b,d),(a,d)],[(b,c),(b,d),(a,d),(a,c)]):
  length=math.hypot(x1-x0,z1-z0)
  for k in range(1,max(2,math.ceil(length/.14))):
   t=k/max(2,math.ceil(length/.14));x=x0+(x1-x0)*t;z=z0+(z1-z0)*t;tube('Lift enclosure interpreted vertical grille',(x,-z,bottom),(x,-z,top),.008,GUARD,10)
  for yy in [bottom+.15,bottom+1.1,EXIT-.10,EXIT+1.1,top]:tube('Lift enclosure horizontal member',(x0,-z0,yy),(x1,-z1,yy),.015,GUARD)
# Edge fences omit exact arrival entries and physically join their newels.
def horizontal_guard(name,x0,z0,x1,z1):
 length=math.hypot(x1-x0,z1-z0);N=max(1,math.ceil(length/.9))
 for h,r in [(1.12,.023),(.15,.010)]:tube(name+' rail',(x0,-z0,EXIT+h),(x1,-z1,EXIT+h),r,GUARD,12)
 for i in range(N+1):
  t=i/N;x=x0+(x1-x0)*t;z=z0+(z1-z0)*t;tube(name+' grounded upright',(x,-z,EXIT-.05),(x,-z,EXIT+1.12),.011,GUARD,10)
for side,x in [('west',XW),('east',XE)]:
 intervals=[];last=ZN
 for r in sorted([r for r in rows if r['side']==side],key=lambda r:r['centerZ']):
  lo,hi=r['centerZ']-1.17,r['centerZ']+1.17
  if lo>last:intervals.append((last,lo))
  last=max(last,hi)
  for sign in [-1,1]:tube('Arrival head physically connected guard return',(x,-(r['centerZ']+sign*1.17),EXIT+1.12),(x,-(r['centerZ']+sign*1.035),EXIT+1.06),.024,GUARD,12)
 if last<ZS:intervals.append((last,ZS))
 for a,b in intervals:horizontal_guard('Exit outer source-family fence',x,a,x,b)
for z in [ZN,ZS]:horizontal_guard('Temporary bounded-research end guard',XW,z,XE,z)
# Actual new underside selects fixture heights and verifies full mounting
# flange footprints. No guessedY or oldfloatingemitter remains in recipe.
trees=[]
for obj in frame_objects:
 trees.append((obj.name,BVHTree.FromPolygons([v.co for v in obj.data.vertices],[tuple(f.vertices)for f in obj.data.polygons])))
def ceiling(x,z):
 hits=[]
 for name,t in trees:
  p,n,i,d=t.ray_cast(Vector((x,-z,PLATFORM+.5)),Vector((0,0,1)),6)
  if p is not None and n.z<-.98:hits.append((p.z,name))
 return min(hits)if hits else None
fixtures=manifest['railway']['platformNernstFixtures'];groups=[];fixture_proofs=[]
for i,old in enumerate(fixtures[:16]):
 z=old['positionLocal'][2];preferred=XW+18.288*.25 if i%2==0 else XW+18.288*.75;chosen=None
 for shift in [0,-.24,.24,-.48,.48]:
  x=preferred+shift;hit=ceiling(x,z)
  if not hit or hit[0]-PLATFORM<2.8:continue
  samples=[ceiling(x+.094*math.cos(t),z+.094*math.sin(t))for t in np.linspace(0,2*math.pi,17)[:-1]]
  if all(q is not None and abs(q[0]-hit[0])<.00002 for q in samples):chosen=(x,hit,samples);break
 assert chosen,('No complete real fixture mount',i)
 x,hit,samples=chosen;mount=[x,hit[0],z];world=[x,hit[0]-DROP,z]
 groups.append({'instance':i,'platform':old['platform'],'fromMain':old['positionLocal'],'toMain':mount,'mountWorld':world,'glowerCentreMain':[x,hit[0]-.324,z],'glowerCentreWorld':[x,hit[0]-.324-DROP,z],'glowerCentresMain':[[x+dx,hit[0]-.324,z]for dx in [-.035,0,.035]],'glowerCentresWorld':[[x+dx,hit[0]-.324-DROP,z]for dx in [-.035,0,.035]]})
 fixture_proofs.append({'instance':i,'preferredX':preferred,'actualMountMain':mount,'actualSupportingMesh':hit[1],'fullFlangeRingSamples':16,'maxCeilingMismatch':max(abs(q[0]-hit[0])for q in samples),'abovePlatformGlower':hit[0]-.324-PLATFORM})
fc=json.loads((OUT/'runtime-arrival-fixture-census.json').read_text());models={v['variant']:{'sha256':v['files']['model-platform'+('-low'if v['variant']=='low'else'')+'.glb.gz']['sha256']}for v in fc['variants']}
parts=[{'node':n,'primitive':0,'material':'Railway tie plates and bolts'if n in [7,8,10]else'Platform Nernst ceramic fittings'if n==9 else'PlatformNernstGlower','originOffsetMain':offset}for n,offset in [(7,[0,-.007,0]),(8,[0,-.1,0]),(9,[0,-.23,0]),(10,[0,-.286,0]),(11,[-.035,-.324,0]),(12,[0,-.324,0]),(13,[.035,-.324,0])]]
fixture_recipe={'schema':1,'coordinateSpace':'Main0-glTF','authoring':{'tool':'Blender','sourceBlendSha256':SOURCE_SHA,'generatorSha256':H(Path(__file__)),'supportProofSha256':None},'instanceCount':22,'selectedInstanceIds':list(range(16)),'parts':parts,'models':models,'groups':groups,'retainedInstances':list(range(16,22)),'qualification':'Positions inferred; height/fullflange uses actual new ceiling. Retained6mounts remain on exact/provisionalclosed northdeck. Runtimeactualfixture/clearance proof required.'}
fixture_proof={'schema':1,'scope':'Blender actualnewfloor/girder underside mounting proof; complete7partruntimeplacement separatelyvalidated.','sourceBlendSha256':SOURCE_SHA,'entries':fixture_proofs};(OUT/'fixture-support-proof.json').write_text(json.dumps(fixture_proof,indent=2)+'\n');fixture_recipe['authoring']['supportProofSha256']=H(OUT/'fixture-support-proof.json');(OUT/'fixture-relocation-recipe.json').write_text(json.dumps(fixture_recipe,indent=2)+'\n')
print('FIXTURES16 realundersides',flush=True)
# Actual mesh closure/winding/UVguards precede any expensive bake.
geometry_checks=[]
for obj in objects:
 d=obj.data;d.calc_loop_triangles();v=np.array([p.co[:]for p in d.vertices]);faces=[tuple(f.vertices)for f in d.polygons];directed=Counter((a,b)for f in faces for a,b in zip(f,f[1:]+f[:1]));assert all(c==directed[(b,a)]==1 for(a,b),c in directed.items()),('Winding',obj.name)
 vol=volume(v,faces);areas=[np.linalg.norm(np.cross(v[t.vertices[1]]-v[t.vertices[0]],v[t.vertices[2]]-v[t.vertices[0]]))/2 for t in d.loop_triangles];assert vol>1e-10 and min(areas)>1e-12,('Collapsed',obj.name)
 geometry_checks.append({'object':obj.name,'material':d.materials[0].name,'closedOutward':True,'signedVolume':vol,'triangles':len(d.loop_triangles)})
print('GEOMETRY '+str(len(objects)),flush=True)
def export(selected,path):
 bpy.ops.object.select_all(action='DESELECT')
 for o in selected:o.hide_viewport=False;o.select_set(True)
 bpy.context.view_layer.objects.active=selected[0];bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_normals=True,export_texcoords=True,export_materials='EXPORT',export_extras=True)
export([owned],OUT/'old-exit-owned.glb');export(objects,OUT/'arrivals-module.glb')
# Source-copy export with exact UVs/normals and texture-free scalar materials.
retained_objects=[o for o in bpy.context.scene.objects if o.type in ['MESH','FONT']and any(c.name.startswith(('03 ','Phase6 corrected','Phase7 circulation'))for c in o.users_collection)]
TEMP=bpy.data.collections.new('ARRIVALS retained export copies');bpy.context.scene.collection.children.link(TEMP);copies=[];datas={};mats={};renamed={}
for o in retained_objects:
 if o.data is None or not hasattr(o.data,'materials'):continue
 for m in o.data.materials:
  if m and m not in renamed:renamed[m]=m.name;m.name='ARRIVALS_TEMP_'+m.name
for m,name in renamed.items():
 clone=bpy.data.materials.new(name);clone.use_nodes=True;old=m.node_tree.nodes.get('Principled BSDF')if m.use_nodes else None;q=clone.node_tree.nodes.get('Principled BSDF')
 if old:
  for k in ['Base Color','Roughness','Metallic','Transmission Weight','IOR']:
   if old.inputs.get(k):q.inputs[k].default_value=old.inputs[k].default_value
 mats[m]=clone
for o in retained_objects:
 cp=o.copy()
 if o.data:
  if o.data not in datas:
   data=o.data.copy()
   if hasattr(data,'materials'):
    slots=list(data.materials);data.materials.clear()
    for m in slots:data.materials.append(mats[m]if m else None)
   datas[o.data]=data
  cp.data=datas[o.data]
 TEMP.objects.link(cp);cp.parent=None;cp.matrix_world=Matrix.Translation((0,0,DROP))@o.matrix_world;copies.append(cp)
bpy.context.view_layer.update();export(copies,OUT/'retained-concourse-occluder.glb');shutil.copyfile(OUT/'retained-concourse-occluder.glb',OUT/'retained-protected.glb')
for cp in copies:bpy.data.objects.remove(cp,do_unlink=True)
for data in datas.values():
 if data.users==0:bpy.data.batch_remove(ids=[data])
for m in mats.values():
 if m.users==0:bpy.data.materials.remove(m)
for m,name in renamed.items():m.name=name
bpy.data.collections.remove(TEMP);owned_data=owned.data;bpy.data.objects.remove(owned,do_unlink=True);bpy.data.collections.remove(ownedC)
if owned_data.users==0:bpy.data.meshes.remove(owned_data)
if ownedMat.users==0:bpy.data.materials.remove(ownedMat)
if orphan:orphan.name=orphan_name
for o in objects:o.location.z-=DROP
bpy.context.view_layer.update();unrelated={n:sig(bpy.data.objects[n])for n in before if n!=original.name};assert unrelated=={n:s for n,s in before.items()if n!=original.name},'Unrelated source objects changed'
assert H(SOURCE)==SOURCE_SHA
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'arrivals-eight-review.blend'),compress=True)
outputs={p.name:{'sha256':H(p),'bytes':p.stat().st_size}for p in [OUT/'old-exit-owned.glb',OUT/'arrivals-module.glb',OUT/'retained-concourse-occluder.glb',OUT/'retained-protected.glb',OUT/'arrivals-eight-review.blend',OUT/'fixture-relocation-recipe.json']}
proof={'schema':1,'status':'EXTERNAL FIRST8ARRIVALS CANDIDATE. No runtime/canonicalpublication. Actualindependentbody/clearance/fixtures/loadpathtests pending.','source':str(SOURCE),'sourceSha256':SOURCE_SHA,'sourceSha256After':H(SOURCE),'generatorSha256':H(Path(__file__)),'allSixPhysicalInputs':physical_inputs,'inputRecipes':{n:H(OUT/n)for n in ['bounded-construction-recipe.json','reviewed-support-trace.json','source-arrival-dependencies.json','runtime-arrival-fixture-census.json']},'frames':{'raw':'Main0glTF:Xeast,Yup,Zsouth','savedMainWorldY':-DROP},'corridor':{'boundsXZ':[XW,XE,ZN,ZS],'topMainY':EXIT,'slabThickness':.30,'northStatus':'Temporary research boundary, not historicalpartition','southStatus':'Approximate registeredsourcepublicend±1m','liftKeepouts':shafts},'stairs':rows,'flights':flights,'landingRecords':landings,'oldExitOwnership':{'removedCellCount':43,'retainedExactCellCount':5,'crossingRemovedAndClosedPartialCount':3,'removedCells':removed_cells,'retainedExactCells':kept_cells,'newPartials':partials,'retainedMarbleCornersExact':len(old_loops),'positionsNormalsEveryUvExact':True},'structuralSource':{'traced':49,'safeLowerBuilt':47,'heldIds':['C014','C025'],'upperRecords':upper_records,'jacketHeightAbovePlatform':2.5908,'foundationTopNominalMain':FOUNDATION,'memberDimensions':'320mmsquarebody500mmbases460mmcaps480mmdeepgirdersinferred, no capacitycertification','jointMethod':'Members overlap at intentional structural joints; source positions retained. No generic source grid cloned.'},'fixtureRecipe':'fixture-relocation-recipe.json','fixtureSupportProof':'fixture-support-proof.json','unrelatedObjectSignaturesExact':len(unrelated),'geometryChecks':geometry_checks,'counts':{'newObjects':len(objects),'closedOutwardComponents':len(geometry_checks),'triangles':sum(r['triangles']for r in geometry_checks)},'outputs':outputs,'limits':['WesternMainfloor/prismsand20definite+6edgeMainbasesunchanged; lowerwesterncorrectionheld.','P9/LIRRindividualroutesandfullstreetwardExitconnectionsnotreconstructed.','Sourcephotoformbacked,14+13risers/25goings/.284m/1.2m/2mwidthandminorprofilesinferred.','Uppercontinuationsonlyactualfullcapopaquebearingcontacts; prism/webtransferfamilyheldwithoutfloatingcaps.','Liftcagesareclosedvisualenclosures, notfunctioningelevators orcertifiedMainreachingassignments.','Understairlandinggirderclearance~1.682m isblockedspace, notwalkthrough.','All6northfixturesretainactualcloseddeck;16newpositionsinferredbutphysicallyseated, completecurrentruntimeinstanceproofpending.','Newfloorfinishneutralinterpreted, notverifiedhistoricalmarble.','No globalilluminationbake/nativeproductionbrowseracceptanceperformedbythisworker.']}
(OUT/'source-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
world_flights=[]
for f in flights:
 world_flights.append({**f,'label':f'Arrival {f["rowOrdinal"]} {f["side"]} flight {f["flight"]}','width':f['nominalClearWidth'],'start':[f['start'][0],f['start'][1]-DROP,f['start'][2]],'end':[f['end'][0],f['end'][1]-DROP,f['end'][2]],'coordinateSpace':'world-glTF'})
arrival_access=[]
for r in rows:
 centre=r['centerZ'];land=r['landing']
 arrival_access.append({'sourceOrdinal':r['ordinal'],'workingPlatform':r['ordinal'],'platformMappingStatus':'SourceFig3unnumbered candidate correspondence; P9/LIRRnotincluded','side':r['side'],'sourceCenterZ':centre,'exitHeadWorld':[r['headX'],EXIT-DROP,centre],'platformFootWorld':[r['footX'],PLATFORM-DROP,centre],'flights':[f for f in world_flights if f['rowOrdinal']==r['ordinal']and f['side']==r['side']],'intermediateLanding':{'boundsXZ':[min(land['startX'],land['endX']),max(land['startX'],land['endX']),centre-1.07,centre+1.07],'worldY':land['mainY']-DROP},'geometryBasedFloorRayRequired':True})
layout={'schema':1,'sourceProofSha256':H(OUT/'source-proof.json'),'coordinateSpace':'world-glTF,exceptexplicitMainfields','stairSupportFlights':world_flights,'arrivalAccess':arrival_access,'ordinaryExitFloor':{'label':'First8source-registeredordinaryExitcorridor','boundsXZ':[XW,XE,ZN,ZS],'worldTopY':EXIT-DROP,'surface':'actualfloorwith8liftopenings;useactualraycast,neverafakefloorplane','northEndStatus':'temporaryresearchguard,notauthenticpartition','sourceWidth':18.288,'minimumPositionUncertainty':1},'retainedProvisionalNorthExit':{'boundsXZ':[-55.25630187988281,-47.75630187988281,-72.38999938964844,ZN],'worldTopY':EXIT-DROP,'oldOpenHoleXZ':[-53.4563,-48.9563,-40.32146-1.65,-40.32146+1.65],'status':'retainedprovisionalP9/LIRRdecksupporting6fixtures,notfinishedhistoricalcirculation','exactOldCells':5,'closedReplacementPartialCells':3,'geometryBasedFloorRayRequired':True},'liftKeepouts':shafts,'fixtureGroups':groups,'preserveExistingManifestFields':['27departurestairSupportFlights','9accessStairs','allcurrentdeparturewalkablebounds/P1P2approaches'],'limits':proof['limits']}
(OUT/'arrival-layout.json').write_text(json.dumps(layout,indent=2)+'\n')
print(json.dumps({'outputs':outputs,'counts':proof['counts'],'upperBuilt':sum(r['upperBuilt']for r in upper_records),'unrelatedExact':len(unrelated)},indent=2),flush=True)
