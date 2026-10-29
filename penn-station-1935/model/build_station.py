"""Pennsylvania Station: evidence-led architectural study, model revision 1.

Run with Blender 4.3's official bpy distribution (see README).
The browser never creates the architectural geometry. Units are metres.
Blender axes: X east, Y north, Z up. glTF export maps Y north to -Z.
"""
from pathlib import Path
import json, math, random, sys
import bpy
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ASSETS.mkdir(exist_ok=True)
FT = .3048
L, W = 784 * FT, 430 * FT
HALL_W, HALL_L, HALL_H = 103 * FT, 277 * FT, 150 * FT
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
LIMESTONE = stone("Travertine", (.62, .60, .55), 11)
FLOOR = stone("TennesseeMarble", (.49, .46, .40), 12)
PALE = mat("PaleVaultPlaster", (.73, .70, .62), .87)
SHADOW = mat("CofferRecess", (.48, .46, .40), .9)
IRON = mat("PaintedStructuralIron", (.13, .145, .145), .45, .55)
BRONZE = mat("AgedBronze", (.19, .14, .085), .47, .65)
GLASS = mat("HistoricGlass", (.37, .49, .49), .23, .22)
gp = GLASS.node_tree.nodes.get("Principled BSDF")
gp.inputs["Alpha"].default_value = .28
GLASS.surface_render_method = "DITHERED"
LIGHT_GLASS = mat("LunetteGlazing", (.58, .67, .66), .24, .1)
gp = LIGHT_GLASS.node_tree.nodes.get("Principled BSDF")
gp.inputs["Emission Color"].default_value = (.55, .67, .71, 1)
gp.inputs["Emission Strength"].default_value = .4
WOOD = mat("WalnutBench", (.14, .075, .038), .55)
ASPHALT = mat("StreetPaving", (.16, .17, .17), .93)
PAVING = mat("SidewalkStone", (.40, .40, .37), .9)
BRICK = [mat("ContextBrick" + str(i), rgb) for i, rgb in enumerate([(.23,.14,.11),(.34,.26,.20),(.40,.32,.24),(.27,.26,.23)])]
WINDOW = mat("ContextWindow", (.09,.125,.135), .3, .15)
BLACK = mat("Lettering", (.055,.06,.055), .7)
WHITE = mat("ClockFace", (.82,.79,.68), .65)

def box(name, center, scale, material, bevel=0):
    x,y,z=center
    a,b,c=[s/2 for s in scale]
    verts=[(x+sx*a,y+sy*b,z+sz*c) for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]]
    return mesh(name,verts,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],material)

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
    rows,cols=16,8
    radial=Vector((math.cos(angle),math.sin(angle),0))
    tangent=Vector((-math.sin(angle),math.cos(angle),0))
    for iy in range(rows+1):
        t=iy/rows
        width=.43*max(0,math.sin(math.pi*t))**.7*(1+.18*math.cos(8*math.pi*t))
        radius=.80+.35*t+.24*t**4
        z=.12+rank*.85+1.35*t-.28*t**8
        for ix in range(cols+1):
            s=-1+2*ix/cols
            ridge=.10*(1-s*s)*math.sin(math.pi*t)
            p=Vector(center)+radial*(radius+ridge)+tangent*(s*width)+Vector((0,0,z))
            verts.append(tuple(p))
    for iy in range(rows):
        for ix in range(cols):
            k=iy*(cols+1)+ix
            faces.append((k,k+1,k+cols+2,k+cols+1))
    leaf=mesh("Curved lobed acanthus leaf",verts,faces,LIMESTONE)
    for p in leaf.data.polygons:p.use_smooth=True
    return leaf

def arch(name, center, radius, depth, material, axis="X", start=0, end=math.pi, width=.35, steps=48, rise=None):
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
    return mesh(name,verts,faces,material)

