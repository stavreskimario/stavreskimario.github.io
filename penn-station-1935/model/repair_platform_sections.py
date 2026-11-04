"""External first-eight platform construction candidate; never writes live assets.

Source controls: Francis/O'Brien ASCE69 printed201-202/Fig6. Retained raster
outlines and flat stair-bearing datum do not certify original1935 coordinates.
The16in centre depth, continuous end-wall closure and joint width/depth remain
interpretations. Source Fig6 crossfall is deliberately held for later integrated
stair/platform registration. Northern P9-11 remain unchanged.
"""
from pathlib import Path
import argparse,hashlib,json,math,re
from collections import Counter
import bpy,bmesh,numpy as np
from PIL import Image
from mathutils import Vector

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--manifest',type=Path,required=True)
parser.add_argument('--out',type=Path,required=True)
parser.add_argument('--whole-export',action='store_true')
args=parser.parse_args()
SOURCE=args.source.resolve();MANIFEST=args.manifest.resolve();OUT=args.out.resolve()
H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
SOURCE_SHA='db4b398537b5838e8625091f4b81401834fc822d2c77652393c5f216e5532b1c'
MANIFEST_SHA='f2d0e638a8db9b6b968c747bd69fb3f0e875a5ac4182607fad7835c88aeffe03'
assert H(SOURCE)==SOURCE_SHA
assert H(MANIFEST)==MANIFEST_SHA
assert not OUT.exists(),'Use a new output directory; retain review history'
REPOSITORY=SOURCE.parents[2]
assert REPOSITORY not in OUT.parents and OUT!=REPOSITORY,'Write candidates outside the repository'
OUT.mkdir(parents=True)
M=json.loads(MANIFEST.read_text())
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));bpy.context.view_layer.update()
SOURCE_OBJECTS={o.name:o for o in bpy.context.scene.objects}
JOINT_CENTRES={name:o.matrix_world@(sum((Vector(c)for c in o.bound_box),Vector())/8)
 for name,o in SOURCE_OBJECTS.items()if name.startswith('Platform paving construction joint')}
COL=bpy.data.collections.new('Phase9 first-eight source-controlled platform sections')
bpy.context.scene.collection.children.link(COL)
material_cache={};mesh_signatures={}
def sig(o):
 h=hashlib.sha256(np.asarray(o.matrix_world,dtype='<f8').tobytes())
 if o.type=='MESH':
  d=o.data
  if d.name not in mesh_signatures:
   s=hashlib.sha256()
   for seq,key,n,kind in [(d.vertices,'co',3,'<f4'),(d.loops,'vertex_index',1,'<i4'),(d.polygons,'loop_start',1,'<i4'),(d.polygons,'loop_total',1,'<i4'),(d.polygons,'material_index',1,'<i4')]:
    a=np.empty(len(seq)*n,np.dtype(kind));seq.foreach_get(key,a);s.update(a.tobytes())
   for uv in d.uv_layers:
    a=np.empty(len(uv.data)*2,np.float32);uv.data.foreach_get('uv',a);s.update(uv.name.encode());s.update(a.tobytes())
   s.update('|'.join(m.name if m else ''for m in d.materials).encode())
   mesh_signatures[d.name]=s.digest()
  h.update(mesh_signatures[d.name])
 return h.hexdigest()
before={o.name:sig(o)for o in bpy.context.scene.objects}
def material(name,color,rough):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF')
 p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough
 m['surface_identity']='Source-documented platform granolithic/concrete family; uncalibrated material colour, roughness and minor tooling reconstructed.'
 return m
CONCRETE=material('RailwayPlatformRubbedConcretePhase9',(.39,.395,.37),.85)
GRANO=material('RailwayPlatformStippledGranolithicPhase9',(1,1,1),.87)
# A single metre-registered repeating surface avoids hundreds of thousands of
# tiny scored-joint triangles. No historic material sample/color is claimed.
N=2048;PITCH=.762;SEED=19352026
rng=np.random.default_rng(SEED)
def periodic_noise(cells):
 grid=rng.random((cells,cells),dtype=np.float32)
 pos=np.arange(N,dtype=np.float32)*cells/N;idx=pos.astype(int);t=pos-idx
 # Smooth interpolation and wrapped neighbours give seamless repeat borders.
 t=t*t*(3-2*t)
 a=grid[idx[:,None]%cells,idx[None,:]%cells]
 b=grid[idx[:,None]%cells,(idx[None,:]+1)%cells]
 c=grid[(idx[:,None]+1)%cells,idx[None,:]%cells]
 d=grid[(idx[:,None]+1)%cells,(idx[None,:]+1)%cells]
 return (a*(1-t[None,:])+b*t[None,:])*(1-t[:,None])+(c*(1-t[None,:])+d*t[None,:])*t[:,None]
