"""Pennsylvania Station: evidence-led architectural reconstruction, revision 3.

Run with Blender 4.3's official bpy distribution (see README).
The browser never creates the architectural geometry. Units are metres.
Blender axes: X east, Y north, Z up. glTF export maps Y north to -Z.
"""
from pathlib import Path
import argparse, json, math, random, sys
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from coffer_geometry import tessellate_profile
from surface_finish_normals import clamp_backfacing_corner_normals

ROOT = Path(__file__).resolve().parent.parent
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument("--out",type=Path,help="Write all raw assets and editable source to a separate review directory")
parser.add_argument("--hall-only",action="store_true")
parser.add_argument("--only",choices=['exterior','waiting','concourse','platform','core'],help="Re-export one review asset or the three architectural core chunks")
parser.add_argument("--no-context",action="store_true",help="Omit superseded unverified surrounding-building massing")
parser.add_argument("--preserve-platform",action="store_true",help="Preserve an existing representative platform GLB during a concourse-only correction")
parser.add_argument("--legacy-platform",action="store_true",help="Include the superseded Phase2 representative bay instead of the separately authored railway")
ARGS=parser.parse_args()
ASSETS = ARGS.out.resolve() if ARGS.out else ROOT / "assets"
ASSETS.mkdir(exist_ok=True,parents=True)
MODEL_DIR=ASSETS if ARGS.out else ROOT.parent/"authoring"/ROOT.name
MODEL_DIR.mkdir(parents=True,exist_ok=True)
FT = .3048
L, W = 784 * FT, 430 * FT
HALL_W, HALL_L, HALL_H = 103 * FT, 277 * FT, 143 * FT
REPORTED_ROOM_HEIGHT=150*FT
HALL_ROOM_W=(108+8/12)*FT
HALL_ROOM_L=(314+4/12)*FT
HALL_SHELL_W=119*FT
HALL_SHELL_L=325*FT
STREET_DROP=14*FT
WING_PARAPET=65*FT
WING_ROOF=63*FT
END_STAIR_TOP=HALL_L/2
END_STAIR_FOOT=END_STAIR_TOP-35*FT
END_STAIR_WIDTH=18*FT
COURT_X0=43.0
COURT_LENGTH=(152+8.5/12)*FT
COURT_X1=COURT_X0+COURT_LENGTH
COURT_INNER=8.8
COURT_WIDTH=(115+6/12)*FT
COURT_OUTER=COURT_INNER+COURT_WIDTH
INTERIOR_PEDESTAL=(9+4/12)*FT
INTERIOR_BASE=(3+3/12)*FT
INTERIOR_SHAFT=48*FT
INTERIOR_CAPITAL=(8+3/12)*FT
INTERIOR_ORDER_TOP=INTERIOR_PEDESTAL+INTERIOR_BASE+INTERIOR_SHAFT+INTERIOR_CAPITAL
INTERIOR_ENTABLATURE=(13+5/12)*FT
LOWER_ARCH_RADIUS=(19+3/12)*FT
RNG = random.Random(1935)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
for collection in list(bpy.data.collections):
    if collection.name != "Collection": bpy.data.collections.remove(collection)
COL = None
CONTACTS=[]

def contact(name,part,support,where="bottom",points=None,source="Primary architectural order/support relationship"):
    """Audit actual member vertices against the supporting mesh before batching."""
    CONTACTS.append(dict(name=name,part=part,support=support,where=where,points=points,source=source))

def contact_audit():
    bpy.context.view_layer.update()
    cache={};records=[]
    def support_geometry(obj):
        if obj.name not in cache:
            vertices=[obj.matrix_world@v.co for v in obj.data.vertices]
            cache[obj.name]=BVHTree.FromPolygons(vertices,[tuple(p.vertices) for p in obj.data.polygons],epsilon=.0005)
        return cache[obj.name]
    for rec in CONTACTS:
        targets=rec['support']() if callable(rec['support']) else rec['support']
        if not isinstance(targets,(list,tuple,set)):targets=[targets]
        targets=[obj for obj in targets if obj and obj.type=='MESH']
        part=rec['part']
        if rec['points'] is not None:
            points=[Vector(p) for p in rec['points']]
        else:
            vertices=[part.matrix_world@v.co for v in part.data.vertices]
            z=(max if rec['where']=='top' else min)(v.z for v in vertices)
            points=[v for v in vertices if abs(v.z-z)<.0005]
            for face in part.data.polygons:
                corners=[vertices[i] for i in face.vertices]
                if all(abs(v.z-z)<.0005 for v in corners):points.append(sum(corners,Vector())/len(corners))
        distances=[]
        for point in points:
            nearest=[]
            for obj in targets:
                hit,normal,index,distance=support_geometry(obj).find_nearest(point)
                if hit is None:continue
                # Inside an actual convex supporting solid is also contact.
                if (obj.get('convex_support') or obj.get('closed_support')) and normal.dot(point-hit)<=0:distance=0
                nearest.append(distance)
            distances.append(min(nearest) if nearest else 999)
        best=min(distances) if distances else 999
        records.append({'name':rec['name'],'minimumGap':best,'maximumSampleGap':max(distances) if distances else 999,'samples':len(points),'touches':best<=.025,'source':rec['source']})
    report={'revision':3,'units':'metres','method':'Member vertices/endpoints against actual supporting meshes before batching; signed containment uses outward normals of closed support solids.','contacts':records,'failures':[r for r in records if not r['touches']]}
    (ASSETS/'architecture-contact-audit.json').write_text(json.dumps(report,indent=2))
    print('CONTACT AUDIT',len(records),'checks',len(report['failures']),'failures',flush=True)
    return report

def collection(name):
    global COL
    COL = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(COL)
    return COL

def move(obj):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    COL.objects.link(obj)
    return obj

def mat(name, color, roughness=.75, metallic=0):
    material = bpy.data.materials.new(name)
    material.diffuse_color = (*color, 1)
    material.use_nodes = True
    p = material.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*color, 1)
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Metallic"].default_value = metallic
    return material

def stone(name, rgb, seed, strength=.05):
    """Original, deterministic 1024² albedo/normal/roughness PBR maps."""
    material = mat(name, rgb)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    p = nodes.get("Principled BSDF")
    size = 1024
    gen = np.random.default_rng(seed)
    noise = gen.normal(0, .012, (size, size)).astype(np.float32)
    yy, xx = np.mgrid[0:size, 0:size]
    vein = np.sin(xx * .016 + np.sin(yy * .011) * 3) * .001
    grain = noise + vein
    images = []
    for suffix in ["albedo", "normal", "roughness"]:
        image = bpy.data.images.new(name + "_" + suffix, width=size, height=size)
        rgba = np.ones((size, size, 4), dtype=np.float32)
        if suffix == "albedo":
            for k in range(3): rgba[:, :, k] = np.clip(rgb[k] + grain, 0, 1)
        elif suffix == "normal":
            dx, dy = np.gradient(grain)
            rgba[:, :, 0] = .5 + dx * .9
            rgba[:, :, 1] = .5 + dy * .9
            rgba[:, :, 2] = .998
            image.colorspace_settings.name = "Non-Color"
        else:
            for k in range(3): rgba[:, :, k] = np.clip(.69 + grain * 2, .4, .9)
            image.colorspace_settings.name = "Non-Color"
        image.pixels.foreach_set(rgba.ravel())
        image.filepath_raw = str(ASSETS / f"textures-{name.lower()}-{suffix}.png")
        image.file_format = "PNG"
        image.save()
        image.pack()
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = image
        if suffix == "albedo": links.new(tex.outputs["Color"], p.inputs["Base Color"])
        elif suffix == "roughness": links.new(tex.outputs["Color"], p.inputs["Roughness"])
        else:
            normal = nodes.new("ShaderNodeNormalMap")
            normal.inputs["Strength"].default_value = strength
            links.new(tex.outputs["Color"], normal.inputs["Color"])
            links.new(normal.outputs["Normal"], p.inputs["Normal"])
        images.append(image)
    return material

GRANITE = stone("MilfordGranite", (.60, .49, .43), 10)
INTERIOR_GRANITE=GRANITE.copy()
INTERIOR_GRANITE.name="InteriorGranite"
INTERIOR_GRANITE["source_identity"]="Granite colossal columns from PRR description; exact mineral colour remains uncalibrated"
LIMESTONE = stone("Travertine", (.62, .60, .55), 11)
FLOOR = stone("PublicFloorMarble", (.49, .46, .40), 12)
BOTTICINO=FLOOR.copy();BOTTICINO.name="BotticinoMarble"
PALE = mat("PaleVaultPlaster", (.67, .665, .64), .84)
SHADOW = mat("CofferRecess", (.48, .475, .45), .9)
IRON = mat("PaintedStructuralIron", (.105, .12, .12), .55, 0)
MONEL=mat("MonelRoof",(.29,.31,.31),.58,.85)
ROOF_TILE=mat("FlatRoofTile",(.32,.31,.29),.78)
BRONZE = mat("AgedBronze", (.19, .14, .085), .47, .65)
OPAL_GLASS=mat('OpalCandelabraGlass',(.78,.77,.72),.24,0)
OPAL_GLASS['optical_interpretation']='Milky opal lamp globes identified photographically; exact IOR, transmission, finish and practical-light output are not measured historic samples'
GLASS = mat("HistoricGlass", (.84, .89, .89), .14, 0)
gp = GLASS.node_tree.nodes.get("Principled BSDF")
gp.inputs["Transmission Weight"].default_value=.86
gp.inputs["IOR"].default_value=1.5
LIGHT_GLASS = mat("LunetteGlazing", (.82, .88, .89), .12, 0)
gp = LIGHT_GLASS.node_tree.nodes.get("Principled BSDF")
gp.inputs["Transmission Weight"].default_value=.85
gp.inputs["IOR"].default_value=1.5
gp.inputs["Emission Strength"].default_value=0
WOOD = mat("WalnutBench", (.14, .075, .038), .55)
ASPHALT = mat("StreetPaving", (.16, .17, .17), .93)
PAVING = mat("SidewalkStone", (.40, .40, .37), .9)
BRICK = [mat("ContextBrick" + str(i), rgb) for i, rgb in enumerate([(.23,.14,.11),(.34,.26,.20),(.40,.32,.24),(.27,.26,.23)])]
WINDOW = mat("ContextWindow", (.09,.125,.135), .3, .15)
BLACK = mat("Lettering", (.055,.06,.055), .7)
WHITE = mat("ClockFace", (.82,.79,.68), .65)
ASHLAR=[mat("TravertineAshlar"+str(i),(.62+i*.003,.60+i*.003,.55+i*.003),.73) for i in range(-2,3)]
MURAL_ID=0
MURAL_WIDTH,MURAL_HEIGHT=70*FT,25*FT