def lunette(name, center, radius, material, axis="X", grid=True):
    verts=[center]
    for i in range(65):
        a=i*math.pi/64
        q=(0,math.cos(a)*radius,math.sin(a)*radius) if axis=="X" else (math.cos(a)*radius,0,math.sin(a)*radius)
        verts.append(tuple(center[k]+q[k] for k in range(3)))
    mesh(name,verts,[(0,i+1,i+2) for i in range(64)],material)
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
    for i,(w,h) in enumerate([(1.25,.40),(1.70,.28),(1.90,.18),(2.1,.23),(1.6,.24)]):
        dims=(w,length,h) if axis=="Y" else (length,w,h)
        box(name+str(i),(center[0],center[1],height+i*.22),dims,material)

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
    COL=col
    groups={}
    for o in list(col.objects):
        if o.type!="MESH" or o.hide_render or o.modifiers: continue
        material=o.data.materials[0] if o.data.materials else None
        groups.setdefault(material,[]).append(o)
    for material,objects in groups.items():
        verts=[];faces=[];smooth=[];uvs=[]
        for o in objects:
            offset=len(verts)
            matrix=o.matrix_world
            verts.extend(tuple(matrix@v.co) for v in o.data.vertices)
            for poly in o.data.polygons:
                faces.append(tuple(offset+i for i in poly.vertices))
                smooth.append(poly.use_smooth)
                uv_layer=o.data.uv_layers.active
                uvs.extend(tuple(uv_layer.data[i].uv) if uv_layer else (0,0) for i in poly.loop_indices)
        joined=mesh(col.name+" — "+(material.name if material else "default"),verts,faces,material)
        for i,p in enumerate(joined.data.polygons): p.use_smooth=smooth[i]
        for i,uv in enumerate(uvs): joined.data.uv_layers.active.data[i].uv=uv
        for o in objects: bpy.data.objects.remove(o,do_unlink=True)
    print("Batched",col.name,"to",len(col.objects),"objects",flush=True)

# ---------- Exterior: plate 300/301/309, nominal published footprint ----------
print("Building exterior architectural meshes",flush=True)
EXTERIOR=collection("01 Exterior and context")
box("Station stylobate",(0,0,-.35),(L,W,.7),GRANITE,.06)
box("Street field",(0,0,-.62),(530,390,.3),ASPHALT)
# Sidewalks outline both long and short block edges; no modern road paint.
for sy in [-1,1]:
    box("31st33rd sidewalk",(0,sy*(W/2+3),-.20),(L+13,6,.4),PAVING)
for sx in [-1,1]:
    box("Avenue sidewalk",(sx*(L/2+3),0,-.20),(6,W+13,.4),PAVING)

# Street-front shell only: courts and passenger interiors are not filled solids.
for sy in [-1,1]:
    box("Long perimeter wall",(0,sy*(W/2-1),6.9),(L,1.4,13.8),GRANITE)
    cornice("Long street cornice",(0,sy*(W/2-.7)),L,axis="X")
    for xx in np.linspace(-113,113,52):
        # Rusticated horizontal courses and ashlar end joints are true geometry.
        for z in [1.1,3.4,6.3,10.0]:
            box("Long facade inset window",(float(xx),sy*(W/2+.015),z+1),(1.3,.05,1.75),WINDOW)
    # Side colonnades occupy central 230 feet, between the carriage courts.
    for xx in np.linspace(-35.05,35.05,17):
        pass

for sx in [-1,1]:
    # Avenue walls behind porticos.
    for y0,width in [(-42,41),(42,41),(-10,9),(10,9)]:
        box("Avenue wall bay",(sx*(L/2-4.5),y0,6.6),(2.1,width,13.2),GRANITE)
    cornice("Avenue entablature",(sx*(L/2-1),0),W)
    # Repeated tall rectangular fenestration.
    for yy in np.linspace(-59,59,29):
        if abs(yy)<5: continue
        box("Avenue dark window",(sx*(L/2-3.38),float(yy),6.8),(.07,1.7,5.0),WINDOW)
        for z in [4.2,9.35]:
            box("Avenue window stone sill",(sx*(L/2-3.1),float(yy),z),(.5,2.15,.23),GRANITE)
        box("Avenue upper window",(sx*(L/2-3.38),float(yy),11.3),(.07,1.7,1.8),WINDOW)

# Exterior Doric order: 35 ft column including base/capital, 4 ft 6 in dia.
profile=[(0,.80),(.18,.82),(.35,.76),(.45,.686),(2.0,.680),(5.0,.645),(8.8,.586),(9.5,.565),(9.75,.59),(9.85,.72),(10.05,.82),(10.18,.91),(10.34,.91),(10.44,.83),(10.668,.83)]
doric=lathe("Doric column master — 35ft",profile,GRANITE,40)
doric.hide_render=True
doric.location=(0,0,0)
eastpoints=[]
# Elevation plate301: central hexastyle entrance and side colonnades,
# extra rear row belongs only to central portico and carriage gateways.
for yy in [-10.0,-6,-2,2,6,10]:
    eastpoints.extend([(L/2-.86,yy,.3),(L/2-4.6,yy,.3)])
for sy in [-1,1]:
    for yy in [18,22,26,30,34,38,42,46,50]:
        eastpoints.append((L/2-.86,sy*yy,.3))
    for yy in [55,59,63]:
        eastpoints.extend([(L/2-.86,sy*yy,.3),(L/2-4.6,sy*yy,.3)])
