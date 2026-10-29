"""Authored PRR rolling stock: unnumbered 1935+ production GG1 and P70 coaches.
Blender X east/longitudinal, Y north/transverse, Z up; glTF exports X east, Y up, Z south.
Wheel contact is local height0. Parent places the asset at the track datum.
See rolling-stock-research.md. Reference rasters are never embedded in the asset.
"""
from pathlib import Path
import argparse, json, math
import bpy
import numpy as np
from mathutils import Vector

parser=argparse.ArgumentParser()
parser.add_argument('--out',type=Path,default=Path('/private/tmp/penn-phase2-trains'))
parser.add_argument('--render',action='store_true')
args=parser.parse_args()
OUT=args.out.resolve();OUT.mkdir(parents=True,exist_ok=True)
FT=.3048
GG1_LENGTH=79.5*FT
GG1_WIDTH=(10+(4+3/16)/12)*FT
GG1_BODY_LENGTH=(76+(8+3/16)/12)*FT
GG1_DRIVER=57*.0254
GG1_CONTACT_ORIGIN=-30.0
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for col in list(bpy.data.collections):
    if col.name!='Collection':bpy.data.collections.remove(col)
COL=None
MASTERS=bpy.data.collections.new('00 reusable rolling stock kits');bpy.context.scene.collection.children.link(MASTERS)

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




def text(name,body,at,size,mat,rotation=None):
    font=bpy.data.curves.new(name,'FONT');font.body=body;font.size=size
    # Painted lettering is a flat silhouette, rather than thousands of bevel faces.
    font.align_x='CENTER';font.extrude=0;font.bevel_depth=0;font.resolution_u=2
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




def move_to_masters(col):
    for obj in list(col.objects):
        for c in list(obj.users_collection):c.objects.unlink(obj)
        MASTERS.objects.link(obj);obj.hide_render=True





def painted_metal(name,rgb,seed):
    mat=material(name,rgb,.37,.28)
    nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=nodes.get('Principled BSDF')
    n=1024;rng=np.random.default_rng(seed)
    grain=rng.normal(0,.004,(n,n)).astype(np.float32)
    for suffix in ['albedo','normal','roughness']:
        image=bpy.data.images.new(name+'_'+suffix,width=n,height=n)
        rgba=np.ones((n,n,4),dtype=np.float32)
        if suffix=='albedo':
            for k in range(3):rgba[:,:,k]=np.clip(rgb[k]+grain*.20,.002,1)
        elif suffix=='normal':
            micro=grain*.05
            if name.startswith('P70'):
                yy,xx=np.mgrid[:n,:n]
                for row in [1.38,1.83,3.48]:
                    dyrow=np.minimum(np.abs(yy-row*n/4),n-np.abs(yy-row*n/4))
                    dxr=np.mod(xx+64,128)-64
                    micro+=np.maximum(0,1-(dxr*dxr+dyrow*dyrow)/5.5)*.012
            dy,dx=np.gradient(micro)
            rgba[:,:,0]=.5-dx*.35;rgba[:,:,1]=.5-dy*.35;rgba[:,:,2]=.999
            image.colorspace_settings.name='Non-Color'
        else:
            for k in range(3):rgba[:,:,k]=.39+grain
            image.colorspace_settings.name='Non-Color'
        image.pixels.foreach_set(rgba.ravel());image.filepath_raw=str(OUT/(name.lower()+'-'+suffix+'.png'));image.file_format='PNG';image.save();image.pack()
        tex=nodes.new('ShaderNodeTexImage');tex.image=image
        if suffix=='normal':
            normal=nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=.12
            links.new(tex.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],p.inputs['Normal'])
        else:links.new(tex.outputs['Color'],p.inputs['Base Color' if suffix=='albedo' else 'Roughness'])
    return mat