coarse=periodic_noise(32);aggregate=periodic_noise(128);fine=periodic_noise(512)
u=(np.arange(N,dtype=np.float32)+.5)/N
edge=np.minimum(u,1-u)*PITCH
distance=np.minimum(edge[:,None],edge[None,:])
joint=np.exp(-np.minimum((distance/.0015)**4,80))
height=.00012*(aggregate-.5)+.000025*(fine-.5)-.002*joint
dx=(np.roll(height,-1,1)-np.roll(height,1,1))/(2*PITCH/N)
dy=(np.roll(height,-1,0)-np.roll(height,1,0))/(2*PITCH/N)
normal=np.stack((-dx,dy,np.ones_like(height)),axis=-1);normal/=np.linalg.norm(normal,axis=-1,keepdims=True)
linear=.46+.028*(coarse-.5)+.045*(aggregate-.5)+.018*(fine-.5)-.10*joint
rgb=np.stack((linear*1.025,linear*1.012,linear*.962),axis=-1)
rgb=np.where(rgb<=.0031308,rgb*12.92,1.055*np.maximum(rgb,0)**(1/2.4)-.055)
rough=np.clip(.86+.07*(fine-.5)+.04*(aggregate-.5)+.04*joint,0,1)
textures={'granolithic-basecolor.png':np.uint8(np.clip(rgb,0,1)*255+.5),
 'granolithic-normal.png':np.uint8(np.clip(normal*.5+.5,0,1)*255+.5),
 'granolithic-roughness.png':np.uint8(rough*255+.5)}
for name,array in textures.items():Image.fromarray(array).save(OUT/name,optimize=True)
p=GRANO.node_tree.nodes.get('Principled BSDF')
for name,input_name,color in [('granolithic-basecolor.png','Base Color','sRGB'),('granolithic-roughness.png','Roughness','Non-Color'),('granolithic-normal.png','Normal','Non-Color')]:
 image=bpy.data.images.load(str(OUT/name));image.colorspace_settings.name=color;image.pack()
 node=GRANO.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;node.extension='REPEAT'
 if input_name=='Normal':
  bump=GRANO.node_tree.nodes.new('ShaderNodeNormalMap');bump.inputs['Strength'].default_value=1
  GRANO.node_tree.links.new(node.outputs['Color'],bump.inputs['Color']);GRANO.node_tree.links.new(bump.outputs['Normal'],p.inputs['Normal'])
 else:GRANO.node_tree.links.new(node.outputs['Color'],p.inputs[input_name])
created=[]
def volume(v,faces):
 q=np.asarray(v,np.float64);c=q.mean(axis=0)
 return sum(float(np.dot(q[f[0]]-c,np.cross(q[f[i]]-c,q[f[i+1]]-c)))/6 for f in faces for i in range(1,len(f)-1))
def mesh(name,vertices,faces,mat,smooth_faces=()):
 # Inputs are explicit BlenderX/Ynorth/Zup; units are metres.
 d=bpy.data.meshes.new(name);d.from_pydata(vertices,[],faces);d.update();d.materials.append(mat)
 bm=bmesh.new();bm.from_mesh(d);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(d);bm.free();d.update()
 uv=d.uv_layers.new(name='RailwayUV')
 for f in d.polygons:
  f.use_smooth=f.index in smooth_faces
  axis=max(range(3),key=lambda i:abs(f.normal[i]));axes=[i for i in range(3)if i!=axis]
  for k in f.loop_indices:
   p=d.vertices[d.loops[k].vertex_index].co;scale=PITCH if mat==GRANO else 1
   uv.data[k].uv=(p[axes[0]]/scale,p[axes[1]]/scale)
 o=bpy.data.objects.new(name,d);COL.objects.link(o);created.append(o)
 o['penn_platform_revision']=9
 return o
def prism_arrays(poly,bottom,top):
 n=len(poly);v=[(a,-z,h)for h in [bottom,top]for a,z in poly]
 f=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]+[(i,(i+1)%n,(i+1)%n+n,i+n)for i in range(n)]
 return v,f
def inset(poly,d):
 p=np.asarray(poly,np.float64);lines=[]
 for a,b in zip(p,np.roll(p,-1,axis=0)):
  tangent=(b-a)/np.linalg.norm(b-a);normal=np.array([-tangent[1],tangent[0]])
  lines.append((normal,float(normal@a+d)))
 return [np.linalg.solve(np.stack((lines[i-1][0],lines[i][0])),np.array([lines[i-1][1],lines[i][1]])).tolist()for i in range(len(p))]
