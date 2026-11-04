"""Blender authoring for a registered arrivals exit route.

The route file supplies evidence-reviewed world coordinates. This helper creates
only the addition, retains the station source unchanged and exports Main=0 glTF.
Minor sections and surface appearances remain declared reconstructions.
"""
import argparse, hashlib, json, math
from pathlib import Path
import bpy
from mathutils import Vector

P = argparse.ArgumentParser(description=__doc__)
P.add_argument('--route', type=Path, required=True)
P.add_argument('--materials-source', type=Path, required=True)
P.add_argument('--out', type=Path, required=True)
P.add_argument('--material-library',type=Path,default=Path('/Users/stavreskimario/Desktop/penn-station-work/phase5-materials/material-library'))
A = P.parse_args()
SHA = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
assert not A.out.exists(), 'Use a new output directory'
R = json.loads(A.route.read_text())
assert R['status'] == 'REVIEWED FOR CONSTRUCTION'
assert R['coordinateSpace'] == 'world-glTF-Xeast-Yup-Zsouth'
assert R['sources'] and R['qualifications']
source_sha = SHA(A.materials_source)
assert source_sha == R['materialsSourceSha256']
DROP = 4.2672
A.out.mkdir(parents=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
C = bpy.data.collections.new('Arrivals onward exit — registered construction')
bpy.context.scene.collection.children.link(C)
originals = ['Travertine', 'PublicFloorMarble', 'PaintedStructuralIron',
             'AgedBronze', 'WalnutBench', 'InteriorGranite']
with bpy.data.libraries.load(str(A.materials_source), link=False) as (src, dst):
    assert all(n in src.materials for n in originals)
    dst.materials = originals
M = {}
for key, name in [('stone', 'Travertine'), ('floor', 'PublicFloorMarble'),
                  ('iron', 'PaintedStructuralIron'), ('bronze', 'AgedBronze'),
                  ('wood', 'WalnutBench'), ('granite', 'InteriorGranite')]:
    m = bpy.data.materials[name].copy()
    m.name = name + 'ArrivalsExitRoute'
    m['historical_qualification'] = 'Existing interpreted surface family; not a measured surviving material sample.'
    M[key] = m

brick=bpy.data.materials.new('EnamelledBrickArrivalsExitRoute')
brick.use_nodes=True
pbr=brick.node_tree.nodes.get('Principled BSDF')
pbr.inputs['Base Color'].default_value=(.72,.70,.65,1)
pbr.inputs['Roughness'].default_value=.26
brick['historical_qualification']='Gibbs254 documents enameled brick; pale colour and glaze response interpreted.'
M['brick']=brick
import sys
sys.path.insert(0,'/Users/stavreskimario/Desktop/penn-station-reconstruction/penn-station-1935/model')
from material_library import apply_materials
material_profiles=apply_materials(list(M.values()),A.material_library)
for channel,filename in [('Base Color','enameled-brick-color.png'),('Roughness','enameled-brick-roughness.png'),('Normal','enameled-brick-normal.png')]:
    folder=Path(R['enamelMaterialDirectory']);image=bpy.data.images.load(str(folder/filename),check_existing=True)
    image.colorspace_settings.name='sRGB' if channel=='Base Color' else 'Non-Color'
    tex=brick.node_tree.nodes.new('ShaderNodeTexImage');tex.image=image
    if channel=='Normal':
        normal=brick.node_tree.nodes.new('ShaderNodeNormalMap');normal.inputs['Strength'].default_value=1
        brick.node_tree.links.new(tex.outputs['Color'],normal.inputs['Color']);brick.node_tree.links.new(normal.outputs['Normal'],pbr.inputs['Normal'])
    else:brick.node_tree.links.new(tex.outputs['Color'],pbr.inputs[channel])
opal=bpy.data.materials.new('OpalCandelabraExits');opal.use_nodes=True;op=opal.node_tree.nodes.get('Principled BSDF')
opal['skip_lighting_atlas']=True;op.inputs['Base Color'].default_value=(.95,.91,.80,1);op.inputs['Roughness'].default_value=.30
op.inputs['Emission Color'].default_value=(1.,.72,.43,1);op.inputs['Emission Strength'].default_value=2.0
M['opal']=opal

def point(w):
    return Vector((w[0], -w[2], w[1] + DROP))

def closed_mesh(name, vertices, faces, material, smooth=False):
    vs = [point(v) for v in vertices]
    centre = sum(vs, Vector()) / len(vs)
    volume = sum((vs[f[0]]-centre).dot((vs[f[i]]-centre).cross(vs[f[i+1]]-centre))/6
                 for f in faces for i in range(1, len(f)-1))
    assert abs(volume) > 1e-12, (name, 'zero volume')
    if volume < 0:
        faces = [tuple(reversed(f)) for f in faces]
    d = bpy.data.meshes.new(name)
    d.from_pydata(vs, [], faces)
    d.update()
    d.materials.append(M[material])
    uv = d.uv_layers.new(name='ArchitecturalUV')
    tile = {'stone': 1.5, 'floor': 1.8, 'granite': 1.0}.get(material, 1.0)
    for f in d.polygons:
        f.use_smooth = smooth and len(f.vertices) == 4
        axis = max(range(3), key=lambda i: abs(f.normal[i]))
        axes = [i for i in range(3) if i != axis]
        for k in f.loop_indices:
            v = d.vertices[d.loops[k].vertex_index].co
            uv.data[k].uv = (v[axes[0]]/tile, v[axes[1]]/tile)
    d['penn_surface_revision'] = 3
    o = bpy.data.objects.new(name, d)
    C.objects.link(o)
    o['penn_surface_revision'] = 3
    o['route_component'] = True
    return o

BOX = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]

