"""Author the reviewed connected Penn Station arcade in an external output.

Architectural body is copied byte-for-byte from frozen connected-v12. This
portable header changes only argument/path handling and input verification.
"""
from pathlib import Path
import argparse,hashlib,json,math,shutil,struct
from collections import Counter,defaultdict
P=Path(__file__).resolve().parent
H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
SOURCE_SHA="c96fb37215d4ebfc7bbbba9154fe7f96a8daf8500e9c61778136e286c4a03739"
EXPECTED_CONTROLS={'arcade-ownership-controls.json': '30dfea97e2ab7ca44f13a8eee5156941f55b07c30ebee5c773dd8c29cff08240', 'arcade-source-audit.json': '2185467c03416512569dea1ddb681051b85361a4861e351a249b4591a3c1fce5', 'arcade-section-calibration.json': 'e375323ec56ad541bc8a25bac7c5d39fbb5d7cd78488dc9167a5e97df2d6f60f', 'arcade-connected-ownership-controls.json': 'a38ce6abfbd07689cf7cde2bfcc73a3b139ae6e2d37ebdca8045dd728adb924f'}
ap=argparse.ArgumentParser(description=__doc__)
ap.add_argument('--source',type=Path,required=True,help='Exact reviewed c96 input Blender file; never overwritten.')
ap.add_argument('--controls',type=Path,default=P/'controls')
ap.add_argument('--out',type=Path,help='New external review directory; must not exist.')
ap.add_argument('--check-inputs',action='store_true',help='Check hashes without loading Blender or authoring anything.')
a=ap.parse_args();SOURCE=a.source.resolve();RESEARCH=a.controls.resolve()
assert SOURCE.is_file()and H(SOURCE)==SOURCE_SHA,'Unreviewed source input'
for name,digest in EXPECTED_CONTROLS.items():
 assert H(RESEARCH/name)==digest,'Changed source control: '+name
controls=json.loads((RESEARCH/'arcade-ownership-controls.json').read_text())
audit=json.loads((RESEARCH/'arcade-source-audit.json').read_text())
cal=json.loads((RESEARCH/'arcade-section-calibration.json').read_text())
connected=json.loads((RESEARCH/'arcade-connected-ownership-controls.json').read_text())
assert controls['sourceSha256']==SOURCE_SHA and audit['sourceSha256']==SOURCE_SHA and connected['sourceSha256']==SOURCE_SHA
if a.check_inputs:
 print(json.dumps({'sourceSha256':SOURCE_SHA,'controls':EXPECTED_CONTROLS,'authoringPerformed':False},indent=2));raise SystemExit(0)
if a.out is None:ap.error('--out is required for authoring')
OUT=a.out.resolve()
assert not OUT.exists()and not SOURCE.is_relative_to(OUT),'Output must be new and cannot contain source'
OUT.mkdir(parents=True)
import bpy,numpy as np
from mathutils import Vector
# Frozen architectural body begins. Do not hand-edit geometry in this port.
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.view_layer.update()

def sig(o):
 h=hashlib.sha256(np.asarray(o.matrix_world,dtype='<f8').tobytes())
 if o.type=='MESH':
  d=o.data;v=np.empty(len(d.vertices)*3,np.float32);d.vertices.foreach_get('co',v);h.update(v.tobytes())
  v=np.empty(len(d.corner_normals)*3,np.float32);d.corner_normals.foreach_get('vector',v);h.update(v.tobytes())
  for f in d.polygons:h.update(np.asarray(f.vertices,dtype='<i4').tobytes());h.update(str((f.material_index,f.use_smooth)).encode())
  for l in d.uv_layers:
   v=np.empty(len(l.data)*2,np.float32);l.data.foreach_get('uv',v);h.update(l.name.encode());h.update(v.tobytes())
 elif o.type=='FONT':h.update(str((o.data.body,o.data.size)).encode())
 if o.data is not None and hasattr(o.data,'materials'):h.update('|'.join(m.name if m else ''for m in o.data.materials).encode())
 return h.hexdigest()
before={o.name:sig(o)for o in bpy.context.scene.objects}
def value(v):
 if v is None or isinstance(v,(str,int,float,bool)):return v
 if isinstance(v,dict):return {k:value(q)for k,q in v.items()}
 if hasattr(v,'to_dict'):return {k:value(q)for k,q in v.to_dict().items()}
 try:return [value(q)for q in v]
 except TypeError:return str(v)
def material_sig(m):
 data={'name':m.name,'use_nodes':m.use_nodes,'diffuse':list(m.diffuse_color),'metallic':m.metallic,'roughness':m.roughness,'backface':m.use_backface_culling,'extras':value(dict(m.items()))}
 if m.use_nodes:
  nodes=[]
  for n in m.node_tree.nodes:
   props={}
   for p in n.bl_rna.properties:
    if p.identifier in ['rna_type','name','select','dimensions','internal_links']or p.type not in ['BOOLEAN','INT','FLOAT','STRING','ENUM']:continue
    try:props[p.identifier]=value(getattr(n,p.identifier))
    except (AttributeError,TypeError):pass
   nodes.append({'name':n.name,'type':n.bl_idname,'properties':props,'extras':value(dict(n.items())),'inputs':[(s.identifier,value(s.default_value))for s in n.inputs if hasattr(s,'default_value')],'image':(n.image.name,n.image.filepath,n.image.colorspace_settings.name)if getattr(n,'image',None)else None})
  data['nodes']=nodes;data['links']=sorted((l.from_node.name,l.from_socket.identifier,l.to_node.name,l.to_socket.identifier)for l in m.node_tree.links)
 return hashlib.sha256(json.dumps(data,sort_keys=True,default=str).encode()).hexdigest()
