"""Original-plan railway study: 21 tracks, 11 unequal island platforms.

All geometry is authored through Blender. Read railway-research.md before
treating the raster trace as a measured1935 layout. Main floor is local0;
runtime chunk translation is worldY−4.2672m. No active app assets are written.
"""
from pathlib import Path
import argparse
import json
import math
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

parser=argparse.ArgumentParser()
parser.add_argument('--out',type=Path,default=Path('/private/tmp/penn-phase3-railway'))
parser.add_argument('--plan',type=Path,default=Path(__file__).with_name('railway-plan.json'))
parser.add_argument('--render',action='store_true')
parser.add_argument('--support',type=Path,action='append',default=[],help='Optional raw Main=0 core GLBs used for actual upward ceiling rays. Without these, only two units per platform on the confirmed exit slab are authored.')
args=parser.parse_args()
OUT=args.out.resolve();OUT.mkdir(parents=True,exist_ok=True)
PLAN=json.loads(args.plan.read_text())
REG=PLAN['registration'];LEVEL=PLAN['levels'];FT=.3048
TOR=LEVEL['rail'];FLOOR=LEVEL['platform'];EDGE=(5+3/12)*FT
GAUGE=(4+8.5/12)*FT
SX=(REG['seventhAvenueAxisWorldX']-REG['eighthAvenueAxisWorldX'])/(REG['seventhAvenueAxisPixelU']-REG['eighthAvenueAxisPixelU'])
SZ=REG['northSouthMetresPerPixel']
def x(u):return REG['eighthAvenueAxisWorldX']+(u-REG['eighthAvenueAxisPixelU'])*SX
def z(v):return (v-REG['axialPassagePixelV'])*SZ
TRACKS={i+1:z(v) for i,v in enumerate(PLAN['trackCentreRowsSouthToNorth'])}
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
COL=bpy.data.collections.new('Source-traced station railway');scene.collection.children.link(COL)
KITS=bpy.data.collections.new('Shared rail fittings');scene.collection.children.link(KITS)
AUDIT=[]