geometry_node_row("Seventh Avenue Doric colonnade",doric,eastpoints)
sidepoints=[]
for sy in [-1,1]:
    sidepoints.extend([(float(xx),sy*(W/2-.86),.3) for xx in np.linspace(-35.05,35.05,17)])
geometry_node_row("230ft side colonnades",doric,sidepoints)
# Eighth Avenue is primarily pilasters, not a copy of Seventh Avenue.
for yy in np.linspace(-62,62,32):
    if abs(yy)<7: continue
    box("Eighth Avenue Doric pilaster",(-L/2+.7,float(yy),5.65),(1.35,1.35,10.7),GRANITE)
    box("Eighth pilaster capital",(-L/2+.5,float(yy),10.65),(1.7,1.7,.52),GRANITE)
for yy in [-6.7,-2.23,2.23,6.7]:
    copy_obj(doric,"Eighth central portico column",(-L/2+.86,yy,.3))

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
box("Flat central clock attic",(L/2-2.6,0,17.2),(5.8,6.7,6.0),GRANITE)
cornice("Clock attic crowning cornice",(L/2-2.6,0),7.2,height=20.0)
# The seven-foot dial is centred61ft above the pavement in the PRR description.
clockz=61*FT
beam("Clock bronze bezel",(L/2+.31,0,clockz),(L/2+.56,0,clockz),3.5*FT,BRONZE,64)
beam("Clock stone face",(L/2+.57,0,clockz),(L/2+.60,0,clockz),3.25*FT,WHITE,64)
for k in range(12):
    angle=math.pi/2-k*math.pi/6
    r0=.78;r1=.90
    beam("Clock hour mark",(L/2+.64,r0*math.cos(angle),clockz+r0*math.sin(angle)),(L/2+.64,r1*math.cos(angle),clockz+r1*math.sin(angle)),.025,BLACK)
beam("Clock minute hand",(L/2+.67,0,clockz),(L/2+.67,.10,clockz+.76),.025,BLACK)
beam("Clock hour hand",(L/2+.69,0,clockz),(L/2+.69,.52,clockz-.26),.034,BLACK)

# Arcade: 225 by45ft. Axis is E–W; flanking carriage drives remain open.
for sy in [-1,1]:
    box("Arcade shop wall",(67,sy*7.2,5.7),(68.58,1,11.4),GRANITE)
    box("Arcade shop roof",(67,sy*17.8,10.9),(68.58,20,1.2),GRANITE)
box("Arcade roof",(67,0,12),(68.58,14.7,1.0),GRANITE)
for xx in np.arange(35,102,5.1):
    for sy in [-1,1]:
        box("Arcade storefront",(float(xx),sy*6.65,3.4),(3.1,.08,5.0),WINDOW)
        box("Arcade pilaster",(float(xx)-2,sy*6.2,4.8),(.55,.6,9.6),GRANITE)
box("Arcade paving",(67,0,-.10),(69,14,.2),FLOOR)

# Massive main-room volume: actual windows and interior are separate asset.
for sx in [-1,1]:
    # The monumental waiting hall is a masonry volume, not an open pavilion.
    # Its lower shell is mostly concealed by adjacent lower accommodation.
    box("Waiting exterior continuous masonry shell",(sx*17.6,0,15.5),(3.6,92.5,31.0),GRANITE)
    for yy in [-44.6,-14.07,14.07,44.6]:
        box("Waiting exterior great pier",(sx*17.6,yy,25.7),(3.6,4.9,38.0),GRANITE)
    box("Waiting exterior clerestory spandrel",(sx*17.6,0,28.3),(3.6,92.5,3.2),GRANITE)
    cornice("Great hall exterior cornice",(sx*17.6,0),95,height=43.6)
    for yy in [-28.14,0,28.14]:
        lunette("Exterior thermal window",(sx*19.43,yy,31.0),10.16,GLASS)
    # Upper spandrel wall above windows. Individual strips avoid black box mass.
    for yy in np.arange(-44,44,1.5):
        nearest=min([-28.14,0,28.14],key=lambda t:abs(t-yy))
        d=abs(float(yy)-nearest)
        lower=31+math.sqrt(max(0,10.16**2-d*d)) if d<10.16 else 31
        if lower<43.8:
            box("Granite thermal-window upper spandrel",(sx*18.1,float(yy),(lower+43.8)/2),(2.7,1.52,43.8-lower),GRANITE)