GREEN=painted_metal('GG1DarkGreenLocomotiveEnamel',(.019,.035,.025),680)
TUSCAN=painted_metal('P70TuscanRedSteel',(.23,.045,.029),681)
GOLD=material('PeriodGoldLetteringAndWhiskers',(.54,.36,.095),.39,.62)
IRON=material('CastSteelRunningGear',(.045,.051,.049),.66,.62)
BLACK=material('BlackRoofAndDiaphragms',(.022,.025,.024),.79,.20)
STEEL=material('MachinedSteelWheelTreads',(.27,.29,.28),.30,.87)
GLASS=material('PeriodTrainGlazing',(.040,.081,.088),.16,.33)
CREAM=material('LampLensAndPorcelain',(.68,.67,.59),.34,.06)
COPPER=material('PantographContactCopper',(.28,.16,.075),.45,.76)
RED=material('TailMarkerRedLens',(.28,.015,.009),.23,.12)
SEAT=material('CoachUpholsteryInterpretation',(.07,.105,.065),.94)


def kit_instances(kit,name,position,angle=0):
    for master in kit:instance(master,name,position,angle)


def steel_wheel_kit(name,radius,spokes=12):
    col=collection(name)
    def ring(title,profile,mat):
        vertices=[];faces=[];segments=32
        for i in range(segments):
            a=i*math.tau/segments
            for depth,r in profile:vertices.append((r*math.cos(a),depth,r*math.sin(a)))
        n=len(profile)
        for i in range(segments):
            for k in range(n):faces.append((i*n+k,((i+1)%segments)*n+k,((i+1)%segments)*n+(k+1)%n,i*n+(k+1)%n))
        return mesh(title,vertices,faces,mat,True)
    # Annular sections preserve the opening around the spokes: no solid N-gon caps.
    ring('Wheel rolled steel tread',[(-.075,radius-.05),(-.07,radius),(.07,radius),(.085,radius-.05)],STEEL)
    ring('Wheel inward flange',[(-.09,radius-.08),(-.11,radius+.026),(-.08,radius+.026),(-.06,radius-.04)],IRON)
    hub=beam('Wheel central hub',(0,-.12,0),(0,.12,0),radius*.19,IRON,16)
    for i in range(spokes):
        a=i*math.tau/spokes
        beam('Cast wheel spoke',(radius*.14*math.cos(a),0,radius*.14*math.sin(a)),(radius*.94*math.cos(a),0,radius*.94*math.sin(a)),radius*.042,IRON,6)
    beam('Axle cap',(0,-.15,0),(0,.15,0),radius*.12,STEEL,16)
    bpy.context.view_layer.update();batch(col,name);kit=list(col.objects);move_to_masters(col)
    return kit


DRIVER=steel_wheel_kit('01 GG1 57inch spoked driver master',GG1_DRIVER/2,12)
SMALL_WHEEL=steel_wheel_kit('02 36inch pilot and coach wheel master',36*.0254/2,10)


def axle(kit,x,radius,name,transverse=.785):
    # Interpreted wheelset fit: full treads cover the1.4351m running gauge and
    # the inward flanges clear the actual authored railhead below its crown.
    kit_instances(kit,name+' left',(x,transverse,radius))
    # A half-turn mirrors the transverse wheel profile: both flanges face
    # inward toward the track centre rather than one flange facing outward.
    kit_instances(kit,name+' right',(x,-transverse,radius),math.pi)
    beam(name+' axle',(x,-transverse,radius),(x,transverse,radius),.075,IRON,16)


def coil(name,center,radius=.10,height=.32,turns=4):
    points=[]
    for i in range(turns*8+1):
        t=i/(turns*8);a=t*math.tau*turns
        points.append(Vector((center[0]+radius*math.cos(a),center[1]+radius*math.sin(a),center[2]+height*t)))
    vertices=[];faces=[]
    for i,p in enumerate(points):
        tangent=points[min(i+1,len(points)-1)]-points[max(0,i-1)]
        q=tangent.to_track_quat('Z','Y')
        for k in range(6):vertices.append(tuple(p+q@Vector((.018*math.cos(k*math.tau/6),.018*math.sin(k*math.tau/6),0))))
        if i:
            for k in range(6):faces.append(((i-1)*6+k,(i-1)*6+(k+1)%6,i*6+(k+1)%6,i*6+k))
    mesh(name,vertices,faces,IRON,True)