def prism(name, start, end, width, bottom0, bottom1, top0, top1, material):
    a, b = Vector(start), Vector(end)
    tangent = Vector((b.x-a.x, 0, b.z-a.z)).normalized()
    across = Vector((-tangent.z, 0, tangent.x)) * width/2
    v = [tuple(p + q*across + Vector((0,y-p.y,0)))
         for p, y, q in [(a,bottom0,-1),(b,bottom1,-1),(b,bottom1,1),(a,bottom0,1),
                          (a,top0,-1),(b,top1,-1),(b,top1,1),(a,top0,1)]]
    return closed_mesh(name, v, BOX, material)

def bar(name, a, b, radius, material='iron', segments=12):
    a, b = Vector(a), Vector(b)
    t = (b-a).normalized()
    ref = Vector((0,1,0)) if abs(t.y) < .9 else Vector((1,0,0))
    u, v = t.cross(ref).normalized(), t.cross(t.cross(ref)).normalized()
    vertices = [tuple(p+radius*(u*math.cos(i*2*math.pi/segments)+v*math.sin(i*2*math.pi/segments)))
                for p in (a,b) for i in range(segments)]
    faces = [tuple(range(segments-1,-1,-1)), tuple(range(segments,2*segments))]
    faces += [(i,(i+1)%segments,(i+1)%segments+segments,i+segments) for i in range(segments)]
    return closed_mesh(name, vertices, faces, material, True)