def box(name, center, scale, material, bevel=0):
    x,y,z=center
    a,b,c=[s/2 for s in scale]
    if not bevel and material in {GRANITE,LIMESTONE,FLOOR} and min(scale)>.16:
        bevel=min(.025,min(scale)*.10)
    if bevel:
        r=min(bevel,min(a,b,c)*.35)
        corners=[(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
        verts=[]
        for sx,sy,sz in corners:
            verts.extend([(x+sx*a,y+sy*(b-r),z+sz*(c-r)),(x+sx*(a-r),y+sy*b,z+sz*(c-r)),(x+sx*(a-r),y+sy*(b-r),z+sz*c)])
        faces=[]
        for axis,inds in [(0,[0,4,7,3]),(0,[1,2,6,5]),(1,[0,1,5,4]),(1,[3,7,6,2]),(2,[0,3,2,1]),(2,[4,5,6,7])]:
            faces.append(tuple(i*3+axis for i in inds))
        for i,s1 in enumerate(corners):
            for j,s2 in enumerate(corners):
                different=[k for k in range(3) if s1[k]!=s2[k]]
                if j<=i or len(different)!=1:continue
                axes=[k for k in range(3) if k!=different[0]]
                faces.append((i*3+axes[0],j*3+axes[0],j*3+axes[1],i*3+axes[1]))
        faces.extend((i*3,i*3+1,i*3+2) for i in range(8))
        for i,f in enumerate(faces):
            normal=(Vector(verts[f[1]])-Vector(verts[f[0]])).cross(Vector(verts[f[2]])-Vector(verts[f[0]]))
            outward=sum((Vector(verts[k])-Vector(center) for k in f),Vector())
            if normal.dot(outward)<0:faces[i]=tuple(reversed(f))
        obj=mesh(name,verts,faces,material);obj['convex_support']=True
        return obj
    verts=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    obj=mesh(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],material)
    obj['convex_support']=True
    return obj

def mesh(name, verts, faces, material):
    data = bpy.data.meshes.new(name)
    data.from_pydata(verts, [], faces)
    data.update()
    uv=data.uv_layers.new(name="ArchitecturalUV")
    for poly in data.polygons:
        axis=max(range(3),key=lambda k:abs(poly.normal[k]))
        axes=[k for k in range(3) if k!=axis]
        for loop_index in poly.loop_indices:
            v=data.vertices[data.loops[loop_index].vertex_index].co
            uv.data[loop_index].uv=(v[axes[0]]*.28,v[axes[1]]*.28)
    o = bpy.data.objects.new(name, data)
    COL.objects.link(o)
    if material: data.materials.append(material)
    return o

def beam(name, a, b, radius, material, vertices=8):
    a,b = Vector(a),Vector(b)
    d=b-a
    q=d.to_track_quat("Z","Y")
    verts=[]
    for z in [-d.length/2,d.length/2]:
        for i in range(vertices):
            angle=2*math.pi*i/vertices
            v=q@Vector((radius*math.cos(angle),radius*math.sin(angle),z))+(a+b)*.5
            verts.append(tuple(v))
    faces=[tuple(range(vertices-1,-1,-1)),tuple(range(vertices,vertices*2))]
    for i in range(vertices):
        j=(i+1)%vertices
        faces.append((i,j,j+vertices,i+vertices))
    o=mesh(name,verts,faces,material)
    for p in o.data.polygons: p.use_smooth=True
    return o

def section_beam(name,a,b,profile,material=IRON):
    a,b=Vector(a),Vector(b)
    direction=b-a
    q=direction.to_track_quat('Z','Y')
    verts=[tuple(q@Vector((x,y,z))+a) for z in [0,direction.length] for x,y in profile]
    n=len(profile)
    faces=[tuple(range(n-1,-1,-1)),tuple(range(n,n*2))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    return mesh(name,verts,faces,material)

def steel_i(name,a,b,width=.22,depth=.42,flange=.035,web=.024):
    w,d=width/2,depth/2
    p=[(-w,-d),(w,-d),(w,-d+flange),(web/2,-d+flange),(web/2,d-flange),(w,d-flange),(w,d),(-w,d),(-w,d-flange),(-web/2,d-flange),(-web/2,-d+flange),(-w,-d+flange)]
    return section_beam(name,a,b,p)

def flatbar(name,a,b,width=.07,thick=.018,material=IRON):
    return section_beam(name,a,b,[(-width/2,-thick/2),(width/2,-thick/2),(width/2,thick/2),(-width/2,thick/2)],material)

def tube_path(name,points,radius,material,segments=8,closed=False):
    verts=[];faces=[]
    for i,p in enumerate(points):
        tangent=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
        q=tangent.to_track_quat('Z','Y')
        for k in range(segments):
            a=k*math.tau/segments
            verts.append(tuple(Vector(p)+q@Vector((radius*math.cos(a),radius*math.sin(a),0))))
    for i in range(len(points)-1):
        for k in range(segments):
            j=(k+1)%segments
            faces.append((i*segments+k,i*segments+j,(i+1)*segments+j,(i+1)*segments+k))
    if closed:
        faces.extend([tuple(range(segments-1,-1,-1)),tuple((len(points)-1)*segments+k for k in range(segments))])
    obj=mesh(name,verts,faces,material)
    if closed:obj['closed_support']=True
    for p in obj.data.polygons:p.use_smooth=True
    return obj

def ionic_order(name,at,axis='Y'):
    """Plate310's30ft base-to-capital order; scroll geometry from plate308."""
    x,y,z=at
    total=30*FT
    pedestal=box(name+' supporting pedestal',(x,y,z-1.5*FT),(1.30,1.30,3*FT),LIMESTONE,.025)
    contact(name+' pedestal to floor or landing',pedestal,lambda:[HALL_FLOOR,*END_LANDING_SLABS])
    shaft=lathe(name+" moulded base and shaft",[(0,.56),(.10,.59),(.19,.53),(.30,.57),(.43,.48),(.58,.46),(1.4,.455),(4.0,.43),(7.7,.39),(8.15,.38),(8.27,.45)],LIMESTONE,72,24)
    shaft.location=at
    contact(name+' shaft to pedestal',shaft,pedestal)
    echinus=box(name+" echinus",(x,y,z+8.38),(1.16,1.0,.22),LIMESTONE,.035)
    bolster=box(name+" continuous capital bolster",(x,y,z+8.69),(1.02,.84,.46),LIMESTONE,.035)
    neck=box(name+" abacus bedding",(x,y,z+8.94),(1.20,.96,.08),LIMESTONE,.018)
    abacus=box(name+" abacus",(x,y,z+total-.10),(1.54,1.14,.20),LIMESTONE,.025)
    contact(name+' shaft to echinus',shaft,echinus,'top')
    contact(name+' capital bolster to echinus',bolster,echinus)
    contact(name+' bedding to bolster',neck,bolster)
    contact(name+' abacus to bedding',abacus,neck)
    for sign in [-1,1]:
        for face in [-1,1]:
            points=[]
            for i in range(65):
                t=i/64
                angle=math.pi/2+math.tau*1.25*t
                r=.26*(1-.82*t)
                u=sign*.46+r*math.cos(angle)
                zz=z+8.68+r*math.sin(angle)
                points.append((x+u,y+face*.43,zz) if axis=='Y' else (x+face*.43,y+u,zz))
            tube_path(name+" carved Ionic volute",points,.045,LIMESTONE,10)
    return abacus

def carved_abacus(name,center):
    """Concave Corinthian abacus with a small bevel, as visible in plate308."""
    verts=[];faces=[]
    outline=[]
    for side in range(4):
        # Sample the same concave outline more finely; exclude duplicated
        # corner endpoints that formerly generated zero-area side faces.
        for k in range(24):
            t=k/24
            along=-1.5+3*t
            depth=1.5-.18*math.sin(math.pi*t)
            p=(along,-depth) if side==0 else (depth,along) if side==1 else (-along,depth) if side==2 else (-depth,-along)
            outline.append(p)
    for z,shrink in [(-.14,.97),(-.10,1),(.10,1),(.14,.97)]:
        verts.extend((center[0]+x*shrink,center[1]+y*shrink,center[2]+z) for x,y in outline)
    n=len(outline)
    for ring in range(3):
        for i in range(n):
            j=(i+1)%n
            faces.append((ring*n+i,ring*n+j,(ring+1)*n+j,(ring+1)*n+i))
    faces.extend([tuple(range(n-1,-1,-1)),tuple(3*n+i for i in range(n))])
    return mesh(name,verts,faces,LIMESTONE)

def moulded_square(name,center,profile,material=LIMESTONE):
    """Continuous stone profile: every course shares its actual bearing rim."""
    verts=[];faces=[]
    for z,width in profile:
        half=width/2;r=.025
        outline=[(-half+r,-half),(half-r,-half),(half,-half+r),(half,half-r),(half-r,half),(-half+r,half),(-half,half-r),(-half,-half+r)]
        verts.extend((center[0]+x,center[1]+y,center[2]+z) for x,y in outline)
    for j in range(len(profile)-1):
        faces.extend((j*8+k,j*8+(k+1)%8,(j+1)*8+(k+1)%8,(j+1)*8+k) for k in range(8))
    faces.extend([tuple(range(7,-1,-1)),tuple((len(profile)-1)*8+k for k in range(8))])
    obj=mesh(name,verts,faces,material);obj['closed_support']=True
    return obj

def colossal_impost(x,y):
    low=(4+2.5/12)*FT;mid=(3+11.5/12)*FT;high=(5+3/12)*FT
    profile=[(0,3.10),(.16,3.10),(.22,3.28),(.42,3.28),(.48,3.18),(.90,3.18),(1.05,3.42),(low,3.42),(low+.10,3.35),(low+mid-.10,3.35),(low+mid,3.65),(low+mid+.17,3.65),(low+mid+.30,3.95),(low+mid+.52,3.95),(low+mid+.66,4.18),(low+mid+.85,4.18),(low+mid+1.00,4.65),(low+mid+1.25,4.65),(low+mid+1.36,5.10),(low+mid+high,5.10)]
    obj=moulded_square('Plate310 continuous colossal impost',(x,y,INTERIOR_ORDER_TOP),profile)
    # The section shows modillions/dentils beneath the projecting cornice.
    for face in range(4):
        for u in np.arange(-1.75,1.76,.34):
            px,py=(float(u),1.93) if face==0 else (1.93,float(u)) if face==1 else (float(u),-1.93) if face==2 else (-1.93,float(u))
            d=box('Colossal impost dentil',(x+px,y+py,INTERIOR_ORDER_TOP+low+mid+.43),(.22,.22,.25),LIMESTONE,.02)
            contact('Impost dentil attached',d,obj)
    return obj

def corinthian_scrolls(center):
    for k in range(8):
        angle=k*math.pi/4+math.pi/8
        radial=Vector((math.cos(angle),math.sin(angle),0))
        points=[]
        for i in range(65):
            t=i/64
            a=math.pi/2+math.tau*1.2*t
            r=.36*(1-.80*t)
            p=Vector(center)+radial*(1.03+r*math.cos(a))+Vector((0,0,1.92+r*math.sin(a)))
            points.append(tuple(p))
        tube_path("Corinthian carved volute",points,.055,LIMESTONE,10)

def thermal_window(name,center,axis='X'):
    radius=10.16
    axis_index=0 if axis=='X' else 1
    sign=1 if center[axis_index]>0 else -1
    glass=list(center);glass[axis_index]+=sign*.90
    lunette(name+" transmitting glass",tuple(glass),radius,LIGHT_GLASS,axis=axis,grid=False)
    for offset,width,depth in [(0,.26,1.4),(.30,.18,.30),(.54,.14,.16)]:
        at=list(center);at[axis_index]+=sign*(.35 if offset==0 else -.12)
        arch(name+" stepped stone reveal",tuple(at),radius+offset,depth,LIMESTONE,axis=axis,width=width)
    divisions=[radius*t for t in [-.6,-.2,.2,.6]]
    for u in divisions:
        h=math.sqrt(radius*radius-u*u)
        loc=list(center);loc[axis_index]+=sign*.45
        loc[1-axis_index]+=u;loc[2]+=h/2
        dimensions=(.95,.32,h) if axis=='X' else (.32,.95,h)
        box(name+" primary five-light stone mullion",tuple(loc),dimensions,LIMESTONE,.018)
    for k in range(-14,15):
        u=k*radius/15
        if min(abs(u-d) for d in divisions)<.16:continue
        h=math.sqrt(radius*radius-u*u)
        p=list(glass);p[1-axis_index]+=u
        q=p.copy();q[2]+=h
        flatbar(name+" bronze glazing upright",p,q,.045,.035,BRONZE)
    for k in range(1,8):
        h=k*radius/8;half=math.sqrt(radius*radius-h*h)
        p=list(glass);q=list(glass)
        p[1-axis_index]-=half;q[1-axis_index]+=half;p[2]+=h;q[2]+=h
        flatbar(name+" bronze glazing transom",p,q,.04,.03,BRONZE)

def mural_field(center,axis='X'):
    global MURAL_ID
    MURAL_ID+=1
    x,y,z=center;w,h=MURAL_WIDTH/2,MURAL_HEIGHT/2
    vertices=[(x,y-w,z-h),(x,y+w,z-h),(x,y+w,z+h),(x,y-w,z+h)] if axis=='X' else [(x-w,y,z-h),(x+w,y,z-h),(x+w,y,z+h),(x-w,y,z+h)]
    material=mat("GuerinMuralField"+str(MURAL_ID),(.545,.55,.53),.9)
    north_map=ROOT/'assets/mural-north-archival.png'
    if MURAL_ID==6 and north_map.exists():
        image=bpy.data.images.load(str(north_map),check_existing=True);image.pack()
        texture=material.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image
        material.node_tree.links.new(texture.outputs['Color'],material.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
    obj=mesh("Guérin70x25ft historical mural field",vertices,[(0,1,2,3)],material)
    for i,uv in enumerate([(0,0),(1,0),(1,1),(0,1)]):obj.data.uv_layers.active.data[i].uv=uv
    obj['artwork_status']='North map recovered mechanically from LOC det.4a23713; photographic monochrome, original colour unverified' if MURAL_ID==6 and north_map.exists() else 'Neutral field: no authenticated full reproduction assigned'
    return obj

def lathe(name, profile, material, segments=32, flutes=0):
    verts=[]
    for z,r in profile:
        for k in range(segments):
            angle=2*math.pi*k/segments
            rr=r*(1-.028*(.5+.5*math.cos(angle*flutes))) if flutes else r
            verts.append((rr*math.cos(angle),rr*math.sin(angle),z))
    faces=[]
    for j in range(len(profile)-1):
        for k in range(segments):
            n=(k+1)%segments
            faces.append((j*segments+k,j*segments+n,(j+1)*segments+n,(j+1)*segments+k))
    faces += [tuple(range(segments-1,-1,-1)),tuple((len(profile)-1)*segments+k for k in range(segments))]
    o=mesh(name,verts,faces,material)
    for p in o.data.polygons: p.use_smooth=True
    return o

def copy_obj(o,name,at):
    c=bpy.data.objects.new(name,o.data)
    c.location=at
    COL.objects.link(c)
    return c

def capital_leaf(center, angle, rank):
    """A curved, lobed acanthus interpretation; not a scanned carving."""
    verts=[];faces=[]
    # Preserve the existing interpreted leaf profile/lobe count while sampling
    # its curves sufficiently for close views and their cast shadows.
    rows,cols=40,20
    radial=Vector((math.cos(angle),math.sin(angle),0))
    tangent=Vector((-math.sin(angle),math.cos(angle),0))
    for iy in range(rows+1):
        t=iy/rows
        width=.035+.43*max(0,math.sin(math.pi*t))**.7*(1+.20*math.cos(10*math.pi*t))
        z=.10+rank*.76+1.44*t-.25*t**8
        bell_z=[0,.22,.8,1.8,2.25,INTERIOR_CAPITAL]
        bell_r=[.81,.84,1.04,1.23,1.38,1.38]
        radius=float(np.interp(z,bell_z,bell_r))-.025+.13*math.sin(math.pi*t)+.25*t**5
        for ix in range(cols+1):
            s=-1+2*ix/cols
            ridge=.085*(1-s*s)*math.sin(math.pi*t)+.018*math.cos(s*math.pi*4)*math.sin(math.pi*t)
            p=Vector(center)+radial*(radius+ridge)+tangent*(s*width)+Vector((0,0,z))
            verts.append(tuple(p))
    for iy in range(rows):
        for ix in range(cols):
            k=iy*(cols+1)+ix
            faces.append((k,k+1,k+cols+2,k+cols+1))
    # Return the leaf edges into the bell, so the carving is physically rooted.
    front_count=len(verts)
    # The visible front remains unchanged. A fixed radial extrusion intersects
    # the front where its tip curls down. Return behind the radial/vertical
    # profile normal, clipping its radial component at the curl so the hidden
    # shell never grows beyond the authored radial silhouette. The55mm return
    # is an appearance interpretation, not a documented carving thickness.
    front=list(verts)
    for iy in range(rows+1):
        for ix in range(cols+1):
            lo=max(0,iy-1)*(cols+1)+ix
            hi=min(rows,iy+1)*(cols+1)+ix
            tangent_profile=Vector(front[hi])-Vector(front[lo])
            dr=tangent_profile.dot(radial)
            normal=radial*max(0,tangent_profile.z)+Vector((0,0,-dr))
            normal.normalize()
            verts.append(tuple(Vector(front[iy*(cols+1)+ix])-normal*.055))
    faces.extend(tuple(i+front_count for i in reversed(f)) for f in list(faces))
    for iy in range(rows):
        for ix in [0,cols]:
            a=iy*(cols+1)+ix;b=(iy+1)*(cols+1)+ix
            edge=(a,b,b+front_count,a+front_count)
            faces.append(tuple(reversed(edge)) if ix==cols else edge)
    for iy in [0,rows]:
        for ix in range(cols):
            a=iy*(cols+1)+ix;edge=(a,a+1,a+1+front_count,a+front_count)
            faces.append(tuple(reversed(edge)) if iy==0 else edge)
    leaf=mesh("Rooted carved acanthus leaf",verts,faces,LIMESTONE)
    for p in leaf.data.polygons:p.use_smooth=True
    return leaf

def arch(name, center, radius, depth, material, axis="X", start=0, end=math.pi, width=.35, steps=144, rise=None):
    verts=[]
    for j in range(steps+1):
        a=start+(end-start)*j/steps
        for r,d in [(radius-width/2,-depth/2),(radius+width/2,-depth/2),(radius-width/2,depth/2),(radius+width/2,depth/2)]:
            z=math.sin(a)*r*(rise/radius if rise is not None else 1)
            q=(d,math.cos(a)*r,z) if axis=="X" else (math.cos(a)*r,d,z)
            verts.append(tuple(center[k]+q[k] for k in range(3)))
    faces=[]
    for j in range(steps):
        a=j*4;b=a+4
        faces.extend([(a,b,b+1,a+1),(a+2,a+3,b+3,b+2),(a,a+2,b+2,b),(a+1,b+1,b+3,a+3)])
    # Exchanging the X/Y parameterization reverses handedness. Retain the
    # established axis-X winding, and correct axis-Y shells only.
    if axis=="Y":faces=[tuple(reversed(face)) for face in faces]
    return mesh(name,verts,faces,material)

def lunette(name, center, radius, material, axis="X", grid=True):
    # One physical6mm sheet, with front/back interfaces. A zero-thickness
    # transmissive face can leave Cycles rays inside glass and produce bands.
    verts=[];faces=[];thickness=.006
    for layer in [1,-1]:
        shifted=list(center);shifted[0 if axis=='X' else 1]+=layer*thickness/2
        verts.append(tuple(shifted))
        for i in range(65):
            a=i*math.pi/64
            q=(0,math.cos(a)*radius,math.sin(a)*radius) if axis=="X" else (math.cos(a)*radius,0,math.sin(a)*radius)
            verts.append(tuple(shifted[k]+q[k] for k in range(3)))
    for i in range(64):
        faces.extend([(0,i+1,i+2),(66,66+i+2,66+i+1),(i+1,66+i+1,66+i+2,i+2)])
    faces.append((1,65,131,67))
    if axis=='Y':faces=[tuple(reversed(f)) for f in faces]
    sheet=mesh(name,verts,faces,material);sheet['physical_glazing_thickness']=thickness
    arch(name+" molded archivolt",center,radius,.55,LIMESTONE if material==LIGHT_GLASS else GRANITE,axis,width=.52)
    if grid:
        for p in range(-9,10):
            d=p*radius/10
            h=math.sqrt(radius*radius-d*d)
            a=(center[0],center[1]+d,center[2]) if axis=="X" else (center[0]+d,center[1],center[2])
            beam(name+" bronze mullion",a,(a[0],a[1],a[2]+h),.035,IRON)
        for p in range(1,7):
            z=p*radius/7
            half=math.sqrt(radius*radius-z*z)
            a=(center[0],center[1]-half,center[2]+z) if axis=="X" else (center[0]-half,center[1],center[2]+z)
            b=(center[0],center[1]+half,center[2]+z) if axis=="X" else (center[0]+half,center[1],center[2]+z)
            beam(name+" transom",a,b,.025,IRON)

def text(name,body,at,size,material,rotation=(math.pi/2,0,math.pi/2)):
    curve=bpy.data.curves.new(name,"FONT")
    curve.body=body
    curve.align_x="CENTER"
    curve.size=size
    curve.extrude=.008
    curve.space_character=1.2
    obj=bpy.data.objects.new(name,curve)
    COL.objects.link(obj)
    obj.location=at
    obj.rotation_euler=rotation
    curve.materials.append(material)
    return obj

def geometry_node_row(name, source, points):
    """Persistent node group authors repetitions, then realizes for portable export."""
    m=bpy.data.meshes.new(name+" anchors")
    m.from_pydata(points,[],[])
    row=bpy.data.objects.new(name,m)
    COL.objects.link(row)
    group=bpy.data.node_groups.new(name+" Geometry Nodes","GeometryNodeTree")
    group.interface.new_socket(name="Geometry",in_out="INPUT",socket_type="NodeSocketGeometry")
    group.interface.new_socket(name="Geometry",in_out="OUTPUT",socket_type="NodeSocketGeometry")
    n=group.nodes;l=group.links
    inp=n.new("NodeGroupInput");out=n.new("NodeGroupOutput")
    obj=n.new("GeometryNodeObjectInfo");obj.inputs["Object"].default_value=source
    obj.transform_space="ORIGINAL"
    instances=n.new("GeometryNodeInstanceOnPoints")
    realize=n.new("GeometryNodeRealizeInstances")
    l.new(inp.outputs["Geometry"],instances.inputs["Points"])
    l.new(obj.outputs["Geometry"],instances.inputs["Instance"])
    l.new(instances.outputs["Instances"],realize.inputs["Geometry"])
    l.new(realize.outputs["Geometry"],out.inputs["Geometry"])
    mod=row.modifiers.new(name,"NODES");mod.node_group=group
    return row

def cornice(name,center,length,axis="Y",height=13.2,material=GRANITE):
    # Preserve the overall envelope while removing the former15mm air gap
    # between the third and fourth moulding courses.
    level=height-.20
    previous=None
    for i,(w,h) in enumerate([(1.25,.40),(1.70,.28),(1.90,.18),(2.1,.23),(1.6,.24)]):
        h*=1.20/1.33
        dims=(w,length,h) if axis=="Y" else (length,w,h)
        course=box(name+str(i),(center[0],center[1],level+h/2),dims,material)
        if previous:contact(name+f' course{i} bearing',course,previous)
        previous=course;level+=h

def stone_cheek(name,p0,p1,width=.50,upstand=.78):
    p0,p1=Vector(p0),Vector(p1)
    direction=Vector((p1.x-p0.x,p1.y-p0.y,0)).normalized()
    n=Vector((-direction.y,direction.x,0))*width/2
    vertices=[]
    for p in [p0,p1]:
        vertices.extend([tuple(Vector((p.x,p.y,0))-n),tuple(Vector((p.x,p.y,0))+n),tuple(p-n+Vector((0,0,upstand))),tuple(p+n+Vector((0,0,upstand)))])
    obj=mesh(name,vertices,[(0,4,5,1),(0,2,6,4),(1,5,7,3),(2,3,7,6),(0,1,3,2),(4,6,7,5)],LIMESTONE)
    obj['closed_support']=True
    cap=section_beam(name+' continuous stone coping',p0+Vector((0,0,upstand)),p1+Vector((0,0,upstand)),[(-width*.58,-.075),(width*.58,-.075),(width*.58,.075),(-width*.58,.075)],LIMESTONE)
    contact(name+' coping bedding',cap,obj)
    return obj

def pierced_wall(name,normal_at,u0,u1,z0,z1,thickness,axis,holes,material):
    """Masonry cells stop at openings; reveals have actual depth, not decals."""
    us=sorted({u0,u1,*[max(u0,min(u1,h[k])) for h in holes for k in [0,1]]})
    zs=sorted({z0,z1,*[max(z0,min(z1,h[k])) for h in holes for k in [2,3]]})
    vertices=[];faces=[]
    for a,b in zip(us,us[1:]):
        for c,d in zip(zs,zs[1:]):
            if b-a<.001 or d-c<.001:continue
            u,z=(a+b)/2,(c+d)/2
            if any(h[0]<u<h[1] and h[2]<z<h[3] for h in holes):continue
            offset=len(vertices)
            for su,sn,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]:
                v=u+su*(b-a)/2;n=normal_at+sn*thickness/2;h=z+sz*(d-c)/2
                vertices.append((n,v,h) if axis=='X' else (v,n,h))
            for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]:
                face=face if axis=='Y' else tuple(reversed(face))
                faces.append(tuple(offset+k for k in face))
    return mesh(name,vertices,faces,material)

def recessed_sash(name,center,width,height,axis,sign,material=GRANITE):
    x,y,z=center
    front=Vector(center);normal=Vector((sign,0,0)) if axis=='X' else Vector((0,sign,0))
    pane=front-normal*.24
    dims=(.035,width,height) if axis=='X' else (width,.035,height)
    glazing=box(name+' recessed opaque room backing',tuple(pane),dims,WINDOW)
    for side in [-1,1]:
        p=front.copy();p[1 if axis=='X' else 0]+=side*(width/2+.075)
        dims=(.22,.15,height+.30) if axis=='X' else (.15,.22,height+.30)
        box(name+' deep stone jamb',tuple(p),dims,material,.018)
    for side in [-1,1]:
        p=front+normal*.035;p.z+=side*(height/2+.08)
        dims=(.36,width+.30,.16) if axis=='X' else (width+.30,.36,.16)
        box(name+' projecting sill or lintel',tuple(p),dims,material,.018)
    for fraction in [-.5,0,.5]:
        p=pane+normal*.028;p.z+=fraction*height
        dims=(.06,width,.055) if axis=='X' else (width,.06,.055)
        box(name+' sash cross rail',tuple(p),dims,IRON,.009)
    p=pane+normal*.028
    dims=(.06,.05,height) if axis=='X' else (.05,.06,height)
    box(name+' sash central meeting rail',tuple(p),dims,IRON,.008)
    return glazing

def export(name,col):
    bpy.ops.object.select_all(action="DESELECT")
    for o in col.all_objects:
        if o.type in {"MESH","FONT"} and not o.hide_render: o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(ASSETS/name),export_format="GLB",use_selection=True,
        export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,
        export_materials="EXPORT",export_image_format="AUTO",export_extras=True)

def batch_static(col):
    """Batch static surfaces by material; preserve editable Geometry Nodes rows."""
    global COL
    # Batching reads matrix_world. Single-zone review/export helpers must also
    # flush recently assigned placements and the Main-to-Street translation.
    bpy.context.view_layer.update()
    COL=col
    groups={}
    for o in list(col.objects):
        if o.type!="MESH" or o.hide_render or o.modifiers or o.get('preserve_linked_geometry'): continue
        materials=tuple(o.data.materials)
        groups.setdefault(materials,[]).append(o)
    for materials,objects in groups.items():
        material=materials[0] if materials else None
        verts=[];faces=[];smooth=[];uvs=[];material_indices=[]
        carry_custom=any(o.data.has_custom_normals for o in objects)
        corner_normals=[]
        for o in objects:
            offset=len(verts)
            matrix=o.matrix_world
            verts.extend(tuple(matrix@v.co) for v in o.data.vertices)
            for poly in o.data.polygons:
                faces.append(tuple(offset+i for i in poly.vertices))
                smooth.append(poly.use_smooth)
                material_indices.append(poly.material_index)
                uv_layer=o.data.uv_layers.active
                uvs.extend(tuple(uv_layer.data[i].uv) if uv_layer else (0,0) for i in poly.loop_indices)
                if carry_custom:
                    transform=matrix.to_3x3().inverted().transposed()
                    corner_normals.extend(tuple((transform@o.data.corner_normals[i].vector).normalized()) for i in poly.loop_indices)
        joined=mesh(col.name+" — "+(material.name if material else "default"),verts,faces,material)
        for extra in materials[1:]:joined.data.materials.append(extra)
        for i,p in enumerate(joined.data.polygons):
            p.use_smooth=smooth[i]
            p.material_index=material_indices[i]
        for i,uv in enumerate(uvs): joined.data.uv_layers.active.data[i].uv=uv
        if carry_custom:joined.data.normals_split_custom_set(corner_normals)
        if hasattr(bpy.data,"batch_remove"):
            bpy.data.batch_remove(ids=objects)
        else:
            for o in objects:bpy.data.objects.remove(o,do_unlink=True)
    print("Batched",col.name,"to",len(col.objects),"objects",flush=True)