def shell_sections():
    # Smoothly shaped hoods with rounded ends and a raised central double cab.
    half=GG1_BODY_LENGTH/2;width=GG1_WIDTH/2
    return [(-half,.38,1.38,3.45),(-11.46,.88,1.26,3.73),(-11.05,1.29,1.22,3.90),(-10.4,1.47,1.20,3.95),(-8.5,1.55,1.20,3.74),(-5.1,1.55,1.20,3.28),(-4.15,1.56,1.20,3.28),(-3.5,width,1.20,4.28),(-2.0,width,1.20,4.28),(0,width,1.20,4.14),(2.0,width,1.20,4.28),(3.5,width,1.20,4.28),(4.15,1.56,1.20,3.28),(5.1,1.55,1.20,3.28),(8.5,1.55,1.20,3.74),(10.4,1.47,1.20,3.95),(11.05,1.29,1.22,3.90),(11.46,.88,1.26,3.73),(half,.38,1.38,3.45)]


def section_values(x):
    sections=shell_sections()
    for a,b in zip(sections,sections[1:]):
        if a[0]<=x<=b[0]:
            t=(x-a[0])/(b[0]-a[0]);return tuple(a[k]*(1-t)+b[k]*t for k in range(1,4))
    return sections[0][1:] if x<0 else sections[-1][1:]


def gg1_body():
    verts=[];faces=[];nx=104;around=32
    for i in range(nx+1):
        x=-GG1_BODY_LENGTH/2+GG1_BODY_LENGTH*i/nx;w,zlo,zhi=section_values(x)
        for k in range(around):
            a=math.tau*k/around
            y=w*math.copysign(abs(math.cos(a))**.56,math.cos(a))
            z=(zlo+zhi)/2+(zhi-zlo)/2*math.copysign(abs(math.sin(a))**.58,math.sin(a))
            verts.append((x,y,z))
    for i in range(nx):
        for k in range(around):
            n=(k+1)%around;faces.append((i*around+k,(i+1)*around+k,(i+1)*around+n,i*around+n))
    faces += [tuple(range(around-1,-1,-1)),tuple(nx*around+k for k in range(around))]
    return mesh('GG1 welded streamlined steel shell',verts,faces,GREEN,True)


def pantograph(center_x,raised):
    base=section_values(center_x)[2]+.25
    top=6.1 if raised else 4.572
    mid=(base+top)/2
    span=1.10 if raised else 1.65
    for x in [center_x-.60,center_x+.60]:
        for y in [-.55,.55]:
            ins=lathe('Porcelain pantograph insulator',[(0,.09),(.04,.13),(.08,.09),(.12,.13),(.16,.09),(.20,.13),(.24,.09)],CREAM,20)
            ins.location=(x,y,base-.24)
    for side in [-1,1]:
        y=side*.55
        pts=[(center_x,y,base),(center_x-span,y,mid),(center_x,y,top),(center_x+span,y,mid),(center_x,y,base)]
        polyline('Pantograph articulated diamond frame',pts,.042,IRON,12)
        beam('Pantograph cross spring',(center_x-.65,y,base+.10),(center_x+.65,y,base+.10),.032,IRON)
    for x,z in [(center_x,base),(center_x-span,mid),(center_x+span,mid),(center_x,top)]:beam('Pantograph transverse hinge',(x,-.61,z),(x,.61,z),.035,STEEL)
    for xx in [center_x-.13,center_x+.13]:beam('Copper contact bow',(xx,-.95,top),(xx,.95,top),.032,COPPER,16)
    for side in [-1,1]:polyline('Pantograph shoe turned end',[(center_x,side*.77,top),(center_x,side*.98,top-.06),(center_x,side*1.08,top-.17)],.025,COPPER)


def coupler(x,side,height=.90):
    box('Drawbar shank',(x-side*.23,0,height),(.55,.23,.20),IRON)
    pts=[(x-side*.10,-.18,height-.12),(x+side*.13,-.18,height-.12),(x+side*.22,-.02,height-.12),(x+side*.12,.17,height-.12),(x-side*.10,.17,height-.12)]
    # A substantial, curved knuckle with a visible jaw gap.
    top=[(a,b,c+.24) for a,b,c in pts]
    v=pts+top;f=[(0,1,2,3,4),(9,8,7,6,5)]+[(i,(i+1)%5,(i+1)%5+5,i+5) for i in range(5)]
    mesh('Knuckle coupler interpretation',v,f,IRON)
    beam('Brake hose',(x-side*.38,.32,height-.1),(x-side*.13,.42,height-.48),.035,BLACK)