source_material_objects=set(bpy.data.materials);source_material_signatures={m.name:material_sig(m)for m in source_material_objects}
source_node_tree_pointers={m.node_tree.as_pointer()for m in source_material_objects if m.use_nodes}
source_node_used={(m.name,n.name):('used'in n,value(n.get('used')))for m in source_material_objects if m.use_nodes for n in m.node_tree.nodes}
EXTERIOR=bpy.data.collections['01 Exterior and context']
C=bpy.data.collections.new('Phase9 FORMAL ARCADE — EXTERNAL SOURCE REVIEW');bpy.context.scene.collection.children.link(C)
OWN=bpy.data.collections.new('ARCADE old-owned export only');bpy.context.scene.collection.children.link(OWN)
objects=[];contacts=[]
def material(old,name,roughness=None):
 m=bpy.data.materials[old].copy();m.name=name
 if roughness is not None:
  q=m.node_tree.nodes.get('Principled BSDF')
  for key in ['Roughness','Normal']:
   for link in list(q.inputs[key].links):m.node_tree.links.remove(link)
  q.inputs['Roughness'].default_value=roughness
 return m
STONE=material('Travertine','TravertineArcadeCastComposition')
VAULT=material('Travertine','ArcadeVaultCastComposition',.80)
q=VAULT.node_tree.nodes.get('Principled BSDF')
for link in list(q.inputs['Base Color'].links):VAULT.node_tree.links.remove(link)
q.inputs['Base Color'].default_value=(.66,.64,.60,1)
VAULT['surface_identity']='Matte cast-composition appearance inferred; no new ceiling coffer or decorative motif.'
BRONZE=material('PaintedStructuralIron','ArcadeOrnamentalMetal')
BACK=material('PublicFloorMarble','ArcadeNeutralUnassignedShopBacking',.68)
q=BACK.node_tree.nodes.get('Principled BSDF')
for link in list(q.inputs['Base Color'].links):BACK.node_tree.links.remove(link)
q.inputs['Base Color'].default_value=(.20,.18,.15,1)
BACK['surface_identity']='Neutral matte grey-brown unassigned backing, an appearance interpretation without invented tenant fittings.'
FLOOR=material('PublicFloorMarble','PublicFloorMarbleArcadeRecessBearingPhase9')
def glass(name):
 m=bpy.data.materials.new(name);m.use_nodes=True;q=m.node_tree.nodes.get('Principled BSDF')
 q.inputs['Base Color'].default_value=(.985,.995,.99,1);q.inputs['Metallic'].default_value=0
 q.inputs['Roughness'].default_value=.05;q.inputs['IOR'].default_value=1.52;q.inputs['Transmission Weight'].default_value=1.0
 m.use_backface_culling=True;m['optical_interpretation']='Clear uncoated architectural plate glass, IOR1.52/transmission1/roughness.05 interpreted; no measured historic optical sample or invented wave/grime.'
 m['skip_lighting_atlas']=True;return m
GLASS=glass('ArcadeShopAndClerestoryGlass')
GLASS['walk_collision']='closed-glazing'
BOX=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
def volume(v,faces):
 q=np.asarray(v,dtype=float);c=q.mean(axis=0)
 return sum(float(np.dot(q[f[0]]-c,np.cross(q[f[i]]-c,q[f[i+1]]-c)))/6 for f in faces for i in range(1,len(f)-1))
def mesh(name,v,f,mat,smooth=False):
 f=[tuple(x)for x in f]
 if volume(v,f)<0:f=[tuple(reversed(x))for x in f]
 d=bpy.data.meshes.new(name);d.from_pydata(v,[],f);d.update();d.materials.append(mat)
 uv=d.uv_layers.new(name='ArchitecturalUV')
 for p in d.polygons:
  p.use_smooth=smooth and len(p.vertices)==4
  axis=max(range(3),key=lambda i:abs(p.normal[i]));axes=[i for i in range(3)if i!=axis]
  for k in p.loop_indices:
   w=d.vertices[d.loops[k].vertex_index].co;uv.data[k].uv=(w[axes[0]]*.28,w[axes[1]]*.28)
 o=bpy.data.objects.new(name,d);C.objects.link(o);o['penn_source_scope']='Connected arcade, loggia and vestibule; primary plan/photo reconstruction with qualified dimensions';objects.append(o);return o
def box(name,c,s,m):
 c=Vector(c);r=Vector(s)/2
 return mesh(name,[tuple(c+Vector((x*r.x,y*r.y,z*r.z)))for x,y,z in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]],BOX,m)