for sy in [-1,1]:
    box("Waiting end exterior continuous masonry shell",(0,sy*47.1,15.5),(36,2.8,31),GRANITE)
    box("Waiting end exterior lintel",(0,sy*47.1,28.2),(36,2.8,3.0),GRANITE)
    for xx in [-15,15]: box("Waiting end exterior pier",(xx,sy*47.1,22),(6,2.8,43),GRANITE)
    lunette("Waiting end thermal window",(0,sy*48.52,31),10.16,GLASS,axis="Y")
    cornice("Waiting end cornice",(0,sy*47.1),39,axis="X",height=43.6)
    for xx in np.arange(-18,18,1.5):
        lower=31+math.sqrt(max(0,10.16**2-float(xx)**2)) if abs(xx)<10.16 else 31
        if lower<43.8:
            box("Waiting end upper masonry spandrel",(float(xx),sy*47.1,(lower+43.8)/2),(1.52,2.8,43.8-lower),GRANITE)
# Pitched lead roof; three transverse ridges follow triple vaulted volume.
for j in [-1,0,1]:
    y=j*28.14
    lo=y-14.1-(5.3 if j==-1 else 0)
    hi=y+14.1+(5.3 if j==1 else 0)
    verts=[(-20,lo,44.6),(20,lo,44.6),(0,lo,47),(-20,hi,44.6),(20,hi,44.6),(0,hi,47)]
    mesh("Lead roof bay",verts,[(0,1,2),(3,5,4),(0,2,5,3),(2,1,4,5)],IRON)

# Context perimeter: deliberately unsigned, plausible low-rise period massing.
for sy in [-1,1]:
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
for sx in [-1,1]:
    for i,yy in enumerate(range(-85,100,18)):
        height=RNG.choice([18,23,28,33])
        xx=sx*(L/2+47)
        m=BRICK[i%4]
        box("Unverified avenue context mass",(xx,yy,height/2),(22,17,height),m)
        for zz in np.arange(2.5,height-1,3.7):
            for dy in [-5,0,5]:
                box("Context avenue window",(xx-sx*11.03,yy+dy,float(zz)),(.06,1.7,2.3),WINDOW)

# Restrained decorative cast-iron street standards (not surveyed positions).
for xx in [-111,-70,-30,30,70,111]:
    for sy in [-1,1]:
        yy=sy*(W/2+4)
        post=lathe("Period streetlamp",[(0,.24),(.25,.27),(.55,.15),(4.1,.075),(4.3,.13)],IRON,16)
        post.location=(xx,yy,0)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.28,location=(xx,yy,4.48))
        lamp=move(bpy.context.object);lamp.name="Streetlamp opal globe";lamp.data.materials.append(WHITE)

# ---------- Waiting room: monumental fluted order and intersecting vaults ----------
print("Building waiting room architectural meshes",flush=True)
HALL=collection("02 Main waiting room")
box("Waiting room clear floor",(0,0,-.20),(HALL_W,HALL_L,.4),FLOOR)
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
        box("Waiting room continuous side backing",(sx*17.1,sy*25.7,15.5),(1.2,38.6,31.0),LIMESTONE)
    box("Waiting axial portal header",(sx*17.1,0,20.8),(1.2,12.8,20.4),LIMESTONE)
    for yy in [-42.216,-14.072,14.072,42.216]:
        box("Great pier",(sx*16.55,yy,14.3),(2.2,6.0,28.6),LIMESTONE)
    box("Thermal-window springing band",(sx*16.6,0,29.6),(2.4,90,2.2),LIMESTONE)
    for yy in [-28.144,0,28.144]:
        arch("Great lower wall arch",(sx*15.42,yy,14.8),LOWER_ARCH_RADIUS,.8,LIMESTONE,width=1.25)
        # Recessed tympanum and window in arch, not an invented passage.
        lunette("Inner arch tympanum",(sx*16.12,yy,14.7),LOWER_ARCH_RADIUS-.6,LIMESTONE,grid=False)
        for yside in [-LOWER_ARCH_RADIUS+.4,LOWER_ARCH_RADIUS-.4]:
            box("Arch jamb",(sx*15.7,yy+yside,7.4),(.85,1.1,14.8),LIMESTONE)
        # Central east-west circulation passage: true opening at the axial bay.
        if yy != 0:
            box("Ticket window wall",(sx*16.08,yy,6.4),(.85,19.2,12.8),LIMESTONE)
            for dy in [-7.4,-4.9,-2.4,.1,2.6,5.1,7.6]:
                box("Ticket grille opening",(sx*15.62,yy+dy,2.15),(.08,1.65,2.0),BRONZE)
                for dz in [1.3,2.1,2.8]:
                    box("Ticket grille crossbar",(sx*15.56,yy+dy,dz),(.08,1.7,.045),IRON)
                for p in [-.6,-.3,0,.3,.6]:
                    box("Ticket grille upright",(sx*15.54,yy+dy+p,2.15),(.08,.025,1.8),IRON)
            text("Ticket bureau lettering","T I C K E T S",(sx*15.53,yy,3.65),.38,BLACK,
                (math.pi/2,0,math.pi/2 if sx>0 else -math.pi/2))
        for ystep in [yy-4.75,yy+4.75]:
            # Secondary order on the screen wall.
            small=lathe("Secondary interior order",[(0,.26),(.15,.33),(.30,.26),(10.2,.23),(10.4,.38),(10.6,.38)],LIMESTONE,20)
            small.location=(sx*15.1,ystep,.3)
        lunette("Main room Diocletian window",(sx*15.49,yy,31.0),10.16,LIGHT_GLASS)
        # Horizontal stone window sill.
        box("Thermal window sill",(sx*15.6,yy,31.05),(1.0,20.9,.46),LIMESTONE)
    for yy in np.arange(-43.5,44,1):
        near=min([-28.144,0,28.144],key=lambda v:abs(v-yy))
        distance=abs(float(yy)-near)
        lower=31+math.sqrt(max(0,10.16**2-distance**2)) if distance<10.16 else 31
        if lower<HALL_H:
            box("Waiting upper spandrel",(sx*16.45,float(yy),(lower+HALL_H)/2),(1.8,1.03,HALL_H-lower),LIMESTONE)
    box("Interior architrave and frieze",(sx*14.8,0,INTERIOR_ORDER_TOP+1.5),(2.0,HALL_L+4,3.0),LIMESTONE)
    cornice("Interior long entablature",(sx*14.8,0),HALL_L+4,height=INTERIOR_ORDER_TOP+INTERIOR_ENTABLATURE-1.0,material=LIMESTONE)