def locomotive():
    col=collection('03 Unnumbered 1935 production GG1 interpretation')
    gg1_body()
    # Two articulated six-driver frames, each guiding a two-axle pilot truck.
    for side in [-1,1]:
        for xx in [1.524,3.6068,5.6896]:axle(DRIVER,side*xx,GG1_DRIVER/2,'GG1 quill driver')
        for xx in [8.0772,10.5156]:axle(SMALL_WHEEL,side*xx,36*.0254/2,'GG1 leading truck')
        for y in [-1.09,1.09]:
            box('Articulated cast frame top rail',(side*5.6,y,1.34),(10.6,.24,.27),IRON)
            polyline('Articulated frame lower sill',[(side*.45,y,.98),(side*2.3,y,.91),(side*4.7,y,.90),(side*7.1,y,.76),(side*10.8,y,.70)],.10,IRON,12)
            for xx in [1.524,3.6068,5.6896]:
                x=side*xx
                box('Driver bearing pedestal',(x,y,.81),(.50,.31,.46),IRON)
                beam('Journal cover',(x,y-.18,.81),(x,y+.18,.81),.16,STEEL,24)
                coil('Driver suspension coil',(x-.28,y,1.05),.11,.32)
                beam('Equalising suspension beam',(x-.67,y,1.12),(x+.67,y,1.12),.065,IRON)
            for xx in [8.0772,10.5156]:box('Pilot truck journal',(side*xx,y,.52),(.35,.30,.31),IRON)
            beam('Pilot truck side frame',(side*7.80,y,.75),(side*10.82,y,.75),.10,IRON)
        for x in [side*1.524,side*3.6068,side*5.6896]:
            beam('Traction motor transverse housing',(x,-.65,1.1),(x,.65,1.1),.24,IRON,20)
        box('Steam heating equipment underframe',(side*6.5,0,.98),(1.5,1.15,.48),IRON)
        # Cast pilots, end ladders, body access panels, and handrails.
        end=side*11.65
        box('Front pilot crossbeam',(end,0,.75),(.24,2.75,.40),IRON)
        for y in np.linspace(-1.28,1.28,12):beam('Pilot vertical ribs',(end,float(y),.40),(end-side*.10,float(y),.95),.038,IRON,8)
        for y in [-.42,.42]:
            polyline('Nose access grab rail',[(side*11.68,y,1.26),(side*11.70,y,2.76),(side*11.56,y,3.32)],.022,STEEL,10)
        for z in np.arange(1.30,2.9,.29):beam('Front roof access rung',(side*11.69,-.42,float(z)),(side*11.69,.42,float(z)),.025,IRON)
        # Narrow arched nose door and a circular high-mounted headlight.
        box('Nose access door',(side*11.698,0,2.26),(.025,.65,1.83),GREEN)
        beam('Nose access door handle',(side*11.73,.20,2.15),(side*11.73,.20,2.40),.018,STEEL)
        beam('Nose headlight housing',(side*11.59,0,3.26),(side*11.72,0,3.26),.205,IRON,32)
        beam('Nose headlight lens',(side*11.73,0,3.26),(side*11.744,0,3.26),.17,CREAM,32)
        for y in [-.80,.80]:
            beam('End marker light',(side*11.19,y,3.50),(side*11.27,y,3.50),.08,CREAM,20)
            box('Unnumbered class number board',(side*10.91,y,3.69),(.12,.39,.17),BLACK)
        coupler(side*(GG1_LENGTH/2-.22),side)
    # The central articulation remains visible between the two frames.
    ellipsoid('Articulation ball-and-pin housing',(0,0,1.02),(.22,.26,.22),IRON,24,12)
    for side in [-1,1]:
        y=side*1.574
        # Two directional cabs, each with three actual glazed panes and wipers.
        for direction in [-1,1]:
            x0=direction*2.05;x1=direction*3.67
            pts=[(x0,y,3.18),(x1,y,3.18),(direction*3.45,y,3.96),(x0,y,4.00)]
            mesh('GG1 directional cab side glazing',pts,[(0,1,2,3)],GLASS)
            polyline('Cab window weather seal',pts+[pts[0]],.025,BLACK,10)
            beam('Cab sliding window stile',(direction*2.85,y,3.20),(direction*2.85,y,3.98),.024,STEEL)
            face=[(direction*4.18,side*.35,3.32),(direction*4.18,side*1.37,3.32),(direction*3.70,side*1.34,4.02),(direction*3.70,side*.35,4.02)]
            mesh('GG1 split forward cab windshield',face,[(0,1,2,3)],GLASS)
            polyline('Forward windshield rubber seal',face+[face[0]],.024,BLACK,10)
            beam('Cab windscreen wiper',(direction*4.24,side*.61,3.35),(direction*3.96,side*.94,3.82),.009,IRON,6)
        # Longitudinal vents and welded service-panel joints, without prototype rivets.
        for direction in [-1,1]:
            for i in range(18):
                x=direction*(5.0+i*.24)
                beam('Side air intake louvre',(x,y,1.88),(x,y,2.33),.012,IRON,6)
            for x in [direction*5.0,direction*7.3,direction*9.4]:
                polyline('Welded hood access panel',[(x-.7,y,1.55),(x-.7,y,2.47),(x+.7,y,2.47),(x+.7,y,1.55)],.005,IRON,6)
        # Five restrained gold stripes sweep down into the two rounded noses.
        for stripe in range(5):
            v=[];f=[]
            for i in range(145):
                x=-11.52+23.04*i/144;w,_,_=section_values(x)
                downturn=max(0,(abs(x)-8.1)/3.42)**1.75
                z=2.84+stripe*.078-1.42*downturn
                for dz in [-.013,.013]:v.append((x,side*(w+.008),z+dz))
                if i:f.append((2*i-2,2*i-1,2*i+1,2*i))
            mesh('Five gold cat-whisker stripes',v,f,GOLD)
        obj=text('Period railroad name','P E N N S Y L V A N I A',(0,side*1.592,2.08),.29,GOLD,(math.pi/2 if side==-1 else -math.pi/2,0,0 if side==-1 else math.pi))
    pantograph(-7.2,False);pantograph(7.2,True)
    for x in np.linspace(-6.1,6.1,11):
        polyline('Roof high voltage bus',[(float(x),-.40,4.14),(float(x)+.7,-.40,4.14)],.023,COPPER,10)
    for x in [-.9,.9]:
        vent=lathe('Steam heater and transformer roof vent',[(0,.22),(.14,.25),(.24,.25),(.30,.19)],BLACK,32);vent.location=(x,0,4.17)
    bpy.context.view_layer.update()
    # Translate the entire source assembly to the parent's common track position.
    for obj in col.objects:obj.location.x+=GG1_CONTACT_ORIGIN
    return col