def prism(name,profile,y0,y1,mat):
 # Profile X,Z, extruded in north/southY. Tessellate real concave caps.
 from mathutils.geometry import tessellate_polygon
 p=[Vector((x,z,0))for x,z in profile];lookup={tuple(x):i for i,x in enumerate(p)}
 cap=[tuple(int(q)if isinstance(q,int)else lookup[tuple(q)]for q in tri)for tri in tessellate_polygon([p])];n=len(p)
 v=[(x,y,z)for y in [y0,y1]for x,z in profile]
 f=cap+[tuple(n+i for i in reversed(t))for t in cap]+[((i+1)%n,i,i+n,(i+1)%n+n)for i in range(n)]
 return mesh(name,v,f,mat)
def beam(name,p0,p1,r,m,N=12):
 p0,p1=Vector(p0),Vector(p1);t=(p1-p0).normalized();ref=Vector((0,0,1))if abs(t.z)<.9 else Vector((1,0,0));u=t.cross(ref).normalized();w=t.cross(u)
 v=[tuple(p+r*(u*math.cos(2*math.pi*i/N)+w*math.sin(2*math.pi*i/N)))for p in [p0,p1]for i in range(N)]
 f=[tuple(range(N-1,-1,-1)),tuple(range(N,N*2))]+[(i,(i+1)%N,(i+1)%N+N,i+N)for i in range(N)]
 return mesh(name,v,f,m,True)

# Exact source-component ownership; all untouched corner attributes retained.
selected=[]
for group in controls['selectionGroups']:
 if group['role']in ['remove-replace-envelope','remove-replace-opaque-storefronts','coordinate-clerestory-exterior-openings']:selected+=group['components']
upper=[]
for c in audit['components']:
 lo,hi=c['boundsBlenderWorld'];sz=np.array(hi)-lo
 if lo[0]>43 and hi[0]<89.55 and min(abs(lo[1]),abs(hi[1]))>8.74 and max(abs(lo[1]),abs(hi[1]))<8.94 and lo[2]>10.5 and hi[2]<16.91 and sz[0]<1.61 and sz[2]<1.91:upper.append(c)
assert len(upper)==264
selected+=upper;assert len(selected)==327
selected+=connected['components'];assert len(selected)==394
by=defaultdict(list)
for c in selected:by[c['object']].append(c)
owned=[];retained_checks=[];owned_aliases={};source_primary_uv={}
def subset(source,ids,name,col,alias=False):
 d=source.data;vi=sorted({v for i in ids for v in d.polygons[i].vertices});look={v:i for i,v in enumerate(vi)}
 n=bpy.data.meshes.new(name);n.from_pydata([tuple(d.vertices[i].co)for i in vi],[],[tuple(look[v]for v in d.polygons[i].vertices)for i in ids]);n.update()
 for mat in d.materials:
  if alias:
   if mat.name not in owned_aliases:
    m=bpy.data.materials.new('REMOVAL_'+mat.name);m.use_nodes=True;m['original_material_name']=mat.name;owned_aliases[mat.name]=m
   n.materials.append(owned_aliases[mat.name])
  else:n.materials.append(mat)
 loops=[]
 for old,new in zip(ids,n.polygons):
  loops+=list(d.polygons[old].loop_indices);new.material_index=d.polygons[old].material_index;new.use_smooth=d.polygons[old].use_smooth
 for layer in d.uv_layers:
  u=n.uv_layers.new(name=layer.name)
  for i,j in enumerate(loops):u.data[i].uv=layer.data[j].uv
 n.normals_split_custom_set([tuple(d.corner_normals[i].vector)for i in loops])
 o=bpy.data.objects.new(name,n);col.objects.link(o);o.matrix_world=source.matrix_world.copy();return o,loops
for name,entries in by.items():
 original=bpy.data.objects[name];old=original.data;remove={i for c in entries for i in c['polygonIndices']};keep=[f.index for f in old.polygons if f.index not in remove]
 # Capture the original primary UV projection before removing owned faces.
 # Rebuilt repair faces inherit that component's basis; identical old corners
 # keep their exact UV values, while genuinely new boundary vertices interpolate.
 for c in entries:
  if c.get('role') is None:continue
  planes={};exact={};layer=old.uv_layers[0]
  for fi in c['polygonIndices']:
   f=old.polygons[fi];nw=original.matrix_world.to_3x3()@f.normal;axis=max(range(3),key=lambda i:abs(nw[i]));key=(axis,1 if nw[axis]>=0 else -1);axes=[i for i in range(3)if i!=axis];xx=[];uu=[]
   for li in f.loop_indices:
    w=original.matrix_world@old.vertices[old.loops[li].vertex_index].co;uv0=tuple(layer.data[li].uv);xx.append([w[axes[0]],w[axes[1]],1]);uu.append(uv0);exact[(key,tuple(np.asarray(w,dtype=np.float32)))]=uv0
   if key not in planes or f.area>planes[key]['area']:
    planes[key]={'area':f.area,'axes':axes,'coefficients':np.linalg.lstsq(np.array(xx),np.array(uu),rcond=None)[0]}
  source_primary_uv[(name,c['componentOrdinal'])]={'planes':planes,'exact':exact,'surfaceRevision':original.get('penn_surface_revision',old.get('penn_surface_revision'))}
 own,_=subset(original,sorted(remove),'Old owned '+name,OWN,True);owned.append(own)
 temp,loops=subset(original,keep,'Retained protected '+name,OWN)
 pos=np.array([old.vertices[old.loops[i].vertex_index].co[:]for i in loops]);normal=np.array([old.corner_normals[i].vector[:]for i in loops])
 assert np.array_equal(pos,np.array([temp.data.vertices[l.vertex_index].co[:]for l in temp.data.loops]))
 assert np.array_equal(normal,np.array([n.vector[:]for n in temp.data.corner_normals]))
 for layer in old.uv_layers:assert np.array_equal(np.array([layer.data[i].uv[:]for i in loops]),np.array([u.uv[:]for u in temp.data.uv_layers[layer.name].data]))
 original.data=temp.data;bpy.data.objects.remove(temp,do_unlink=True)
 retained_checks.append({'object':name,'removedComponents':len(entries),'removedFaces':len(remove),'retainedCorners':len(loops),'positionsNormalsAllUvsExact':True})