# ---------- Exterior: plate 300/301/309, nominal published footprint ----------
print("Building exterior architectural meshes",flush=True)
EXTERIOR=collection("01 Exterior and context")
# Foundation rings leave room floors and stair/track voids unobstructed.
foundation_holes=[(-105.15,-40.85,-48.8,48.8),(-19.6,19.6,-49.6,49.6),(-40.85,-19.6,-7.75,7.75),(19.6,L/2,-7.75,7.75)]
for sign in [-1,1]:foundation_holes.append((COURT_X0,COURT_X1,min(sign*COURT_INNER,sign*COURT_OUTER),max(sign*COURT_INNER,sign*COURT_OUTER)))
xs=sorted([-L/2,-105.15,-40.85,-19.6,19.6,COURT_X0,COURT_X1,101.3,L/2])
ys=sorted([-W/2,-48.8,-COURT_OUTER,-COURT_INNER,-7.75,7.75,COURT_INNER,COURT_OUTER,48.8,W/2])
for x0,x1 in zip(xs,xs[1:]):
    for y0,y1 in zip(ys,ys[1:]):
        cx,cy=(x0+x1)/2,(y0+y1)/2
        if any(a<=cx<=b and c<=cy<=d for a,b,c,d in foundation_holes):continue
        box("Station foundation ring",(cx,cy,-.35),(x1-x0,y1-y0,.7),GRANITE,.02)
for sy in [-1,1]:
    if not ARGS.no_context:box("Street field beyond station",(0,sy*(195+W/2)/2,-.62),(530,195-W/2,.3),ASPHALT)
for sx in ([] if ARGS.no_context else [-1,1]):
    box("Avenue field beyond station",(sx*(265+L/2)/2,0,-.62),(265-L/2,W,.3),ASPHALT)
# Sidewalks outline both long and short block edges; no modern road paint.
for sy in ([] if ARGS.no_context else [-1,1]):
    box("31st33rd sidewalk",(0,sy*(W/2+3),-.20),(L+13,6,.4),PAVING)
for sx in ([] if ARGS.no_context else [-1,1]):
    box("Avenue sidewalk",(sx*(L/2+3),0,-.20),(6,W+13,.4),PAVING)

# Street-front shell only: courts and passenger interiors are not filled solids.
for sy in [-1,1]:
    gate=END_STAIR_WIDTH/2+.50
    windows=[]
    for xx in np.linspace(-113,113,52):
        for level in [2.1,4.4,7.3,11.0]:
            if abs(xx)<gate+.65 and level<8:continue
            windows.append((float(xx),level,1.3,1.75))
    holes=[(x-w/2,x+w/2,z-h/2,z+h/2) for x,z,w,h in windows]+[(-gate,gate,0,8.0)]
    pierced_wall('Long street facade with recessed openings',sy*(W/2-1),-L/2,L/2,0,13.8,1.4,'Y',holes,GRANITE)
    cornice('Long street cornice',(0,sy*(W/2-.7)),L,axis='X')
    for x,z,w,h in windows:recessed_sash('Long facade window',(x,sy*(W/2-.30),z),w,h,'Y',sy)

for sx in [-1,1]:
    # Side colonnade bays retain their source-study arrangement. Behind the
    # double-row centre and carriage porticos the rear wall is set farther back.
    for y0,width in [(-34.25,37.5),(34.25,37.5),(-10,9),(10,9)]:
        center=sx*(L/2-(8.3 if abs(y0)==10 else 4.5))
        windows=[]
        for yy in np.linspace(-59,59,29):
            if y0-width/2+.9<=yy<=y0+width/2-.9 and abs(yy)>=5:
                windows.extend([(float(yy),6.8,1.7,5.0),(float(yy),11.3,1.7,1.8)])
        holes=[(y-w/2,y+w/2,z-h/2,z+h/2) for y,z,w,h in windows]
        pierced_wall('Avenue masonry with actual window reveals',center,y0-width/2,y0+width/2,0,13.2,2.1,'X',holes,GRANITE)
        for y,z,w,h in windows:recessed_sash('Avenue recessed window',(center+sx*1.05,y,z),w,h,'X',sx)
    cornice('Avenue entablature',(sx*(L/2-1),0),W)

# Exterior Doric order: 35 ft column including base/capital, 4 ft 6 in dia.
profile=[(0,.80),(.18,.82),(.35,.76),(.45,.686),(2.0,.680),(5.0,.645),(8.8,.586),(9.5,.565),(9.75,.59),(9.85,.72),(10.05,.82),(10.18,.91),(10.34,.91),(10.44,.83),(10.668,.83)]
doric=lathe("Doric column master — 35ft",profile,GRANITE,40)
doric.hide_render=True
doric.location=(0,0,0)
eastpoints=[]
# Elevation plate301: central hexastyle entrance and side colonnades,
# extra rear row belongs only to central portico and carriage gateways.
for yy in [-10.0,-6,-2,2,6,10]:
    eastpoints.extend([(L/2-.86,yy,0),(L/2-4.6,yy,0)])
for sy in [-1,1]:
    for yy in [18,22,26,30,34,38,42,46,50]:
        eastpoints.append((L/2-.86,sy*yy,0))
    for yy in [55,59,63]:
        eastpoints.extend([(L/2-.86,sy*yy,0),(L/2-4.6,sy*yy,.3)])
geometry_node_row("Seventh Avenue Doric colonnade",doric,eastpoints)
sidepoints=[]
for sy in [-1,1]:
    sidepoints.extend([(float(xx),sy*(W/2-.86),0) for xx in np.linspace(-35.05,35.05,17)])
geometry_node_row("230ft side colonnades",doric,sidepoints)
# Eighth Avenue is primarily pilasters, not a copy of Seventh Avenue.
for yy in np.linspace(-62,62,32):
    if abs(yy)<7: continue
    box("Eighth Avenue Doric pilaster",(-L/2+.7,float(yy),5.65),(1.35,1.35,10.7),GRANITE)
    box("Eighth pilaster capital",(-L/2+.5,float(yy),10.65),(1.7,1.7,.52),GRANITE)
for yy in [-6.7,-2.23,2.23,6.7]:
    copy_obj(doric,"Eighth central portico column",(-L/2+.86,yy,0))

# Frieze, dentils and roof balustrade along the Seventh Avenue face.
for yy in np.arange(-65,65,.86):
    box("Doric entablature dentil",(L/2+.11,float(yy),12.45),(.4,.26,.34),GRANITE)
for yy in np.arange(-64,65,1.26):
    # Simplified lathed balusters are explicitly approximate (plate309 profiles).
    b=lathe("Balustrade spindle",[(0,.13),(.08,.16),(.18,.11),(.32,.07),(.54,.14),(.74,.10),(.88,.15)],GRANITE,12)
    b.location=(L/2-1.15,float(yy),14.45)
box("Seventh balustrade top",(L/2-1.15,0,15.39),(.9,W,.22),GRANITE)

# Central entrance and corner pavilions rise above their neighbouring colonnade.
for sy in [-1,1]:
    for yy in [sy*14,sy*53]:
        box("Portico pavilion pier",(L/2-2.6,yy,8.2),(6.0,2.8,16.4),GRANITE)
        cornice("Pavilion cornice",(L/2-2.6,yy),3.5,height=16.35)
for y0 in [-59,59]:
    # Low triangular pediments over double-row carriage entrances.
    verts=[(L/2+.2,y0-6,14.0),(L/2+.2,y0+6,14.0),(L/2+.2,y0,16.3)]
    mesh("Carriage entrance pediment",verts,[(0,1,2)],GRANITE)
text("Pedestrian entrance legend","PENNSYLVANIA STATION",(L/2+.45,0,13.4),.76,BLACK)
# Plate301: the clock attic spans the six-column central portico and its
# flanking piers; the clock itself occupies only the middle of this wide mass.
CLOCK_ATTIC_WIDTH=30.2
box("Flat central clock attic",(L/2-2.6,0,(14.05+75*FT)/2),(5.8,CLOCK_ATTIC_WIDTH,75*FT-14.05),GRANITE)
cornice("Clock attic crowning cornice",(L/2-2.6,0),CLOCK_ATTIC_WIDTH+.5,height=75*FT-1.0)
# The seven-foot dial is centred61ft above the pavement in the PRR description.
clockz=61*FT
beam("Clock bronze bezel",(L/2+.31,0,clockz),(L/2+.56,0,clockz),3.5*FT,BRONZE,128)
beam("Clock stone face",(L/2+.57,0,clockz),(L/2+.60,0,clockz),3.25*FT,WHITE,128)
# Preserve the declared6ft/7ft source conflict rather than changing diameter
# silently. Minute index proportions and fixed hand time remain interpreted.
for k in range(60):
    if k%5==0:continue # Existing twelve hour marks already occupy these positions.
    angle=math.pi/2-k*math.pi/30
    r0=.88 if k%5 else .79
    beam("Exterior clock minute index",(L/2+.635,r0*math.cos(angle),clockz+r0*math.sin(angle)),(L/2+.635,.94*math.cos(angle),clockz+.94*math.sin(angle)),.009 if k%5 else .014,BLACK,8)
for k in range(12):
    angle=math.pi/2-k*math.pi/6
    r0=.78;r1=.90
    beam("Clock hour mark",(L/2+.64,r0*math.cos(angle),clockz+r0*math.sin(angle)),(L/2+.64,r1*math.cos(angle),clockz+r1*math.sin(angle)),.025,BLACK)
beam("Clock minute hand",(L/2+.67,0,clockz),(L/2+.67,.10,clockz+.76),.025,BLACK)
beam("Clock hour hand",(L/2+.69,0,clockz),(L/2+.69,.52,clockz-.26),.034,BLACK)

# Arcade: 225 by45ft. Axis is E–W; flanking carriage drives remain open.
for sy in [-1,1]:
    box("Arcade shop wall",(67,sy*7.2,5.7),(68.58,1,11.4),GRANITE)
    box("Arcade shop lower ceiling",(67,sy*8.0,10.9),(68.58,1.0,1.2),GRANITE)
box("Arcade roof",(67,0,12),(68.58,14.7,1.0),GRANITE)
for xx in np.arange(35,102,5.1):
    for sy in [-1,1]:
        box("Arcade storefront",(float(xx),sy*6.65,3.4),(3.1,.08,5.0),WINDOW)
        box("Arcade pilaster",(float(xx)-2,sy*6.2,4.8),(.55,.6,9.6),GRANITE)
box("Arcade paving",(67,0,-.10),(225*FT,14,.2),FLOOR)
box("Seventh Avenue vestibule paving",((101.29+L/2)/2,0,-.10),(L/2-101.29,14,.2),FLOOR)
for sy in [-1,1]:
    inner=HALL_ROOM_L/2
    box('Street-level pedestrian bridge over carriage drive',(0,sy*(inner+W/2)/2,-.16),(END_STAIR_WIDTH,W/2-inner,.32),FLOOR,.015)
    for sign in [-1,1]:
        steel_i('Pedestrian bridge longitudinal girder',(sign*(END_STAIR_WIDTH/2-.22),sy*inner,-.36),(sign*(END_STAIR_WIDTH/2-.22),sy*W/2,-.36),.20,.68,.032,.022)

# The lower bodies are four-storey buildings around actual open courts, not
# a roofless perimeter screen. Their recessed roofs are distinct from the
# lower Doric entablature/balustrade in front (ASCE188; Bain elevated view).
wing_roofs=[]
def wing_roof(name,x0,x1,y0,y1):
    slab=box(name+' self-glazed tile roof',((x0+x1)/2,(y0+y1)/2,WING_ROOF-.14),(x1-x0,y1-y0,.28),ROOF_TILE,.018)
    wing_roofs.append(slab)
    return slab
for sign in [-1,1]:
    wing_roof('North/south street wing',-L/2,L/2,min(sign*HALL_SHELL_L/2,sign*(W/2-2.0)),max(sign*HALL_SHELL_L/2,sign*(W/2-2.0)))
    terrace=box('North/south colonnade roof terrace',(0,sign*(W/2-1.60),13.90),(L-11.10,3.20,.30),ROOF_TILE,.018)
    # Recessed attic wall is visible behind the lower colonnade and coping.
    attic_holes=[(float(x)-.675,float(x)+.675,16.6-.825,16.6+.825) for x in np.arange(-113,114,4.5)]
    attic= pierced_wall('North/south recessed attic wall',sign*(W/2-2.6),-L/2,L/2,13.8,WING_ROOF,1.2,'Y',attic_holes,GRANITE)
    contact('North/south attic wall on terrace',attic,terrace)
    cornice('North/south attic roof coping',(0,sign*(W/2-2.6)),L,axis='X',height=WING_PARAPET-1.0)
    for xx in np.arange(-113,114,4.5):
        recessed_sash('North/south attic sash',(float(xx),sign*(W/2-2.0),16.6),1.35,1.65,'Y',sign)
    for xa,xb in [(-L/2,-HALL_SHELL_W/2),(HALL_SHELL_W/2,L/2)]:
        box('Inner office-wing wall to roof',((xa+xb)/2,sign*(HALL_SHELL_L/2+.30),WING_ROOF/2),(xb-xa,.60,WING_ROOF),LIMESTONE,.02)
    beam_support=box('Doric side architrave and frieze',(0,sign*(W/2-2.0),(10.668+13.01)/2),(L-11.0,4.0,13.01-10.668),GRANITE,.015)
    for point in [p for p in sidepoints if p[1]*sign>0]:
        basepts=[(point[0]+v.co.x,point[1]+v.co.y,v.co.z) for v in doric.data.vertices if v.co.z<.001]
        cappts=[(point[0]+v.co.x,point[1]+v.co.y,v.co.z) for v in doric.data.vertices if abs(v.co.z-10.668)<.001]
        contact('Side Doric foot '+str(point),None,lambda:[o for o in EXTERIOR.objects if o.type=='MESH' and ('foundation' in o.name.lower() or 'paving' in o.name.lower())],points=basepts)
        contact('Side Doric capital bearing '+str(point),None,beam_support,points=cappts)

for sign in [-1,1]:
    x0,x1=(101.29,L/2-3.45) if sign>0 else (-L/2+3.45,-105.1437)
    wing_roof('Seventh/Eighth Avenue office wing',x0,x1,-HALL_SHELL_L/2,HALL_SHELL_L/2)
    terrace=box('Avenue colonnade roof terrace',(sign*(L/2-2.775),0,13.90),(5.55,W,.30),ROOF_TILE,.018)
    cx=sign*(L/2-4.5)
    attic_holes=[(float(y)-.75,float(y)+.75,16.7-.825,16.7+.825) for y in np.arange(-61,62,4.4)]
    pierced_wall('Avenue recessed attic masonry',cx,-W/2,W/2,13.2,WING_ROOF,2.1,'X',attic_holes,GRANITE)
    cornice('Avenue attic roof coping',(cx,0),W,height=WING_PARAPET-1.0)
    for yy in np.arange(-61,62,4.4):
        recessed_sash('Avenue attic sash',(cx+sign*1.05,float(yy),16.7),1.50,1.65,'X',sign)
    beam_support=box('Avenue Doric architrave and frieze',(sign*(L/2-2.5),0,(10.668+13.01)/2),(6.0,W,13.01-10.668),GRANITE,.015)
    pts=eastpoints if sign>0 else [(-L/2+.86,y,0) for y in [-6.7,-2.23,2.23,6.7]]
    for point in pts:
        basepts=[(point[0]+v.co.x,point[1]+v.co.y,v.co.z) for v in doric.data.vertices if v.co.z<.001]
        cappts=[(point[0]+v.co.x,point[1]+v.co.y,v.co.z) for v in doric.data.vertices if abs(v.co.z-10.668)<.001]
        contact('Avenue Doric foot '+str(point),None,lambda:[o for o in EXTERIOR.objects if o.type=='MESH' and ('foundation' in o.name.lower() or 'paving' in o.name.lower())],points=basepts)
        contact('Avenue Doric capital bearing '+str(point),None,beam_support,points=cappts)

COURT_X0=43.0
COURT_LENGTH=(152+8.5/12)*FT
COURT_X1=COURT_X0+COURT_LENGTH
COURT_INNER=8.8
COURT_WIDTH=(115+6/12)*FT
COURT_OUTER=COURT_INNER+COURT_WIDTH
wing_roof('Dining/lunch and arcade vestibule',HALL_SHELL_W/2,COURT_X0,-HALL_SHELL_L/2,HALL_SHELL_L/2)
wing_roof('Arcade office spine',COURT_X0,COURT_X1,-COURT_INNER,COURT_INNER)
wing_roof('Eastern court vestibule band',COURT_X1,101.29,-HALL_SHELL_L/2,HALL_SHELL_L/2)
wing_roof('Western subsidiary accommodation',-40.8563,-HALL_SHELL_W/2,-HALL_SHELL_L/2,HALL_SHELL_L/2)

def courtyard_sash(name,center,axis):
    x,y,z=center
    dims=(.055,1.35,1.65) if axis=='X' else (1.35,.055,1.65)
    box(name+' dark glazing',center,dims,WINDOW)
    for sign in [-1,1]:
        at=(x,y+sign*.73,z) if axis=='X' else (x+sign*.73,y,z)
        dimensions=(.10,.10,1.85) if axis=='X' else (.10,.10,1.85)
        box(name+' stone jamb',at,dimensions,LIMESTONE,.015)
    for dz in [-.91,.91,0]:
        dims=(.12,1.55,.10) if axis=='X' else (1.55,.12,.10)
        box(name+' sill and sash transom',(x,y,z+dz),dims,LIMESTONE,.012)

for sign in [-1,1]:
    ya,yb=sorted([sign*COURT_INNER,sign*COURT_OUTER])
    wing_roof('Carriage-drive court edge',COURT_X0,COURT_X1,min(sign*COURT_OUTER,sign*HALL_SHELL_L/2),max(sign*COURT_OUTER,sign*HALL_SHELL_L/2))
    for xx,face in [(COURT_X0,1),(COURT_X1,-1)]:
        box('Eastern court east/west enclosing wall',(xx-face*.30,(ya+yb)/2,WING_ROOF/2),(.60,yb-ya,WING_ROOF),LIMESTONE,.02)
        for y in np.arange(ya+2.2,yb-1.0,4.1):
            for z in [2.7,7.1,11.5,15.9]:courtyard_sash('Four-storey court sash',(xx+face*.035,float(y),z),'X')
    for yy,face in [(ya,1),(yb,-1)]:
        box('Eastern court north/south enclosing wall',((COURT_X0+COURT_X1)/2,yy-face*.30,WING_ROOF/2),(COURT_LENGTH,.60,WING_ROOF),LIMESTONE,.02)
        for x in np.arange(COURT_X0+2.2,COURT_X1-1.0,4.1):
            for z in [2.7,7.1,11.5,15.9]:courtyard_sash('Four-storey court sash',(float(x),yy+face*.035,z),'Y')
    # Gibbs240: these are OPEN courts above street-level glazed train sheds.
    # The high office roof ring must not be bridged by an invented high roof.
    mx=(COURT_X0+COURT_X1)/2;my=(ya+yb)/2
    ml=(91+7.5/12)*FT;mw=(20+4/12)*FT
    eave=.15;ridge=1.50;monitor_top=2.25
    outer=[(COURT_X0,ya,eave),(COURT_X1,ya,eave),(COURT_X1,yb,eave),(COURT_X0,yb,eave)]
    inner=[(mx-ml/2,my-mw/2,ridge),(mx+ml/2,my-mw/2,ridge),(mx+ml/2,my+mw/2,ridge),(mx-ml/2,my+mw/2,ridge)]
    mesh('Street-level hipped eastern train-shed glass',outer+inner,[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],GLASS)
    for i in range(4):
        j=(i+1)%4
        steel_i('Eastern shed eave/gutter',outer[i],outer[j],.13,.24,.022,.014)
        steel_i('Eastern shed monitor curb',inner[i],inner[j],.12,.22,.020,.014)
        steel_i('Eastern shed hip',outer[i],inner[i],.13,.25,.022,.014)
        p,q=inner[i],inner[j]
        mesh('Eastern shed monitor vertical glazing',[p,q,(q[0],q[1],monitor_top),(p[0],p[1],monitor_top)],[(0,1,2,3)],GLASS)
    box('Eastern shed monitor Monel cap',(mx,my,monitor_top+.035),(ml+.15,mw+.15,.07),MONEL,.012)
    for xx in np.linspace(COURT_X0,COURT_X1,18):
        # Secondary glazing rafters follow the actual hipped surfaces.
        for side in [-1,1]:
            y0=my+side*COURT_WIDTH/2;y1=my+side*mw/2
            targetx=max(mx-ml/2,min(mx+ml/2,float(xx)))
            steel_i('Eastern train-shed glazing rafter',(float(xx),y0,eave),(targetx,y1,ridge),.065,.13,.016,.010)