LOCOMOTIVE=locomotive()

P70_LENGTH=(80+4/12)*FT  # Museum No1006 exhibit label; measurement datum not stated.
P70_WIDTH=3.00           # Interpreted until the original PRR end diagram is obtained.
P70_ROOF=4.2672          # Interpreted 14ft envelope, not a verified No1006 height.
COACH_GLASS=material('TransparentPassengerCoachGlass',(.15,.24,.22),.19,.12)
p=COACH_GLASS.node_tree.nodes.get('Principled BSDF');p.inputs['Alpha'].default_value=.39
COACH_GLASS.surface_render_method='DITHERED'
INTERIOR=material('CoachWarmInteriorPanels',(.38,.27,.16),.72)


def coach_roof():
    cross=[(-1.50,3.52),(-1.38,3.70),(-1.10,3.86),(-.70,3.94),(-.54,3.95),(-.54,4.13),(-.40,4.23),(0,4.2672),(.40,4.23),(.54,4.13),(.54,3.95),(.70,3.94),(1.10,3.86),(1.38,3.70),(1.50,3.52)]
    sections=[(-11.80,.35,.62),(-11.66,.75,.78),(-11.40,.98,.88),(-10.60,1,1),(10.60,1,1),(11.40,.98,.88),(11.66,.75,.78),(11.80,.35,.62)]
    verts=[];faces=[]
    for x,width,high in sections:
        for y,z in cross:verts.append((x,y*width,3.50+(z-3.50)*high))
    n=len(cross)
    for i in range(len(sections)-1):
        for k in range(n-1):faces.append((i*n+k,(i+1)*n+k,(i+1)*n+k+1,i*n+k+1))
    return mesh('P70 arched steel clerestory roof',verts,faces,BLACK,True)