X0,X1=32.71,101.29;WALL=45*.3048/2;R=40*.3048/2;SPRING=cal['recommendedWorkingSection']['springAboveArcadeFloorM'];THICK=.18;TOP=18.9224
DIV=controls['bayTrace']['workingXDividers'];BAYS=[]
for i,(lo,hi)in enumerate(zip(DIV,DIV[1:]),1):
 cx=(lo+hi)/2;radius=min(3.0,(hi-lo-.95)/2)
 BAYS.append({'row':i,'lo':lo,'hi':hi,'x':cx,'radius':radius,'lowerWidth':min(7.4,(hi-lo)*.72),'lowerSill':.45,'lowerTop':7.35,'upperSill':11.17,'upperSpring':12.10,'courtDaylight':43<cx-radius and cx+radius<89.5455})
assert sum(b['courtDaylight']for b in BAYS)==5
def win_top(b,x):return b['upperSpring']+math.sqrt(max(0,b['radius']**2-(x-b['x'])**2))
def arch_x(b):return [b['x']+b['radius']*math.sin(t)for t in np.linspace(-math.pi/2,math.pi/2,65)]
def wall(name,x0,x1,y0,y1,z0,z1,lower,upper):
 # Closed non-overlapping bands preserve actual rectangular + arched openings.
 if lower:
  sill=lower[0]['lowerSill'];top=lower[0]['lowerTop'];box(name+' baseband',((x0+x1)/2,(y0+y1)/2,(z0+sill)/2),(x1-x0,y1-y0,sill-z0),STONE)
  end=x0
  for b in lower:
   a=b['x']-b['lowerWidth']/2;c=b['x']+b['lowerWidth']/2
   if a>end:box(name+' shop pier',((end+a)/2,(y0+y1)/2,(sill+top)/2),(a-end,y1-y0,top-sill),STONE)
   end=c
  if end<x1:box(name+' shop endpier',((end+x1)/2,(y0+y1)/2,(sill+top)/2),(x1-end,y1-y0,top-sill),STONE)
  z0=top
 if upper:
  sill=upper[0]['upperSill'];box(name+' continuous spandrel',((x0+x1)/2,(y0+y1)/2,(z0+sill)/2),(x1-x0,y1-y0,sill-z0),STONE);end=x0
  for b in upper:
   a=b['x']-b['radius'];c=b['x']+b['radius']
   if a>end:box(name+' clerestory pier',((end+a)/2,(y0+y1)/2,(sill+z1)/2),(a-end,y1-y0,z1-sill),STONE)
   pts=[(x,win_top(b,x))for x in arch_x(b)]+[(c,z1),(a,z1)]
   prism(name+' arched opaque spandrel',pts,y0,y1,STONE);end=c
  if end<x1:box(name+' clerestory endpier',((end+x1)/2,(y0+y1)/2,(sill+z1)/2),(x1-end,y1-y0,z1-sill),STONE)
 else:box(name+' full upper wall',((x0+x1)/2,(y0+y1)/2,(z0+z1)/2),(x1-x0,y1-y0,z1-z0),STONE)