# Massive main-room volume: actual windows and interior are separate asset.
hall_exterior_before=set(EXTERIOR.objects)
for sx in [-1,1]:
    # The monumental waiting hall is a masonry volume, not an open pavilion.
    # Its lower shell is mostly concealed by adjacent lower accommodation.
    wall=(HALL_SHELL_W-HALL_ROOM_W)/2
    sidecenter=(HALL_SHELL_W+HALL_ROOM_W)/4
    portal_half=39.5*FT/2
    for sy in [-1,1]:
        # End walls own the corner return. Stop here rather than retaining a
        # second coplanar external face through their full2.06m thickness.
        end_return=48.50-2.06/2
        part=end_return-portal_half
        box("Waiting exterior side shell with axial portal",(sx*sidecenter,sy*(end_return+portal_half)/2,15.5),(wall,part,31.0),GRANITE)
    box("Waiting exterior axial portal header",(sx*sidecenter,0,20.8),(wall,portal_half*2,20.4),GRANITE)
    for yy in [-44.6,-14.07,14.07,44.6]:
        box("Waiting exterior great pier",(sx*((112+10/12)*FT/2),yy,25.7),(1.98,4.9,38.0),GRANITE)
    # Lower shell already supplies this masonry band. A second coincident
    # spandrel face produces black self-intersection ribbons under the glazing.
    cornice("Great hall exterior cornice",(sx*17.6,0),HALL_SHELL_L,height=45.0)
    for yy in [-28.14,0,28.14]:
        arch("Exterior thermal-window stone archivolt",(sx*(HALL_SHELL_W/2+.02),yy,31.0),10.16,.55,GRANITE,width=.52)
    # Upper spandrel wall above windows. Individual strips avoid black box mass.
    for ya in np.arange(-end_return,end_return,1.5):
        yb=min(end_return,float(ya)+1.5);yy=(float(ya)+yb)/2
        nearest=min([-28.14,0,28.14],key=lambda t:abs(t-yy))
        d=abs(float(yy)-nearest)
        lower=31+math.sqrt(max(0,10.16**2-d*d)) if d<10.16 else 31
        if lower<46.0:
            box("Granite thermal-window upper spandrel",(sx*sidecenter,float(yy),(lower+46.0)/2),(wall,yb-float(ya),46.0-lower),GRANITE)
for sy in [-1,1]:
    for xa,xb in [(-HALL_SHELL_W/2,-2.50),(2.50,HALL_SHELL_W/2)]:
        box("Waiting end exterior masonry with bridge portal",((xa+xb)/2,sy*48.50,15.5),(xb-xa,2.06,31),GRANITE)
    header=STREET_DROP+10.25
    box('Waiting end exterior portal header',(0,sy*48.50,(31+header)/2),(5.0,2.06,31-header),GRANITE)
    # The continuous end masonry already contains the window-sill band.
    for xx in [-15,15]: box("Waiting end exterior pier",(xx,sy*47.1,22),(6,2.8,43),GRANITE)
    arch("Waiting end exterior stone archivolt",(0,sy*(HALL_SHELL_L/2+.02),31),10.16,.55,GRANITE,axis="Y",width=.52)
    cornice("Waiting end cornice",(0,sy*48.50),HALL_SHELL_W+1.1,axis="X",height=45.0)
    for xa in np.arange(-HALL_SHELL_W/2,HALL_SHELL_W/2,1.5):
        xb=min(HALL_SHELL_W/2,float(xa)+1.5);xx=(float(xa)+xb)/2
        lower=31+math.sqrt(max(0,10.16**2-float(xx)**2)) if abs(xx)<10.16 else 31
        if lower<46.0:
            box("Waiting end upper masonry spandrel",(float(xx),sy*48.50,(lower+46.0)/2),(xb-float(xa),2.06,46.0-lower),GRANITE)
# Monel pitched roof; three transverse ridges follow the triple vaulted volume.
for j in [-1,0,1]:
    y=j*HALL_L/3
    lo=-HALL_SHELL_L/2 if j==-1 else -HALL_L/6 if j==0 else HALL_L/6
    hi=HALL_SHELL_L/2 if j==1 else HALL_L/6 if j==0 else -HALL_L/6
    # Three transverse gables, visible as three peaks from Seventh Avenue.
    roofbase=46.0
    half=HALL_SHELL_W/2+.8
    # Shared bay boundaries meet exactly. Rounded28.14/14.1 values formerly
    # overlapped the valley strips by60mm and produced double roof surfaces.
    verts=[(-half,lo,roofbase),(-half,hi,roofbase),(-half,y,167*FT),(half,lo,roofbase),(half,hi,roofbase),(half,y,167*FT)]
    mesh("Monel roof transverse gabled bay",verts,[(0,3,5,2),(2,5,4,1)],MONEL)
    for sign in [-1,1]:
        x=sign*HALL_SHELL_W/2
        mesh('Granite gable tympanum',[(x,lo,roofbase),(x,hi,roofbase),(x,y,167*FT)],[(0,1,2)],GRANITE)
        for start,end in [((x,lo,roofbase),(x,y,167*FT)),((x,y,167*FT),(x,hi,roofbase))]:
            section_beam('Continuous sloping gable stone coping',start,end,[(-.32,-.22),(.32,-.22),(.32,.22),(-.32,.22)],GRANITE)
for obj in set(EXTERIOR.objects)-hall_exterior_before:
    obj.location.z-=STREET_DROP

# Context perimeter: deliberately unsigned, plausible low-rise period massing.
for sy in ([] if ARGS.no_context else [-1,1]):
    for i,xx in enumerate(range(-130,161,15)):
        if 118<xx<150: continue
        height=RNG.choice([13,17,20,24,28])
        cy=sy*(W/2+34)
        m=BRICK[i%len(BRICK)]
        box("Unverified period context mass",(xx,cy,height/2),(14,17,height),m)
        box("Context parapet cornice",(xx,cy,height-.35),(14.5,17.5,.6),m)
        for zz in np.arange(2.5,height-1,3.4):
            for dx in [-4.4,0,4.4]:
                box("Context window",(xx+dx,cy-sy*8.53,float(zz)),(1.5,.06,2.05),WINDOW)
for sx in ([] if ARGS.no_context else [-1,1]):
    for i,yy in enumerate(range(-85,100,18)):
        height=RNG.choice([18,23,28,33])
        xx=sx*(L/2+47)
        m=BRICK[i%4]
        box("Unverified avenue context mass",(xx,yy,height/2),(22,17,height),m)
        for zz in np.arange(2.5,height-1,3.7):
            for dy in [-5,0,5]:
                box("Context avenue window",(xx-sx*11.03,yy+dy,float(zz)),(.06,1.7,2.3),WINDOW)

# Restrained decorative cast-iron street standards (not surveyed positions).
for xx in ([] if ARGS.no_context else [-111,-70,-30,30,70,111]):
    for sy in [-1,1]:
        yy=sy*(W/2+4)
        post=lathe("Period streetlamp",[(0,.24),(.25,.27),(.55,.15),(4.1,.075),(4.3,.13)],IRON,16)
        post.location=(xx,yy,0)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.28,location=(xx,yy,4.48))
        lamp=move(bpy.context.object);lamp.name="Streetlamp opal globe";lamp.data.materials.append(WHITE)

# ---------- Waiting room: monumental fluted order and intersecting vaults ----------
print("Building waiting room architectural meshes",flush=True)
HALL=collection("02 Main waiting room")
HALL_FLOOR=box("Waiting room clear floor",(0,0,-.20),(HALL_W,HALL_L,.4),FLOOR)
END_LANDING_SLABS=[]
IMPOSTS={}
UPPER_PIERS={}
for sx in [-1,1]:
    for ya,yb in [(-HALL_ROOM_L/2,-7.75),(7.75,HALL_ROOM_L/2)]:
        box('Wall-to-wall floor strip beyond clear dimension',(sx*(HALL_W+HALL_ROOM_W)/4,(ya+yb)/2,-.20),((HALL_ROOM_W-HALL_W)/2,yb-ya,.40),FLOOR,.000001)
# Floor grout and larger dark border in genuine dimensions.
for y in np.arange(-HALL_L/2,HALL_L/2,2.15):
    box("Marble transverse joint",(0,float(y),.003),(HALL_W,.025,.008),SHADOW)
for x in np.arange(-HALL_W/2,HALL_W/2,2.15):
    box("Marble longitudinal joint",(float(x),0,.005),(.025,HALL_L,.008),SHADOW)
for sx in [-1,1]:
    box("Hall floor border",(sx*13.9,0,.008),(.45,HALL_L,.012),SHADOW)

# Wall piers frame three large lower arches; narrow upper wall is transparent fenestration.
for sx in [-1,1]:
    # Continuous masonry backing behind the recessed order, with axial entry.
    for sy in [-1,1]:
        part=HALL_ROOM_L/2-6.4
        box("Waiting room continuous side backing",(sx*17.20,sy*(HALL_ROOM_L/2+6.4)/2,15.5),(1.27,part,31.0),LIMESTONE)
    box("Waiting axial portal header",(sx*17.20,0,20.8),(1.27,12.8,20.4),LIMESTONE)
    for yy in [-42.216,-14.072,14.072,42.216]:
        box("Great pier",(sx*16.0,yy,14.3),(1.1,6.0,28.6),LIMESTONE)
    box("Thermal-window springing band",(sx*15.90,0,29.6),(1.3,90,2.2),LIMESTONE)
    for yy in [-28.144,0,28.144]:
        if yy==0:
            arch("Central axial wall arch",(sx*15.42,yy,14.8),LOWER_ARCH_RADIUS,.8,LIMESTONE,width=.9)
            for yside in [-LOWER_ARCH_RADIUS-.4,LOWER_ARCH_RADIUS+.4]:
                box("Central arch jamb",(sx*15.7,yy+yside,7.4),(.85,.8,14.8),LIMESTONE)
        else:
            # Plate302: outer bays have rectangular recessed panels, not arches.
            box("Outer bay recessed mural substrate",(sx*16.55,yy,20.0),(.12,MURAL_WIDTH,MURAL_HEIGHT),LIMESTONE,.018)
            mural_field((sx*16.475,yy,20.0))
            for inset in [0,.23,.43]:
                halfwidth=MURAL_WIDTH/2+.4-inset;halfheight=MURAL_HEIGHT/2+.4-inset
                for sign in [-1,1]:
                    box("Panel horizontal moulded rebate",(sx*(16.20+inset*.5),yy,20+sign*halfheight),(.24,halfwidth*2,.14),LIMESTONE,.025)
                    box("Panel vertical moulded rebate",(sx*(16.20+inset*.5),yy+sign*halfwidth,20),(.24,.14,halfheight*2),LIMESTONE,.025)
        # Central east-west circulation passage: true opening at the axial bay.
        if yy != 0:
            telephone=(sx==-1 and yy<0)
            office_holes=[(yy+dy-.825,yy+dy+.825,.15 if telephone else 1.15,3.15) for dy in [-7.4,-4.9,-2.4,.1,2.6,5.1,7.6]]
            if not telephone:
                office_holes.extend((yy+dy-.60,yy+dy+.60,.22,.64) for dy in [-7.4,-4.9,-2.4,.1,2.6,5.1,7.6])
            office_screen=pierced_wall('Ticket/parcel office structural screen',sx*16.08,yy-9.6,yy+9.6,0,12.8,.85,'X',office_holes,LIMESTONE)
            office_front=pierced_wall('Botticino office front with actual grille openings',sx*15.60,yy-9.6,yy+9.6,0,3.65,.12,'X',office_holes,BOTTICINO)
            for dy in [-7.4,-4.9,-2.4,.1,2.6,5.1,7.6]:
                if telephone:
                    box('Telephone booth dark interior',(sx*16.18,yy+dy,1.65),(.045,1.65,3.0),BLACK)
                    box('Clear-panel telephone booth door',(sx*15.55,yy+dy,1.65),(.045,1.45,2.85),LIGHT_GLASS)
                    for side in [-1,1]:box('Botticino telephone booth partition',(sx*15.56,yy+dy+side*.86,1.65),(.16,.12,3.16),BOTTICINO,.02)
                    flatbar('Telephone booth bronze pull',(sx*15.49,yy+dy+.53,1.12),(sx*15.49,yy+dy+.53,1.47),.035,.035,BRONZE)
                    for side in [-1,1]:
                        box('Telephone clear-panel bronze door stile',(sx*15.52,yy+dy+side*.69,1.65),(.045,.045,2.85),BRONZE,.005)
                    for z in [.23,2.73,3.06]:
                        box('Telephone clear-panel bronze door rail',(sx*15.52,yy+dy,z),(.045,1.42,.045),BRONZE,.005)
                    continue
                box('Unmodelled ticket-office dark interior',(sx*16.18,yy+dy,2.15),(.045,1.65,2.0),BLACK)
                box('Botticino ticket counter ledge',(sx*15.48,yy+dy,1.10),(.48,1.84,.12),BOTTICINO,.035)
                for dz in [1.3,1.65,2.0,2.35,2.70,3.08]:
                    box("Ticket grille crossbar",(sx*15.55,yy+dy,dz),(.035,1.65,.025),BRONZE)
                for p in np.linspace(-.72,.72,13):
                    box("Ticket grille upright",(sx*15.55,yy+dy+float(p),2.15),(.035,.018,2.0),BRONZE)
                # S23 shows recessed fine base vents under the counters. These
                # are actual holes in both stone layers, not painted decals.
                box('Booth base vent recessed backing',(sx*16.05,yy+dy,.43),(.025,1.20,.42),BLACK)
                for offset in np.linspace(-.54,.54,10):
                    box('Booth base vent vertical',(sx*15.56,yy+dy+float(offset),.43),(.025,.015,.42),BRONZE)
                for z in [.25,.37,.49,.61]:
                    box('Booth base vent horizontal',(sx*15.56,yy+dy,z),(.025,1.20,.015),BRONZE)
                for sign in [-1,1]:box('Botticino grille opening jamb',(sx*15.56,yy+dy+sign*.86,2.15),(.16,.12,2.16),BOTTICINO,.02)
            for z,height in [(.12,.12),(3.48,.10),(3.61,.10)]:
                box('Botticino office continuous moulded course',(sx*15.53,yy,z),(.20,19.2,height),BOTTICINO,.012)
            frieze=box('Botticino supported office lettering frieze',(sx*15.586,yy,3.875),(.14,19.2,.55),BOTTICINO,.008)
            contact('Office lettering frieze into structural screen',frieze,office_screen,source='LOC det.4a23713 office-front frieze; minor profile dimensions reconstructed')
            office_label='T I C K E T S' if (sx==1 and yy<0) or (sx==-1 and yy>0) else 'P A R C E L S' if sx==1 else 'T E L E P H O N E S'
            text("Opening-era office lettering",office_label,(sx*15.51,yy,3.68),.32,BLACK,
                (math.pi/2,0,-math.pi/2 if sx>0 else math.pi/2))
        order_tops=[]
        order_spacing=5.3 if yy==0 else 9.5
        for ystep in [yy-order_spacing,yy+order_spacing]:
            order_tops.append(ionic_order("Side screen Ionic order",(sx*15.1,ystep,3*FT),axis='X'))
        lintel=box('Side Ionic screen continuous trabeation',(sx*15.1,yy,33*FT+.26),(1.55,2*order_spacing+1.6,.52),LIMESTONE,.025)
        for abacus in order_tops:contact('Side Ionic abacus to trabeation',abacus,lintel,'top')
        thermal_window("Main room Diocletian window",(sx*16.45,yy,31.0))
        # Horizontal stone window sill.
        box("Thermal window sill",(sx*15.6,yy,31.05),(1.0,20.9,.46),LIMESTONE)
    for yy in np.arange(-43.5,44,1):
        near=min([-28.144,0,28.144],key=lambda v:abs(v-yy))
        distance=abs(float(yy)-near)
        lower=31+math.sqrt(max(0,10.16**2-distance**2)) if distance<10.16 else 31
        if lower<HALL_H:
            box("Waiting upper spandrel",(sx*17.35,float(yy),(lower+HALL_H)/2),(1.58,1.03,HALL_H-lower),LIMESTONE)
    # Section302 has individual projecting imposts above the colossal columns;
    # a continuous lower band would cut across and obscure the mural fields.
    for yy in [-42.216,-14.072,14.072,42.216]:
        IMPOSTS[(sx,yy)]=colossal_impost(sx*14.2,yy)
        pier=box('Attic pilaster from impost to vault spring',(sx*15.0,yy,(INTERIOR_ORDER_TOP+INTERIOR_ENTABLATURE+HALL_H)/2),(3.10,4.80,HALL_H-INTERIOR_ORDER_TOP-INTERIOR_ENTABLATURE),LIMESTONE,.018)
        UPPER_PIERS[(sx,yy)]=pier
        contact('Upper vault pier bears on colossal impost',pier,IMPOSTS[(sx,yy)])

# Interior colossal Corinthian order: eight columns. Capitals are disclosed abstractions.
corinth=lathe("Fluted Corinthian shaft master",[(0,1.18),(.18,1.28),(.50,1.13),(.8,1.03),(INTERIOR_BASE,1.0),(4.2,.98),(9,.93),(14.4,.86),(INTERIOR_BASE+INTERIOR_SHAFT,.81)],INTERIOR_GRANITE,144,24)
corinth.location=(0,0,-100)
corinth.hide_render=True
for sx in [-1,1]:
    for yy in [-42.216,-14.072,14.072,42.216]:
        shaft=copy_obj(corinth,"Colossal fluted interior column",(sx*14.2,yy,INTERIOR_PEDESTAL))
        pedestal=moulded_square('Colossal pedestal with continuous plinth and cap',(sx*14.2,yy,0),[(0,3.30),(.15,3.30),(.24,3.14),(.36,3.14),(.44,3.00),(INTERIOR_PEDESTAL-.35,3.00),(INTERIOR_PEDESTAL-.23,3.25),(INTERIOR_PEDESTAL,3.25)])
        contact('Colossal pedestal on Main floor',pedestal,HALL_FLOOR)
        contact('Colossal shaft on pedestal',shaft,pedestal)
        # Capital core and two ranks of curved, abstracted acanthus leaves.
        cap_start=INTERIOR_PEDESTAL+INTERIOR_BASE+INTERIOR_SHAFT
        cap=lathe("Corinthian capital bell",[(0,.81),(.22,.84),(.8,1.04),(1.8,1.23),(2.25,1.38),(INTERIOR_CAPITAL,1.38)],LIMESTONE,96)
        cap.location=(sx*14.2,yy,cap_start)
        cap['closed_support']=True
        abacus=carved_abacus("Concave Corinthian abacus",(sx*14.2,yy,INTERIOR_ORDER_TOP-.14))
        contact('Colossal capital on shaft',cap,shaft)
        contact('Colossal abacus on bell',abacus,cap)
        contact('Colossal impost on capital',IMPOSTS[(sx,yy)],abacus)
        corinthian_scrolls((sx*14.2,yy,cap_start))
        for rank in [0,1]:
            for k in range(8):
                a=(k+rank*.5)*math.pi/4
                leaf=capital_leaf((sx*14.2,yy,cap_start),a,rank)
                contact('Corinthian leaf root to bell',leaf,cap)