def area(poly):return .5*sum(a[0]*b[1]-b[0]*a[1]for a,b in zip(poly,poly[1:]+poly[:1]))if len(poly)>2 else 0
owned=[];platforms=[]
for number in range(1,9):
 body=SOURCE_OBJECTS[f'Platform {number:02d} source-traced concrete body']
 verts=np.asarray([tuple(body.matrix_world@v.co)for v in body.data.vertices])
 floor=float(verts[:,2].max());foundation=float(verts[:,2].min())
 n=len(verts)//2
 poly=[[float(x),float(-y)]for x,y,z in verts[:n]]
 assert area(poly)>0
 for a,b,c in zip(poly,poly[1:]+poly[:1],poly[2:]+poly[:2]):assert np.cross(np.array(b)-a,np.array(c)-b)>0
 own=[body]+[o for o in bpy.context.scene.objects if o.name.startswith(f'Platform {number:02d} unpainted edge coping')]
 for o in bpy.context.scene.objects:
  if not o.name.startswith('Platform paving construction joint'):continue
  p=JOINT_CENTRES[o.name];x,z=float(p.x),float(-p.y)
  if min(v[0]for v in poly)-.02<=x<=max(v[0]for v in poly)+.02 and min(v[1]for v in poly)<=z<=max(v[1]for v in poly):own.append(o)
 owned.extend(own)
 assert sum(o.name.startswith('Platform paving construction joint')for o in own)==46,(number,'Unexpected first-eight source joint census')
 # Following source Fig6: edge8in, outerwall20in,16in wall and12in cove.
 edge=.2032;radius=.3048;wall_outer=.508;wall_inner=.9144;centre=.4064
 rings=[(0,floor-.01905),(0,floor-edge),(.2032,floor-edge)]
 for i in range(1,17):
  t=math.pi/2*i/16;rings.append((.2032+radius*math.sin(t),floor-edge-radius*(1-math.cos(t))))
 rings += [(wall_outer,foundation),(wall_inner,foundation),(wall_inner,floor-centre)]
 v=[]
 for distance,y in rings:v.extend((x,-z,y)for x,z in inset(poly,distance))
 faces=[tuple(range(n-1,-1,-1))]
 smooth=[]
 for j in range(len(rings)-1):
  for i in range(n):
   faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
   if 2<=j<18:smooth.append(len(faces)-1)
 faces.append(tuple((len(rings)-1)*n+i for i in range(n)))
 shell=mesh(f'Platform {number:02d} source-section continuous walls and coved slab',v,faces,CONCRETE,smooth)
 shell['centre_slab_inches_inferred']=16
 # Continuous3/4in dressing with metre-registered PBR scored joints/stipple.
 # The flat collision surface remains the exact source platform top.
 v,f=prism_arrays(poly,floor-.01905,floor)
 finish=mesh(f'Platform {number:02d} continuous30-inch-gridded granolithic dressing',v,f,GRANO)
 platforms.append({'number':number,'polygonXZ':poly,'floorMainY':floor,'foundationMainY':foundation,'slabEdgeDepth':edge,'slabCentreDepthInterpreted':centre,
  'wallThickness':wall_inner-wall_outer,'wallOuterInset':wall_outer,'overhangCoveRadius':radius,'granolithicDressing':.01905,
  'jointPitch':PITCH,'jointGapInterpreted':.003,'jointDepthInterpreted':.002,'jointRepresentation':'PBR normal/roughness/colour; flat source collision top retained','ownedObjects':[o.name for o in own],
  'sourceDimensions':'Francis/OBrien201-202 andFig6;16incentrechoice and endclosure interpreted; flat current top retained, crossfall held.'})
 print('PLATFORM',number,'PROFILE_VERTICES',len(shell.data.vertices),flush=True)

# Preserve the sixteen published complete fixture assemblies in this editable
# railway scene, as the previous runtime checkpoint applied their deltas only
# to the optimized glTF. Their measured sourcefloat precision remains explicit.
fixture_changes=[]
for record in M['arrivalAccess']['platformFixtures']:
 old=record['fromMain'];new=record['toMain'];number=record['platform']
 group=[o for o in bpy.context.scene.objects if o.name.startswith(f'Platform {number:02d} Nernst')and abs(o.location.x-old[0])<1e-5]
 assert len(group)==7,(record['instance'],len(group))
 for o in group:
  old_signature=sig(o);o.location.x+=new[0]-old[0];o.location.y-=new[2]-old[2];o.location.z+=new[1]-old[1]
  fixture_changes.append({'name':o.name,'beforeSignature':old_signature,'deltaMain':[new[i]-old[i]for i in range(3)]})
bpy.context.view_layer.update()
for record in fixture_changes:record['afterSignature']=sig(SOURCE_OBJECTS[record['name']])
assert len({o.name for o in owned})==len(owned)
owned_names={o.name for o in owned};fixture_names={r['name']for r in fixture_changes}
unrelated=[(name,old)for name,old in before.items()if name not in owned_names|fixture_names]
assert all(sig(SOURCE_OBJECTS[name])==old for name,old in unrelated),'Unrelated source altered'
print('UNRELATED_PROOF',len(unrelated),flush=True)