for sign in [-1,1]:
 yy0,yy1=sorted([sign*WALL,sign*(WALL+.4)])
 wall(f'Arcade {sign} full engaged shop and clerestory wall',X0,X1,yy0,yy1,0,TOP,BAYS,BAYS)
 # Inferred bearing strip bridges old paving edge7.0 to the actual existing
 # foundation ring at7.75..8.8. No duplicate coplanar public paving plane.
 box('Arcade side wall and display recess continuous bearing strip',((X0+X1)/2,sign*7.6,-.12),(X1-X0,1.2,.24),FLOOR)
 for n,x in enumerate(DIV):
  width=1.15 if n in [0,len(DIV)-1]else .92
  # Preserve formal module bounds; end half-pilasters meet future portals.
  xa,xb=max(X0,x-width/2),min(X1,x+width/2);cx=(xa+xb)/2
  for za,zb,front in [(0,.14,R-.20),(.14,.40,R-.12),(.40,.62,R-.06),(.62,8.35,R),(8.35,8.55,R-.12),(8.55,8.72,R-.18)]:
   rear=WALL+.08;yp=sign*(front+rear)/2
   box('Arcade actual engaged pilaster and moulded foot',(cx,yp,(za+zb)/2),(xb-xa,rear-front,zb-za),STONE)
  contacts.append({'role':'engaged pilaster','x':cx,'side':sign,'floorWorldZ':0,'rearOverlapM':.08,'frontWorldAbsY':R,'footSupportedBy':'retainedpavingpluscontinuousnewbearingstrip'})
 for za,zb,front in [(8.72,8.94,R-.14),(8.94,9.55,R-.06),(9.55,9.68,R-.14),(9.68,10.75,R-.02),(10.75,11.02,R-.13),(11.02,SPRING,R-.19)]:
  rear=WALL+.12;box('Arcade continuous stepped entablature',((X0+X1)/2,sign*(front+rear)/2,(za+zb)/2),(X1-X0,rear-front,zb-za),STONE)
 for b in BAYS:
  x=b['x'];lw=b['lowerWidth'];sill=b['lowerSill'];lintel=b['lowerTop'];front=sign*(WALL+.11);back=sign*8.12
  # Full actual recess with a neutral back, not a black portal to empty space.
  box('Arcade unassigned shop recess back',(x,back,(sill+lintel)/2),(lw,.12,lintel-sill),BACK)
  for sx in [-1,1]:box('Arcade shop return reveal',(x+sx*(lw/2+.045),sign*(WALL+8.18)/2,(sill+lintel)/2),(.09,8.18-WALL,lintel-sill),STONE)
  box('Arcade shop recess lintel soffit',(x,sign*(WALL+8.18)/2,lintel+.06),(lw,8.18-WALL,.12),STONE)
  box('Arcade shop recessed closed glazing',(x,front,(sill+lintel)/2),(lw-.12,.028,lintel-sill-.12),GLASS)
  for sx in [-1,1]:box('Arcade shop metal jamb',(x+sx*(lw/2-.035),front,(sill+lintel)/2),(.07,.12,lintel-sill),BRONZE)
  for zz in [sill+.035,4.85,lintel-.035]:box('Arcade shop metal transom',(x,front,zz),(lw,.12,.07),BRONZE)
  # Door and divided panes are restrained interpreted subdivisions, no tenant.
  for dx in [-.65,.65]:box('Arcade shop door stile',(x+dx,front,(sill+4.85)/2),(.055,.12,4.85-sill),BRONZE)
  box('Arcade shop door head',(x,front,3.15),(1.35,.12,.065),BRONZE)
  for zz,extra in [(sill-.03,.0),(lintel+.04,.0),(lintel+.16,.12)]:box('Arcade source-family stone shopfront moulding',(x,sign*(WALL-.045),zz),(lw+.3+extra,.20,.10),STONE)
  for sx in [-1,1]:box('Arcade source-family stone shopfront jamb',(x+sx*(lw/2+.12),sign*(WALL-.045),(sill+lintel)/2),(.16,.20,lintel-sill+.15),STONE)

# Matched arched apertures in two actual exterior court-spine walls. Lower
# rectangular sash assemblies are preserved; old upper opaque units are owned.
for sign in [-1,1]:
 y0,y1=sorted([sign*8.2,sign*8.8])
 wall(f'Arcade {sign} courtyard spine with actual upper apertures',43.,89.5455,y0,y1,0,19.2024,[],[b for b in BAYS if b['courtDaylight']])

def shell(name,xs,across,h,mat):
 # Across(x,t) returns worldY. Closed vertically offset shell. At real groins
 # different analytic patches share exact endpoints rather than folded offsets.
 N=48;v=[]
 for dz in [0,THICK]:
  for x in xs:
   for t in np.linspace(0,1,N+1):
    y=across(x,float(t));v.append((float(x),float(y),float(h(x,y)+dz)))
 n=len(xs)*(N+1);f=[]
 for i in range(len(xs)-1):
  for j in range(N):
   a=i*(N+1)+j;b=a+N+1;f.extend([(a,a+1,b+1,b),(a+n,b+n,b+n+1,a+n+1)])
 perimeter=list(range(N+1))+[i*(N+1)+N for i in range(1,len(xs))]+list(range((len(xs)-1)*(N+1)+N-1,(len(xs)-1)*(N+1)-1,-1))+[i*(N+1)for i in range(len(xs)-2,0,-1)]
 f.extend((b,a,a+n,b+n)for a,b in zip(perimeter,perimeter[1:]+perimeter[:1]))
 o=mesh(name,v,f,mat,True)
 # Curved-face normals must follow the analytic surface rather than average
 # into the tiny closed endcaps. Otherwise modular shell seams look like ribs.
 surface_faces=(len(xs)-1)*N*2;normals=[]
 for p in o.data.polygons:
  p.use_smooth=p.index<surface_faces
  for loop in p.loop_indices:
   vi=o.data.loops[loop].vertex_index;x,y,z=o.data.vertices[vi].co
   if p.index>=surface_faces:normal=p.normal.copy()
   elif 'side lunette' in name:
    cx=(float(xs[0])+float(xs[-1]))/2;rad=(float(xs[-1])-float(xs[0]))/2
    u=max(-1.,min(1.,(x-cx)/rad));normal=Vector((-u,0,-math.sqrt(max(0,1-u*u))))
    if vi>=n:normal=-normal
   else:
    u=max(-1.,min(1.,y/R));normal=Vector((0,-u,-math.sqrt(max(0,1-u*u))))
    if vi>=n:normal=-normal
   normals.append(tuple(normal.normalized()))
 o.data.normals_split_custom_set(normals)
 return o