# Interior colossal Corinthian order: eight columns. Capitals are disclosed abstractions.
corinth=lathe("Fluted Corinthian shaft master",[(0,1.18),(.18,1.28),(.50,1.13),(.8,1.03),(INTERIOR_BASE,1.0),(4.2,.98),(9,.93),(14.4,.86),(INTERIOR_BASE+INTERIOR_SHAFT,.81)],LIMESTONE,144,24)
corinth.location=(0,0,-100)
corinth.hide_render=True
for sx in [-1,1]:
    for yy in [-42.216,-14.072,14.072,42.216]:
        copy_obj(corinth,"Colossal fluted interior column",(sx*14.2,yy,INTERIOR_PEDESTAL))
        box("Colossal column plinth",(sx*14.2,yy,INTERIOR_PEDESTAL/2),(3.3,3.3,INTERIOR_PEDESTAL),LIMESTONE,.06)
        # Capital core and two ranks of curved, abstracted acanthus leaves.
        cap_start=INTERIOR_PEDESTAL+INTERIOR_BASE+INTERIOR_SHAFT
        cap=lathe("Corinthian capital bell",[(0,.81),(.22,.84),(.8,1.04),(1.8,1.23),(2.25,1.38),(INTERIOR_CAPITAL,1.38)],LIMESTONE,32)
        cap.location=(sx*14.2,yy,cap_start)
        box("Corinthian abacus",(sx*14.2,yy,INTERIOR_ORDER_TOP-.10),(3.0,3.0,.20),LIMESTONE,.04)
        for rank in [0,1]:
            for k in range(8):
                a=(k+rank*.5)*math.pi/4
                capital_leaf((sx*14.2,yy,cap_start),a,rank)

# Wall masonry coursing and panel outlines.
for sx in [-1,1]:
    for yy in [-42.216,-14.072,14.072,42.216]:
        for z in np.arange(3,26,1.55):
            box("Pier ashlar joint",(sx*15.40,yy,float(z)),(.016,5.8,.025),SHADOW)

# End walls: lower colonnade screen and high single semicircular thermal window.
for sy in [-1,1]:
    box("Waiting end continuous masonry backing",(0,sy*44.8,15.5),(31.4,1.2,31.0),LIMESTONE)
    for x in [-14.2,14.2]:
        box("Hall end pier",(x,sy*43.6,15),(3.1,2.4,30),LIMESTONE)
    for x in [-9.5,-6.7,-3.9,3.9,6.7,9.5]:
        c=lathe("End screen order",[(0,.43),(.2,.54),(.4,.43),(10.7,.36),(10.9,.57),(11.2,.57)],LIMESTONE,32,20)
        c.location=(x,sy*42.6,.3)
    box("End screen entablature",(0,sy*42.9,12.05),(25.5,1.3,1.0),LIMESTONE)
    box("End blind wall above screen",(0,sy*43.5,21.65),(28.5,1.7,17.5),LIMESTONE)
    lunette("End Diocletian window",(0,sy*42.52,31.0),10.16,LIGHT_GLASS,axis="Y")
    box("End lunette sill",(0,sy*42.5,31.0),(21,1,.44),LIMESTONE)
    cornice("End great cornice",(0,sy*42.3),HALL_W,axis="X",height=INTERIOR_ORDER_TOP+INTERIOR_ENTABLATURE-1.0,material=LIMESTONE)
    # Upper end spandrels hugging the lunette shape.
    for x in np.arange(-15.5,16,1):
        lower=31+math.sqrt(max(0,10.16**2-float(x)**2)) if abs(x)<10.16 else 31
        if lower<HALL_H: box("End upper spandrel",(float(x),sy*43.0,(lower+HALL_H)/2),(1.03,1.7,HALL_H-lower),LIMESTONE)