permissions, flights, components = [], [], []
for i, p in enumerate(R.get('passages', [])):
    a, b = Vector(p['start']), Vector(p['end'])
    width, thick = p['width'], p.get('floorThickness', .30)
    tangent = Vector((b.x-a.x,0,b.z-a.z)).normalized()
    across = Vector((-tangent.z,0,tangent.x))
    height = p['clearHeight']
    name = p['name']
    prism(name+' floor', a,b,width,a.y-thick,b.y-thick,a.y,b.y,p.get('floorMaterial','floor'))
    if p.get('roof', False):
        prism(name+' ceiling',a,b,width,a.y+height,b.y+height,
              a.y+height+p.get('roofThickness',.24),b.y+height+p.get('roofThickness',.24),'stone')
    length = (Vector((b.x,0,b.z))-Vector((a.x,0,a.z))).length
    for side in p.get('walls', []):
        s = -1 if side == 'left' else 1
        aa, bb = a+across*s*(width/2+.12), b+across*s*(width/2+.12)
        prism(name+' '+side+' wall',aa,bb,.24,a.y-.02,b.y-.02,a.y+height,b.y+height,'stone')
        # A restrained physical skirting and cornice, not fabricated ornament.
        for y, h, depth, label in [(.09,.18,.045,'skirting'),(height-.12,.12,.035,'ceiling trim')]:
            ca, cb = aa-across*s*.125, bb-across*s*.125
            prism(name+' '+side+' '+label,ca,cb,depth,a.y+y-h/2,b.y+y-h/2,a.y+y+h/2,b.y+y+h/2,'stone')
    for side in p.get('guards', []):
        s = -1 if side == 'left' else 1
        aa, bb = a+across*s*(width/2-.07), b+across*s*(width/2-.07)
        for h in [.12,1.10]:
            bar(name+' guard rail', aa+Vector((0,h,0)),bb+Vector((0,h,0)),.023)
        count = max(1,math.ceil(length/.9))
        for j in range(count+1):
            q = aa.lerp(bb,j/count)
            bar(name+' guard post',q-Vector((0,.04,0)),q+Vector((0,1.12,0)),.018)
    lo = [a-across*width/2,a+across*width/2,b-across*width/2,b+across*width/2]
    permissions.append({'label':name,'bounds':[min(q.x for q in lo),max(q.x for q in lo),min(q.z for q in lo),max(q.z for q in lo)],
                        'geometryBasedFloorRayRequired':True,'surface':'Permission only; actual authored geometry supplies support.'})
    components.append({'name':name,'start':list(a),'end':list(b),'width':width,'length':length,'clearHeight':height})

for i, f in enumerate(R.get('stairFlights', [])):
    a,b = Vector(f['start']),Vector(f['end'])
    width, n = f['width'], f['risers']
    assert 0 < (b.y-a.y)/n <= .24
    tangent=Vector((b.x-a.x,0,b.z-a.z)).normalized()
    across=Vector((-tangent.z,0,tangent.x))
    horizontal=Vector((b.x-a.x,0,b.z-a.z)).length
    assert horizontal/n >= .20
    going = horizontal/n
    for j in range(n):
        c=a+(b-a)*((j+.5)/n)
        top=a.y+(j+1)*(b.y-a.y)/n
        aa=c-tangent*(going/2+.0002);bb=c+tangent*(going/2+.0002)
        bottom=min(a.y-.22, top-.24) if f.get('solidToFoot',False) else top-.24
        prism(f['name']+' tread '+str(j+1),aa,bb,width,bottom,bottom,top,top,f.get('treadMaterial','stone'))
    for s in [-1,1]:
        cheek_t=f.get('cheekThickness',.16); cheek_h=f.get('cheekHeight',.18)
        aa=a+across*s*(width/2+cheek_t/2);bb=b+across*s*(width/2+cheek_t/2)
        prism(f['name']+' continuous cheek',aa,bb,cheek_t,a.y-.32,b.y-.32,a.y+cheek_h,b.y+cheek_h,f.get('sideMaterial','iron'))
        if f.get('handrail',True):
            bar(f['name']+' handrail',aa+Vector((0,.98,0)),bb+Vector((0,.98,0)),.036,f.get('railMaterial','wood'),24)
    bounds=[min(a.x,b.x)-width/2,max(a.x,b.x)+width/2,min(a.z,b.z)-width/2,max(a.z,b.z)+width/2]
    permissions.append({'label':f['name'],'bounds':bounds,'geometryBasedFloorRayRequired':True,'surface':'Actual stair treads and landing receivers required.'})
    flights.append({'label':f['name'],'start':list(a),'end':list(b),'width':width,'steps':n})

# Explicit bearing members are supplied by the reviewed source fit, never by an
# invented global grid. All coordinates are the same world frame as the route.
for e in R.get('members', []):
    a,b=e['start'],e['end']
    prism(e['name'],a,b,e['width'],a[1],b[1],a[1]+e['depth'],b[1]+e['depth'],e.get('material','iron'))

if R.get('escalatorPair'):
    import sys
    sys.path.insert(0,str(Path(__file__).parent))
    from escalator_pair import build
    pair=build(R,M,C,closed_mesh,prism,bar,point)
    permissions.extend(pair['walkable']);flights.extend(pair['flights']);components.extend(pair['components'])