# Individual shallow ashlar faces give the wall joints true depth and arrises.
# Course cadence is inferred from the photographs; no survey of every block exists.
for sx in [-1,1]:
    for course in range(29):
        lo=course*1.05;hi=min(31,(course+1)*1.05)
        offset=1.2 if course%2 else 0
        for k in range(39):
            y0=-45+k*2.4-offset;y1=min(45,y0+2.4)
            y0=max(-45,y0)
            if y1-y0<.1:continue
            if lo<10.6 and y0<6.4 and y1>-6.4:continue
            material=ASHLAR[(course+k)%len(ASHLAR)]
            box("Individually faced travertine ashlar",(sx*16.50,(y0+y1)/2,(lo+hi)/2),(.07,y1-y0-.018,hi-lo-.018),material,.012)
# Wall masonry coursing and panel outlines.
for sx in [-1,1]:
    for yy in [-42.216,-14.072,14.072,42.216]:
        for z in np.arange(3,26,1.55):
            box("Pier ashlar joint",(sx*15.40,yy,float(z)),(.016,5.8,.025),SHADOW)

# Street-level north/south bridges and their central stairs (plates300/302).
# The277ft clear versus314ft4 room hierarchy leaves an18ft8 end portico.
for sy in [-1,1]:
    lo,hi=HALL_L/2,HALL_ROOM_L/2
    base=box('Main floor beneath end entrance landing',(0,sy*(lo+hi)/2,-.12),(HALL_ROOM_W,hi-lo,.24),FLOOR,.000001)
    landing=box('Raised end bridge landing',(0,sy*(lo+hi)/2,STREET_DROP-.16),(HALL_ROOM_W,hi-lo,.32),FLOOR,.015)
    END_LANDING_SLABS.append(landing)
    retaining=[]
    # Actual openings under the two flanks, as seen in the Detroit photograph.
    for sign in [-1,1]:
        x0,x1=sorted([sign*END_STAIR_WIDTH/2,sign*HALL_ROOM_W/2])
        doorway=sign*9.6;doorw=2.1;doorh=3.0
        segments=[(x0,doorway-doorw/2),(doorway+doorw/2,x1)]
        for xa,xb in segments:
            if xb>xa:retaining.append(box('End landing masonry supporting pier',((xa+xb)/2,sy*(lo+.28),STREET_DROP/2),(xb-xa,.56,STREET_DROP),LIMESTONE,.02))
        retaining.append(box('End landing door lintel',(doorway,sy*(lo+.28),(doorh+STREET_DROP)/2),(doorw,.56,STREET_DROP-doorh),LIMESTONE,.02))
    girder=steel_i('End bridge structural bearing girder',(-HALL_W/2,sy*(lo+.45),STREET_DROP-.34),(HALL_W/2,sy*(lo+.45),STREET_DROP-.34),.24,.60,.035,.022)
    contact('End landing deck to masonry piers',landing,retaining)
    contact('End landing girder bearing',girder,retaining)
    # Broad central flight is plan-derived; final run/riser registration is qualified.
    steps=28
    for k in range(steps):
        y=sy*(END_STAIR_FOOT+(k+.5)*(END_STAIR_TOP-END_STAIR_FOOT)/steps)
        h=(k+1)*STREET_DROP/steps
        tread=box('North/south bridge stair solid tread',(0,y,h/2),(END_STAIR_WIDTH,(END_STAIR_TOP-END_STAIR_FOOT)/steps+.004,h),LIMESTONE,.012)
        contact('End stair foundation contact',tread,HALL_FLOOR)
    for sign in [-1,1]:
        cheek=stone_cheek('End stair attached stone parapet',(sign*(END_STAIR_WIDTH/2+.23),sy*END_STAIR_FOOT,0),(sign*(END_STAIR_WIDTH/2+.23),sy*END_STAIR_TOP,STREET_DROP),.46,.72)
        contact('End stair parapet foundation',cheek,HALL_FLOOR)
    # Six equally spaced Ionic orders stand on the raised continuous deck.
    order_y=sy*(lo+.80)
    tops=[]
    for x in [-9.5,-5.7,-1.9,1.9,5.7,9.5]:
        tops.append(ionic_order('Raised end screen Ionic order',(x,order_y,STREET_DROP+3*FT)))
    screen_top=STREET_DROP+33*FT
    architrave=box('End screen architrave',(0,order_y,screen_top+.16),(25.5,1.4,.32),LIMESTONE,.025)
    frieze=box('End screen frieze',(0,order_y,screen_top+.78),(25.5,1.18,.92),LIMESTONE,.018)
    crown=box('End screen cornice',(0,order_y,screen_top+1.45),(25.9,1.65,.42),LIMESTONE,.025)
    for obj in tops:contact('Raised Ionic order carries trabeation',obj,architrave,'top')
    contact('End screen frieze bearing',frieze,architrave)
    contact('End screen cornice bearing',crown,frieze)
    # End room plane remains distinct from the shorter clear central hall.
    endwall=sy*(HALL_ROOM_L/2+.15)
    for xx in [-9.1,9.1]:box('Waiting end masonry backing',(xx,endwall,15.5),(13.2,1.30,31.0),LIMESTONE)
    header_start=STREET_DROP+10.25
    box('Waiting end portal upper backing',(0,endwall,(header_start+31)/2),(5,1.30,31-header_start),LIMESTONE)
    portal_y=endwall-sy*.68
    box('Raised end portal bronze glazed doors',(0,portal_y,STREET_DROP+3.8),(4.7,.10,7.6),LIGHT_GLASS)
    lunette('Raised end portal round-headed transom',(0,portal_y,STREET_DROP+7.6),2.35,LIGHT_GLASS,axis='Y',grid=False)
    for xx in [-2.35,-1.2,0,1.2,2.35]:flatbar('End door bronze upright',(xx,portal_y,STREET_DROP),(xx,portal_y,STREET_DROP+7.6),.06,.06,BRONZE)
    for zz in [0,2.4,5,7.6]:flatbar('End door bronze transom',(-2.35,portal_y,STREET_DROP+zz),(2.35,portal_y,STREET_DROP+zz),.06,.06,BRONZE)
    # The two end-wall flanks and portal header already close this entire
    # elevation. A second backing here would duplicate their interior faces.
    mural_y=endwall-sy*.67
    mural_field((0,mural_y,20.0),axis='Y')
    for sign in [-1,1]:
        box('End mural moulded horizontal frame',(0,mural_y-sy*.03,20+sign*(MURAL_HEIGHT/2+.2)),(MURAL_WIDTH+.4,.25,.18),LIMESTONE,.025)
        box('End mural moulded vertical frame',(sign*(MURAL_WIDTH/2+.2),mural_y-sy*.03,20),(.18,.25,MURAL_HEIGHT+.4),LIMESTONE,.025)
    thermal_window('End Diocletian window',(0,sy*(HALL_ROOM_L/2-.05),31.0),axis='Y')
    box('End lunette sill',(0,endwall-sy*.55,31.0),(21,1,.44),LIMESTONE)
    for x in np.arange(-HALL_ROOM_W/2,HALL_ROOM_W/2,1):
        lower=31+math.sqrt(max(0,10.16**2-float(x)**2)) if abs(x)<10.16 else 31
        if lower<HALL_H:box('End upper spandrel',(float(x),endwall,(lower+HALL_H)/2),(1.03,1.30,HALL_H-lower),LIMESTONE)

spring=30.35
rise=HALL_H-spring
a=HALL_ROOM_W/2
b=HALL_L/6
def vault_z(x,y):
    return spring+rise*max(math.sqrt(max(0,1-(x/a)**2)),math.sqrt(max(0,1-(y/b)**2)))
def vault_surface(x,y,cy,depth=0):
    # The interpreted relief depth is vertical. A normal-offset mapping folds
    # where the two barrel normals meet at a groin, producing overlaps/slivers.
    # This graph preserves shared XY boundaries and the143ft finished crown.
    return (x,cy+y,vault_z(x,y)-depth)
def coffer_cell(name,cx,yy,hw,hh,surface):
    outer=[(-1,-1),(-1,-1),(1,-1),(1,-1),(1,1),(1,1),(-1,1),(-1,1)]
    octagon=[(-1,-.66),(-.66,-1),(.66,-1),(1,-.66),(1,.66),(.66,1),(-.66,1),(-1,.66)]
    verts=[];faces=[]
    for layer,(shrink,depth) in enumerate([(1,.36),(.91,.36),(.84,.29),(.77,.065),(.72,0)]):
        outline=outer if layer==0 else octagon
        verts.extend((cx+u*hw*shrink,yy+v*hh*shrink,depth) for u,v in outline)
    for layer in range(4):
        for k in range(8):
            n=(k+1)%8
            face=(layer*8+k,layer*8+n,(layer+1)*8+n,(layer+1)*8+k)
            if layer==0 and outer[k]==outer[n]:face=(layer*8+k,(layer+1)*8+n,(layer+1)*8+k)
            faces.append(tuple(reversed(face)))
    center_index=len(verts);verts.append((cx,yy,0))
    faces.extend((center_index,32+(k+1)%8,32+k) for k in range(8))
    verts,triangles,normals=tessellate_profile(verts,faces,surface)
    obj=mesh(name,verts,triangles,PALE)
    for face in obj.data.polygons:face.use_smooth=True
    obj.data.normals_split_custom_set_from_vertices(normals)
    clamp_backfacing_corner_normals(obj.data)
    obj['coffer_curvature_revision']=4
    obj['coffer_shading_normal_revision']=5
    obj['coffer_profile_status']='Existing interpreted10ft projected module and five relief bands retained; curved tessellation replaces warped planar polygons'
    return obj

# Gibbs255 explicitly states10ft coffers. The projected module is about10ft;
# field count and edge-pocket arrangement remain reconstructed from photographs.
grid_x=max(1,round(2*a/(10*FT)));grid_y=max(1,round(2*b/(10*FT)))
for j in [-1,0,1]:
    cy=j*HALL_L/3
    for iy in range(grid_y):
        for ix in range(grid_x):
            cx=-a+(ix+.5)*2*a/grid_x;yy=-b+(iy+.5)*2*b/grid_y
            coffer_cell('Ten-foot-module octagonal plaster coffer',cx,yy,a/grid_x,b/grid_y,lambda x,y,d,cy=cy:vault_surface(x,y,cy,d))
# Four actual boundary ribs; shared bay lines are not duplicated.
for y in [-HALL_L/2,-HALL_L/6,HALL_L/6,HALL_L/2]:
    rib=arch('Continuous transverse vault bearing rib',(0,y,spring-.3),a,.8,LIMESTONE,axis='Y',width=.45,rise=rise)
    yy=min([-42.216,-14.072,14.072,42.216],key=lambda c:abs(c-y))
    for sx in [-1,1]:contact('Vault rib spring on upper pier',None,UPPER_PIERS[(sx,yy)],points=[(sx*a,y,spring-.3)],source='Architects plates302/310: projecting impost, upper pilaster and vault haunch')

# The reported314ft4 room includes the raised end porticos beyond the277ft
# central hall. Matching barrel strips close the ceiling over those porticos.
def barrel_surface(x,y,depth=0):
    z=spring+rise*math.sqrt(max(0,1-(x/a)**2))
    return (x,y,z-depth)
for sy in [-1,1]:
    begin=HALL_L/2;length=(HALL_ROOM_L-HALL_L)/2
    for iy in range(2):
        cy=sy*(begin+(iy+.5)*length/2)
        for ix in range(grid_x):
            cx=-a+(ix+.5)*2*a/grid_x
            coffer_cell('End-portico octagonal barrel coffer',cx,cy,a/grid_x,length/4,barrel_surface)

# Period screen benches, lamps and clocks: positions approximate, documented.
for sx in [-1,1]:
    for yy in [-33,-23,-5,5,23,33]:
        xx=sx*10.7
        # Preserve the existing reconstructed row positions. Individual wood
        # slats and supported metal frames replace the former solid boxes;
        # minor profiles/counts are interpretations of the period photographs.
        for u in np.linspace(-.26,.26,5):
            z=.49+.025*(float(u)/.30)**2
            box('Waiting bench individual seat plank',(xx+sx*float(u),yy,z-.035),(.118,4.2,.07),WOOD,.008)
        for dy in np.linspace(-1.96,1.96,29):
            verts=[(xx+sx*(.25+.11*t+dx),yy+float(dy)+ddy,.57+.61*t) for t in [0,1] for dx,ddy in [(-.025,-.047),(.025,-.047),(.025,.047),(-.025,.047)]]
            faces=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
            if sx<0:faces=[tuple(reversed(face)) for face in faces]
            mesh('Waiting bench individual leaning back slat',verts,faces,WOOD)
        for u,z in [(.255,.60),(.366,1.20)]:
            box('Waiting bench continuous back rail',(xx+sx*u,yy,z),(.075,4.2,.10),WOOD,.012)
        for dy in [-1.80,0,1.80]:
            for side in [-1,1]:
                points=[(xx+sx*side*.28,yy+dy,.035),(xx+sx*side*.25,yy+dy,.13),(xx+sx*side*.18,yy+dy,.29),(xx+sx*side*.17,yy+dy,.47)]
                tube_path('Waiting bench curved iron support',points,.031,IRON,12)
                box('Waiting bench grounded iron foot',(xx+sx*side*.28,yy+dy,.025),(.15,.22,.05),IRON,.008)
            beam('Waiting bench under-seat cross stay',(xx-.27,yy+dy,.43),(xx+.27,yy+dy,.43),.025,IRON,12)
            arm=[(xx-sx*.25,yy+dy,.49),(xx-sx*.25,yy+dy,.65),(xx-sx*.13,yy+dy,.78),(xx+sx*.15,yy+dy,.82),(xx+sx*.33,yy+dy,1.00)]
            tube_path('Waiting bench supported curved arm',arm,.026,IRON,12)
def waiting_candelabrum(xx,yy):
    """S23/plate306: raised central globe over four lower curved branches.

    Hierarchy and visible forms follow the photograph; small profile sizes,
    exact finish and placement remain reconstructed rather than surveyed.
    """
    pedestal=moulded_square('Candelabrum moulded stone pedestal',(xx,yy,0),
        [(0,1.40),(.08,1.40),(.14,1.32),(.24,1.22),(1.28,1.22),(1.36,1.35),(1.50,1.35)])
    profile=[(0,.27),(.06,.31),(.15,.31),(.21,.28),(.30,.22),(.44,.16),(.60,.125),
        (3.25,.11),(3.42,.15),(3.52,.21),(3.62,.19),(3.72,.13),(4.36,.11),(4.45,.15),(4.52,.17)]
    standard=lathe('Candelabrum fluted cast bronze standard',profile,BRONZE,96,16)
    standard.location=(xx,yy,1.5)
    standard['closed_support']=True
    contact('Candelabrum bronze foot on stone pedestal',standard,pedestal,
        source='S23/plate306: candelabrum on continuous stone pedestal; exact small profiles reconstructed')
    for k in range(4):
        angle=math.pi/4+k*math.pi/2;points=[]
        for j in range(17):
            t=j/16;r=.14+.21*t;z=1.75-.215*t
            points.append((xx+r*math.cos(angle),yy+r*math.sin(angle),z))
        foot=tube_path('Candelabrum curved bronze foot',points,.035,BRONZE,16,closed=True)
        contact('Candelabrum curved foot bearing',foot,pedestal)
    def globe(name,x,y,z,radius):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=24,radius=radius,location=(x,y,z))
        obj=move(bpy.context.object);obj.name=name;obj.data.materials.append(OPAL_GLASS)
        for face in obj.data.polygons:face.use_smooth=True
        return obj
    for k in range(4):
        angle=k*math.pi/2;points=[]
        for j in range(33):
            t=j/32;r=.10+.54*math.sin(math.pi*t/2);z=5.12+.28*t-.22*math.sin(math.pi*t)
            points.append((xx+r*math.cos(angle),yy+r*math.sin(angle),z))
        branch=tube_path('Candelabrum swept lower branch',points,.045,BRONZE,16,closed=True)
        contact('Candelabrum branch rooted in standard',branch,standard,points=[points[0]])
        x=xx+.64*math.cos(angle);y=yy+.64*math.sin(angle)
        cup=lathe('Candelabrum lower globe cup',[(0,.095),(.045,.115),(.09,.15),(.13,.155)],BRONZE,64)
        cup.location=(x,y,5.36)
        cup['closed_support']=True
        contact('Candelabrum lower cup on branch',cup,branch)
        shade=globe('Candelabrum lower opal globe',x,y,5.69,.225)
        contact('Candelabrum lower opal globe mounted in cup',shade,cup)
    cup=lathe('Candelabrum raised central cup',[(0,.10),(.045,.14),(.09,.18),(.13,.19)],BRONZE,64)
    cup.location=(xx,yy,5.89)
    cup['closed_support']=True
    contact('Candelabrum raised cup on standard',cup,standard)
    shade=globe('Candelabrum raised central opal globe',xx,yy,6.2855,.29)
    contact('Candelabrum raised globe mounted in cup',shade,cup)
for sx in [-1,1]:
    for yy in [-33,-11,11,33]:waiting_candelabrum(sx*6.4,yy)

# The one-storey main stair descends from street arcade to the main floor.
# Width39ft6 is published;28risers are an explicit reconstruction of14ft drop.
main_stair_base=box('Main stair structural foundation slab',((16.5+24.9)/2,0,-.15),(24.9-16.5,39.5*FT+.95,.30),FLOOR,.000001)
for k in range(28):
    x=16.5+(k+.5)*.30
    top=(k+1)*.1524
    step=box("Main stair solid tread",(x,0,top/2),(.304,39.5*FT,top),LIMESTONE,.012)
    contact('Grand stair solid tread foundation',step,main_stair_base)
for sign in [-1,1]:
    cheek=stone_cheek('Grand stair joined stone parapet',(16.5,sign*(39.5*FT/2+.23),0),(24.9,sign*(39.5*FT/2+.23),STREET_DROP),.46,.80)
    contact('Grand stair parapet foundation',cheek,main_stair_base)
box("Main stair lower threshold floor",((16.5+HALL_W/2)/2,0,-.10),(16.5-HALL_W/2,39.5*FT,.20),FLOOR,.000001)
box("West axial threshold floor",(-(HALL_ROOM_W+HALL_W)/4,0,-.10),((HALL_ROOM_W-HALL_W)/2,15.5,.20),FLOOR,.000001)
box("Street-level loggia landing",((24.9+32.71)/2,0,STREET_DROP-.10),(32.71-24.9,15.5,.20),FLOOR,.015)