def main_h(x,y):return SPRING+math.sqrt(max(0,R*R-y*y))
end=X0
for b in BAYS:
 a=b['x']-b['radius'];c=b['x']+b['radius']
 if a>end:
  xs=np.linspace(end,a,max(2,math.ceil((a-end)/.55)+1));shell('Arcade plain longitudinal barrel between lunettes',xs,lambda x,t:R*math.sin((t-.5)*math.pi),main_h,VAULT)
 xs=arch_x(b)
 def intersection(x):return math.sqrt(max(0,R*R-(win_top(b,x)-SPRING)**2))
 shell('Arcade plain longitudinal barrel trimmed to actual lunette groins',xs,lambda x,t:R*math.sin((t*2-1)*math.asin(intersection(x)/R)),main_h,VAULT)
 for sign in [-1,1]:
  outer=8.8 if b['courtDaylight']else WALL+.4
  shell('Arcade continuous side lunette and actual lightwell roof',xs,lambda x,t:sign*(intersection(x)+(outer-intersection(x))*t),lambda x,y:win_top(b,x),VAULT)
  # The window's rectangular spring rise sits above the main barrel spring.
  # Its short vertical shoulder returns close that difference at both ends;
  # leaving only individually closed roof strips leaves triangular air gaps.
  # These unornamented returns are a qualified enclosure inference.
  from mathutils.geometry import tessellate_polygon
  yi=math.sqrt(R*R-(b['upperSpring']-SPRING)**2)-.015
  yz=[(float(y),main_h(0,float(y))-.025)for y in np.linspace(yi,R,20)]
  yz += [(WALL+.05,SPRING-.025),(WALL+.05,b['upperSpring']+THICK),(yi,b['upperSpring']+THICK)]
  for xe in [xs[0],xs[-1]]:
   pp=[Vector((y,z,0))for y,z in yz];cap=[tuple(int(q)for q in tri)for tri in tessellate_polygon([pp])];nn=len(pp)
   vv=[(float(xe)+dx,sign*y,z)for dx in [-.035,.035]for y,z in yz]
   ff=cap+[tuple(nn+i for i in reversed(t))for t in cap]+[((i+1)%nn,i,i+nn,(i+1)%nn+nn)for i in range(nn)]
   mesh('Arcade lunette solid shoulder return closing vault junction',vv,ff,VAULT)
  # A source-family lightwell includes jambs/sill; these seal its section beyond
  # the arcade wall so the new exterior aperture is a real daylit path.
  for sx in [-1,1]:
   box('Arcade upper lightwell solid side return',(b['x']+sx*(b['radius']+.07),sign*(WALL+outer)/2,(b['upperSill']+b['upperSpring'])/2),(.14,outer-WALL,b['upperSpring']-b['upperSill']),STONE)
  box('Arcade upper lightwell supported sill',(b['x'],sign*(WALL+outer)/2,b['upperSill']-.06),(2*b['radius'],outer-WALL,.12),STONE)
  pane_y=sign*(8.78 if b['courtDaylight']else WALL+.15)
  profile=[(b['x']-b['radius'],b['upperSill']),(b['x']+b['radius'],b['upperSill'])]+list(reversed([(x,win_top(b,x))for x in xs]))
  prism('Arcade arched clerestory closed glass',profile,pane_y-.014,pane_y+.014,GLASS)
  for xx in [b['x']-b['radius'],b['x']+b['radius']]:beam('Arcade clerestory supported metal jamb',(xx,pane_y,b['upperSill']),(xx,pane_y,b['upperSpring']),.045,BRONZE)
  beam('Arcade clerestory supported sill rail',(b['x']-b['radius'],pane_y,b['upperSill']),(b['x']+b['radius'],pane_y,b['upperSill']),.045,BRONZE)
  for xa,xb in zip(xs,xs[1:]):beam('Arcade clerestory arched metal head',(xa,pane_y,win_top(b,xa)),(xb,pane_y,win_top(b,xb)),.045,BRONZE)
  for frac in [-.5,0,.5]:
   xx=b['x']+b['radius']*frac;beam('Arcade clerestory slender vertical glazing bar',(xx,pane_y,b['upperSill']),(xx,pane_y,win_top(b,xx)),.022,BRONZE)
  beam('Arcade clerestory spring transom',(b['x']-b['radius'],pane_y,b['upperSpring']),(b['x']+b['radius'],pane_y,b['upperSpring']),.025,BRONZE)
 end=c
if end<X1:shell('Arcade plain longitudinal barrel end interval',np.linspace(end,X1,8),lambda x,t:R*math.sin((t-.5)*math.pi),main_h,VAULT)

