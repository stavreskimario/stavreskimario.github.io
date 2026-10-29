"""Evidence-led Penn Station context asset, in a separate authoring scene.

Run via uv with bpy 4.3 and numpy<2. This script never writes the live assets.
Blender X east/Y north/Z up exports to glTF X east/Y up/Z south, metres.
See context-research.md and the generated manifest for historical limitations.
"""
from pathlib import Path
import argparse
import json
import math
import random
import bpy
import numpy as np
from mathutils import Vector

parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, default=Path('/private/tmp/penn-phase2-context'))
parser.add_argument('--vehicles-only', action='store_true')
parser.add_argument('--render', action='store_true')
args = parser.parse_args()
OUT = args.out.resolve()
OUT.mkdir(parents=True, exist_ok=True)
FT = .3048
HALF_X, HALF_Y = 784*FT/2, 430*FT/2
AVENUE = 100*FT
CROSS_STREET = 60*FT
# Source facades are set back from the house/property lines (ASCE 1910).
SEVENTH_HOUSE_X = HALF_X + 19*FT
EIGHTH_HOUSE_X = -HALF_X - 7*FT
NORTH_HOUSE_Y = HALF_Y + 13*FT
SOUTH_HOUSE_Y = -HALF_Y - 13*FT
ROAD_TOP = -.15
RNG = random.Random(1936)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for col in list(bpy.data.collections):
    if col.name != 'Collection': bpy.data.collections.remove(col)
COL = None
MASTERS = bpy.data.collections.new('00 reusable authored masters')
bpy.context.scene.collection.children.link(MASTERS)


def collection(name):
    global COL
    COL = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(COL)
    return COL