def coach_prototype():
    col=collection('04 P70 heavyweight coach original authoring master')
    half_body=11.75
    box('Coach steel floor',(0,0,1.0784),(23.5,2.98,.18),IRON)
    box('Coach interior floor',(0,0,1.1534),(21.2,2.86,.03),INTERIOR)
    coach_roof()
    # Two four-wheel passenger trucks, with steel leaf and coil suspension.
    for direction in [-1,1]:
        truck=direction*8.1
        for dx in [-1.02,1.02]:axle(SMALL_WHEEL,truck+dx,36*.0254/2,'P70 passenger truck')
        for side in [-1,1]:
            y=side*1.04
            box('Coach truck cast top beam',(truck,y,.90),(2.75,.22,.23),IRON)
            beam('Coach truck lower tie',(truck-1.31,y,.50),(truck+1.31,y,.50),.075,IRON)
            for dx in [-1.02,1.02]:
                box('Passenger journal box',(truck+dx,y,.51),(.35,.31,.34),IRON)
                coil('Passenger truck suspension coil',(truck+dx*.6,y,.79),.08,.24)
            for i in range(4):
                polyline('Passenger truck laminated leaf spring',[(truck-.78+i*.03,y,.89+i*.024),(truck,y,.70+i*.024),(truck+.78-i*.03,y,.89+i*.024)],.022,IRON,8)
        beam('Passenger truck bolster',(truck,-1.17,1.02),(truck,1.17,1.02),.14,IRON)
    # Underfloor battery boxes, air reservoirs, steam-heat pipe and truss rods.
    for x in [-4.8,3.8]:box('P70 underfloor equipment case',(x,0,.75),(2.2,1.15,.68),IRON)
    for x in [-1.8,.1]:beam('Brake air reservoir',(x,-.82,.75),(x,.82,.75),.19,IRON,24)
    for side in [-1,1]:
        polyline('Coach underframe truss rod',[(-9.7,side*.96,1.04),(-3.4,side*.96,.52),(3.4,side*.96,.52),(9.7,side*.96,1.04)],.027,IRON,10)
        beam('Steam heating longitudinal pipe',(-10.9,side*.85,.90),(10.9,side*.85,.90),.038,IRON)
    # Ten paired sash groups plus a single end pane at each end, read from the
    # museum side photograph; precise subclass spacing remains interpreted.
    window_x=[-10.10]+[float(c)+d for c in np.linspace(-8.70,8.70,10) for d in [-.34,.34]]+[10.10]
    for side in [-1,1]:
        y=side*1.50
        box('Coach riveted lower steel side',(0,y,1.5992),(21.45,.10,.8616),TUSCAN)
        box('Coach upper letterboard',(0,y,3.30),(21.45,.10,.48),TUSCAN)
        previous=-10.725
        for x in window_x:
            left=x-.295;right=x+.295
            if left>previous:box('Coach solid window mullion',((previous+left)/2,y,2.58),(left-previous,.10,1.10),TUSCAN)
            glass_y=side*1.512
            box('P70 transparent sash glass',(x,glass_y,2.58),(.59,.025,1.06),COACH_GLASS)
            for dx in [-.313,.313]:box('P70 sash vertical frame',(x+dx,side*1.54,2.58),(.035,.055,1.14),GOLD)
            for z in [2.03,3.13]:box('P70 sash head and sill',(x,side*1.54,z),(.66,.055,.035),GOLD)
            box('P70 sliding sash meeting rail',(x,side*1.544,2.69),(.61,.06,.036),TUSCAN)
            previous=right
        if previous<10.725:box('Coach end window pier',((previous+10.725)/2,y,2.58),(10.725-previous,.10,1.10),TUSCAN)
        for z in [1.91,1.96,3.50]:beam('P70 fine gold body lining',(-10.72,side*1.562,z),(10.72,side*1.562,z),.009,GOLD,6)
        text('P70 railroad letterboard','P E N N S Y L V A N I A',(0,side*1.565,3.20),.24,GOLD,(math.pi/2 if side==-1 else -math.pi/2,0,0 if side==-1 else math.pi))
        # Clerestory glass and vents fit the raised central roof section.
        for x in np.linspace(-9.9,9.9,22):box('Coach clerestory glazing',(float(x),side*.552,4.05),(.46,.025,.17),COACH_GLASS)
        # Fine coach rivet rows are in the original normal map; the production
        # GG1 uses welded shell detailing rather than prototype rivet geometry.
    # Eighty seats, inspired by the museum's 1927 interior photograph.
    for x in np.linspace(-9.2,9.2,20):
        for side in [-1,1]:
            for transverse in [.58,1.04]:
                box('Coach paired upholstered seat',(float(x),side*transverse,1.5484),(.66,.43,.14),SEAT)
                back=box('Coach walkover seat back',(float(x)+.30,side*transverse,1.8984),(.11,.43,.72),SEAT)
            beam('Coach seat support',(float(x),side*.84,1.1784),(float(x),side*.84,1.5084),.045,IRON)
            beam('Coach armrest',(float(x)-.18,side*1.30,1.8384),(float(x)+.27,side*1.30,1.8384),.023,INTERIOR)
    for side in [-1,1]:
        for x in [-10.1,10.1]:beam('Luggage rack longitudinal rail',(x,side*.87,3.24),(-x,side*.87,3.24),.021,IRON)
        for x in np.linspace(-9.8,9.8,20):beam('Luggage rack bracket',(float(x),side*.88,3.23),(float(x),side*1.44,3.32),.016,IRON,6)
    # Enclosed end vestibules and concertina rubber gangways.
    for direction in [-1,1]:
        x=direction*11.24
        box('Coach enclosed vestibule',(x,0,2.37),(1.05,2.90,2.40),TUSCAN)
        for side in [-1,1]:
            box('Vestibule side door',(x,side*1.472,2.29),(.78,.055,2.18),TUSCAN)
            box('Vestibule door glazing',(x,side*1.512,2.78),(.54,.03,.87),COACH_GLASS)
            beam('Vestibule door handle',(x+.28,side*1.54,2.10),(x+.28,side*1.54,2.36),.015,STEEL)
            # The high-platform display state retracts the outer steps within
            # the body envelope. Extended low-platform steps would penetrate
            # Penn's documented5ft3 centre-to-edge clearance by about9cm.
            for i in range(4):box('Coach vestibule access step — retracted high-platform state',(x,side*min(1.14+i*.10,1.30),.30+i*.22),(.87,.50,.13),IRON)
        end=direction*11.81
        for i in range(7):
            xx=end+direction*i*.027
            for side in [-1,1]:box('Gangway concertina side fold',(xx,side*.57,2.24),(.025,.11,2.10),BLACK)
            box('Gangway concertina top fold',(xx,0,3.31),(.025,1.25,.12),BLACK)
        box('Gangway passage door',(end+direction*.02,0,2.25),(.05,1.0,2.08),TUSCAN)
        box('Gangway door window',(end+direction*.058,0,2.65),(.028,.67,.70),GLASS)
        coupler(direction*(P70_LENGTH/2-.22),direction)
    # Assemble the reusable coach into a small set of material meshes.
    for obj in col.objects:
        if obj.get('keep_instance'):del obj['keep_instance']
    bpy.context.view_layer.update();batch(col,'P70 coach reusable assembly')
    kit=list(col.objects);move_to_masters(col)
    return kit