extension_path=P/'arcade_connected_extensions.py'
exec(compile(extension_path.read_text(),str(extension_path),'exec'),globals())
for mat in {m for o in objects for m in o.data.materials}:
 assert mat not in source_material_objects,'New geometry must never bind a retained source material'
 assert not mat.use_nodes or mat.node_tree.as_pointer()not in source_node_tree_pointers,'New materials need independent node trees'
 mat['reflection_probe']='arcade'

print('Builtformalobjects',len(objects),flush=True)
checks=[]
for o in objects:
 d=o.data;d.calc_loop_triangles();vv=np.asarray([v.co[:]for v in d.vertices]);ff=[tuple(f.vertices)for f in d.polygons]
 directed=Counter((a,b)for f in ff for a,b in zip(f,f[1:]+f[:1]));closed=all(n==1 and directed[(b,a)]==1 for(a,b),n in directed.items())
 vol=volume(vv,ff);areas=[np.linalg.norm(np.cross(vv[t.vertices[1]]-vv[t.vertices[0]],vv[t.vertices[2]]-vv[t.vertices[0]]))/2 for t in d.loop_triangles]
 assert closed and vol>1e-12 and min(areas)>1e-12,(o.name,closed,vol,min(areas))
 checks.append({'object':o.name,'vertices':len(vv),'triangles':len(d.loop_triangles),'closedOutward':True,'volume':vol,'minimumTriangleArea':float(min(areas))})

def export(obs,name):
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.hide_viewport=False;o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0]
 bpy.ops.export_scene.gltf(filepath=str(OUT/name),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_normals=True,export_texcoords=True,export_materials='EXPORT',export_extras=True)
old_exterior=[o for o in owned if '01 Exterior' in o.name];old_main=[o for o in owned if '02 Main' in o.name]
# Old authorities use exact original material names and scalar properties.
# Temporarily disambiguate retained source names; restore before proof/save.
aliases={m:m.name for o in owned for m in o.data.materials};original_names={}
for m in aliases:
 original=m.get('original_material_name')
 if original and original not in original_names:
  source_mat=bpy.data.materials[original];original_names[original]=source_mat;source_mat.name='TEMP_OLD_AUTHORITY_'+original
for m in aliases:m.name=m['original_material_name']
export(old_exterior,'old-arcade-owned-exterior-street0.glb')
for o in old_main:o.matrix_world.translation.z+=4.2672
export(old_main,'old-arcade-owned-main-main0.glb')
for o in old_main:o.matrix_world.translation.z-=4.2672
for m,name in aliases.items():m.name=name
for name,m in original_names.items():m.name=name
export(objects,'formal-arcade-module.glb')

retained=[o for o in EXTERIOR.all_objects if o.type in ['MESH','FONT']]
# Original-material export keeps Geometry Nodes master references intact. This
# avoids temporary scalar aliases leaking through realised Doric rows.
export(retained,'retained-exterior-occluder.glb')
def scalarise_authority(path):
 original=path.read_bytes();length,kind=struct.unpack('<II',original[12:20]);jj=json.loads(original[20:20+length]);tail=original[20+length:];protected={k:jj.get(k)for k in ['accessors','bufferViews','buffers','meshes','nodes','scenes','scene','skins','animations']}
 def strip(v):
  if isinstance(v,dict):return {k:strip(q)for k,q in v.items()if not k.endswith('Texture')}
  if isinstance(v,list):return [strip(q)for q in v]
  return v
 for index,mat in enumerate(jj.get('materials',[])):
  mat=strip(mat);source_mat=bpy.data.materials.get(mat.get('name',''));assert source_mat is not None,mat.get('name')
  pbr=source_mat.node_tree.nodes.get('Principled BSDF')if source_mat.use_nodes else None
  if pbr:mat['pbrMetallicRoughness']={'baseColorFactor':list(pbr.inputs['Base Color'].default_value),'metallicFactor':float(pbr.inputs['Metallic'].default_value),'roughnessFactor':float(pbr.inputs['Roughness'].default_value)}
  jj['materials'][index]=mat
 removed_images=len(jj.get('images',[]));jj.pop('images',None);jj.pop('textures',None);jj.pop('samplers',None)
 assert protected=={k:jj.get(k)for k in protected},'Scalar authority changed protected geometry JSON'
 encoded=json.dumps(jj,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);result=struct.pack('<4sII',b'glTF',2,12+8+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4E4F534A)+encoded+tail
 assert result[20+len(encoded):]==tail
 path.write_bytes(result)
 return {'operation':'JSON-only material scalarization; original names, geometry JSON and complete trailing BIN unchanged','embeddedImagesBefore':removed_images,'imagesAfter':0,'texturesAfter':0,'originalGlbSha256':hashlib.sha256(original).hexdigest(),'scalarGlbSha256':H(path),'binAndGeometryJsonExact':True}
protected_scalarisation=scalarise_authority(OUT/'retained-exterior-occluder.glb')
for o in owned:
 dd=o.data;bpy.data.objects.remove(o,do_unlink=True)
 if dd.users==0:bpy.data.meshes.remove(dd)