def material(name, rgb, roughness=.7, metallic=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.diffuse_color = (*rgb, 1)
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = roughness
    p.inputs['Metallic'].default_value = metallic
    return m


def textured(name, rgb, seed, kind='stone'):
    """Original, restrained 1024² PBR maps, no sampled photographs."""
    m = material(name, rgb)
    size = 1024
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[:size, :size]
    fine = rng.normal(0, .008, (size, size)).astype(np.float32)
    height = fine * .01
    variation = fine
    if kind == 'brick':
        # The tile spans 4 m, with staggered 0.24 m brick units and thin mortar.
        row = np.floor(yy / (size*.085/4)).astype(int)
        in_y = np.mod(yy, size*.085/4)
        in_x = np.mod(xx + (row % 2)*size*.12/4, size*.24/4)
        mortar = (in_y < 1.5) | (in_x < 1.4)
        cell = (row*97 + np.floor((xx + (row%2)*size*.12/4)/(size*.24/4))).astype(int)
        cellnoise = np.sin(cell*3.172)*.018
        variation = variation + cellnoise
        height = np.where(mortar, -.035, .004 + fine*.02)
    else:
        mortar = np.zeros((size, size), dtype=bool)
    for suffix in ['albedo', 'normal', 'roughness']:
        image = bpy.data.images.new(f'{name}_{suffix}', width=size, height=size)
        rgba = np.ones((size, size, 4), dtype=np.float32)
        if suffix == 'albedo':
            for k in range(3): rgba[:,:,k] = np.clip(rgb[k]+variation, .005, 1)
            if kind == 'brick': rgba[mortar,:3] = (.39,.36,.31)
        elif suffix == 'normal':
            dy, dx = np.gradient(height)
            rgba[:,:,0] = .5-dx*.7
            rgba[:,:,1] = .5-dy*.7
            rgba[:,:,2] = .999
            image.colorspace_settings.name = 'Non-Color'
        else:
            for k in range(3): rgba[:,:,k] = np.clip(.77 + fine*2, .5,.96)
            image.colorspace_settings.name = 'Non-Color'
        image.pixels.foreach_set(rgba.ravel())
        image.filepath_raw = str(OUT/f'context-{name.lower()}-{suffix}.png')
        image.file_format = 'PNG'
        image.save()
        image.pack()
        tex = m.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = image
        p = m.node_tree.nodes.get('Principled BSDF')
        if suffix == 'albedo': m.node_tree.links.new(tex.outputs['Color'], p.inputs['Base Color'])
        elif suffix == 'roughness': m.node_tree.links.new(tex.outputs['Color'], p.inputs['Roughness'])
        else:
            normal = m.node_tree.nodes.new('ShaderNodeNormalMap')
            normal.inputs['Strength'].default_value = .27 if kind=='brick' else .07
            m.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color'])
            m.node_tree.links.new(normal.outputs['Normal'],p.inputs['Normal'])
    return m

STONE = textured('IndianaLimestoneContext',(.52,.50,.44),211)
BRICK = textured('HotelBuffBrick',(.35,.28,.20),212,'brick')
SIDEWALK = textured('CitySidewalkStone',(.31,.31,.29),213)
DARK_STONE = material('DarkGraniteCurb',(.20,.20,.19),.86)
IRON = material('StreetCastIron',(.032,.04,.037),.54,.5)
CHROME = material('VehicleNickelAndChrome',(.43,.46,.45),.20,.92)
TYRE = material('TyreRubber',(.018,.019,.018),.94)
WHITEWALL = material('TyreCreamSidewall',(.56,.54,.47),.87)
CAR_BLACK = material('1930sSedanBlackLacquer',(.016,.022,.020),.25,.32)
CAR_OCHRE = material('1930sCabOchreLacquer',(.37,.25,.07),.29,.25)
CAR_DARK = material('CabRoofAndFenders',(.025,.026,.022),.32,.18)
CAR_GLASS = material('AutomobileGlazing',(.05,.085,.092),.16,.38)
WINDOW = material('PeriodBuildingGlazing',(.075,.11,.12),.25,.27)
FRAME = material('PaintedTimberWindowFrames',(.18,.18,.15),.66)
GLASS_LAMP = material('OpalStreetlampGlass',(.69,.67,.56),.29,.05)
RED_LAMP = material('RearLampRedGlass',(.25,.016,.009),.20,.1)
COPPER = material('HotelCopperCornice',(.17,.21,.17),.58,.55)
LETTER = material('InlaidStoneLettering',(.075,.069,.053),.71)


def mesh(name, vertices, faces, mat, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    if mat: data.materials.append(mat)
    uv = data.uv_layers.new(name='ContextUV')
    for poly in data.polygons:
        poly.use_smooth = smooth
        axis = max(range(3), key=lambda k:abs(poly.normal[k]))
        axes = [k for k in range(3) if k != axis]
        for i in poly.loop_indices:
            p = data.vertices[data.loops[i].vertex_index].co
            uv.data[i].uv = (p[axes[0]]/4,p[axes[1]]/4)
    obj = bpy.data.objects.new(name,data)
    COL.objects.link(obj)
    return obj


def box(name, center, size, mat):
    c = Vector(center); d = Vector(size)/2
    offsets = [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
    return mesh(name,[tuple(c+Vector((a*d.x,b*d.y,e*d.z))) for a,b,e in offsets],[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)


def beam(name,a,b,radius,mat,segments=12):
    a,b=Vector(a),Vector(b)
    q=(b-a).to_track_quat('Z','Y')
    verts=[]
    for end in [a,b]:
        verts += [tuple(end+q@Vector((radius*math.cos(i*math.tau/segments),radius*math.sin(i*math.tau/segments),0))) for i in range(segments)]
    faces=[tuple(range(segments-1,-1,-1)),tuple(range(segments,segments*2))]
    for i in range(segments):
        j=(i+1)%segments
        faces.append((i,j,j+segments,i+segments))
    return mesh(name,verts,faces,mat,True)


def polyline(name,pts,radius,mat,segments=10):
    return [beam(name,a,b,radius,mat,segments) for a,b in zip(pts,pts[1:])]


def lathe(name,profile,mat,segments=48,flutes=0):
    verts=[]
    for z,r in profile:
        for i in range(segments):
            a=i*math.tau/segments
            rr=r*(1-.035*(.5+.5*math.cos(a*flutes))) if flutes else r
            verts.append((rr*math.cos(a),rr*math.sin(a),z))
    faces=[]
    for row in range(len(profile)-1):
        for i in range(segments):
            j=(i+1)%segments
            faces.append((row*segments+i,row*segments+j,(row+1)*segments+j,(row+1)*segments+i))
    faces += [tuple(range(segments-1,-1,-1)),tuple((len(profile)-1)*segments+i for i in range(segments))]
    return mesh(name,verts,faces,mat,True)


def ellipsoid(name,center,radii,mat,segments=28,rings=14):
    verts=[];faces=[]
    for j in range(rings+1):
        phi=math.pi*j/rings
        for i in range(segments):
            theta=math.tau*i/segments
            verts.append((center[0]+radii[0]*math.sin(phi)*math.cos(theta),center[1]+radii[1]*math.sin(phi)*math.sin(theta),center[2]+radii[2]*math.cos(phi)))
    for j in range(rings):
        for i in range(segments):
            k=j*segments+i;n=j*segments+(i+1)%segments
            faces.append((k,n,n+segments,k+segments))
    return mesh(name,verts,faces,mat,True)


def torus(name,center,major,minor,mat,axis='X',segments=48,tube=12):
    verts=[];faces=[]
    for i in range(segments):
        a=math.tau*i/segments
        for j in range(tube):
            b=math.tau*j/tube
            p=(minor*math.sin(b),(major+minor*math.cos(b))*math.cos(a),(major+minor*math.cos(b))*math.sin(a))
            if axis=='Y': p=(p[1],p[0],p[2])
            if axis=='Z': p=(p[1],p[2],p[0])
            verts.append(tuple(center[k]+p[k] for k in range(3)))
    for i in range(segments):
        for j in range(tube):
            k=i*tube+j;l=i*tube+(j+1)%tube
            faces.append((k,l,((i+1)%segments)*tube+(j+1)%tube,((i+1)%segments)*tube+j))
    return mesh(name,verts,faces,mat,True)


def loft_body(name,sections,mat,segments=32):
    verts=[];faces=[]
    for y,w,zlo,zhi in sections:
        for i in range(segments):
            a=math.tau*i/segments
            # A rounded rectangular section: lacquered coachwork rather than a box.
            sx=math.copysign(abs(math.cos(a))**.47,math.cos(a))
            sz=math.copysign(abs(math.sin(a))**.65,math.sin(a))
            verts.append((w*sx,y,(zlo+zhi)/2+(zhi-zlo)/2*sz))
    for row in range(len(sections)-1):
        for i in range(segments):
            j=(i+1)%segments
            faces.append((row*segments+i,row*segments+j,(row+1)*segments+j,(row+1)*segments+i))
    faces += [tuple(range(segments-1,-1,-1)),tuple((len(sections)-1)*segments+i for i in range(segments))]
    return mesh(name,verts,faces,mat,True)


def text(name,body,at,size,mat,rotation=None):
    font=bpy.data.curves.new(name,'FONT');font.body=body;font.size=size
    font.align_x='CENTER';font.extrude=.003;font.bevel_depth=.001
    obj=bpy.data.objects.new(name,font);COL.objects.link(obj);obj.location=at
    if rotation:obj.rotation_euler=rotation
    obj.data.materials.append(mat)
    return obj


def batch(col, name='Surface batches'):
    """Batch unique static pieces by material; keep linked masters instanced."""
    global COL
    old=COL;COL=col
    # Convert original lettering before sharing its evaluated geometry.
    for obj in list(col.objects):
        if obj.type == 'FONT':
            data = bpy.data.meshes.new_from_object(obj.evaluated_get(bpy.context.evaluated_depsgraph_get()))
            replacement = bpy.data.objects.new(obj.name, data)
            replacement.matrix_world = obj.matrix_world.copy()
            col.objects.link(replacement)
            bpy.data.objects.remove(obj, do_unlink=True)
    groups={}
    for obj in list(col.objects):
        if obj.type!='MESH' or obj.get('keep_instance') or obj.hide_render:continue
        mat=obj.data.materials[0] if obj.data.materials else None
        groups.setdefault(mat,[]).append(obj)
    for mat,objects in groups.items():
        verts=[];faces=[];smooth=[];uvs=[]
        for obj in objects:
            off=len(verts)
            verts.extend(tuple(obj.matrix_world@v.co) for v in obj.data.vertices)
            for p in obj.data.polygons:
                faces.append(tuple(off+i for i in p.vertices));smooth.append(p.use_smooth)
                uv=obj.data.uv_layers.active
                uvs.extend(tuple(uv.data[i].uv) if uv else (0,0) for i in p.loop_indices)
        merged=mesh(f'{name} — {mat.name if mat else "default"}',verts,faces,mat)
        for p,value in zip(merged.data.polygons,smooth):p.use_smooth=value
        for uv,value in zip(merged.data.uv_layers.active.data,uvs):uv.uv=value
        for obj in objects:bpy.data.objects.remove(obj,do_unlink=True)
    COL=old


def instance(master,name,at,rotation=0,scale=None):
    obj=bpy.data.objects.new(name,master.data);COL.objects.link(obj)
    obj.location=at;obj.rotation_euler.z=rotation
    if scale:obj.scale=scale
    obj['keep_instance']=True
    return obj


def automobile(name,paint,taxi=False):
    """Generic 1930s closed saloon: original reconstruction, no exact marque."""
    col=collection(name)
    loft_body('Rounded steel coachwork',[(-2.16,.53,.62,.92),(-2.04,.73,.52,1.04),(-1.7,.81,.51,1.16),(-1.2,.80,.53,1.19),(.45,.79,.54,1.23),(.76,.73,.58,1.23),(1.65,.62,.61,1.12),(1.98,.57,.65,1.05)],paint)
    loft_body('Pressed closed saloon roof',[(-1.64,.61,1.09,1.36),(-1.36,.68,1.12,1.67),(-1.16,.69,1.15,1.75),(.38,.65,1.15,1.74),(.68,.60,1.13,1.55),(.87,.56,1.12,1.28)],CAR_DARK if taxi else paint)
    # Glazed panes, their individual bright metal reveals and original door seams.
    for side in [-1,1]:
        for y0,y1 in [(-1.27,-.34),(-.27,.55)]:
            low_x=side*.744;high_x=side*.704
            pts=[(low_x,y0,1.18),(low_x,y1,1.18),(high_x,y1-.05,1.60),(high_x,y0+.05,1.63)]
            mesh('Saloon side glass',pts,[(0,1,2,3)],CAR_GLASS)
            polyline('Nickel window reveal',pts+[pts[0]],.013,CHROME)
        for yy in [-1.38,-.30,.70]:
            polyline('Door gap',[(side*.80,yy,.66),(side*.80,yy,1.12),(side*.71,yy,1.19)],.004,IRON,6)
        for yy in [-.47,.47]:beam('Door handle',(side*.811,yy-.075,1.05),(side*.811,yy+.075,1.05),.018,CHROME)
        beam('Waistline bright trim',(side*.80,-1.58,1.12),(side*.75,.73,1.12),.011,CHROME)
        # Exposed running boards and individually swept fenders.
        board = loft_body('Running board', [(-1.45,.12,.37,.43),(1.43,.12,.37,.43)],CAR_DARK)
        board.location.x = side*.89
        for yy in [-1.43,1.38]:
            verts=[];faces=[]
            for i in range(41):
                a=-.09*math.pi+i/40*1.18*math.pi
                for xx,rr in [(side*.74,.53),(side*1.05,.53),(side*.74,.59),(side*1.05,.59)]:
                    verts.append((xx,yy+rr*math.cos(a),.42+rr*math.sin(a)))
            for i in range(40):
                k=i*4;l=k+4
                faces.extend([(k,l,l+1,k+1),(k+2,k+3,l+3,l+2),(k,k+2,l+2,l),(k+1,l+1,l+3,k+3)])
            mesh('Swept rounded wheel fender',verts,faces,CAR_DARK if taxi else paint,True)
            center=(side*.94,yy,.42)
            torus('Tyre with rounded shoulder',center,.285,.112,TYRE)
            torus('Cream rubber sidewall',(side*1.047,yy,.42),.282,.018,WHITEWALL)
            outer=side*1.055
            beam('Wheel steel disc',(side*.90,yy,.42),(outer,yy,.42),.245,IRON,48)
            for j in range(24):
                a=j*math.tau/24
                beam('Radial wire wheel spoke',(outer,yy,.42),(outer,yy+.237*math.cos(a),.42+.237*math.sin(a)),.005,CHROME,6)
            ellipsoid('Domed nickel hubcap',(side*1.076,yy,.42),(.043,.11,.11),CHROME,24,12)
    # Sloping split windscreen, rear glazing and separate wiper blades.
    for side in [-1,1]:
        x0=0 if side==1 else -.59;x1=.59 if side==1 else 0
        pts=[(x0,.932,1.22),(x1,.932,1.22),(x1*.94,.62,1.66),(x0*.94,.62,1.66)]
        mesh('Split sloped windscreen',pts,[(0,1,2,3)],CAR_GLASS)
        polyline('Windscreen surround',pts+[pts[0]],.013,CHROME)
        beam('Windscreen wiper',(side*.30,.838,1.25),(side*.12,.65,1.51),.008,IRON,6)
    rear=[(-.56,-1.61,1.19),(.56,-1.61,1.19),(.58,-1.36,1.57),(-.58,-1.36,1.57)]
    mesh('Rear windscreen',rear,[(0,1,2,3)],CAR_GLASS);polyline('Rear glass reveal',rear+[rear[0]],.014,CHROME)
    # Tall radiator and hood vents: no invented manufacturer logo.
    grill=[(-.44,2.025,.63),(.44,2.025,.63),(.49,1.98,.97),(.39,1.96,1.13),(-.39,1.96,1.13),(-.49,1.98,.97)]
    mesh('Dark radiator matrix',grill,[tuple(range(6))],IRON)
    polyline('Bright radiator perimeter',grill+[grill[0]],.025,CHROME)
    for xx in np.linspace(-.40,.40,25):beam('Radiator vertical slat',(float(xx),2.041,.67),(float(xx),2.015,1.07),.0065,CHROME,6)
    for side in [-1,1]:
        for yy in np.linspace(.92,1.63,9):
            beam('Hood cooling louvre',(side*.644,float(yy),.84),(side*.638,float(yy),1.04),.008,IRON,6)
        ellipsoid('Torpedo headlamp housing',(side*.65,1.72,1.11),(.18,.27,.18),CHROME)
        beam('Headlamp face',(side*.65,1.94,1.11),(side*.65,1.98,1.11),.151,GLASS_LAMP,40)
        torus('Headlamp rim',(side*.65,1.985,1.11),.155,.015,CHROME,'Y',40)
        beam('Headlamp bracket',(side*.58,1.5,.83),(side*.65,1.72,1.02),.035,IRON)
        beam('Tail lamp',(side*.66,-2.06,.84),(side*.66,-2.10,.84),.07,RED_LAMP,20)
    for front in [-1,1]:
        points=[(-.86,front*2.15,.40),(-.52,front*2.28,.40),(0,front*2.33,.40),(.52,front*2.28,.40),(.86,front*2.15,.40)]
        polyline('Curved bright metal bumper',points,.035,CHROME,16)
        for xx in [-.43,.43]:beam('Bumper overrider',(xx,front*2.27,.28),(xx,front*2.27,.53),.035,CHROME)
    if taxi:
        sign=box('Generic taxi roof sign',(0,-.15,1.86),(.58,.18,.22),GLASS_LAMP)
        text('Generic taxi lettering','TAXI',(0,-.247,1.785),.15,LETTER,(math.pi/2,0,0))
    # Group by surface for a linked, instancable vehicle kit.
    bpy.context.view_layer.update();batch(col,name)
    for obj in col.objects:
        if obj.type=='MESH':obj['context_interpretation']='Generic 1930s saloon; not an authenticated make, taxi livery or parked position'
    return col


SEDAN=automobile('01 Generic 1930s closed sedan',CAR_BLACK)
CAB=automobile('02 Generic 1930s taxi interpretation',CAR_OCHRE,True)
# Each authored component is kept as linked geometry when placed repeatedly.
VEHICLES=collection('03 Street vehicles — reconstructed placements')
vehicle_placements=[('sedan',(136.1,35,ROAD_TOP-.023),0),('taxi',(143.2,-17,ROAD_TOP-.023),math.pi),('sedan',(-136,-23,ROAD_TOP-.023),0),('taxi',(36,-78.0,ROAD_TOP-.023),math.pi/2),('sedan',(-46,78.1,ROAD_TOP-.023),-math.pi/2),('taxi',(136.3,5,ROAD_TOP-.023),0)]
for kind,at,angle in vehicle_placements:
    source=CAB if kind=='taxi' else SEDAN
    for master in source.objects:
        if master.type!='MESH':continue
        obj=instance(master,f'{kind} component',at,angle)
for source in [SEDAN,CAB]:
    for obj in list(source.objects):
        for c in list(obj.users_collection):c.objects.unlink(obj)
        MASTERS.objects.link(obj);obj.hide_render=True


def streetlamp_master():
    col=collection('04 Original generic cast iron street standard')
    pole=lathe('Fluted cast iron street standard',[(0,.21),(.12,.25),(.22,.24),(.34,.18),(.70,.17),(.82,.12),(1.1,.11),(5.8,.065),(6.05,.11),(6.17,.08)],IRON,48,12)
    # A curled arm is a modelled profile, not a bent cuboid.
    points=[(0,0,5.95)]
    for i in range(33):
        t=i/32
        points.append((1.32*math.sin(t*math.pi*.88),0,6.03+.93*math.sin(t*math.pi*.88)))
    polyline('Curled swan-neck arm',points,.042,IRON,12)
    x,z=points[-1][0],points[-1][2]
    beam('Hanging luminaire stem',(x,0,z),(x,0,z-.30),.035,IRON)
    shade=lathe('Cast luminaire bell',[(0,.10),(.07,.18),(.16,.29),(.23,.31),(.27,.26),(.31,.11)],IRON,40)
    shade.location=(x,0,z-.62)
    glass=ellipsoid('Hanging opal bowl',(x,0,z-.69),(.245,.245,.15),GLASS_LAMP,32,16)
    for angle in [0,math.pi/2,math.pi,math.pi*1.5]:
        beam('Luminaire bowl cage',(x+.22*math.cos(angle),.22*math.sin(angle),z-.56),(x+.12*math.cos(angle),.12*math.sin(angle),z-.81),.008,IRON,6)
    bpy.context.view_layer.update();batch(col,'Street standard')
    return col


LAMP=streetlamp_master()
FURNITURE=collection('05 Street furniture — reconstructed positions')
for side in [-1,1]:
    for yy in [-57,-29,0,29,57]:
        x = SEVENTH_HOUSE_X+4.8 if side==1 else EIGHTH_HOUSE_X-4.8
        for master in LAMP.objects:instance(master,'Avenue streetlamp',(x,yy,0),0 if side==1 else math.pi)
for side in [-1,1]:
    for xx in [-98,-58,-18,22,62,102]:
        y = NORTH_HOUSE_Y+2.1 if side==1 else SOUTH_HOUSE_Y-2.1
        for master in LAMP.objects:instance(master,'Cross-street streetlamp',(xx,y,0),side*math.pi/2)
for master in list(LAMP.objects):
    for c in list(master.users_collection):c.objects.unlink(master)
    MASTERS.objects.link(master);master.hide_render=True

PAVEMENT=collection('06 Period pavement — widths provisional pending registered map')
# Road paint, modern zebra crossings, signals and curb ramps are intentionally absent.
ASPHALT=material('PeriodAsphaltRoadSurface',(.065,.069,.066),.96)
for side in [-1,1]:
    house_x=SEVENTH_HOUSE_X if side==1 else EIGHTH_HOUSE_X
    x=house_x+side*3.048
    box('Avenue stone sidewalk',(x,0,-.075),(6.096,2*NORTH_HOUSE_Y+.6,.15),SIDEWALK)
    curb_x=house_x+side*6.096
    box('Avenue granite curb',(curb_x,0,-.075),(.24,2*NORTH_HOUSE_Y+.5,.18),DARK_STONE)
    box('Avenue carriageway',(house_x+side*AVENUE/2,0,ROAD_TOP-.05),(AVENUE-12.192,340,.1),ASPHALT)
    for yy in np.arange(-HALF_Y,HALF_Y,1.5):
        box('Sidewalk transverse joint',(x,float(yy),.003),(6.04,.016,.008),DARK_STONE)
    for dx in [-1.5,0,1.5]:box('Sidewalk longitudinal joint',(x+dx,0,.004),(.014,2*HALF_Y,.008),DARK_STONE)
for side in [-1,1]:
    house_y=NORTH_HOUSE_Y if side==1 else SOUTH_HOUSE_Y
    y=house_y+side*1.524
    box('Cross-street flagstone sidewalk',(0,y,-.115),(2*HALF_X,3.048,.23),SIDEWALK)
    box('Cross-street granite curb',(0,house_y+side*3.048,-.075),(2*HALF_X,.24,.18),DARK_STONE)
    box('Cross-street carriageway',(0,house_y+side*CROSS_STREET/2,ROAD_TOP-.05),(440,CROSS_STREET-6.096,.1),ASPHALT)
    for xx in np.arange(-HALF_X,HALF_X,1.5):box('Flagstone sidewalk joint',(float(xx),y,.003),(.016,3.0,.008),DARK_STONE)
# Cast-iron drain grates beside the curb, plausible generic products rather than exact inventory.
for xx,yy,angle in [(HALF_X+6.5,-51,0),(HALF_X+6.5,52,0),(-HALF_X-6.5,-52,0),(-HALF_X-6.5,51,0),(90,HALF_Y+3.45,math.pi/2),(-90,-HALF_Y-3.45,math.pi/2)]:
    grate=box('Road drain casting',(xx,yy,-.42),(.6,1.1,.035),IRON)
    for dy in np.arange(-.44,.5,.11):box('Drain longitudinal slot',(xx,yy+float(dy),-.397),(.45,.044,.008),LETTER)

# Opposite avenue sidewalks and the station's own setback forecourts.
for side,house,facade in [(1,SEVENTH_HOUSE_X,HALF_X),(-1,EIGHTH_HOUSE_X,-HALF_X)]:
    far_house=house+side*AVENUE
    box('Opposite avenue sidewalk',(far_house-side*3.048,0,-.075),(6.096,2*NORTH_HOUSE_Y,.15),SIDEWALK)
    box('Opposite avenue curb',(far_house-side*6.096,0,-.075),(.24,2*NORTH_HOUSE_Y,.18),DARK_STONE)
    box('Station avenue setback forecourt',((house+facade)/2,0,-.075),(abs(house-facade),2*HALF_Y,.15),SIDEWALK)
    for yy in np.arange(-HALF_Y,HALF_Y,1.5):box('Opposite sidewalk joint',(far_house-side*3.048,float(yy),.002),(6.08,.016,.008),DARK_STONE)
for side in [-1,1]:
    house=NORTH_HOUSE_Y if side==1 else SOUTH_HOUSE_Y
    box('Station cross-street setback margin',(0,side*(HALF_Y+6.5*FT),-.075),(2*HALF_X,13*FT,.15),SIDEWALK)
    far_house=house+side*CROSS_STREET
    box('Opposite cross-street sidewalk',(0,far_house-side*1.524,-.075),(2*HALF_X,3.048,.15),SIDEWALK)
    box('Opposite cross-street curb',(0,far_house-side*3.048,-.075),(2*HALF_X,.24,.18),DARK_STONE)
# West32nd terminates at Seventh Avenue; it never runs through the station block.
east_house=SEVENTH_HOUSE_X+AVENUE
box('West32nd eastward carriageway',((east_house+340)/2,0,ROAD_TOP-.05),(340-east_house,CROSS_STREET-6.096,.1),ASPHALT)
for side in [-1,1]:
    box('West32nd sidewalk beside hotel',((east_house+340)/2,side*7.62,-.075),(340-east_house,3.048,.15),SIDEWALK)
    box('West32nd granite curb',((east_house+340)/2,side*6.096,-.075),(340-east_house,.24,.18),DARK_STONE)

# Architectural anchors are added below after their evidence and plan registration.


def export_context():
    bpy.context.scene.unit_settings.system='METRIC'
    bpy.context.scene.unit_settings.scale_length=1
    bpy.context.preferences.filepaths.save_version=0
    bpy.context.view_layer.update()
    for col in list(bpy.data.collections):
        if col==MASTERS or col.name=='Collection':continue
        batch(col,col.name)
    for obj in bpy.data.objects:
        if obj.type=='MESH':
            obj['asset_status']='Evidence-led historical context extension; see context-manifest.json'
            for mat in obj.data.materials:mat.use_backface_culling=False
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'context-neighbourhood.blend'),compress=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.data.objects:
        if obj.type in {'MESH','FONT'} and not obj.hide_render:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'context-neighbourhood.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True,export_gpu_instances=True)
    print('CONTEXT_OUTPUT',OUT,flush=True)
    print('GLB_BYTES',(OUT/'context-neighbourhood.glb').stat().st_size,flush=True)


def render_vehicle_review():
    global COL
    COL=collection('99 Temporary visual review rig — excluded from source asset')
    box('Review road',(136,35,ROAD_TOP-.03),(30,30,.05),material('ReviewAsphalt',(.075,.078,.075),.95))
    world=bpy.data.worlds.new('Context neutral daylight');world.use_nodes=True
    world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.65,.72,.78,1)
    world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.6
    bpy.context.scene.world=world
    data=bpy.data.lights.new('Review daylight','SUN');data.energy=2.0;data.angle=.09
    sun=bpy.data.objects.new('Review daylight',data);COL.objects.link(sun);sun.rotation_euler=(.45,-.6,-.3)
    camera_data=bpy.data.cameras.new('Vehicle inspection camera');camera=bpy.data.objects.new('Vehicle inspection camera',camera_data);COL.objects.link(camera)
    camera.location=(141.0,41.7,3.1);target=Vector((136.1,35,.8));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();camera_data.lens=58
    scene=bpy.context.scene;scene.camera=camera;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=24
    scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=900;scene.render.resolution_y=600;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.filepath=str(OUT/'vehicle-close-review.png')
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=0
    bpy.ops.render.render(write_still=True)


def move_to_masters(col):
    for obj in list(col.objects):
        for c in list(obj.users_collection):c.objects.unlink(obj)
        MASTERS.objects.link(obj);obj.hide_render=True


def window_kit(name,w,h,lattice=False,casing=STONE):
    col=collection(name)
    box('Recessed glazing',(0,-.045,0),(w,.035,h),WINDOW)
    for side in [-1,1]:
        box('Window jamb',(side*(w/2+.055),-.10,0),(.11,.17,h+.22),casing)
        box('Window head and sill',(0,-.11,side*(h/2+.055)),(w+.22,.19,.11),casing)
    box('Projecting stone sill',(0,-.17,-h/2-.11),(w+.36,.35,.12),casing)
    if lattice:
        for x in np.arange(-w/2+.25,w/2,.30):box('Original iron lattice vertical',(float(x),-.081,0),(.022,.045,h),IRON)
        for z in np.arange(-h/2+.28,h/2,.38):box('Original iron lattice transom',(0,-.083,float(z)),(w,.047,.022),IRON)
    else:
        box('Timber window centre stile',(0,-.084,0),(.043,.055,h),FRAME)
        box('Timber sash meeting rail',(0,-.09,0),(w,.055,.055),FRAME)
        for z in [-h*.24,h*.24]:box('Window sash glazing bar',(0,-.091,z),(w,.04,.027),FRAME)
    bpy.context.view_layer.update();batch(col,name)
    masters=list(col.objects);move_to_masters(col)
    return masters


def place_kit(kit,name,at,rotation=0):
    for master in kit:instance(master,name,at,rotation)


def extruded_union(name,rectangles,z0,z1,mat):
    """A closed union of the source's orthogonal plan wings, without coplanar walls."""
    xs=sorted(set(v for r in rectangles for v in r[:2]))
    ys=sorted(set(v for r in rectangles for v in r[2:]))
    filled=set()
    for i in range(len(xs)-1):
        for j in range(len(ys)-1):
            cx=(xs[i]+xs[i+1])/2;cy=(ys[j]+ys[j+1])/2
            if any(a<cx<b and c<cy<d for a,b,c,d in rectangles):filled.add((i,j))
    verts=[];faces=[]
    def quad(points):
        k=len(verts);verts.extend(points);faces.append((k,k+1,k+2,k+3))
    for i,j in filled:
        a,b=xs[i],xs[i+1];c,d=ys[j],ys[j+1]
        quad([(a,c,z1),(b,c,z1),(b,d,z1),(a,d,z1)])
        quad([(a,d,z0),(b,d,z0),(b,c,z0),(a,c,z0)])
        if (i-1,j) not in filled:quad([(a,c,z0),(a,c,z1),(a,d,z1),(a,d,z0)])
        if (i+1,j) not in filled:quad([(b,d,z0),(b,d,z1),(b,c,z1),(b,c,z0)])
        if (i,j-1) not in filled:quad([(a,c,z0),(b,c,z0),(b,c,z1),(a,c,z1)])
        if (i,j+1) not in filled:quad([(b,d,z0),(a,d,z0),(a,d,z1),(b,d,z1)])
    return mesh(name,verts,faces,mat)


def volume_union(name,boxes,mat):
    """Join orthogonal adjoining stone wings without hidden duplicate facades."""
    xs=sorted(set(v for r in boxes for v in r[:2]));ys=sorted(set(v for r in boxes for v in r[2:4]));zs=sorted(set(v for r in boxes for v in r[4:]))
    filled=set()
    for i in range(len(xs)-1):
        for j in range(len(ys)-1):
            for k in range(len(zs)-1):
                p=((xs[i]+xs[i+1])/2,(ys[j]+ys[j+1])/2,(zs[k]+zs[k+1])/2)
                if any(a<p[0]<b and c<p[1]<d and e<p[2]<f for a,b,c,d,e,f in boxes):filled.add((i,j,k))
    verts=[];faces=[]
    def quad(points):
        n=len(verts);verts.extend(points);faces.append((n,n+1,n+2,n+3))
    for i,j,k in filled:
        a,b=xs[i],xs[i+1];c,d=ys[j],ys[j+1];e,f=zs[k],zs[k+1]
        if (i-1,j,k) not in filled:quad([(a,c,e),(a,c,f),(a,d,f),(a,d,e)])
        if (i+1,j,k) not in filled:quad([(b,d,e),(b,d,f),(b,c,f),(b,c,e)])
        if (i,j-1,k) not in filled:quad([(a,c,e),(b,c,e),(b,c,f),(a,c,f)])
        if (i,j+1,k) not in filled:quad([(b,d,e),(a,d,e),(a,d,f),(b,d,f)])
        if (i,j,k-1) not in filled:quad([(a,d,e),(b,d,e),(b,c,e),(a,c,e)])
        if (i,j,k+1) not in filled:quad([(a,c,f),(b,c,f),(b,d,f),(a,d,f)])
    return mesh(name,verts,faces,mat)


def corinthian_kit(name,height=53*FT):
    col=collection(name)
    base=.77;cap=2.02;shaft=height-base-cap
    lathe('Corinthian moulded base',[(0,1.13),(.17,1.16),(.27,1.0),(.36,.91),(.43,1.02),(.55,1.0),(.65,.91),(base,.91)],STONE,72)
    obj=lathe('Farley fluted granite shaft',[(0,.91),(.25,.92),(shaft*.3,.90),(shaft*.7,.85),(shaft,.80)],STONE,144,24);obj.location.z=base
    obj=lathe('Corinthian capital bell',[(0,.80),(.35,.86),(1.0,1.02),(1.55,1.14),(cap,1.20)],STONE,48);obj.location.z=height-cap
    box('Corinthian abacus',(0,0,height-.11),(2.6,2.6,.22),STONE)
    for rank in [0,1]:
        for k in range(8):
            a=(k+rank*.5)*math.pi/4
            radial=Vector((math.cos(a),math.sin(a),0));tangent=Vector((-math.sin(a),math.cos(a),0))
            verts=[];faces=[]
            for iy in range(13):
                t=iy/12
                width=.37*max(0,math.sin(math.pi*t))**.65*(1+.16*math.cos(8*math.pi*t))
                radius=.81+.16*t+.26*t**5
                z=height-cap+rank*.67+.10+1.12*t-.23*t**8
                for ix in range(7):
                    s=-1+2*ix/6
                    p=radial*(radius+.07*(1-s*s)*math.sin(math.pi*t))+tangent*s*width+Vector((0,0,z))
                    verts.append(tuple(p))
            for iy in range(12):
                for ix in range(6):
                    q=iy*7+ix;faces.append((q,q+1,q+8,q+7))
            mesh('Lobed acanthus relief interpretation',verts,faces,STONE,True)
    for a in [math.pi/4,3*math.pi/4,5*math.pi/4,7*math.pi/4]:
        points=[]
        for i in range(36):
            t=i/35;angle=t*math.pi*2.3
            r=.25*(1-t)+.035
            p=Vector((math.cos(a),math.sin(a),0))*(1.02+r*math.cos(angle))+Vector((0,0,height-.42+r*math.sin(angle)))
            points.append(tuple(p))
        polyline('Capital corner volute',points,.037,STONE,10)
    bpy.context.view_layer.update();batch(col,name)
    masters=list(col.objects);move_to_masters(col)
    return masters


def ionic_kit(name,height=14.1):
    col=collection(name)
    lathe('Attic Ionic moulded base',[(0,.76),(.16,.78),(.26,.64),(.36,.60),(.47,.68),(.57,.60),(.66,.58)],STONE,64)
    obj=lathe('Ionic portico shaft',[(0,.58),(height*.35,.57),(height-.94,.49)],STONE,120,24);obj.location.z=.66
    obj=lathe('Ionic echinus',[(0,.49),(.12,.62),(.27,.65),(.42,.72)],STONE,48);obj.location.z=height-.42
    box('Ionic abacus',(0,0,height+.04),(1.64,1.4,.18),STONE)
    for front in [-1,1]:
        for side in [-1,1]:
            points=[]
            for i in range(45):
                t=i/44;a=t*math.pi*3.1
                radius=.34*(1-t)+.025
                points.append((side*.54+side*radius*math.cos(a),front*.57,height-.18+radius*math.sin(a)))
            polyline('Ionic carved spiral volute',points,.043,STONE,12)
    bpy.context.view_layer.update();batch(col,name)
    masters=list(col.objects);move_to_masters(col)
    return masters


def cornice_segment(name,center,length,axis='Y',base=0,mat=STONE,scale=1):
    for i,(out,high) in enumerate([(1.0,.25),(1.18,.22),(1.45,.18),(1.6,.25),(1.15,.21)]):
        dims=(out*scale,length,high*scale) if axis=='Y' else (length,out*scale,high*scale)
        box(name, (center[0],center[1],base+i*.22*scale),dims,mat)


def farley_post_office():
    """Original 1913 east facade plus a declared, approximate 1935 rear annex."""
    # The primary plan is authoritative in form; its full scale registration is pending.
    # 355 x 332 ft is a WORKING envelope, not certified dimensional evidence.
    width,depth=355*FT,332*FT
    stair_foot=EIGHTH_HOUSE_X-AVENUE
    rise=22*FT
    stair_run=31*.36
    column_x=stair_foot-stair_run-1.35
    east_wall=column_x-4.0
    west_wall=east_wall-depth
    granite=textured('FarleyGranite',(.48,.46,.415),214)
    global STONE
    saved_stone=STONE;STONE=granite
    kit=corinthian_kit('10 Farley 53ft Corinthian order master')
    tall_window=window_kit('11 Farley iron lattice glazing master',3.0,9.9,True,granite)
    upper_window=window_kit('12 Farley attic window master',1.5,2.25,False,granite)
    col=collection('13 Farley original east pavilion and colonnade — plate360–364')
    # Raised public floor: the 31-step/22-foot relation is recorded by NYC LPC.
    for i in range(31):
        x=stair_foot-(i+.5)*.36
        step_height=(i+1)*rise/31
        box('Farley monumental stair tread',(x,0,step_height/2),(.365,81.5,step_height),granite)
    box('Farley elevated public colonnade floor',(column_x-2.2,0,rise-.20),(7.1,width,.40),granite)
    # Front backing, corner pavilions, and side/rear perimeter wings enclose the mail room.
    front_wall_x=east_wall
    perimeter_boxes=[
        (front_wall_x-10.4,front_wall_x,-width/2,width/2,rise,27.8),
        (west_wall,east_wall,width/2-12,width/2,0,30.8),
        (west_wall,east_wall,-width/2,-width/2+12,0,30.8),
        (west_wall,west_wall+12,-width/2,width/2,0,29.6),
    ]
    box('Farley central sorting room',((east_wall+west_wall)/2,0,7.5),(depth-23,width-24,15),granite)
    # A low clerestory roof over the workroom is a plan-led interpretation.
    for yy in np.arange(-32,33,9):
        y=float(yy)
        points=[(west_wall+14,y-3.7,15.3),(east_wall-14,y-3.7,15.3),(east_wall-14,y,17.4),(west_wall+14,y,17.4),(west_wall+14,y+3.7,15.3),(east_wall-14,y+3.7,15.3)]
        mesh('Farley workroom rooflight',points,[(0,1,2,3),(3,2,5,4)],WINDOW)
        for xx in np.arange(west_wall+15,east_wall-14,4):beam('Workroom rooflight bar',(float(xx),y-3.7,15.35),(float(xx),y,17.45),.04,IRON)
    positions=np.linspace(-38.0,38.0,20)
    for yy in positions:place_kit(kit,'Farley 53ft Corinthian column',(column_x,float(yy),rise))
    for yy in (positions[:-1]+positions[1:])/2:
        place_kit(tall_window,'Farley glazed bay',(east_wall+.03,float(yy),rise+10.5),math.pi/2)
        # Door aedicules are carved profiles; their grille designs remain approximate.
        box('Farley public door',(east_wall+.13,float(yy),rise+1.8),(.08,2.05,3.6),IRON)
        for side in [-1,1]:box('Farley door stone surround',(east_wall+.32,float(yy)+side*1.15,rise+1.9),(.55,.20,3.9),granite)
        beam('Farley door centre stile',(east_wall+.20,float(yy),rise+.15),(east_wall+.20,float(yy),rise+3.45),.032,CHROME)
        pts=[(east_wall+.46,float(yy)-1.3,rise+4.0),(east_wall+.46,float(yy),rise+4.54),(east_wall+.46,float(yy)+1.3,rise+4.0)]
        polyline('Farley alternating classical doorway pediment',pts,.10,granite,12)
    top_order=rise+53*FT
    box('Farley colonnade entablature',(column_x-1.65,0,top_order+1.35),(7.3,84,2.7),granite)
    cornice_segment('Farley great east cornice',(column_x-1.25,0),width,base=top_order+2.55,mat=granite,scale=1.35)
    attic_base=top_order+3.8
    perimeter_boxes.append((column_x-8.25,column_x+1.25,-width/2,width/2,attic_base,attic_base+4.5))
    for yy in np.linspace(-37.8,37.8,21):place_kit(upper_window,'Farley attic sash',(column_x+1.31,float(yy),attic_base+2.2),math.pi/2)
    cornice_segment('Farley attic coping',(column_x-3.2,0),width,base=attic_base+4.45,mat=granite,scale=.65)
    # Front corner square pavilions, low stepped pyramid roofs, and carved relief panels.
    for side in [-1,1]:
        y=side*(width/2-6.5)
        perimeter_boxes.append((column_x-8.1,column_x+1.9,y-6.5,y+6.5,rise,attic_base+4.5))
        for i in range(6):box('Farley stepped pyramid roof',(column_x-3.1,y,attic_base+4.65+i*.46),(10.0-i*1.35,13.0-i*1.62,.49),granite)
        # Reserved panel has the documented outline; detailed federal seal is not invented.
        box('Farley corner sculpture panel — relief unresolved',(column_x+1.94,y,top_order-3.0),(.13,4.15,3.5),granite)
        for z in np.arange(rise+1,top_order,1.2):box('Farley pavilion ashlar joint',(column_x+1.982,y,float(z)),(.012,12.2,.018),DARK_STONE)
        # Side elevation repeats the classical rhythm with pilasters, as in LPC's report.
        for xx in np.linspace(west_wall+8,east_wall-7,21):
            box('Farley side granite pilaster',(float(xx),side*(width/2+.13),rise+8),(1.40,.45,16.0),granite)
            box('Farley side pilaster capital',(float(xx),side*(width/2+.18),rise+16.4),(1.85,.65,.8),granite)
            place_kit(upper_window,'Farley side attic sash',(float(xx),side*(width/2+.35),attic_base+1.6),math.pi if side==1 else 0)
        cornice_segment('Farley side great cornice',((west_wall+east_wall)/2,side*width/2),depth,axis='X',base=top_order+2.55,mat=granite,scale=1.3)
    volume_union('Farley continuous stone perimeter and pavilions',perimeter_boxes,granite)
    # Terra-cotta antefix silhouette, abstracted from plate364 rather than blank parapet.
    for yy in np.arange(-width/2+2,width/2-1,2.0):
        y=float(yy);z=attic_base+5.04
        for side in [-1,1]:
            a=[]
            for i in range(15):
                t=i/14*math.pi
                a.append((column_x+1.2,y+side*(.24+.35*math.cos(t)),z+.25*math.sin(t)))
            polyline('Farley scroll crest silhouette',a,.055,granite,8)
        for theta in np.linspace(-.7,.7,5):
            beam('Farley palmette crest',(column_x+1.2,y,z+.10),(column_x+1.2,y+.34*math.sin(float(theta)),z+.55*math.cos(float(theta))),.043,granite,8)
    # Text is supported by the actual historical inscription. Its font/cut is interpreted.
    inscription='NEITHER SNOW NOR RAIN NOR HEAT NOR GLOOM OF NIGHT STAYS THESE COURIERS FROM THE SWIFT COMPLETION OF THEIR APPOINTED ROUNDS'
    obj=text('Farley Herodotus frieze inscription',inscription,(column_x+2.018,0,top_order+1.10),.64,LETTER)
    obj.rotation_euler=(math.pi/2,0,math.pi/2)
    # The 1935 extension is present as a visibly quieter documented-volume interpretation.
    ANNEX=collection('14 Farley 1935 rear annex — unmeasured volume')
    annex_depth=104.0
    box('Farley annex main mass',(west_wall-annex_depth/2,0,13.4),(annex_depth,width,26.8),granite)
    for side in [-1,1]:
        for xx in np.arange(west_wall-annex_depth+5,west_wall-2,5):
            box('Farley annex shallow side pier',(float(xx),side*(width/2+.1),13.5),(1.0,.35,24),granite)
            for z in [8.8,13.4,18.0,22.6]:place_kit(upper_window,'Farley annex repeated window',(float(xx)+2.3,side*(width/2+.3),z),math.pi if side==1 else 0)
        cornice_segment('Farley annex side coping',(west_wall-annex_depth/2,side*width/2),annex_depth,axis='X',base=26.8,mat=granite,scale=.65)
    for yy in np.arange(-width/2+5,width/2-2,5):
        for z in [8.8,13.4,18.0,22.6]:place_kit(upper_window,'Farley annex west window',(west_wall-annex_depth-.12,float(yy),z),-math.pi/2)
    STONE=saved_stone
    return {'name':'General Post Office / Farley','eastStairFootX':stair_foot,'eastColumnLineX':column_x,'workingWidth':width,'workingDepthOriginal':depth,'stairRise':rise,'stairTreads':31,'columns':20,'columnHeight':53*FT,'annexDepthInterpreted':annex_depth,'status':'20-column/53ft/31-step/22ft-rise anchors documented; envelope and world registration provisional'}


def hotel_pennsylvania():
    """1919 comb-plan hotel, preserving the source's actual south-open courts."""
    # Lot and setback: period Record & Guide / Architectural Forum.
    lot_x0=SEVENTH_HOUSE_X+AVENUE
    wall_x0=lot_x0+15*FT
    lot_x1=lot_x0+400*FT
    south=30*FT
    north=south+200*FT
    base_h=62*FT             # A visual reconstruction of the four-storey base.
    bedroom_floors=17
    floor_h=3.4              # Interpreted; the present sources do not certify floor heights.
    upper_top=base_h+bedroom_floors*floor_h
    wing=54*FT
    court=40*FT
    upper_length=4*wing+3*court
    outer_east=wall_x0+upper_length
    ionic=ionic_kit('20 Hotel original Ionic portico order master',13.6)
    standard_window=window_kit('21 Hotel timber sash master',1.22,1.77,False,STONE)
    tall_base_window=window_kit('22 Hotel tall lower sash master',1.8,6.1,False,STONE)
    col=collection('23 Hotel Pennsylvania 1919 primary-plan exterior')
    box('Hotel four continuous public floors',((wall_x0+lot_x1)/2,(south+north)/2,base_h/2),(lot_x1-wall_x0,north-south,base_h),STONE)
    # The published guest-floor plan shows four 54 ft fingers and three 40 ft courts.
    # The upper comb occupies 336 ft. The primary article also describes an east
    # 50 ft service court; 336 +15 ft front setback +50 =401 ft versus rounded400.
    # We retain a49 ft east ground allowance and declare the1 ft closure residual.
    rectangles=[]
    for i in range(4):
        x0=wall_x0+i*(wing+court)
        rectangles.append((x0,x0+wing,south,north if i in [0,3] else 49.0))
    rectangles.extend([
        (wall_x0,outer_east,41.6,49.0),
        (wall_x0+24.5,wall_x0+77.6,56.0,65.45),
        (wall_x0+16.4592,wall_x0+39.9,49.0,56.0),
        (wall_x0+73.7616,wall_x0+85.9536,49.0,56.0),
    ])
    extruded_union('Hotel guest-floor comb — traced plan proportion',rectangles,base_h,upper_top,BRICK)
    extruded_union('Hotel continuous low copper roof',rectangles,upper_top,upper_top+.30,COPPER)
    # Principal elevations and the deep south-facing courtyard walls.
    face_rows=[
        ('west',wall_x0,south,north,-math.pi/2,21),
        ('east',outer_east,south,north,math.pi/2,21),
    ]
    for i in range(3):
        left=wall_x0+i*(wing+court)+wing
        right=left+court
        face_rows.extend([('east',left,south,41.6,math.pi/2,12),('west',right,south,41.6,-math.pi/2,12)])
    for floor in range(bedroom_floors):
        z=base_h+floor_h*(floor+.50)
        for name,x,y0,y1,angle,count in face_rows:
            for y in np.linspace(y0+1.65,y1-1.65,count):place_kit(standard_window,'Hotel recessed timber sash',(x+(-.04 if name=='west' else .04),float(y),z),angle)
        for i in range(4):
            x0=wall_x0+i*(wing+court)
            for x in np.linspace(x0+1.55,x0+wing-1.55,5):
                place_kit(standard_window,'Hotel south wing sash',(float(x),south-.04,z),0)
                if i in [0,3]:place_kit(standard_window,'Hotel north wing sash',(float(x),north+.04,z),math.pi)
        for x in np.linspace(wall_x0+26.0,wall_x0+76.1,18):place_kit(standard_window,'Hotel north central sash',(float(x),65.49,z),math.pi)
        for x in np.linspace(wall_x0+45.5,wall_x0+72.4,10):place_kit(standard_window,'Hotel inner north court sash',(float(x),55.96,z),0)
        for i in range(3):
            x0=wall_x0+wing+i*(wing+court)
            for x in np.linspace(x0+1.4,x0+court-1.4,4):place_kit(standard_window,'Hotel south court head sash',(float(x),41.56,z),0)
    # The fifth-floor sill and high four-storey attic order are legible in the photograph.
    for face,x,y0,y1,angle,count in face_rows:
        cornice_segment('Hotel sill band',(x,(y0+y1)/2),y1-y0,base=base_h-.35,mat=STONE,scale=.55)
        cornice_segment('Hotel top copper cornice',(x,(y0+y1)/2),y1-y0,base=upper_top-.10,mat=COPPER,scale=.85)
        box('Hotel upper attic belt course',(x,(y0+y1)/2,upper_top-4*floor_h),(.28,y1-y0,.30),STONE)
        for y in np.linspace(y0+1.65,y1-1.65,count):
            box('Hotel attic shallow stone pilaster',(x,float(y)-1.04,upper_top-2*floor_h),(.30,.32,4*floor_h),STONE)
            box('Hotel attic cornice bracket',(x-.20 if face=='west' else x+.20,float(y),upper_top-.32),(.65,.28,.56),STONE)
    for i in range(4):
        x0=wall_x0+i*(wing+court)
        cornice_segment('Hotel south wing copper cornice',((x0+x0+wing)/2,south),wing,axis='X',base=upper_top-.1,mat=COPPER,scale=.85)
        for x in np.linspace(x0+.7,x0+wing-.7,6):
            box('Hotel south attic stone pilaster',(float(x),south-.12,upper_top-2*floor_h),(.32,.30,4*floor_h),STONE)
            box('Hotel south attic bracket',(float(x),south-.3,upper_top-.32),(.27,.65,.56),STONE)
    # Original limestone base: Ionic pilasters and tall unaltered apertures.
    mid=(south+north)/2
    for y in np.linspace(south+2.2,north-2.2,17):
        yy=float(y)
        if abs(yy-mid)<12.5:continue
        place_kit(tall_base_window,'Hotel original tall west base window',(wall_x0-.03,yy,6.8),-math.pi/2)
        box('Hotel base Ionic pilaster',(wall_x0-.18,yy+1.48,7.4),(.42,.65,14.8),STONE)
        box('Hotel base Ionic pilaster cap',(wall_x0-.29,yy+1.48,14.9),(.6,1.0,.65),STONE)
    for side in [-1,1]:
        y=south if side==-1 else north
        for x in np.arange(wall_x0+2.5,lot_x1-1,3.5):
            place_kit(tall_base_window,'Hotel original long base window',(float(x),y+side*.03,6.8),0 if side==-1 else math.pi)
            box('Hotel base long Ionic pilaster',(float(x)+1.48,y+side*.15,7.4),(.65,.40,14.8),STONE)
            box('Hotel base pilaster capital',(float(x)+1.48,y+side*.25,14.9),(1.0,.57,.65),STONE)
        cornice_segment('Hotel base long entablature',((wall_x0+lot_x1)/2,y),lot_x1-wall_x0,axis='X',base=15.1,mat=STONE,scale=.9)
        for z in np.arange(1.0,base_h,.9):box('Hotel base limestone horizontal joint',((wall_x0+lot_x1)/2,y+side*.014,float(z)),(lot_x1-wall_x0,.014,.017),DARK_STONE)
    cornice_segment('Hotel base Seventh Avenue entablature',(wall_x0,mid),north-south,base=15.1,mat=STONE,scale=.9)
    # Six full Ionic columns are retained; the much later column-cutting alteration is absent.
    column_x=wall_x0-3.7
    for y in np.linspace(mid-10,mid+10,6):place_kit(ionic,'Hotel original six-column Ionic portico',(column_x,float(y),.25),-math.pi/2)
    box('Hotel portico architrave',(column_x+1.5,mid,14.50),(5.2,24.5,.70),STONE)
    cornice_segment('Hotel portico projecting cornice',(column_x+1.4,mid),25.0,base=14.9,mat=STONE,scale=1.1)
    for y in np.linspace(mid-8,mid+8,5):
        box('Hotel original entrance door',(wall_x0-.12,float(y),2.2),(.10,2.4,4.3),WINDOW)
        beam('Hotel bronze entry stile',(wall_x0-.20,float(y),.15),(wall_x0-.20,float(y),4.0),.038,IRON)
    # Slender original-style entrance canopy, visible in the contemporary photo.
    box('Hotel period entrance canopy',(wall_x0-3.55,mid,4.45),(7.4,18.4,.16),IRON)
    for yy in [mid-8,mid+8]:
        for x in [wall_x0-6.9,wall_x0-3.4]:beam('Hotel canopy upright',(x,yy,0),(x,yy,4.4),.075,IRON)
    # Original record mentions three penthouse levels; their exact silhouettes are unresolved.
    for i in range(3):
        box('Hotel reconstructed original service penthouse',(wall_x0+52.0,59.3,upper_top+1.6+i*3.0),(43-i*7,13-i*2,3.2),BRICK)
    return {'name':'Hotel Pennsylvania','lotFeet':[400,200],'westHouseLineX':lot_x0,'westWallX':wall_x0,'southHouseLineZ':-south,'northWorkingZ':-north,'upperWingWidth':wing,'southOpenCourtWidth':court,'bedroomFloors':bedroom_floors,'baseHeightInterpreted':base_h,'floorHeightInterpreted':floor_h,'upperRoofInterpreted':upper_top,'periodEastCourtFeet':50,'implementedEastCourtFeet':49,'dimensionalClosureResidualFeet':1,'reconciliation':'336ft upper comb +15ft front setback +50ft documented eastern service-court allowance =401ft, versus rounded400ft lot;49ft rear allowance is used, not a stretched upper plan.','status':'1919 lot/setback/materials/six Ionic columns/four54ftwings/three40ftcourts documented; heights, bay spacing and registration interpreted'}


def render_architecture_review():
    scene=bpy.context.scene
    camera=scene.camera
    camera.data.lens=42
    scene.cycles.samples=40
    scene.render.resolution_x=1200;scene.render.resolution_y=900
    for name,position,target in [
        ('hotel-exterior-review',(83,-105,63),(211,36,38)),
        ('farley-exterior-review',(-63,-126,63),(-216,0,14)),
    ]:
        camera.location=position
        camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(OUT/(name+'.png'))
        bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    ledger={'phase':'Historical urban context extension, not a surveyed 1935 streetscape','units':'metres','axes':'glTF X east, Y up, Z south','buildingDatum':'Station nominal facades are not street property lines','streetWidthsWorking':{'avenue':AVENUE,'crossStreet':CROSS_STREET},'sourceStationSetbacksFeet':{'seventh':19,'eighth':7,'north':13,'south':13},'genericVehicles':{'types':['rounded closed sedan','taxi-type saloon'],'count':len(vehicle_placements),'status':'Original modelled period interpretations; no authenticated make, livery or positions'},'streetFurniture':'Generic cast-iron swan-neck products; exact site inventory and placements unverified','buildings':[]}
    if not args.vehicles_only:
        ledger['buildings'].append(farley_post_office())
        ledger['buildings'].append(hotel_pennsylvania())
    (OUT/'context-manifest.json').write_text(json.dumps(ledger,indent=2)+'\n')
    export_context()
    if args.render:
        render_vehicle_review()
        if not args.vehicles_only:render_architecture_review()