COACH_KIT=coach_prototype()
COACHES=collection('05 Two P70 coach interpretations')
first=GG1_CONTACT_ORIGIN-GG1_LENGTH/2-P70_LENGTH/2-.25
second=first-P70_LENGTH-.25
for center in [first,second]:kit_instances(COACH_KIT,'P70 passenger coach',(center,0,0))


def export_asset():
    bpy.context.scene.unit_settings.system='METRIC';bpy.context.scene.unit_settings.scale_length=1
    bpy.context.preferences.filepaths.save_version=0;bpy.context.view_layer.update()
    batch(LOCOMOTIVE,'Production GG1 assembly')
    for obj in bpy.data.objects:
        if obj.type=='MESH':
            obj['period_status']='1935+ class interpretation, unnumbered; see rolling-stock-research.md'
            for mat in obj.data.materials:mat.use_backface_culling=False
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'model-trains.blend'),compress=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in bpy.data.objects:
        if obj.type=='MESH' and not obj.hide_render:obj.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT/'model-trains.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True)
    # Count the actual assembled triangles, including repeated mesh placements.
    triangles=sum(sum(len(p.vertices)-2 for p in obj.data.polygons) for obj in bpy.data.objects if obj.type=='MESH' and not obj.hide_render)
    meta={'units':'metres','axes':'glTF X east, Y up, Z south','wheelContactY':0,'GG1':{'centerX':GG1_CONTACT_ORIGIN,'lengthOverCouplers':GG1_LENGTH,'width':GG1_WIDTH,'driverDiameter':GG1_DRIVER,'wheelArrangement':'2-C+C-2','identity':'unnumbered early production class interpretation','pantographs':['folded to4.572m nominal','raised to6.1m interpreted wire contact']},'P70':{'quantity':2,'lengthAnchor':P70_LENGTH,'lengthSource':'Railroad Museum of Pennsylvania No1006 exhibit label,80ft4in; datum unstated','centersX':[first,second],'widthInterpreted':P70_WIDTH,'heightInterpreted':P70_ROOF,'windowAndSeats':'22 panes per side interpreted from museum side photo;80 seats per coach modelled'},'trianglesAssembled':triangles,'rawBytes':(OUT/'model-trains.glb').stat().st_size,'limits':['Not an exact locomotive or coach identity','P70 original dimensioned diagram retrieval blocked; width and truck geometry interpreted','Brake rigging, wiring, chassis sections and paint hue not factory-certified','Not an authenticated Penn Station train consist or timetable']}
    meta['wheelFlangeMinimumY']=-.026
    meta['GG1'].update({'bodyLength':GG1_BODY_LENGTH,'pilotAxleSpacing':8*FT,'driverAxleSpacing':(6+10/12)*FT,'innerDriverGap':10*FT,'principalDrawing':'PRR F406591, Altoona17July1935, issued25July1935A'})
    meta['P70']['floorHeightIntegration']=1.1684
    (OUT/'rolling-stock-manifest.json').write_text(json.dumps(meta,indent=2)+'\n')
    print('ROLLING_STOCK',json.dumps({'output':str(OUT),'triangles':triangles,'rawBytes':meta['rawBytes']}),flush=True)