def mat(name,color,rough=.7,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal
 return m
CONCRETE=mat('Railway platform concrete interpretation',(.37,.37,.35),.88)
COPING=mat('Railway unpainted stone coping',(.56,.54,.48),.81)
BED=mat('Railway smooth concrete track base',(.24,.245,.23),.93)
HEAD=mat('Railway polished running head',(.33,.35,.36),.25,.94)
WEB=mat('Railway worn steel web and foot',(.15,.16,.16),.57,.76)
IRON=mat('Railway tie plates and bolts',(.13,.125,.115),.61,.82)
WOOD=mat('Railway embedded timber support',(.16,.105,.065),.92)
BUFFER=mat('Railway buffer timber interpretation',(.20,.14,.09),.90)
CERAMIC=mat('Platform Nernst ceramic fittings',(.61,.57,.47),.55)
GLOWER=mat('PlatformNernstGlower',(1,.71,.38),.45)
glower_shader=GLOWER.node_tree.nodes.get('Principled BSDF')
glower_shader.inputs['Emission Color'].default_value=(1,.73,.42,1)
glower_shader.inputs['Emission Strength'].default_value=30
for material in [HEAD,WEB,IRON,WOOD,BUFFER,CERAMIC,GLOWER]:material['skip_lighting_atlas']=True

def mesh(name,vertices,faces,material,collection=COL):
 d=bpy.data.meshes.new(name);d.from_pydata(vertices,[],faces);d.update();d.materials.append(material)
 uv=d.uv_layers.new(name='RailwayUV')
 for p in d.polygons:
  axis=max(range(3),key=lambda i:abs(p.normal[i]));axes=[i for i in range(3) if i!=axis]
  for loop in p.loop_indices:
   point=d.vertices[d.loops[loop].vertex_index].co;uv.data[loop].uv=(point[axes[0]]/2,point[axes[1]]/2)
 o=bpy.data.objects.new(name,d);collection.objects.link(o);return o

def box(name,centre,size,material,collection=COL):
 c=Vector(centre);r=Vector(size)/2
 corners=[(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
 return mesh(name,[tuple(c+Vector((a*r.x,b*r.y,e*r.z))) for a,b,e in corners],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],material,collection)

def prism(name,polygon,bottom,top,material):
 # Input polygon is common worldX/Z; Blender usesYnorth andZup.
 vertices=[(a,-b,h) for h in [bottom,top] for a,b in polygon]
 n=len(polygon);faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
 faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
 # Native outlines run clockwise after conversion to Blender north/up axes.
 # Reverse the complete closed prism so top, bottom and sides face outward.
 faces=[tuple(reversed(face)) for face in faces]
 return mesh(name,vertices,faces,material)

def sweep(name,points,profile,material):
 points=[Vector(p) for p in points];vertices=[];faces=[]
 for i,p in enumerate(points):
  tangent=(points[min(i+1,len(points)-1)]-points[max(i-1,0)]).normalized()
  side=Vector((-tangent.y,tangent.x,0)).normalized()
  for across,height in profile:vertices.append(tuple(p+side*across+Vector((0,0,height))))
 n=len(profile)
 faces.append(tuple(range(n-1,-1,-1)));faces.append(tuple((len(points)-1)*n+i for i in range(n)))
 for j in range(len(points)-1):
  for i in range(n):faces.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
 return mesh(name,vertices,faces,material)

def clone(master,name,at,angle=0):
 o=bpy.data.objects.new(name,master.data);COL.objects.link(o);o.location=at;o.rotation_euler.z=angle;return o

def cylinder(name,centre,radius,height,material,collection=COL,segments=16):
 cx,cy,cz=centre
 vertices=[(cx+radius*math.cos(i*math.tau/segments),cy+radius*math.sin(i*math.tau/segments),cz+h) for h in [-height/2,height/2] for i in range(segments)]
 faces=[tuple(range(segments-1,-1,-1)),tuple(range(segments,segments*2))]
 faces.extend((i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments))
 return mesh(name,vertices,faces,material,collection)

def cubic(a,b,c,d,t):return (1-t)**3*a+3*(1-t)**2*t*b+3*(1-t)*t*t*c+t**3*d

rail_profile=[(-.030,0),(.030,0),(.035,-.010),(.033,-.035),(.014,-.045),(.007,-.08),(.007,-.128),(.0667,-.128),(.0667,-.14605),(-.0667,-.14605),(-.0667,-.128),(-.007,-.128),(-.007,-.08),(-.014,-.045),(-.033,-.035),(-.035,-.010)]
plate=box('Shared seven by thirteen inch tie plate',(0,0,0),(.1778,.3302,.0127),IRON,KITS)
block=box('Shared embedded timber support block',(0,0,0),(.2032,.65,.1778),WOOD,KITS)
jointbar=box('Shared rail joint bar',(0,0,0),(.80,.014,.085),IRON,KITS)

platforms=[]
for data in PLAN['platforms']:
 number=data['number'];south,north=[TRACKS[n] for n in data['tracks']]
 north_edge=north+EDGE;south_edge=south-EDGE
 middle=(north_edge+south_edge)/2;width=south_edge-north_edge
 if width<=0:raise ValueError('Invalid traced platform width')
 a,b,c,d=[x(data[key]) for key in ['westTipU','westFullU','eastFullU','eastTipU']]
 # The plan has unequal pointed/rounded tapers, not eleven equal rectangles.
 polygon=[(x(u),z(v)) for u,v in data['outlineUV']]
 obj=prism(f'Platform {number:02d} source-traced concrete body',polygon,TOR-.33655,FLOOR,CONCRETE)
 obj['historical_platform_number']=number
 obj['trace_status']='Raster interpretation; source/dimensional conflicts retained in railway-plan.json'
 for start,end in zip(polygon,polygon[1:]+polygon[:1]):
  dx,dz=end[0]-start[0],end[1]-start[1];length=math.hypot(dx,dz)
  inside=(-dz/length*.24,dx/length*.24)
  strip=[start,end,(end[0]+inside[0],end[1]+inside[1]),(start[0]+inside[0],start[1]+inside[1])]
  prism(f'Platform {number:02d} unpainted edge coping',strip,FLOOR-.09,FLOOR,COPING)
 # Longitudinal surface joints are scored into the platform, not suspended
 # above stair openings. No modern yellow edge or tactile strip is invented.
 for xx in np.arange(b+.75,c-.5,2.7):
  intersections=[]
  for start,end in zip(polygon,polygon[1:]+polygon[:1]):
   if min(start[0],end[0])<=xx<max(start[0],end[0]):
    t=(xx-start[0])/(end[0]-start[0]);intersections.append(start[1]+t*(end[1]-start[1]))
  if len(intersections)>=2:
   low,high=min(intersections),max(intersections)
   box('Platform paving construction joint',(float(xx),-(low+high)/2,FLOOR-.001),(.009,max(.1,high-low-.25),.002),BED)
 record={'number':number,'tracks':data['tracks'],'polygonXZ':polygon,'centreZ':middle,'straightWidth':max(p[1] for p in polygon)-min(p[1] for p in polygon),'trackClearanceWidth':width,'overallLength':d-a,'floorLocal':FLOOR,'floorWorld':FLOOR+LEVEL['chunkWorldOffsetY'],'bounds':[a,d,min(p[1] for p in polygon),max(p[1] for p in polygon)]}
 platforms.append(record)
 AUDIT.append({'object':obj.name,'contact':'platform foundation meets common concrete base','bottom':TOR-.33655,'baseTop':TOR-.33655,'errorMetres':0,'passed':True})

all_x=[value for p in platforms for value in [p['bounds'][0],p['bounds'][1]]]
min_x,max_x=min(min(all_x)-25,x(1550)-5),max(max(all_x)+15,x(2875)+5)
min_z,max_z=min(TRACKS.values())-3,max(TRACKS.values())+3
foundation=box('Continuous station railway concrete foundation',((min_x+max_x)/2,-(min_z+max_z)/2,TOR-.58655),(max_x-min_x,max_z-min_z,.50),BED)

track_records=[]
for number,centre in TRACKS.items():
 west=x(1550);straight_end=x((3025 if number>=20 else 2875) if number>4 else 2808)
 # The four southern lines physically terminate at the east station end.
 # Through tracks are deliberately cut at Seventh Avenue: this asset does
 # not invent the numerous switches of the original east/west throats.
 points=[Vector((float(xx),-centre,TOR)) for xx in np.linspace(west,straight_end,96)]
 for sign in [-1,1]:
  # Gauge is measured between the inner faces of the actual .060m heads.
  offset=(GAUGE+.060)/2*sign
  rail=[]
  for i,p in enumerate(points):
   tangent=(points[min(i+1,len(points)-1)]-points[max(i-1,0)]).normalized();side=Vector((-tangent.y,tangent.x,0))
   rail.append(p+side*offset)
  obj=sweep(f'Track {number:02d} 100lb-type running rail',rail,rail_profile,HEAD)
  obj.data.materials.append(WEB)
  for polygon in obj.data.polygons:
   if polygon.index%len(rail_profile) not in [2,3,17]:polygon.material_index=1
  # Repeated blocks and plates remain linked data for downstream GPU instances.
  traversed=0;next_support=0;next_joint=33*FT
  for i,(a,b) in enumerate(zip(rail,rail[1:])):
   length=(b-a).length
   while next_support<=traversed+length:
    t=max(0,min(1,(next_support-traversed)/length));p=a.lerp(b,t);angle=math.atan2(b.y-a.y,b.x-a.x)
    clone(block,'Embedded support block',(p.x,p.y,TOR-.24765),angle)
    clone(plate,'Rail tie plate',(p.x,p.y,TOR-.1524),angle)
    next_support+=33*FT/18
   if next_joint<=traversed+length:
    t=max(0,min(1,(next_joint-traversed)/length));p=a.lerp(b,t)
    for side in [-1,1]:clone(jointbar,'Running rail joint bar',(p.x,p.y+side*.025,TOR-.078),math.atan2(b.y-a.y,b.x-a.x))
    next_joint+=33*FT
   traversed+=length
 AUDIT.append({'object':f'Track {number:02d}','contact':'rail foot / tie plate / timber block / concrete base','railFoot':TOR-.14605,'plateTop':TOR-.14605,'plateBottom':TOR-.15875,'timberTop':TOR-.15875,'timberBottom':TOR-.33655,'concreteTop':TOR-.33655,'maximumErrorMetres':0,'passed':True})
 if number<=4:
  # A qualified physical terminal stop is preferable to a track through a wall;
  # the original exact stop fabrication is not certified in this interpretation.
  box(f'Track {number:02d} terminal timber stop',(straight_end+.20,-centre,TOR+.58),(.30,2.55,.32),BUFFER)
  for side in [-1,1]:box('Terminal-stop planted support',(straight_end+.26,-centre+side*.75,TOR+.10),(.24,.24,.88),IRON)
  AUDIT.append({'object':f'Track {number:02d} stop','contact':'support foot planted in concrete','bottom':TOR-.34,'baseTop':TOR-.33655,'embeddedDepth':.00345,'passed':True})
 track_records.append({'number':number,'centreZAtStation':centre,'railLocalY':TOR,'railWorldY':TOR+LEVEL['chunkWorldOffsetY'],'eastType':'stub' if number<=4 else 'through','routeXZ':[[p.x,-p.y] for p in points]})

# Nernst glowers were exposed ceramic rods, not vacuum incandescent bulbs or
# a bank of invented floodlights. The small housing details are interpreted.
lamp_kits=[cylinder('Nernst ceiling mounting flange',(0,0,-.007),.095,.014,IRON,KITS),cylinder('Nernst pendant stem',(0,0,-.10),.012,.20,IRON,KITS),cylinder('Nernst ceramic unit',(0,0,-.23),.060,.10,CERAMIC,KITS),cylinder('Nernst unit lower collar',(0,0,-.286),.063,.012,IRON,KITS)]
for side in [-1,0,1]:
 lamp_kits.append(cylinder('Nernst exposed ceramic glower',(side*.035,0,-.324),.006,.066,GLOWER,KITS,8))
fixtures=[];omitted=[];supports=[];support_objects=[]
if args.support:
 before=set(scene.objects)
 for path in args.support:bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
 support_objects=list(set(scene.objects)-before)
 bpy.context.view_layer.update()
 for obj in support_objects:
  if obj.type!='MESH' or not any(word in obj.name.lower() for word in ['floor','slab','deck','landing']):continue
  if obj.data.materials and all(material and any(word in material.name.lower() for word in ['glass','glazing']) for material in obj.data.materials):continue
  vertices=[obj.matrix_world@v.co for v in obj.data.vertices]
  tree=BVHTree.FromPolygons(vertices,[tuple(p.vertices) for p in obj.data.polygons])
  supports.append((obj.name,tree))
for platform in platforms:
 centre=platform['centreZ']
 samples=np.arange(-110,100,20*FT) if supports else [-54.5,-54.5+20*FT]
 for xx in samples:
  if not platform['bounds'][0]+3<float(xx)<platform['bounds'][1]-3:continue
  if supports:
   hits=[]
   for name,tree in supports:
    hit,normal,_,distance=tree.ray_cast(Vector((float(xx),-centre,FLOOR+.6)),Vector((0,0,1)),10)
    if hit is not None and hit.z>FLOOR+2.5:hits.append((hit.z,name))
   if not hits:
    omitted.append({'platform':platform['number'],'x':float(xx),'z':centre,'reason':'No actual opaque core floor overhead'});continue
   mount,name=min(hits)
  else:
   mount=-3.5004;name='Confirmed exit slab underside; core source bounds X[-55.2563,-47.7563],Z[-72.39,72.39]'
  for kit in lamp_kits:clone(kit,f'Platform {platform["number"]:02d} {kit.name}',(float(xx),-centre,mount))
  fixtures.append({'platform':platform['number'],'positionLocal':[float(xx),mount,centre],'positionWorld':[float(xx),mount+LEVEL['chunkWorldOffsetY'],centre],'abovePlatform':mount-FLOOR,'support':name,'contactErrorMetres':0,'emissionStrengthInterpretation':30})
for obj in support_objects:bpy.data.objects.remove(obj,do_unlink=True)

# Authoring kits are not extra visible fittings at the origin.
for obj in list(KITS.objects):bpy.data.objects.remove(obj,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for obj in COL.objects:obj.select_set(True)
bpy.context.view_layer.update()
# Audit actual mesh coordinates and instance transforms, rather than only
# reporting intended dimensions. These contacts are in Blender Z-up space.
def bounds(obj):
 points=[obj.matrix_world@Vector(corner) for corner in obj.bound_box]
 return [[min(p[axis] for p in points),max(p[axis] for p in points)] for axis in range(3)]

base_bounds=bounds(foundation);base_top=base_bounds[2][1]
sampled=[];rail_feet=[];plate_tops=[];plate_bottoms=[];timber_tops=[];timber_bottoms=[]
for obj in COL.objects:
 b=bounds(obj)
 if obj.name.startswith('Platform ') and 'concrete body' in obj.name:
  error=abs(b[2][0]-base_top)
  sampled.append({'object':obj.name,'meshBoundsXYZ':b,'surface':'foundation','contactErrorMetres':error,'passed':error<.00001})
 elif obj.name.startswith('Embedded support block'):
  timber_tops.append(b[2][1]);timber_bottoms.append(b[2][0])
 elif obj.name.startswith('Rail tie plate'):
  plate_tops.append(b[2][1]);plate_bottoms.append(b[2][0])
 elif obj.name.startswith('Track ') and 'running rail' in obj.name:
  rail_feet.append(b[2][0])
  supported=b[0][0]>=base_bounds[0][0] and b[0][1]<=base_bounds[0][1] and b[1][0]>=base_bounds[1][0] and b[1][1]<=base_bounds[1][1]
  sampled.append({'object':obj.name,'meshBoundsXYZ':b,'surface':'track foundation footprint','passed':supported})
 elif obj.name.startswith('Terminal-stop planted support'):
  embedded=base_top-b[2][0]
  sampled.append({'object':obj.name,'meshBoundsXYZ':b,'surface':'foundation','embeddedDepthMetres':embedded,'passed':0<=embedded<.02})
foundation_error=max(abs(h-base_top) for h in timber_bottoms)
plate_error=max(abs(h-p) for h in plate_bottoms for p in [min(timber_tops),max(timber_tops)])
rail_error=max(abs(h-p) for h in rail_feet for p in [min(plate_tops),max(plate_tops)])
sampled.append({'object':'All linked rail supports','timberCount':len(timber_bottoms),'plateCount':len(plate_tops),'railFootCount':len(rail_feet),'maximumTimberFoundationErrorMetres':foundation_error,'maximumTimberPlateErrorMetres':plate_error,'maximumRailPlateErrorMetres':rail_error,'passed':len(timber_bottoms)==len(plate_tops) and max(foundation_error,plate_error,rail_error)<.00001})
flanges=[obj for obj in COL.objects if 'Nernst ceiling mounting flange' in obj.name]
for obj,fixture in zip(sorted(flanges,key=lambda o:o.name),sorted(fixtures,key=lambda f:(f['platform'],f['positionLocal'][0]))):
 # Both pendant columns per platform use the same confirmed underside.
 measured_top=bounds(obj)[2][1]
 mount=fixture['positionLocal'][1]
 sampled.append({'object':obj.name,'surface':'documented core exit-slab underside' if not supports else 'upward core-floor ray hit','meshFlangeTop':measured_top,'ceilingMountHeight':mount,'contactErrorMetres':abs(measured_top-mount),'passed':abs(measured_top-mount)<.00001})
assert all(item['passed'] for item in sampled), 'Actual geometry contact audit failed'
triangles=sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in COL.objects if obj.type=='MESH')
bpy.ops.export_scene.gltf(filepath=str(OUT/'model-railway.glb'),export_format='GLB',use_selection=True,export_yup=True,export_normals=True,export_texcoords=True,export_materials='EXPORT',export_extras=True,export_gpu_instances=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'railway-editable.blend'),compress=True)
heads=PLAN['eastHeadsPlan243'];head_scale=heads['wallExtentMetres']/(heads['wallExtentPixels'][1]-heads['wallExtentPixels'][0])
stair_z=[(heads['axisPixelU']-u)*head_scale for u in heads['centresSouthToNorthPixels']]
manifest={'units':'metres','axes':'glTF X east,Yup,Zsouth','chunkWorldOffset':[0,LEVEL['chunkWorldOffsetY'],0],'railLocalY':TOR,'platformLocalY':FLOOR,'railWorldY':TOR+LEVEL['chunkWorldOffsetY'],'platformWorldY':FLOOR+LEVEL['chunkWorldOffsetY'],'trackCount':len(TRACKS),'platformCount':len(platforms),'tracks':track_records,'platforms':platforms,'suggestedTrainTrack':10,'suggestedTrainTranslation':[0,TOR+LEVEL['chunkWorldOffsetY'],TRACKS[10]],'minimumAdjacentTrackCentres':min(TRACKS[n]-TRACKS[n+1] for n in range(1,21)),'physicalGauge':GAUGE,'eastAccessHeadCentreZSouthToNorth':stair_z,'contactAudit':AUDIT,'sampledMeshContactAudit':sampled,'platformNernstFixtures':fixtures,'omittedNernstCandidates':omitted,'objectCount':len(COL.objects),'uniqueMeshCount':len({o.data for o in COL.objects if o.type=='MESH'}),'materialCount':len({mat for obj in COL.objects for mat in obj.data.materials}),'trianglesAssembled':triangles,'rawBytes':(OUT/'model-railway.glb').stat().st_size,'limits':PLAN['limits']}
(OUT/'railway-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({key:manifest[key] for key in ['trackCount','platformCount','trianglesAssembled','rawBytes','suggestedTrainTranslation']}),flush=True)

if args.render:
 scene.render.engine='CYCLES';scene.cycles.samples=32;scene.render.threads_mode='FIXED';scene.render.threads=8
 world=bpy.data.worlds.new('Railway review daylight');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=(.65,.7,.8,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.75;scene.world=world
 light=bpy.data.lights.new('Review sun','SUN');light.energy=2;sun=bpy.data.objects.new('Review sun',light);scene.collection.objects.link(sun);sun.rotation_euler=(.6,-.4,-.5)
 camera=bpy.data.objects.new('Railway plan review',bpy.data.cameras.new('Railway plan review'));scene.collection.objects.link(camera);scene.camera=camera
 camera.location=(-40,0,410);camera.rotation_euler=(0,0,0);camera.data.type='ORTHO';camera.data.ortho_scale=500
 scene.render.resolution_x=1800;scene.render.resolution_y=1000;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'railway-plan-review.png');bpy.ops.render.render(write_still=True)
 camera.data.type='PERSP';camera.data.lens=45;camera.location=(-5,-TRACKS[10]-5,TOR+4);camera.rotation_euler=(Vector((-75,-TRACKS[10]-2,TOR+2))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/'railway-track-review.png');bpy.ops.render.render(write_still=True)