spring=30.35
rise=HALL_H-spring
a=HALL_W/2
b=HALL_L/6
def vault_z(x,y):
    return spring+rise*max(math.sqrt(max(0,1-(x/a)**2)),math.sqrt(max(0,1-(y/b)**2)))
for j in [-1,0,1]:
    cy=j*HALL_L/3
    n=36;verts=[];faces=[]
    for iy in range(n+1):
        y=-b+2*b*iy/n
        for ix in range(n+1):
            x=-a+2*a*ix/n
            verts.append((x,cy+y,vault_z(x,y)))
    for iy in range(n):
        for ix in range(n):
            k=iy*(n+1)+ix
            faces.append((k,k+n+1,k+n+2,k+1))
    mesh("Intersecting groin vault bay",verts,faces,PALE)
    # Geometric coffer recesses follow each vaulted quadrant, rather than flat boxes.
    grid=14
    for iy in range(grid):
        for ix in range(grid):
            x0=-a+(ix+.13)*2*a/grid;x1=-a+(ix+.87)*2*a/grid
            y0=-b+(iy+.13)*2*b/grid;y1=-b+(iy+.87)*2*b/grid
            pts=[(x,cy+y,vault_z(x,y)-.09) for x,y in [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]]
            mesh("Coffered vault recessed panel",pts,[(3,2,1,0)],SHADOW)
    # Transverse arch ribs are modelled with the same vault section.
    for sy in [-1,1]:
        arch("Vault transverse molded rib",(0,cy+sy*b,spring-.3),a,.8,LIMESTONE,axis="Y",width=.45,rise=rise)

# Period screen benches, lamps and clocks: positions approximate, documented.
for sx in [-1,1]:
    for yy in [-33,-23,-5,5,23,33]:
        xx=sx*10.7
        box("Waiting bench seat",(xx,yy,.53),(1.15,4.2,.15),WOOD,.03)
        box("Waiting bench back",(xx+sx*.46,yy,.97),(.14,4.2,.75),WOOD,.025)
        for dy in [-1.65,1.65]:
            box("Cast iron bench leg",(xx,yy+dy,.24),(.82,.12,.48),IRON)
            box("Bench arm",(xx,yy+dy,.83),(.90,.1,.10),IRON)
for sx in [-1,1]:
    for yy in [-33,-11,11,33]:
        xx=sx*6.4
        box("Lamp marble pedestal",(xx,yy,.75),(1.35,1.35,1.5),LIMESTONE,.04)
        lamp=lathe("Bronze waiting room standard",[(0,.28),(.25,.34),(.5,.18),(3.8,.10),(4.05,.28)],BRONZE,24)
        lamp.location=(xx,yy,1.5)
        for dx,dy in [(0,0),(.55,0),(-.55,0),(0,.55),(0,-.55)]:
            beam("Lamp arm",(xx,yy,5.15),(xx+dx,yy+dy,5.5),.055,BRONZE)
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=.22 if dx or dy else .29,location=(xx+dx,yy+dy,5.7))
            o=move(bpy.context.object);o.name="Opal lamp globe";o.data.materials.append(WHITE)

# Central stair flights provide the circulation cue; precise riser count is phase2.
for sx in [-1,1]:
    for k in range(13):
        x=sx*(15.6+k*.32)
        box("Great stair tread",(x,0,(12-k)*.145+.04),(.34,12.04,.16),LIMESTONE)

# ---------- Train concourse: steel, glass, intersecting roof bays ----------
print("Building concourse structural meshes",flush=True)
CONCOURSE=collection("03 Glass and iron concourse")
CX=-73
CW,CL=59,98
box("Concourse stone floor",(CX,0,-.22),(CW,CL,.44),FLOOR)
for xx in np.arange(CX-CW/2,CX+CW/2,2):
    box("Concourse floor joint",(float(xx),0,.008),(.025,CL,.015),SHADOW)