def render_review():
    global COL
    COL=collection('99 Temporary inspection rig, excluded from saved asset')
    box('Inspection ballast',(-49,0,-.30),(100,10,.45),material('InspectionGravel',(.12,.13,.12),.96))
    for side in [-1,1]:box('Inspection rail',(-49,side*.7175,-.06),(100,.07,.12),STEEL)
    world=bpy.data.worlds.new('Neutral overcast inspection');world.use_nodes=True;world.node_tree.nodes.get('Background').inputs['Color'].default_value=(.72,.76,.8,1);world.node_tree.nodes.get('Background').inputs['Strength'].default_value=.8;bpy.context.scene.world=world
    data=bpy.data.lights.new('Inspection sun','SUN');data.energy=2.8;data.angle=.15
    sun=bpy.data.objects.new('Inspection sun',data);COL.objects.link(sun);sun.rotation_euler=(.5,-.4,-.5)
    camdata=bpy.data.cameras.new('Rolling stock inspection');camera=bpy.data.objects.new('Rolling stock inspection',camdata);COL.objects.link(camera);bpy.context.scene.camera=camera
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=40;scene.render.threads_mode='FIXED';scene.render.threads=6;scene.render.resolution_x=1400;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.view_settings.view_transform='AgX'
    for name,position,target,lens in [('gg1-close-review',(-8,-30,10),(-30,0,2.2),48),('p70-close-review',(-40,-31,7),(first,0,2.1),45),('train-consist-review',(-1,-78,28),(-52,0,1.6),42)]:
        camera.location=position;camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler();camdata.lens=lens;scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)


if __name__=='__main__':
    export_asset()
    if args.render:render_review()