# ---------- Train concourse: steel, glass, intersecting roof bays ----------
print("Building concourse structural meshes",flush=True)
CONCOURSE=collection("03 Glass and iron concourse")
from concourse_details import ConcourseDetails
CONCOURSE_DETAILS=ConcourseDetails(globals())
CX=-73
CW=(210+11/12)*FT
CL=320*FT
CON_FLOOR_L=475*FT
WEST=CX-CW/2
EW_SPANS=[(85+10/12)*FT,(95+4/12)*FT,(85+10/12)*FT]
Y_BOUND=[-sum(EW_SPANS)/2]
for span in EW_SPANS:Y_BOUND.append(Y_BOUND[-1]+span)
X_WEST_INNER=WEST+(29+5/12)*FT
X_WEST_MIDDLE=X_WEST_INNER+(27+8/12)*FT
CROSS_LEFT=X_WEST_MIDDLE+(27+8/12)*FT
CROSS_RIGHT=CROSS_LEFT+98*FT
CROSS_CENTER=(CROSS_LEFT+CROSS_RIGHT)/2
X_EAST_INNER=CROSS_RIGHT+(26+8/12)*FT
CROWN=((417+6.375/12)-320)*FT
# ASCEplateLXX original elevations, registered to theE320 main-floor datum.
EW_SPRING=CROWN-((417+6.375/12)-(367+3/12))*FT
NS_SPRING=CROWN-((417+6.375/12)-(356+5/12))*FT
BRANCH_JUNCTION=((393+6/12)-320)*FT
GLAZING_VALLEY=((401+9/12)-320)*FT
EXIT_LEVEL=-(27.5-17)*FT
TOR_LEVEL=((290+10.125/12)-320)*FT
PLATFORM_LEVEL=TOR_LEVEL+(3+10/12)*FT
STAIR_HEAD_X=CX+CW/2-1.4
ACCESS_CENTRES=[-z for z in [68.764528,54.791453,40.818378,27.149065,13.327870,-.341443,-13.555112,-27.224425,-40.321460]]
# Meet the first tread at its head datum. Extending the opening120mm past it
# left an unsupported118mm slot between floor and tread at every stair head.
MAIN_STAIR_HOLES=[(STAIR_HEAD_X-6.4,STAIR_HEAD_X,y-1.65,y+1.65) for y in ACCESS_CENTRES]
LOWER_SHIFT=.70
EXIT_STAIR_HOLES=[(STAIR_HEAD_X-10.5-LOWER_SHIFT,STAIR_HEAD_X-6.0-LOWER_SHIFT,y-1.65,y+1.65) for y in ACCESS_CENTRES]
def floor_with_voids(name,bounds,holes,level,thickness=.30,material=None,finish_regions=()):
    x0,x1,y0,y1=bounds
    cuts=list(holes)+[region[0] for region in finish_regions]
    xs=sorted({x0,x1,*[max(x0,min(x1,h[k])) for h in cuts for k in [0,1]]})
    ys=sorted({y0,y1,*[max(y0,min(y1,h[k])) for h in cuts for k in [2,3]]})
    objects=[]
    for a,b in zip(xs,xs[1:]):
        for c,d in zip(ys,ys[1:]):
            if b-a<.001 or d-c<.001:continue
            xx,yy=(a+b)/2,(c+d)/2
            if any(h[0]<=xx<=h[1] and h[2]<=yy<=h[3] for h in holes):continue
            # The finish owns the visible top. The concrete remains below
            # its bedding surface instead of occupying the same raster plane.
            finish=max([depth for region,depth in finish_regions if region[0]<=xx<=region[1] and region[2]<=yy<=region[3]],default=0)
            objects.append(box(name,(xx,yy,level-(thickness+finish)/2),(b-a,d-c,thickness-finish),material or FLOOR,.000001))
    return objects
CONCOURSE_DETAILS.configure_visible_court_floor()
MAIN_CONCOURSE_VOIDS=MAIN_STAIR_HOLES+CONCOURSE_DETAILS.fields
CONCOURSE_FINISH_REGIONS=[((-44.4,-HALL_ROOM_W/2,-7.75,7.75),.20),((-41.5,-18.5,8.5,45.5),.22),((-41.5,-18.5,-45.5,-8.5),.22)]
CON_MAIN_FLOORS=floor_with_voids("Main concourse concrete bearing and circulation slab around real stair and prism cutouts",(WEST,CX+CW/2,-CON_FLOOR_L/2,CON_FLOOR_L/2),MAIN_CONCOURSE_VOIDS,0,.44,CONCOURSE_DETAILS.opaque_concrete,CONCOURSE_FINISH_REGIONS)
CONCOURSE_DETAILS.prism_fields()
floor_with_voids("Exit concourse linked circulation floor",(STAIR_HEAD_X-13,STAIR_HEAD_X-5.5,-CON_FLOOR_L/2,CON_FLOOR_L/2),EXIT_STAIR_HOLES,EXIT_LEVEL)
for xx in np.arange(CX-CW/2,CX+CW/2,2):
    ys=sorted({-CON_FLOOR_L/2,CON_FLOOR_L/2,*[h[k] for h in MAIN_CONCOURSE_VOIDS if h[0]-.02<=xx<=h[1]+.02 for k in [2,3]]})
    for ya,yb in zip(ys,ys[1:]):
        if any(h[0]-.02<=xx<=h[1]+.02 and h[2]<=(ya+yb)/2<=h[3] for h in MAIN_CONCOURSE_VOIDS):continue
        box("Concourse floor joint",(float(xx),(ya+yb)/2,.008),(.025,yb-ya,.015),SHADOW)

# Western subsidiary hall between waiting room and concourse.
for sy in [-1,1]:
    CON_MAIN_FLOORS.append(box("Subsidiary waiting room floor",(-30,sy*27,-.11),(23,37,.22),FLOOR))
    box("Subsidiary room wall",(-30,sy*45.4,6),(23,1,12),GRANITE)
    box("Subsidiary room roof",(-30,sy*27,12),(23,38,.6),GRANITE)
    box("Subsidiary room inner wall",(-30,sy*8.2,6),(23,1,12),LIMESTONE)
CON_MAIN_FLOORS.extend(floor_with_voids("Axial passage with authentic centre-stair opening",(-44.4,-HALL_ROOM_W/2,-7.75,7.75),MAIN_STAIR_HOLES,0,.20))
for sy in [-1,1]: box("Passage entablature",(-30,sy*8,11),(28,1,.8),LIMESTONE)

def ew_roof(y):
    for i,(lo,hi) in enumerate(zip(Y_BOUND,Y_BOUND[1:])):
        if lo-.001<=y<=hi+.001:
            t=(y-(lo+hi)/2)/((hi-lo)/2)
            return EW_SPRING+(CROWN-EW_SPRING)*math.sqrt(max(0,1-t*t))
    distance=(abs(y)-sum(EW_SPANS)/2)/(CL/2-sum(EW_SPANS)/2)
    return EW_SPRING+(11.7-EW_SPRING)*min(1,max(0,distance))

def ns_roof(x):
    t=(x-CROSS_CENTER)/((CROSS_RIGHT-CROSS_LEFT)/2)
    return NS_SPRING+(CROWN-NS_SPRING)*math.sqrt(max(0,1-t*t)) if abs(t)<=1 else NS_SPRING

def roofpoint(x,y):
    ew=ew_roof(y)
    # LXX separates the springing line of the exposed cantilever arch from
    # the gutter node E401ft9in,8ft3in above branch junction E393ft6in.
    ew=max(ew,GLAZING_VALLEY)
    if x<X_WEST_INNER:
        ew=19.7+(ew-19.7)*(x-WEST)/(X_WEST_INNER-WEST)
    low_vault=0
    if abs(y)>sum(EW_SPANS)/2:
        t=(abs(y)-sum(EW_SPANS)/2)/(CL/2-sum(EW_SPANS)/2)
        low_vault=EW_SPRING+max(15*FT,17*FT*math.sin(math.pi*t))+.35
    return max(ew,ns_roof(x),low_vault)

def sweep_i(name,points,plane,width=.16,depth=.24):
    n=Vector(plane).normalized();verts=[];faces=[]
    w,d=width/2,depth/2;t=.026;web=.018
    profile=[(-w,-d),(w,-d),(w,-d+t),(web/2,-d+t),(web/2,d-t),(w,d-t),(w,d),(-w,d),(-w,d-t),(-web/2,d-t),(-web/2,-d+t),(-w,-d+t)]
    for i,p in enumerate(points):
        tangent=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
        normal=n.cross(tangent).normalized()
        if normal.z<0:normal=-normal
        verts.extend(tuple(Vector(p)+n*u+normal*v) for u,v in profile)
    m=len(profile)
    for i in range(len(points)-1):
        faces.extend((i*m+k,i*m+(k+1)%m,(i+1)*m+(k+1)%m,(i+1)*m+k) for k in range(m))
    return mesh(name,verts,faces,IRON)

def lattice_arch(name,points,plane,anchors=None,roof_chord=True):
    n=Vector(plane).normalized();upper=[];lower=[]
    for i,p in enumerate(points):
        tangent=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
        outward=n.cross(tangent).normalized()
        if outward.z<0:outward=-outward
        t=i/(len(points)-1)
        # The wide haunch lies above the bearing, not at the endpoint. Taper
        # back to the column-sized bearing so the chords do not hang in air.
        depth=2*FT+((6+7/12)*FT-2*FT)*16*t*(1-t)*(2*t-1)**2
        bearing=min(1,t/.08,(1-t)/.08)
        upper_offset=(1-bearing)*depth/2-bearing*.13
        upper.append(Vector(p)+outward*upper_offset)
        lower.append(Vector(p)+outward*(upper_offset-depth))
        if roof_chord:upper[-1].z=max(upper[-1].z,roofpoint(p[0],p[1])-.10)
    for sign in [-1,1]:
        offset=n*sign*FT
        up=[tuple(p+offset) for p in upper];lo=[tuple(p+offset) for p in lower]
        sweep_i(name+" upper curved flange",up,plane)
        sweep_i(name+" lower curved flange",lo,plane)
        for i in range(len(points)-1):
            flatbar(name+" double-lattice web",up[i],lo[i+1],.085,.022)
            flatbar(name+" double-lattice web",lo[i],up[i+1],.085,.022)
    for i in range(0,len(points),4):
        flatbar(name+" cross-web diaphragm",upper[i]-n*FT,upper[i]+n*FT,.12,.035)
        flatbar(name+" cross-web diaphragm",lower[i]-n*FT,lower[i]+n*FT,.12,.035)
    if anchors:
        for end,index in [('start',0),('end',-1)]:
            x,y=anchors[0 if index==0 else 1]
            for chord,path in [('upper',upper),('lower',lower)]:
                support=bearing_collar(x,y,path[index].z)
                for side in [-1,1]:
                    point=path[index]+n*side*FT
                    contact(name+' '+chord+' '+end+' web'+str(side),None,support,points=[tuple(point)],source='ASCE198–199 riveted cap/upper-column branch connection; plateLXIX/LXX and LOC Gottscho bearing photograph')

PIER_HEIGHTS={}
PIER_OBJECTS={}
PIER_MAJOR={}
BEARING_COLLARS={}
def lattice_pier(x,y,height,major=True):
    key=(round(x,3),round(y,3))
    if PIER_HEIGHTS.get(key,0)>=height-.01:return
    if key in PIER_OBJECTS:
        old=PIER_OBJECTS[key]
        CONTACTS[:]=[r for r in CONTACTS if r['part'] not in old]
        bpy.data.batch_remove(ids=old)
    major=major or PIER_MAJOR.get(key,False)
    PIER_MAJOR[key]=major
    PIER_HEIGHTS[key]=height
    before=set(COL.objects)
    width=3*FT if major else .62
    half=width/2
    leg=8*.0254 if major else .14
    thickness=.019
    legs=[]
    for sx in [-1,1]:
        for sy in [-1,1]:
            profile=[(0,0),(sx*leg,0),(sx*leg,sy*thickness),(sx*thickness,sy*thickness),(sx*thickness,sy*leg),(0,sy*leg)]
            legs.append(section_beam("Built-up pier eight-inch angle",(x-sx*half,y-sy*half,.15),(x-sx*half,y-sy*half,height),profile))
    levels=max(2,int(height/.85))
    for i in range(levels):
        z0=.25+(height-.5)*i/levels;z1=.25+(height-.5)*(i+1)/levels
        for sign in [-1,1]:
            flatbar("Pier double-lattice face",(x-half,y+sign*half,z0),(x+half,y+sign*half,z1),.07,.018)
            flatbar("Pier double-lattice face",(x+half,y+sign*half,z0),(x-half,y+sign*half,z1),.07,.018)
            flatbar("Pier double-lattice face",(x+sign*half,y-half,z0),(x+sign*half,y+half,z1),.07,.018)
            flatbar("Pier double-lattice face",(x+sign*half,y+half,z0),(x+sign*half,y-half,z1),.07,.018)
    for z in np.arange(.3,height,10*FT):
        for sign in [-1,1]:
            box("Pier ten-foot diaphragm collar",(x,y+sign*half,float(z)),(width+.10,.085,.10),IRON)
            box("Pier ten-foot diaphragm collar",(x+sign*half,y,float(z)),(.085,width+.10,.10),IRON)
    base=box("Riveted pier base plate",(x,y,.08),(width+.3,width+.3,.16),IRON)
    cap=box("Riveted pier bearing cap plate",(x,y,height),(max(width+.3,1.10),max(width+.3,1.10),.12),IRON)
    # Resolve against the final replacement assembly after any height upgrade.
    contact('Lattice pier base on Main floor',base,CON_MAIN_FLOORS)
    for legobj in legs:
        contact('Pier angle on base plate',legobj,base)
        contact('Pier angle into bearing cap',legobj,cap,'top')
    for sx in [-1,1]:
        for sy in [-1,1]:
            bolt=lathe("Pier foundation bolt",[(0,.045),(.05,.045)],IRON,6)
            bolt.location=(x+sx*(half+.065),y+sy*(half+.065),.16)
    PIER_OBJECTS[key]=set(COL.objects)-before

def bearing_collar(x,y,z):
    key=(round(x,3),round(y,3),round(z,3))
    if key not in BEARING_COLLARS:
        collar=box('Riveted arch/pier joint collar',(x,y,z),(1.15,1.15,.56),IRON,.008)
        BEARING_COLLARS[key]=collar
    return BEARING_COLLARS[key]

MAIN_PIERS=[]
for xx in [CROSS_LEFT,CROSS_RIGHT]:
    for yy in Y_BOUND:
        lattice_pier(xx,yy,EW_SPRING)
        MAIN_PIERS.append((xx,yy))
for xx in [X_WEST_INNER,X_WEST_MIDDLE,X_EAST_INNER]:
    for yy in Y_BOUND:lattice_pier(xx,yy,GLAZING_VALLEY,False)
for yy in [-CL/2,CL/2]:
    for xx in [X_WEST_INNER,X_WEST_MIDDLE,CROSS_LEFT,CROSS_LEFT+27.5*FT,CROSS_LEFT+70.5*FT,CROSS_RIGHT,X_EAST_INNER]:
        lattice_pier(xx,yy,max(GLAZING_VALLEY,roofpoint(xx,yy)),False)

for xx in [X_WEST_INNER,X_WEST_MIDDLE,CROSS_LEFT,CROSS_RIGHT,X_EAST_INNER]:
    for lo,hi in zip(Y_BOUND,Y_BOUND[1:]):
        pts=[(xx,lo+(hi-lo)*i/48,ew_roof(lo+(hi-lo)*i/48)) for i in range(49)]
        lattice_arch("E–W barrel primary arch",pts,(1,0,0),((xx,lo),(xx,hi)))
for yy in [-CL/2,*Y_BOUND,CL/2]:
    pts=[(CROSS_LEFT+(CROSS_RIGHT-CROSS_LEFT)*i/48,yy,ns_roof(CROSS_LEFT+(CROSS_RIGHT-CROSS_LEFT)*i/48)) for i in range(49)]
    lattice_arch("N–S crossing-barrel primary arch",pts,(0,1,0),((CROSS_LEFT,yy),(CROSS_RIGHT,yy)))

# The diagonal groin ribs are derived from the two intersecting barrel surfaces.
for lo,hi in zip(Y_BOUND,Y_BOUND[1:]):
    cy=(lo+hi)/2;ry=(hi-lo)/2;rx=(CROSS_RIGHT-CROSS_LEFT)/2
    for sx in [-1,1]:
        for sy in [-1,1]:
            pts=[]
            for i in range(33):
                z=EW_SPRING+(CROWN-EW_SPRING)*i/32
                dx=rx*math.sqrt(max(0,1-((z-NS_SPRING)/(CROWN-NS_SPRING))**2))
                dy=ry*math.sqrt(max(0,1-((z-EW_SPRING)/(CROWN-EW_SPRING))**2))
                pts.append((CROSS_CENTER+sx*dx,cy+sy*dy,z))
            # The branch begins on the actual corner pier, not an offset point
            # on two incompatible ideal ellipses.
            pts[0]=(CROSS_LEFT if sx<0 else CROSS_RIGHT,lo if sy<0 else hi,EW_SPRING)
            normal=Vector((sy*ry,-sx*rx,0)).normalized()
            lattice_arch("Intersecting vault diagonal hip rib",pts,normal,((pts[0][0],pts[0][1]),(CROSS_CENTER,cy)),roof_chord=False)

# Twelve-inch I-beam purlins, subordinate gutter ribs, and fine T glazing bars.
ROOF_PURLINS=[]
for yy in np.linspace(-CL/2,CL/2,45):
    pts=[(WEST+CW*i/48,float(yy),roofpoint(WEST+CW*i/48,float(yy))) for i in range(49)]
    ROOF_PURLINS.append(sweep_i("Twelve-inch steel roof purlin",pts,(0,1,0),.13,12*.0254))
EDGE_GUTTERS=[]
for xx in [WEST,CX+CW/2]:
    pts=[(xx,-CL/2+CL*i/140,roofpoint(xx,-CL/2+CL*i/140)) for i in range(141)]
    EDGE_GUTTERS.append(sweep_i('Continuous concourse perimeter gutter girder',pts,(1,0,0),.22,.38))
for xx in np.linspace(WEST,CX+CW/2,73):
    pts=[(float(xx),-CL/2+CL*i/96,roofpoint(float(xx),-CL/2+CL*i/96)+.025) for i in range(97)]
    tube_path("Bent T-section glazing frame",pts,.028,IRON,4)
    for end,index in [('north',0),('south',-1)]:
        contact('Bent glazing frame '+end+' end',None,ROOF_PURLINS[0 if index==0 else -1],points=[pts[index]],source='ASCE199–200 bent T glazing frames riveted to roof framing')
verts=[];faces=[]
nx,ny=88,140
for iy in range(ny+1):
    y=-CL/2+CL*iy/ny
    for ix in range(nx+1):
        x=WEST+CW*ix/nx
        verts.append((x,y,roofpoint(x,y)+.015))
for iy in range(ny):
    for ix in range(nx):
        k=iy*(nx+1)+ix;faces.append((k,k+1,k+nx+2,k+nx+1))
mesh("ASCE-derived intersecting concourse glazing",verts,faces,GLASS)
# The engineers describe lower Guastavino-vaulted cloisters on three sides.
# PlateLXIX gives the complete west arcade bay chain. Shallow arch rises are
# traced from the section, not inferred as semicircular half-span arches.
WEST_ARCADE_SPANS=[26.5,19+8/12,46+2/12,20,26+2/12,43,26+2/12,20,46+2/12,19+8/12,26.5]
WEST_ARCADE_Y=[-CL/2]
for span in WEST_ARCADE_SPANS:WEST_ARCADE_Y.append(WEST_ARCADE_Y[-1]+span*FT)
LOWER_SPRING=EW_SPRING
def lower_rise(span):return min(15*FT,max(7*FT,span*.27))