# Western subsidiary hall between waiting room and concourse.
for sy in [-1,1]:
    box("Subsidiary waiting room floor",(-30,sy*27,-.11),(23,37,.22),FLOOR)
    box("Subsidiary room wall",(-30,sy*45.4,6),(23,1,12),GRANITE)
    box("Subsidiary room roof",(-30,sy*27,12),(23,38,.6),GRANITE)
    box("Subsidiary room inner wall",(-30,sy*8.2,6),(23,1,12),LIMESTONE)
box("Axial passage to concourse",(-30,0,-.10),(28,15.5,.2),FLOOR)
for sy in [-1,1]: box("Passage entablature",(-30,sy*8,11),(28,1,.8),LIMESTONE)

def roofpoint(x,y):
    # Three transverse groin-vault bays, approximated from monograph photo.
    localy=((y+CL/2)%(CL/3))-CL/6
    return 15.2+12.4*max(math.sqrt(max(0,1-((x-CX)/(CW/2))**2)),math.sqrt(max(0,1-(localy/(CL/6))**2)))

# Iron supports, arch trusses and subordinate glazing bars.
for xx in [CX-CW/2,CX,CX+CW/2]:
    for yy in [-49,-CL/6,CL/6,49]:
        beam("Concourse built-up pier",(xx,yy,0),(xx,yy,15.2),.32,IRON,12)
        for z in np.arange(1,15,1.6):
            box("Pier lattice collar",(xx,yy,float(z)),(.9,.8,.12),IRON)
for yy in np.linspace(-CL/2,CL/2,13):
    pts=[]
    for i in range(49):
        x=CX-CW/2+CW*i/48
        pts.append((x,float(yy),roofpoint(x,float(yy))))
    for i in range(48):
        beam("Transverse arch rib",pts[i],pts[i+1],.13,IRON)
        # Lower chord and cross bracing produce true structural depth.
        p=pts[i];q=pts[i+1]
        beam("Arch lower chord",(p[0],p[1],p[2]-.8),(q[0],q[1],q[2]-.8),.065,IRON)
        if i%2==0: beam("Arch truss diagonal",p,(q[0],q[1],q[2]-.8),.037,IRON,6)
for xx in np.linspace(CX-CW/2,CX+CW/2,19):
    pts=[]
    for i in range(85):
        y=-CL/2+CL*i/84
        pts.append((float(xx),y,roofpoint(float(xx),y)))
    for i in range(84): beam("Longitudinal glazing bar",pts[i],pts[i+1],.046,IRON,6)
verts=[];faces=[]
nx,ny=36,60
for iy in range(ny+1):
    y=-CL/2+CL*iy/ny
    for ix in range(nx+1):
        x=CX-CW/2+CW*ix/nx
        verts.append((x,y,roofpoint(x,y)+.07))
for iy in range(ny):
    for ix in range(nx):
        k=iy*(nx+1)+ix
        faces.append((k,k+1,k+nx+2,k+nx+1))
mesh("Concourse glazed intersecting roof",verts,faces,GLASS)
# Glazed end elevations.
for sy in [-1,1]:
    for xx in np.linspace(CX-CW/2,CX+CW/2,25):
        beam("Concourse end glazing upright",(float(xx),sy*CL/2,8),(float(xx),sy*CL/2,roofpoint(float(xx),sy*CL/2)),.055,IRON)
    for z in [8,11,14,17,20]:
        beam("Concourse end glazing transom",(CX-CW/2,sy*CL/2,z),(CX+CW/2,sy*CL/2,z),.05,IRON)

# Five platform-access wells are illustrative, not a verified complete track plan.
for yy in [-38,-19,0,19,38]:
    xx=CX-6
    # Black stair well suggests access without misrepresenting as full track levels.
    box("Platform stair opening — simplified",(xx,yy,.013),(9,5,.03),BLACK)
    for sy in [-1,1]:
        for k in range(11):
            box("Platform stair descending tread",(xx-4.3+k*.4,yy,.02-k*.15),(.42,4.4,.14),LIMESTONE)
        for dx in np.arange(-4.4,4.6,1.1):
            beam("Platform well balustrade upright",(xx+float(dx),yy+sy*2.6,0),(xx+float(dx),yy+sy*2.6,1.15),.033,BRONZE)
        beam("Platform well handrail",(xx-4.5,yy+sy*2.6,1.15),(xx+4.5,yy+sy*2.6,1.15),.044,BRONZE)
    # Signboard only says TRACKS; no invented timetable or exact track number.
    box("Concourse hanging sign",(xx+7,yy,3.2),(.18,3.3,.75),BLACK)
    text("Concourse sign lettering","TRACKS",(xx+7.11,yy,3.0),.32,WHITE)