# Interpreted pendant positions use the source-photographed opal/cone family.
for lamp in R.get('practicalLights',[]):
    x,floor,z=lamp['floorPosition'];mount=lamp['mountY']
    bar(lamp['name']+' ceiling stem',(x,mount,z),(x,mount-.18,z),.012,'iron',12)
    profile=[(mount-.16,.035),(mount-.20,.065),(mount-.31,.17),(mount-.34,.18),(mount-.37,.16)]
    v=[(x+rad*math.cos(j*2*math.pi/24),yy,z+rad*math.sin(j*2*math.pi/24)) for yy,rad in profile for j in range(24)]
    f=[tuple(range(23,-1,-1)),tuple(range((len(profile)-1)*24,len(profile)*24))]
    f += [(i*24+j,i*24+(j+1)%24,(i+1)*24+(j+1)%24,(i+1)*24+j) for i in range(len(profile)-1) for j in range(24)]
    closed_mesh(lamp['name']+' opal shade',v,f,'opal',True)
    ld=bpy.data.lights.new(lamp['name'],'POINT');ld.energy=lamp['watts'];ld.color=(1.,.72,.43);ld.shadow_soft_size=.12
    light=bpy.data.objects.new(lamp['name'],ld);C.objects.link(light);light.location=point((x,mount-.55,z))
for g in R.get('guardRuns',[]):
    a,b=Vector(g['start']),Vector(g['end'])
    for h in [.14,1.10]:bar(g['name']+' rail',a+Vector((0,h,0)),b+Vector((0,h,0)),.022,'iron',12)
    n=max(1,math.ceil((b-a).length/.9))
    for i in range(n+1):
        q=a.lerp(b,i/n);bar(g['name']+' grounded post',q-Vector((0,.035,0)),q+Vector((0,1.12,0)),.018,'iron',12)
# Brick maps are baked over an integral10x26-course physical tile.
for o in C.objects:
    if o.type=='MESH' and o.data.materials and o.data.materials[0]==M['brick']:
        for loop in o.data.uv_layers[0].data:loop.uv.x/=2.032;loop.uv.y/=1.9812
assert len(C.objects)>0
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for o in C.objects:o.select_set(True)
bpy.context.view_layer.objects.active = next(iter(C.objects))
bpy.ops.wm.save_as_mainfile(filepath=str(A.out/'arrivals-exit-addon.blend'),compress=True)
# Batch only the repeated fine material groups; keep editable source above separate.
for key in ['iron','wood','bronze','opal']:
    group=[o for o in C.objects if o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0]==M[key]]
    if len(group)>1:
        bpy.ops.object.select_all(action='DESELECT')
        for o in group:o.select_set(True)
        bpy.context.view_layer.objects.active=group[0];bpy.ops.object.join();group[0].name='Exit route '+key+' batch'
bpy.ops.object.select_all(action='DESELECT')
for o in C.objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(A.out/'model-concourse-exits.glb'),export_format='GLB',use_selection=True,
                         export_apply=True,export_yup=True,export_extras=True,export_texcoords=True,
                         export_normals=True,export_materials='EXPORT',export_lights=True)
assert SHA(A.materials_source)==source_sha
report={'schema':1,'status':'Blender construction source; mapped lighting, encoded and native acceptance pending',
        'routeSha256':SHA(A.route),'materialsSourceSha256':source_sha,'builderSha256':SHA(Path(__file__)),
        'objectCount':len(C.objects),'practicalLights':R.get('practicalLights',[]),'surfaceProfiles':material_profiles,'coordinateSpace':'world-glTF','modelCoordinateSpace':'Main0-glTF: browserYoffset=-4.2672',
        'passages':components,'walkable':permissions,'stairSupportFlights':flights,
        'sources':R['sources'],'qualifications':R['qualifications'],'waypoints':R.get('waypoints',[]),'cameraPreset':R.get('cameraPreset'),
        'outputs':{n:SHA(A.out/n) for n in ['arrivals-exit-addon.blend','model-concourse-exits.glb']}}
(A.out/'construction.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'objects':len(C.objects),'outputs':report['outputs']}))