def export(path,objects):
 # A temporary scene avoids exporter traversal of66k unrelated fittings for
 # each tiny scoped module. Objects/data are linked without copies or transforms.
 original=bpy.context.window.scene
 temporary=bpy.data.scenes.new('Phase9 scoped temporary export')
 for o in objects:temporary.collection.objects.link(o)
 bpy.context.window.scene=temporary
 try:
  bpy.ops.object.select_all(action='DESELECT')
  for o in objects:o.select_set(True)
  bpy.context.view_layer.objects.active=objects[0]
  print('EXPORT',path.name,len(objects),flush=True)
  bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,use_active_scene=True,export_apply=True,export_yup=True,export_materials='EXPORT',export_attributes=True,export_gpu_instances=True)
 finally:
  bpy.context.window.scene=original;bpy.data.scenes.remove(temporary)
export(OUT/'platform-section-owned-old.glb',owned)
export(OUT/'platform-section-module.glb',created)
# Source removal follows export so the exact ownership artifact remains auditable.
for o in owned:bpy.data.objects.remove(o,do_unlink=True)
# The retained raw occluder excludes every superseded solid/coping/joint and
# every new surface; all current sixteen fixture assemblies remain coordinated.
retained=[o for o in bpy.data.collections['Source-traced station railway'].objects if o.type=='MESH']
export(OUT/'platform-retained-occluder.glb',retained)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'railway-phase9-sections-candidate.blend'),compress=True)
if args.whole_export:
 col=bpy.data.collections['Source-traced station railway'];whole=[o for o in col.objects if o.type=='MESH']+created
 export(OUT/'model-platform-sections-whole.glb',whole)

checks=[]
for o in created:
 d=o.data;edges=Counter(tuple(sorted((int(a),int(b))))for f in d.polygons for a,b in zip(f.vertices,tuple(f.vertices[1:])+tuple(f.vertices[:1])))
 v=np.asarray([tuple(p.co)for p in d.vertices]);faces=[tuple(f.vertices)for f in d.polygons]
 signed=volume(v,faces)
 checks.append({'name':o.name,'vertices':len(v),'polygons':len(faces),'boundaryOrNonmanifoldEdges':sum(n!=2 for n in edges.values()),'signedVolume':signed,'passed':all(n==2 for n in edges.values())and signed>0})
assert all(c['passed']for c in checks)
report={'schema':1,'status':'External first-eight platform-section candidate, not published or historically exact/structurally certified',
 'source':str(SOURCE),'sourceSha256':SOURCE_SHA,'sourceSha256After':H(SOURCE),'manifestSha256':MANIFEST_SHA,'generatorSha256':H(Path(__file__)),
 'frame':'BlenderX east/Ynorth/Zup, Main=0; exportedglTFX east/Yup/Zsouth, Main=0; runtimeplacementY-4.2672m. No sourcecoreworlddrop applied twice.',
 'platforms':platforms,'fixtureChanges':fixture_changes,'unrelatedObjectsPreserved':len(unrelated),'unrelatedNamesAndSignaturesSha256':hashlib.sha256(json.dumps(sorted(unrelated),separators=(',',':')).encode()).hexdigest(),
 'closedGeometryChecks':checks,'proceduralFinish':{'seed':SEED,'size':N,'repeatMetres':PITCH,'source':'.75in granolithic dressing and about30in stippled squares, Francis/OBrien202','interpretation':'Neutral aggregate/color/roughness plus3mm/2mm scored-joint normal interpretation; not a recovered original sample'},'outputFiles':{p.name:{'bytes':p.stat().st_size,'sha256':H(p)}for p in OUT.iterdir()if p.is_file()},
 'limits':['P9-11section/finishes preserved, not completed.','SourceFig6crossfall held to preserve exact retained stairs and platform-top datums.','Sixteen-inch centre depth chosen within documented8-16inrange; individual originalmemberdepths not identified.','Wallringendclosures and3mmwide/2mmdeepjointprofiles reconstructed.','No tunnel canopy, track realignment, Main floor cut or transfer-frame certification.','Source30in finish cadence documented; panelgrid origin, colour and roughness interpreted.','New collision, lower support, material/bake and browser validation remain separate.']}
(OUT/'source-proof.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'createdObjects':len(created),'removedOwnedObjects':len(owned),'preservedUnrelatedObjects':len(unrelated),'fixtureComponents':len(fixture_changes),'triangles':sum(len(o.data.polygons)*2 for o in created),'geometryChecks':len(checks),'passed':all(c['passed']for c in checks),'outputFiles':report['outputFiles']},indent=2))