# ---------- Scene metadata and portable delivery ----------
bpy.context.scene.unit_settings.system="METRIC"
bpy.context.scene.unit_settings.scale_length=1
bpy.context.scene.world.color=(.65,.7,.8)
for o in bpy.data.objects:
    if o.type=="MESH":
        o["reconstruction_phase"]="1 architectural study"
        # Keep materials readable from the inside where a historic shell is thin.
        for m in o.data.materials:
            m.use_backface_culling=False

# The source preserves actual Geometry Nodes; GLB export realizes their outputs.
print("Batching static surfaces by material",flush=True)
bpy.context.view_layer.update()
for col in [EXTERIOR,HALL,CONCOURSE]: batch_static(col)
for data in list(bpy.data.meshes):
    if data.users==0: bpy.data.meshes.remove(data)
print("Saving editable Blender source",flush=True)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/"model"/"penn-station-study.blend"),compress=True)
for name,col in [("model-exterior.glb",EXTERIOR),("model-waiting-room.glb",HALL),("model-concourse.glb",CONCOURSE)]:
    if "--hall-only" in sys.argv and col!=HALL: continue
    export(name,col)
    print(name,(ASSETS/name).stat().st_size,flush=True)

manifest={
    "revision":1,"units":"metres","axes":"X east, Y up, Z south (glTF)",
    "status":"Phase 1 architectural study; not a surveyed replica or a photoreal completed reconstruction",
    "dimensions":{"nominalFootprint":[L,W],"waitingRoomClear":[HALL_W,HALL_L,HALL_H],"exteriorDoricColumnHeight":35*FT,"exteriorDoricColumnDiameter":4.5*FT,"interiorColumn":{"pedestal":INTERIOR_PEDESTAL,"base":INTERIOR_BASE,"shaft":INTERIOR_SHAFT,"capital":INTERIOR_CAPITAL,"totalAboveFloor":INTERIOR_ORDER_TOP,"entablatureHeight":INTERIOR_ENTABLATURE},"lowerWallArchRadius":LOWER_ARCH_RADIUS},
    "assets":[{"file":"model-exterior.glb","zone":"exterior"},{"file":"model-waiting-room.glb","zone":"waiting"},{"file":"model-concourse.glb","zone":"concourse"}],
    "cameraPresets":{"exterior":{"position":[180,42,125],"target":[35,16,0]},"waiting":{"position":[0,2.0,34],"target":[0,22,-18]},"concourse":{"position":[-73,2.0,38],"target":[-73,18,-18]}},
    "walkable":[{"label":"Main waiting hall","bounds":[-12.4,12.4,-40,40],"floor":0},{"label":"Central arcade","bounds":[15,126,-5.4,5.4],"floor":0},{"label":"Axial concourse passage","bounds":[-45,-12,-5.4,5.4],"floor":0},{"label":"Concourse","bounds":[-100,-45,-46,46],"floor":0},{"label":"East sidewalk","bounds":[120,129,-69,69],"floor":0}],
    "obstacles":(
        [{"bounds":[-83.85,-74.15,y-2.85,y+2.85],"label":"Platform stairwell"} for y in [-38,-19,0,19,38]]
        +[{"bounds":[x-.9,x+.9,y-.9,y+.9],"label":"Waiting room lamp pedestal"} for x in [-6.4,6.4] for y in [-33,-11,11,33]]
        +[{"bounds":[x-.9,x+.9,y-2.4,y+2.4],"label":"Waiting room bench"} for x in [-10.7,10.7] for y in [-33,-23,-5,5,23,33]]),
    "verified":["277 by103ft clear waiting room;150ft floor-to-roof","Eight colossal interior columns, four per long side","Three semicircular high windows per long wall, one per end","Doric exterior columns35ft high and4ft6in diameter","Eighth Avenue predominantly pilasters","225 by45ft arcade","Main room east of concourse and west of entrance arcade"],
    "reconstructed":["Three groin-vault bays interpreted from plans and interior photographs","Coffer positions and depth","Corinthian capital leaves abstracted from plate308","Interior moulding profiles and ashlar joints","Benches and lamp positions","Concourse truss subdivisions and roof curvature","Simplified platform well placement; no complete track-level reconstruction","Unverified low-rise context massing"],
    "uncertain":["Published outside footprint conflicts784x430ft versus788ft9in x430ft6in","Exact room/street floor elevations and stair riser counts","Exact1935 alterations to ticketing and furnishings","Concourse glazing pane arrangement and structural member sections","Block-by-block Manhattan context survey and historic vehicles remain future phase","Granite/travertine PBR maps are original procedural approximations, not sampled historic materials","No baked global illumination or archival colour calibration in revision1"]
}
(ASSETS/"scene-manifest.json").write_text(json.dumps(manifest,indent=2))
print("Blender authoring complete",flush=True)