def lower_arcade(name,p0,p1):
    p0,p1=Vector(p0),Vector(p1)
    along=(p1-p0).normalized();normal=Vector((-along.y,along.x,0))
    span=(p1-p0).length;rise=lower_rise(span)
    centerline=[p0+(p1-p0)*(i/32)+Vector((0,0,LOWER_SPRING+rise*math.sin(math.pi*i/32))) for i in range(33)]
    # Two latticed webs, subordinate to the much deeper primary roof trusses.
    up=[p+Vector((0,0,.18)) for p in centerline]
    lo=[p-Vector((0,0,.18)) for p in centerline]
    for sign in [-1,1]:
        offset=normal*sign*.20
        a=[tuple(p+offset) for p in up];b=[tuple(p+offset) for p in lo]
        sweep_i(name+" upper chord",a,normal,.11,.14)
        sweep_i(name+" lower chord",b,normal,.11,.14)
        for i in range(32):
            flatbar(name+" double lattice",a[i],b[i+1],.055,.016)
            flatbar(name+" double lattice",b[i],a[i+1],.055,.016)
    for endpoint,index in [(p0,0),(p1,-1)]:
        collar=bearing_collar(endpoint.x,endpoint.y,LOWER_SPRING)
        for path in [up,lo]:
            for side in [-1,1]:contact(name+' spring bearing',None,collar,points=[tuple(path[index]+normal*side*.20)],source='LOC Gottscho LC-DIG-gsc-5a18544 lower ornamental arch on square plated pier joint')
    # Horizontal double-lattice struts bind the upper lengths of the piers.
    top=LOWER_SPRING+rise+.75
    for sign in [-1,1]:
        offset=normal*sign*.20
        a=p0+offset+Vector((0,0,top));b=p1+offset+Vector((0,0,top))
        for dz in [-.32,.32]:
            steel_i(name+" double-lattice strut chord",a+Vector((0,0,dz)),b+Vector((0,0,dz)),.11,.16,.022,.014)
            for endpoint in [p0,p1]:
                collar=bearing_collar(endpoint.x,endpoint.y,top+dz)
                contact(name+' upper strut bearing',None,collar,points=[tuple(endpoint+offset+Vector((0,0,top+dz)))],source='ASCE199 two-web lattice struts binding upper column lengths')
        for i in range(12):
            c=a+(b-a)*i/12;d=a+(b-a)*(i+1)/12
            flatbar(name+" strut lattice",c+Vector((0,0,-.32)),d+Vector((0,0,.32)),.055,.016)
            flatbar(name+" strut lattice",c+Vector((0,0,.32)),d+Vector((0,0,-.32)),.055,.016)

def cloister_cell(name,a,b,c,d):
    # Groined lower vault: crossing tile barrels support the visible arches at
    # the court edge. Outer backs adjoin opaque station accommodation.
    a,b,c,d=[Vector(p) for p in [a,b,c,d]]
    along=(b-a).length;depth=(d-a).length
    nu,nv=32,20;verts=[];faces=[]
    for j in range(nv+1):
        v=j/nv
        for i in range(nu+1):
            u=i/nu;p=a*(1-u)*(1-v)+b*u*(1-v)+c*u*v+d*(1-u)*v
            z=LOWER_SPRING+max(lower_rise(along)*math.sin(math.pi*u),min(17*FT,depth*.45)*math.sin(math.pi*v))
            verts.append((p.x,p.y,z))
    for j in range(nv):
        for i in range(nu):
            k=j*(nu+1)+i;faces.append((k,k+nu+1,k+nu+2,k+1))
    mesh(name+" groined tile soffit",verts,faces,PALE)
    for i in range(0,nu+1,4):
        pts=[verts[j*(nu+1)+i] for j in range(nv+1)]
        tube_path(name+" tile-course joint",pts,.008,SHADOW,4)

for lo,hi in zip(WEST_ARCADE_Y,WEST_ARCADE_Y[1:]):
    lower_arcade("West lower ornamental arcade",(X_WEST_INNER,lo,0),(X_WEST_INNER,hi,0))
    cloister_cell("West Guastavino cloister",(X_WEST_INNER,lo,0),(X_WEST_INNER,hi,0),(WEST,hi,0),(WEST,lo,0))
for yy in WEST_ARCADE_Y:
    lattice_pier(X_WEST_INNER,yy,max(LOWER_SPRING,roofpoint(X_WEST_INNER,yy)),False)

NORTH_ARCADE_X=[WEST,X_WEST_INNER,X_WEST_MIDDLE,CROSS_LEFT,CROSS_LEFT+27.5*FT,CROSS_LEFT+70.5*FT,CROSS_RIGHT,X_EAST_INNER,CX+CW/2]
for sign in [-1,1]:
    y=sign*sum(EW_SPANS)/2;outer=sign*CL/2
    for lo,hi in zip(NORTH_ARCADE_X,NORTH_ARCADE_X[1:]):
        if hi-lo<1:continue
        lower_arcade("North/south lower ornamental arcade",(lo,y,0),(hi,y,0))
        cloister_cell("North/south Guastavino cloister",(lo,y,0),(hi,y,0),(hi,outer,0),(lo,outer,0))
    for xx in NORTH_ARCADE_X:
        lattice_pier(xx,y,max(GLAZING_VALLEY,roofpoint(xx,y)),False)
CONCOURSE_DETAILS.perimeter(WEST_ARCADE_Y,NORTH_ARCADE_X,LOWER_SPRING)
for yy in [-CL/2,CL/2]:
    for x0 in np.arange(WEST,CX+CW/2-.8,.85):
        x1=min(CX+CW/2,float(x0)+.85)
        h0,h1=roofpoint(float(x0),yy),roofpoint(x1,yy)
        base=LOWER_SPRING
        if min(h0,h1)>base+.05:
            face=(0,1,2,3) if yy>0 else (3,2,1,0)
            mesh("North/south court curtain-wall glazing",[(float(x0),yy,base),(x1,yy,base),(x1,yy,h1),(float(x0),yy,h0)],[face],GLASS)
    for xx in np.arange(WEST,CX+CW/2,.85):
        h=roofpoint(float(xx),yy)
        if h>LOWER_SPRING:
            flatbar("North/south glazing upright",(float(xx),yy,LOWER_SPRING),(float(xx),yy,h),.045,.035)
    for z in np.arange(LOWER_SPRING,CROWN,1.25):
        for xx in np.arange(WEST,CX+CW/2-.8,.85):
            if min(roofpoint(float(xx),yy),roofpoint(float(xx+.85),yy))>=z:
                flatbar("North/south glazing transom",(float(xx),yy,float(z)),(float(xx+.85),yy,float(z)),.04,.025)
for xx in [X_WEST_INNER,X_EAST_INNER]:
    for y0 in np.arange(-CL/2,CL/2-.8,.85):
        y1=min(CL/2,float(y0)+.85)
        h0,h1=roofpoint(xx,float(y0)),roofpoint(xx,y1)
        base=max(CONCOURSE_DETAILS.clerestory_base,CONCOURSE_DETAILS.east_top) if xx==X_EAST_INNER else CONCOURSE_DETAILS.clerestory_base
        if min(h0,h1)<=base+.01:continue
        face=(0,1,2,3) if xx==X_WEST_INNER else (3,2,1,0)
        mesh("East/west upper court glazing",[(xx,float(y0),base),(xx,y1,base),(xx,y1,h1),(xx,float(y0),h0)],[face],GLASS)
        flatbar("East/west court glazing upright",(xx,float(y0),base),(xx,float(y0),h0),.045,.035)

# Glazing troughs are carried by the column branches, whose upper lengths
# continue above the ornamental arcades to the E401ft9 gutter node above the E393ft6 branch tier.
for xx in [X_WEST_INNER,X_WEST_MIDDLE,CROSS_LEFT,CROSS_RIGHT,X_EAST_INNER]:
    for yy in Y_BOUND:
        half=.4572 if xx in [CROSS_LEFT,CROSS_RIGHT] else .31
        for sign in [-1,1]:
            steel_i("Upper pier branch to glazing valley",(xx+sign*half,yy,EW_SPRING),(xx+sign*half,yy,GLAZING_VALLEY),.14,.22,.022,.016)
        box("Glazing valley bearing cap",(xx,yy,GLAZING_VALLEY),(1.15,1.15,.12),IRON)

STAIR_SUPPORT_FLIGHTS=[]
def stair_flight(name,x0,x1,cy,z0,z1,width,steps):
    # Record actual flight endpoints, distinct from receiving-landing centres.
    # Bounded browser footprint checks still require real triangle support.
    STAIR_SUPPORT_FLIGHTS.append({"label":f"{name} at Z{-cy:.6f}",
        "start":[x0,z0-STREET_DROP,-cy],"end":[x1,z1-STREET_DROP,-cy],"width":width})
    run=(x1-x0)/steps;rise=(z1-z0)/steps
    for k in range(steps):
        top=z0+rise*k
        box(name+" stone tread and riser",(x0+run*(k+.5),cy,top-.105),(abs(run)+.004,width,.21),LIMESTONE,.012)
    for sign in [-1,1]:
        yy=cy+sign*(width/2+.07)
        steel_i(name+" steel stair stringer",(x0,yy,z0-.24),(x1,yy,z1-.24),.12,.26,.026,.018)
        flatbar(name+" bronze sloping handrail",(x0,yy,z0+1.08),(x1,yy,z1+1.08),.06,.055,BRONZE)
        for k in range(0,steps+1,3):
            t=k/steps
            beam(name+" handrail baluster",(x0+(x1-x0)*t,yy,z0+(z1-z0)*t),(x0+(x1-x0)*t,yy,z0+(z1-z0)*t+1.08),.024,BRONZE)

# Nine east-edge heads are traced from Gibbs' plan243; exact rail-platform
# numbering and dimensions of individual stair shafts remain under review.
# Layout defect: these upper flights currently descend west from a wall-side
# head. Fig2 and LOC det.4a23718 instead support court-facing western entries
# descending east. Rebuild connected shafts/landings together; do not treat
# the authored 1.4m setback as a historical dimension. See platform-stair-audit.md.
for i,yy in enumerate(ACCESS_CENTRES):
    stair_flight("Main-to-exit access stair",STAIR_HEAD_X,STAIR_HEAD_X-5.7,yy,0,EXIT_LEVEL,3.0,19)
    box("Exit stair receiving landing",(STAIR_HEAD_X-6.2,yy,EXIT_LEVEL-.10),(1.0,3.2,.20),FLOOR,.015)
    middle=(EXIT_LEVEL+PLATFORM_LEVEL)/2
    stair_flight("Exit-to-platform first dogleg",STAIR_HEAD_X-6-LOWER_SHIFT,STAIR_HEAD_X-10.5-LOWER_SHIFT,yy-.83,EXIT_LEVEL,middle,1.45,15)
    box("Platform stair turning landing",(STAIR_HEAD_X-11-LOWER_SHIFT,yy,middle-.10),(1.0,3.3,.20),FLOOR,.015)
    stair_flight("Exit-to-platform return dogleg",STAIR_HEAD_X-10.5-LOWER_SHIFT,STAIR_HEAD_X-6-LOWER_SHIFT,yy+.83,middle,PLATFORM_LEVEL,1.45,15)
    box("Platform stair lower receiving landing",(STAIR_HEAD_X-5.55-LOWER_SHIFT,yy,PLATFORM_LEVEL-.10),(.9,3.3,.20),FLOOR,.015)
    for sy in [-1,1]:
        y=yy+sy*1.75
        for x in np.arange(STAIR_HEAD_X-6.4,STAIR_HEAD_X,.45):
            beam("Main floor stair-well fence upright",(float(x),y,0),(float(x),y,1.15),.022,BRONZE)
        flatbar("Stair-well top rail",(STAIR_HEAD_X-6.4,y,1.15),(STAIR_HEAD_X,y,1.15),.06,.055,BRONZE)
    # Gibbs266: paired16ft cast-iron indicator posts, not floating boards.
    for side in [-1,1]:
        # Exact post placement is reconstructed. Keep the documented paired
        # indicators on solid floor beside the fence, clear of the east aisle.
        px=STAIR_HEAD_X-.70;py=yy+side*2.15
        indicator=lathe('Sixteen-foot cast-iron gate indicator',[(0,.28),(.12,.31),(.24,.23),(.48,.14),(3.05,.105),(3.2,.14),(4.15,.12),(4.45,.15),(16*FT,.11)],IRON,24,12)
        indicator.location=(px,py,0);indicator['closed_support']=True
        contact('Gate indicator post foundation',indicator,CON_MAIN_FLOORS,source='Gibbs266: castiron16ft indicators, two at each gate')
        cards=box('Four-sided destination-card cabinet',(px,py,3.57),(.62,.62,.78),IRON,.035)
        times=box('Four-sided time-tape cabinet',(px,py,4.27),(.55,.55,.48),IRON,.025)
        contact('Destination cabinet on cast post',cards,indicator)
        contact('Time cabinet on cast post',times,indicator)
        track=2*i+1 if side<0 else 2*i+2
        for face in range(4):
            dx,dy=[(.311,0),(0,.311),(-.311,0),(0,-.311)][face]
            dims=(.018,.47,.54) if face%2==0 else (.47,.018,.54)
            box('Unassigned historical destination-card field',(px+dx,py+dy,3.57),dims,WHITE)
            rotation=(math.pi/2,0,math.pi/2 if face==0 else -math.pi/2) if face%2==0 else (math.pi/2,0,math.pi if face==1 else 0)
            text('Plan-derived track indicator number',str(track),(px+dx,py+dy,4.20),.25,WHITE,rotation)

CONCOURSE_DETAIL_REPORT=CONCOURSE_DETAILS.audit(ASSETS/'concourse-detail-audit.json')

# One source-anchored representative track/platform section, rather than a
# fabricated complete21-track assignment. Its position registers to stairZ11.
PLATFORM=collection("04 Representative platform")
PLATFORM_CENTER_Z=11.0
PLATFORM_WIDTH=14*FT
TRACK_CENTER_Z=PLATFORM_CENTER_Z-PLATFORM_WIDTH/2-(5+3/12)*FT
PX0,PX1=-85.0,25.0
CONCRETE=mat("PlatformConcrete",(.34,.35,.34),.91)
RAIL_STEEL=mat("RailRunningSteel",(.23,.25,.26),.32,.92)
RAIL_WEB=mat("RailWeatheredSteel",(.13,.145,.15),.64,.65)
TRACK_BASE=mat("TrackConcreteBase",(.24,.25,.24),.93)
FASTENINGS=mat("RailFastenings",(.12,.11,.095),.62,.65)
box("Representative reinforced-concrete platform",((PX0+PX1)/2,-PLATFORM_CENTER_Z,PLATFORM_LEVEL-.63),(PX1-PX0,PLATFORM_WIDTH,1.10),CONCRETE,.018)
box("Representative platform paved surface",((PX0+PX1)/2,-PLATFORM_CENTER_Z,PLATFORM_LEVEL-.041),(PX1-PX0,PLATFORM_WIDTH,.078),CONCRETE,.01)
for sign in [-1,1]:
    edge=-PLATFORM_CENTER_Z+sign*(PLATFORM_WIDTH/2-.12)
    box("Period unpainted platform coping",((PX0+PX1)/2,edge,PLATFORM_LEVEL-.045),(PX1-PX0,.24,.09),LIMESTONE,.018)
box("Smooth concrete track bedding — Gibbs306",((PX0+PX1)/2,-TRACK_CENTER_Z,TOR_LEVEL-.37),(PX1-PX0,3.35,.40),TRACK_BASE,.01)
gauge=(4+8.5/12)*FT
head_width=.0667
rail_offset=(gauge+head_width)/2
profile=[(-.030,0),(.030,0),(.035,-.010),(.033,-.035),(.014,-.045),(.007,-.08),(.007,-.128),(.0667,-.128),(.0667,-.14605),(-.0667,-.14605),(-.0667,-.128),(-.007,-.128),(-.007,-.08),(-.014,-.045),(-.033,-.035),(-.035,-.010)]
for sign in [-1,1]:
    ry=-TRACK_CENTER_Z+sign*rail_offset
    for start in np.arange(PX0,PX1,33*FT):
        end=min(PX1,float(start)+33*FT-.004)
        verts=[(x,ry+u,TOR_LEVEL+v) for x in [float(start),end] for u,v in profile]
        n=len(profile);faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
        faces.extend((k,(k+1)%n,(k+1)%n+n,k+n) for k in range(n))
        rail=mesh("100lb-type running rail head web and foot",verts,faces,RAIL_STEEL)
        rail.data.materials.append(RAIL_WEB)
        for poly in rail.data.polygons:
            if poly.index not in [2,3,2+n-1]:poly.material_index=1
        if start>PX0:
            for side in [-1,1]:
                box("Six-hole rail joint angle bar",(float(start),ry+side*.025,TOR_LEVEL-.078),(.80,.014,.085),FASTENINGS)
                for dx in [-.31,-.19,-.07,.07,.19,.31]:
                    beam("One-inch rail joint bolt",(float(start)+dx,ry+side*.032,TOR_LEVEL-.078),(float(start)+dx,ry+side*.052,TOR_LEVEL-.078),.020,FASTENINGS,6)
    for x in np.arange(PX0,PX1,33*FT/18):
        box("Embedded timber rail support block",(float(x),ry,TOR_LEVEL-.254),(.2032,.65,.1778),WOOD,.008)
        box("Rolled rail tie plate seven by thirteen inches",(float(x),ry,TOR_LEVEL-.1524),(.1778,.3302,.0127),FASTENINGS)
        for dx in [-.06,.06]:
            for dy in [-.10,.10]:
                bolt=lathe("Tie-plate lag screw",[(0,.014),(.025,.014)],FASTENINGS,6)
                bolt.location=(float(x)+dx,ry+dy,TOR_LEVEL-.14605)

# ---------- Scene metadata and portable delivery ----------
if not ARGS.legacy_platform:
    bpy.data.batch_remove(ids=list(PLATFORM.objects))
    PLATFORM.name='04 Railway supplied by separate authored asset'
print('Checking structural attachment controls',flush=True)
CONTACT_REPORT=contact_audit()
bpy.context.scene.unit_settings.system="METRIC"
bpy.context.scene.unit_settings.scale_length=1
bpy.context.scene.world.color=(.65,.7,.8)
for o in bpy.data.objects:
    if o.type=="MESH":
        o["reconstruction_revision"]=3
        # Keep materials readable from the inside where a historic shell is thin.
        for m in o.data.materials:
            m.use_backface_culling=False

# The source preserves actual Geometry Nodes; GLB export realizes their outputs.
print("Batching static surfaces by material",flush=True)
bpy.context.view_layer.update()
for name,col,zone in [("model-exterior.glb",EXTERIOR,'exterior'),("model-waiting-room.glb",HALL,'waiting'),("model-concourse.glb",CONCOURSE,'concourse'),("model-platform.glb",PLATFORM,'platform')]:
    batch_static(col)
    if not ((ARGS.preserve_platform or not ARGS.legacy_platform) and zone=='platform') and (not ARGS.hall_only or col==HALL) and (not ARGS.only or ARGS.only==zone or (ARGS.only=='core' and zone!='platform') or (ARGS.only=='concourse' and zone=='platform')):
        export(name,col)
        print("EXPORTED",name,(ASSETS/name).stat().st_size,flush=True)
orphan_meshes=[data for data in bpy.data.meshes if data.users==0]
if orphan_meshes:bpy.data.batch_remove(ids=orphan_meshes)
print("Saving editable Blender source",flush=True)
bpy.context.preferences.filepaths.save_version=0
blend_name="penn-station-study.blend" if ARGS.out else "penn-station-phase3.blend"
# Exported room chunks deliberately retain their local Main=0 contract. The
# editable source opens as the same coherent common world used by the viewer.
for col in [HALL,CONCOURSE,PLATFORM]:
    for obj in col.objects:obj.location.z-=STREET_DROP
bpy.context.scene["main_floor_world"]=-STREET_DROP
bpy.context.scene["authoring_coordinates"]="World: street0;Main-4.2672;rawroomGLBsuseMain0"
bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(MODEL_DIR/blend_name),compress=True)