bpy.data.collections.remove(OWN)
after={n:sig(bpy.data.objects[n])for n in before if n not in by}
assert after=={n:s for n,s in before.items()if n not in by},'Protectedsourcechanged'
exporter_tags_restored=[]
for (mat_name,node_name),(present,original_value)in source_node_used.items():
 node=bpy.data.materials[mat_name].node_tree.nodes[node_name];current_present='used'in node;current_value=value(node.get('used'))
 if (current_present,current_value)!=(present,original_value):
  exporter_tags_restored.append({'material':mat_name,'node':node_name,'property':'used','originalPresent':present,'originalValue':original_value,'exporterPresent':current_present,'exporterValue':current_value})
  if present:node['used']=original_value
  elif current_present:del node['used']
source_material_after={n:material_sig(bpy.data.materials[n])for n in source_material_signatures}
assert source_material_after==source_material_signatures,'Retained material node properties, custom extras or names changed'
assert H(SOURCE)==SOURCE_SHA
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'formal-arcade-review.blend'),compress=True)
outfiles=['old-arcade-owned-exterior-street0.glb','old-arcade-owned-main-main0.glb','formal-arcade-module.glb','retained-exterior-occluder.glb','formal-arcade-review.blend']
proof={'schema':1,'status':'EXTERNAL CONNECTED ARCADE/LOGGIA/VESTIBULE SOURCE CANDIDATE; no canonical/runtime promotion, no final GI/browser test claimed.',
 'source':str(SOURCE),'sourceSha256':SOURCE_SHA,'sourceSha256After':H(SOURCE),'generatorSha256':H(Path(__file__)),
 'frame':'BlenderworldXeast,Ynorth,Zup,street0. RawGLBsXeast,Yup,Zsouth,street0; NO Mainoffset.',
 'scopeX':[16.465,111.1816],'formalScopeX':[X0,X1],'wallWidth':2*WALL,'barrelSpan':2*R,'springWorldZ':SPRING,'crownWorldZ':SPRING+R,'shellThickness':THICK,
 'heightSource':'Independent071930photoarcfit, two40/45ftnormalisations; at least±.6mspring/±.8mcrownqualification. Notoldwallheight.',
 'sourceInputs':{n:H(RESEARCH/n)for n in ['arcade-ownership-controls.json','arcade-source-audit.json','arcade-section-calibration.json','arcade-connected-ownership-controls.json']},
 'extensionGeneratorSha256':H(extension_path),'connectedRouteControls':connected,'extensionRecords':extension_records,
 'walkableAdditions':walkable_additions,'closedGlazingCollisionMaterial':GLASS.name,
 'newMaterialNames':sorted({m.name for o in objects for m in o.data.materials}),
 'protectedExteriorScalarisation':protected_scalarisation,
 'removedComponentCount':len(selected),'removedComponents':selected,'retainedCornerChecks':retained_checks,
 'unrelatedSourceObjectSignaturesExact':len(after),'bays':BAYS,'pilasterContactRecords':contacts,
 'protectedMaterialSignaturesBefore':source_material_signatures,'protectedMaterialSignaturesAfter':source_material_after,'allRetainedMaterialNamesNodesPropertiesAndExtrasExact':True,
 'provenExporterDerivedNodeTagsRestored':exporter_tags_restored,
 'geometryChecks':checks,'counts':{'objects':len(objects),'triangles':sum(c['triangles']for c in checks),'materials':len({m.name for o in objects for m in o.data.materials})},
 'outputs':{n:{'bytes':(OUT/n).stat().st_size,'sha256':H(OUT/n)}for n in outfiles},
 'limits':['Connected source candidate: Main stair enclosure, Ionic loggia, formal arcade and widened vestibule; finite backed restaurant entrance bays, not full operational restaurants.',
 'OutsideporticoX111.1816..119.4816untouched; stairs/allpublicpavingandMain/arrivalsgeometryprotected.',
 'Photographedsmallarcade/loggiastepsremainheld; currentflatthresholdretainedexplicitly.',
 'Sevenbaychainmanualplantrace±5pxandglobalregistrationuncertainty; no tenantpositionsor1935storefrontscheduleclaimed.',
 'Finewindowprofile/revealdepth/membersectionsandshopdisplayrecessgeometryinferred; noauthenticoperatingretailinteriors.',
 'Fiveupperwindowsperwallhavematchedrealcourtapertures; twoendbaysfaceexistingannexspace, nofakeemissivedaylight.',
 'No new practical wall lamps or GI/reflection-probe update yet; old lightmaps must not be applied as final.',
 'New vestibule side bounds are exported separately; every pre-existing walkable field and public floor/stair remains unchanged.',
 'Front doorway provides real lower daylight; retained clock attic/portico can occlude portions of high front glazing and must not be hidden to brighten the scene.',
 'Local foundation-cell remainders preserve their source envelope but rebuild hidden bevels/UVs within explicitly owned components; only defined floor rectangles rebate the bearing top.',
 'Geometryclosureproofdoesnotestablishphysicalroutes/headroom/lighting/nativebrowseracceptance.']}
(OUT/'source-proof.json').write_text(json.dumps(proof,indent=2)+'\n')
shutil.copyfile(Path(__file__),OUT/'generator.py')
shutil.copyfile(extension_path,OUT/extension_path.name)
print(json.dumps({k:proof[k]for k in ['outputs','counts','unrelatedSourceObjectSignaturesExact']},indent=2),flush=True)