manifest={
    "revision":2,"units":"metres","axes":"X east, Y up, Z south (glTF)",
    "coordinateSpace":"walkable floors and stair endpoints below are WORLD coordinates after chunkOffsets; architectural dimensions and survey-relative levels are local Main=0; editableblend is already worldaligned",
    "chunkOffsets":{"exterior":[0,0,0],"waiting":[0,-STREET_DROP,0],"concourse":[0,-STREET_DROP,0],"platform":[0,-STREET_DROP,0]},
    "levels":{"streetWorld":0,"mainWorld":-STREET_DROP,"exitWorld":EXIT_LEVEL-STREET_DROP,"platformWorld":PLATFORM_LEVEL-STREET_DROP,"railWorld":TOR_LEVEL-STREET_DROP,"platformAboveRail":(3+10/12)*FT,"mainToStreet":STREET_DROP,"exitDatumStatus":"Working10ft6in drop derived from lift travels;1926plan indicates circa10ft, not exact certification"},
    "status":"Detailed evidence-led reconstruction; precise residual assumptions listed individually",
    "waitingRoomHeightStatus":"Implemented 150 ft room envelope is provisional. Francis and O'Brien, ASCE 1910 p194, explicitly gives 143 ft to the highest ceiling; the PRR general 150 ft room-height wording does not resolve that ceiling datum.",
    "dimensions":{"nominalFootprint":[L,W],"waitingRoomClear":[HALL_W,HALL_L,HALL_H],"waitingRoomWallExtent":[HALL_ROOM_W,HALL_ROOM_L],"waitingLanternExterior":[HALL_SHELL_W,HALL_SHELL_L],"waitingLanternFrameWidth":(112+10/12)*FT,"waitingRoofAboveMain":167*FT,"waitingRoofAboveStreet":153*FT,"exteriorDoricColumnHeight":35*FT,"exteriorDoricColumnDiameter":4.5*FT,"interiorColumn":{"pedestal":INTERIOR_PEDESTAL,"base":INTERIOR_BASE,"shaft":INTERIOR_SHAFT,"capital":INTERIOR_CAPITAL,"totalAboveFloor":INTERIOR_ORDER_TOP,"entablatureHeight":INTERIOR_ENTABLATURE},"lowerWallArchRadius":LOWER_ARCH_RADIUS,"concourse":{"overall":[CW,CL],"ewBarrelSpans":EW_SPANS,"nsBarrelSpan":98*FT,"nsBarrelCenterX":CROSS_CENTER,"roofCrownAboveMain":CROWN,"mainPierWidth":3*FT,"webSpacing":2*FT,"archCrownDepth":2*FT,"archHaunchDepth":(6+7/12)*FT}},
    "assets":[{"file":"model-exterior.glb","zone":"exterior"},{"file":"model-waiting-room.glb","zone":"waiting"},{"file":"model-concourse.glb","zone":"concourse"},{"file":"model-platform.glb","zone":"platform"}],
    "cameraPresets":{"exterior":{"position":[180,42,125],"target":[35,16,0]},"waiting":{"position":[0,2.0,34],"target":[0,22,-18]},"concourse":{"position":[-73,2.0,38],"target":[-73,18,-18]}},
    "walkable":[{"label":"Main waiting hall","bounds":[-HALL_W/2,HALL_W/2,-HALL_L/2,HALL_L/2],"floor":-STREET_DROP},{"label":"East hall stair threshold","bounds":[HALL_W/2,16.5,-39.5*FT/2,39.5*FT/2],"floor":-STREET_DROP},{"label":"Main39ft6 stair","bounds":[16.5,24.9,-39.5*FT/2,39.5*FT/2],"floor":-STREET_DROP,"surface":"stair; use actual floor raycast"},{"label":"West hall axial threshold","bounds":[-HALL_ROOM_W/2,-HALL_W/2,-7.75,7.75],"floor":-STREET_DROP},{"label":"Street-level loggia and arcade","bounds":[24.9,L/2,-6.9,6.9],"floor":0},{"label":"Axial concourse passage","bounds":[-44.4,-HALL_ROOM_W/2,-7.75,7.75],"floor":-STREET_DROP},{"label":"Main concourse","bounds":[WEST,CX+CW/2,-CL/2,CL/2],"floor":-STREET_DROP},{"label":"Exit concourse","bounds":[STAIR_HEAD_X-13,STAIR_HEAD_X-5.5,-CL/2,CL/2],"floor":EXIT_LEVEL-STREET_DROP}],
    "mainStair":{"bounds":[16.5,24.9,-39.5*FT/2,39.5*FT/2],"startFloorWorld":-STREET_DROP,"endFloorWorld":0,"risers":28,"riser":.1524,"tread":.30,"riserCountStatus":"Reconstructed to fit verified14ft working drop and39ft6 publishedwidth"},
    "accessStairs":[{"centerZ":-y,"mainOpening":[h[0],h[1],-y-1.65,-y+1.65],"mainFlight":{"start":[STAIR_HEAD_X,-STREET_DROP,-y],"end":[STAIR_HEAD_X-5.7,EXIT_LEVEL-STREET_DROP,-y],"width":3.0,"steps":19},"exitToPlatform":{"upperStart":[STAIR_HEAD_X-6-LOWER_SHIFT,EXIT_LEVEL-STREET_DROP,-y+.83],"turningLanding":[STAIR_HEAD_X-11-LOWER_SHIFT,(EXIT_LEVEL+PLATFORM_LEVEL)/2-STREET_DROP,-y],"lowerLanding":[STAIR_HEAD_X-5.55-LOWER_SHIFT,PLATFORM_LEVEL-STREET_DROP,-y],"flightWidth":1.45,"stepsPerFlight":15}} for y,h in zip(ACCESS_CENTRES,MAIN_STAIR_HOLES)],
    "stairSupportFlights":STAIR_SUPPORT_FLIGHTS,
    "representativePlatform":{"bounds":[PX0,PX1,PLATFORM_CENTER_Z-PLATFORM_WIDTH/2,PLATFORM_CENTER_Z+PLATFORM_WIDTH/2],"floor":PLATFORM_LEVEL-STREET_DROP,"trackCenterZ":TRACK_CENTER_Z,"trackTopOfRailWorld":TOR_LEVEL-STREET_DROP,"nearPlatformEdgeZ":PLATFORM_CENTER_Z-PLATFORM_WIDTH/2,"sourceEdgeOffset":(5+3/12)*FT,"representativeInterpretation":"One linked section; longitudinalposition,widthandassignmentnotcertifiedcomplete21-tracklayout;railsectionminuteprofileinferred100lbtype"},
    "obstacles":(
        [{"bounds":[x-.62,x+.62,-y-.62,-y+.62],"floor":-STREET_DROP,"label":"Main concourse lattice pier"} for x,y in MAIN_PIERS]
        +[{"bounds":[x-.9,x+.9,y-.9,y+.9],"label":"Waiting room lamp pedestal"} for x in [-6.4,6.4] for y in [-33,-11,11,33]]
        +[{"bounds":[x-.9,x+.9,y-2.4,y+2.4],"label":"Waiting room bench"} for x in [-10.7,10.7] for y in [-33,-23,-5,5,23,33]]),
    "verified":["Waitinglantern325x119ft external;320x112ft10 frame;314ft4x108ft8 room;277x103 clear datums distinguished","Eight colossal interiorcolumns with48ftshaft,3ft3base,8ft3capital,9ft4pedestal","Three high windows perlongwall,eachfiveprimarylights;oneateachend","Octagonalrecessesinsquarecofferfield fromplate302","Onlycentralaxiallowerwallbayarched;outerbaysrectangularmuralpanels","ASCEthreeE-Wvaultspans85ft10,95ft4,85ft10;98ftcrossbarrel","ASCEthreeftpierswithfour8inangles,doublelatticeallfaces,diaphragms10ft","Doric35ftheight/4ft6diameter;EighthAvenuepredominantlypilasters","225x45ftarcade;39ft6mainstair","Mainwaiting/concourse equallevel;workingstreetE334/mainE320 datum"],
    "reconstructed":["Coffer exactspacingand.36mreliefdepth inferredfromprimaryphotographs","Corinthianacanthusandvolutedetail profiles interpretedfromplates308/310","Individualashlarcoursing cadenceandmouldingminuteprofiles","Separatecolossalimposts tracedfromsection302","Westlowerarcade11baychainmeasuredfromLXIX;shallowarchrisesandtilegroinrelieftracedratherthanfabricationcertified","Knownnorthsouthwestadjoiningaccommodationenclosedwithoutinventedshopfronts","Nine eaststairheads tracedfromGibbsplan243;individualdimensions/railplatformmappingnotcertified","Exitdatumqualifiedagainst1926plan;platformindependentlyanchoredby3ft10overrail","Rivets,anglethicknessandminortrusssectiondetails withoutcompletefabricationschedule","Benches,lampplacementand1935ticketingalterations"],
    "uncertain":["Nominalwholefootprint784x430versus788ft9x430ft6source outside-edge datums","Smallmainfloorgradients319ft11to320ft0¾;Seventhcurb registrationandexactriserdistribution","UpperwindowE421.25controlpassesclockcentres;exactglazingsilloffsetremainsphotographicwith31mlocalapproximation","Guérinmaps exactcolour andcompleteauthenticatedartworkreproductions","Clearfloor277/103versusroom314ft4/108ft8 endportico registration","Individual1935 operationalsigns/timetables notinvented","Materialcoloursrequirephysicalsamplecalibration;originalproceduralmapsarefallbacksourceassets"],
    "contextIncluded":not ARGS.no_context
}
for stair in manifest['accessStairs']:
    z=stair['centerZ']
    manifest['walkable'].append({'label':'Lower platform-access doglegs','bounds':[STAIR_HEAD_X-11.9,STAIR_HEAD_X-5.1,z-1.85,z+1.85],'floor':PLATFORM_LEVEL-STREET_DROP,'surface':'Stairs and receivinglandings; use actualfloor raycast'})
manifest['walkable'].append({'label':'Representative linked platform','bounds':manifest['representativePlatform']['bounds'],'floor':PLATFORM_LEVEL-STREET_DROP})
def finalise_phase3_manifest(data,legacy_platform=False,contacts=None):
    ft=.3048;drop=14*ft;clear_w=103*ft;clear_l=277*ft;room_w=(108+8/12)*ft;room_l=(314+4/12)*ft
    data['revision']=3
    data['architecturalDetailRevision']=4
    data['ceilingGeometry']={'coffers':341,'nominalProjectedModuleFeet':10,
        'reliefVerticalDepthsMetres':[.36,.36,.29,.065,0],
        'method':'Constrained curved triangulation with matching edge samples; continuous vertical relief avoids folded normal-offset groin pockets',
        'qualifications':'Exact field count, relief depth and fine moulding profiles remain photographic reconstructions; no new decorative motif or surveyed coffer inventory is claimed'}
    data['architecturalFinish']={'archSegments':144,'axisYArchWindingCorrected':True,
        'capitalLeafSampling':[40,20],'capitalBellSegments':96,'abacusSamplesPerSide':24,
        'candelabra':{'count':8,'source':'S23 and plate306','form':'Raised central globe above four lower curved branches, fluted standard on continuous stone pedestal',
            'globeSegments':[48,24],'centralTopMain':6.5755,'outerTopMain':5.915,
            'qualification':'Exact small profiles, dimensions, bronze finish and positions are reconstructed, not surveyed or photometrically calibrated'},
        'roofValleys':'Three gabled bays share exact hall-derived valley boundaries; no overlapping rounded strips'}
    data['waitingRoomHeightStatus']="The model adopts the143ft highest finished-ceiling datum explicitly stated by Francis and O'Brien ASCE1910p194, with167ft roof unchanged. Gibbs in the same volume also states150ft from floor to ceiling; the conflicting narrative remains documented rather than declared resolved."
    data['dimensions']['waitingRoomClear'][2]=143*ft
    data['dimensions']['reportedGeneralRoomHeight']=150*ft
    data['dimensions']['waitingRoomEndPorticoDepth']=(room_l-clear_l)/2
    data['dimensions']['concourse']['passengerFloorNS']=475*ft
    data['dimensions']['concourse']['branchJunctionAboveMain']=(393.5-320)*ft
    data['dimensions']['concourse']['gutterTopAboveMain']=(401.75-320)*ft
    data['dimensions']['wingRoofAboveStreet']=63*ft
    data['dimensions']['wingParapetAboveStreet']=65*ft
    data['dimensions']['easternCourtRoof']={'plan':[float((152+8.5/12)*ft),115.5*ft],'longAxis':'East–west','eaveAboveStreet':.15,'ridgeAboveStreet':1.50,'monitorAboveStreet':2.25,'levelStatus':'Street-level roof role documented; minor rise and exact registration reconstructed from engineering description and Bain view'}
    data['chunkOffsets']['railway']=[0,-drop,0]
    data['walkingSpawnsWorld']={'waiting':[0,1.68-drop,26.0],'endBridgeNorth':[0,1.68,-45.2],'endBridgeSouth':[0,1.68,45.2]}
    for surface in data['walkable']:
        if surface['label'] in ['Main concourse','Exit concourse']:surface['bounds'][2:]=[-475*ft/2,475*ft/2]
    stair_top=clear_l/2;stair_foot=stair_top-35*ft;halfwidth=9*ft
    data['endEntranceStairs']=[]
    for sign in [-1,1]:
        b=sorted([sign*stair_foot,sign*stair_top]);landing=sorted([sign*stair_top,sign*room_l/2]);bridge=sorted([sign*room_l/2,sign*430*ft/2])
        data['walkable'].extend([{'label':'North/south raised-end stair','bounds':[-halfwidth,halfwidth,*b],'floor':-drop,'surface':'Stair; use actual floor intersections'},{'label':'North/south Ionic landing','bounds':[-room_w/2,room_w/2,*landing],'floor':0},{'label':'North/south street-level pedestrian bridge','bounds':[-halfwidth,halfwidth,*bridge],'floor':0}])
        data['endEntranceStairs'].append({'side':'north' if sign<0 else 'south','bounds':[-halfwidth,halfwidth,*b],'landingBounds':[-room_w/2,room_w/2,*landing],'bridgeBounds':[-halfwidth,halfwidth,*bridge],'bottomWorld':-drop,'topWorld':0,'startFloorWorld':-drop,'endFloorWorld':0,'roomSideDoorPlaneZ':sign*(room_l/2-.58),'innerEndWallPlaneZ':sign*(room_l/2-.50),'steps':28,'riser':drop/28,'tread':35*ft/28,'basis':'35x18ft footprint traced from plate300 scale bar, approximately±2ft; longitudinal room registration inferred from277/314ft4 hierarchy'})
    data['waitingEndStairs']=data['endEntranceStairs']
    data['waitingRoomBounds']={'roomWallExtent':[-room_w/2,room_w/2,-room_l/2,room_l/2],'clearFloor':[-clear_w/2,clear_w/2,-clear_l/2,clear_l/2],'innerEndWallPlaneZ':[-room_l/2+.50,room_l/2-.50],'roomSideDoorPlaneZ':[-room_l/2+.58,room_l/2-.58],'endDoorsStatus':'Closed glazing and door leaves; no automatic opening is claimed'}
    data['dimensions']['seventhAvenueClockAtticWidth']=30.2
    for sign in [-1,1]:
        a,b=sorted([sign*clear_w/2,sign*room_w/2])
        data['walkable'].append({'label':'Waiting-room wall-to-wall floor strip','bounds':[a,b,-room_l/2,room_l/2],'floor':-drop})
    if not legacy_platform:
        data['assets']=[a for a in data['assets'] if a['zone']!='platform']
        data['assets'].append({'file':'model-railway.glb','zone':'railway','externalAuthoring':True})
        data['walkable']=[a for a in data['walkable'] if a['label']!='Representative linked platform']
        data['representativePlatform']['deprecatedPhase2']=True
        data['representativePlatform']['runtimeStatus']='Replaced by model-railway.glb and railway-manifest.json; not exported by this build'
    data['historicalMural']={'material':'GuerinMuralField6','location':'North end only','source':'LOC det.4a23713','status':'Mechanical monochrome photographic recovery; original colour and official title unverified. Other five fields stay neutral.'}
    data['glazing']={'thermalPaneCount':8,'physicalThickness':.006,'exteriorDuplicateSheets':False,'thicknessStatus':'Reconstructed glass thickness, not an authenticated surviving pane measurement'}
    data['contactAudit']={'file':'architecture-contact-audit.json','checks':len(contacts['contacts']) if contacts else None,'failures':len(contacts['failures']) if contacts else None,'scope':'Registered visible architectural bearing chains; assembled floor/railway intersections checked separately'}
    data['reconstructed'].extend(['Street wings closed with source-based solid roof ring, recessed attic bodies and genuine eastern open courts above street-level train-shed glazing','Single physical thermal glass sheets with reconstructed6mm thickness; stone reveals exist on both sides','Raised north/south Ionic landings and central stairs traced from plate300; lowerfloor and ceiling extend to reported room planes','Botticino ticket/parcel fronts and telephone booth bays follow opening-era plan labels;1935 changes not certified','Paired16ft cast-iron gate indicator posts replace floating boards; timetable cards remain unassigned'])
    data['uncertain'].extend(['Francis143ft highest-ceiling datum adopted; Gibbs150ft ceiling narrative remains conflicting','Exact coffer count and360mm relief remain interpreted; nominal10ft module is documented by Gibbs255','Eastern street-level skylight pitch and exact room/roof registration are inferred, distinct from documented152ft8½x115ft6 plan dimensions','Detailed truss profiles and joint locations follow structural roles and primary photographs, not a full fabrication survey','Concourse perimeter backing remains unfinished: documented two-level gridded fenestration is not yet reconstructed','Concourse opaque floor-grid material is interpreted; Gibbs marble-floor list does not specifically identify this floor, and documented glass-prism vault-light fields remain unmodelled'])
    data['uncertain']=[text.replace('UpperwindowE421.25controlpassesclockcentres;exactglazingsilloffsetremainsphotographicwith31mlocalapproximation','Upper-window E421.25 control crosses circular base features; their identity and exact sill offset remain unverified; glazing uses31m local approximation') for text in data['uncertain']]
    data['concourseDetails']=CONCOURSE_DETAIL_REPORT
    data['concourseDetails']['floorCoverageRevision']=3
    data['concourseDetails']['bodyHeadSeparationStatus']='West and north/south rectangular grid bodies are separated from high arched lights by opaque masonry;1936 west photograph corroborates this vocabulary. The remaining elevations and minor dimensions are reconstructed.'
    data['furnishingFinish']={'revision':4,'ticketOffice':'Photograph-led finer bronze grilles, real base-vent holes and supported Botticino lettering friezes; exact bar counts and profiles reconstructed','benches':{'count':12,'seatPlanksEach':5,'backSlatsEach':29,'supportedFramesEach':3,'placementStatus':'Existing reconstructed row locations retained; minor profiles and seating inventory not independently certified for1935'},'exteriorClock':'Smoother bezel/dial and60minuteindices; previous case/dial extent retained. Gibbs6ft/PRR7ft exterior description conflict remains unresolved; fixed hand time is interpreted.','interiorClockLimit':'No15ft waiting-room clock or duplicated circular clocks added at an unverified position.','muralLimit':'North mural remains the source-faithful728x260 photographic rectification from the original5076x4061 LOC scan; interpolation is not claimed as newly recovered detail. Other five fields stay neutral.'}
    data['uncertain']=[item for item in data['uncertain'] if not item.startswith(('Concourse perimeter backing remains unfinished:','Concourse opaque floor-grid material is interpreted;'))]
    data['uncertain'].extend(['Concourse window dimensions, sash counts, reveals, lower office frontage and minor profiles are photographic reconstructions, not a complete fabrication survey','Broad visible central open-court square-prism flooring is reconstructed from documented construction and photograph/plan registration; precise extent,pitch,module and underside mould profile remain inferred, with concrete circulation/bearing zones retained','Concourse opaque floor material remains interpreted; the marble-room list does not specifically identify the concourse','Finer booth/bench profiles and exact furnishing inventory by1935 remain unverified; interior clock placement is not invented'])
    return data

manifest=finalise_phase3_manifest(manifest,ARGS.legacy_platform,CONTACT_REPORT)
(ASSETS/"scene-manifest.json").write_text(json.dumps(manifest,indent=2))
print("Blender authoring complete",flush=True)
