"""Build the qualified straight departure-stair candidate, outside production.

The existing Main and provisional arrival/Exit decks are preserved. Old access
components are selected by exact source dimensions plus closed disconnected
components; retained mesh corners keep their positions, UVs and normals.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import shutil
import bpy
import numpy as np
from mathutils import Vector, Matrix

PARSER = argparse.ArgumentParser(description=__doc__)
PARSER.add_argument('--source', type=Path, required=True)
PARSER.add_argument('--recipe', type=Path, required=True)
PARSER.add_argument('--census', type=Path, required=True)
PARSER.add_argument('--out', type=Path, required=True)
PARSER.add_argument('--reuse-unchanged-from', type=Path, help='Verified earlier output with exact same source/removal scope; reuse old mask and retained occluder bytes')
ARGS = PARSER.parse_args()
OUT = ARGS.out.resolve()
OUT.mkdir(parents=True, exist_ok=True)
RECIPE = json.loads(ARGS.recipe.read_text())
PLAN = RECIPE['workingDepartureCandidate']
INDICATOR_X = PLAN.get('indicatorX', PLAN['gateX'])
CENSUS = json.loads(ARGS.census.read_text())
SOURCE_SHA = hashlib.sha256(ARGS.source.read_bytes()).hexdigest()
assert SOURCE_SHA == CENSUS['sourceSha256'], 'Census must describe these exact saved source bytes'
if ARGS.recipe.resolve() != (OUT/'layout-recipe.json').resolve():
    shutil.copyfile(ARGS.recipe, OUT/'layout-recipe.json')
assert PLAN['rootAcceptedInterpretation']
DROP = -RECIPE['coordinates']['mainWorldY']
OLD_HEAD = -42.2563
EXIT = -3.2004
PLATFORM = -7.718425
bpy.ops.wm.open_mainfile(filepath=str(ARGS.source.resolve()))

def arrays(mesh):
    vertices = np.empty(len(mesh.vertices)*3, np.float32)
    mesh.vertices.foreach_get('co', vertices)
    normals = np.empty(len(mesh.corner_normals)*3, np.float32)
    mesh.corner_normals.foreach_get('vector', normals)
    uv = {}
    for layer in mesh.uv_layers:
        a = np.empty(len(layer.data)*2, np.float32)
        layer.data.foreach_get('uv', a)
        uv[layer.name] = a.reshape(-1, 2)
    return vertices.reshape(-1, 3), normals.reshape(-1, 3), uv

def object_signature(obj):
    h = hashlib.sha256(np.asarray(obj.matrix_world, dtype='<f8').tobytes())
    if obj.type == 'MESH':
        v, n, uv = arrays(obj.data)
        h.update(v.tobytes()); h.update(n.tobytes())
        for face in obj.data.polygons:
            h.update(np.asarray(face.vertices, dtype='<i4').tobytes())
            h.update(bytes([face.use_smooth])); h.update(str(face.material_index).encode())
        for name, a in uv.items():
            h.update(name.encode()); h.update(a.tobytes())
    elif obj.type == 'FONT':
        h.update(obj.data.body.encode()); h.update(str(obj.data.size).encode())
    if obj.data is not None and hasattr(obj.data, 'materials'):
        h.update('|'.join(m.name if m else '' for m in obj.data.materials).encode())
    return h.hexdigest()

def near_bounds(component, expected):
    return np.max(np.abs(np.asarray(component['boundsMainBlender'])-expected)) < .00003

def expected_box(center, size):
    c, r = np.asarray(center), np.asarray(size)/2
    return np.array([c-r, c+r])

expected_treads, expected_landings = [], []
for row in PLAN['rows']:
    cy = row['centreBlenderY']
    for x0, x1, y, z0, z1, width, count in [
        (OLD_HEAD, OLD_HEAD-5.7, cy, 0, EXIT, 3, 19),
        (OLD_HEAD-6.7, OLD_HEAD-11.2, cy-.83, EXIT, (EXIT+PLATFORM)/2, 1.45, 15),
        (OLD_HEAD-11.2, OLD_HEAD-6.7, cy+.83, (EXIT+PLATFORM)/2, PLATFORM, 1.45, 15)]:
        for k in range(count):
            run, rise = (x1-x0)/count, (z1-z0)/count
            expected_treads.append(expected_box((x0+run*(k+.5), y, z0+rise*k-.105), (abs(run)+.004, width, .21)))
    expected_landings.extend([
        expected_box((OLD_HEAD-6.2, cy, EXIT-.1), (1, 3.2, .2)),
        expected_box((OLD_HEAD-11.7, cy, (EXIT+PLATFORM)/2-.1), (1, 3.3, .2)),
        expected_box((OLD_HEAD-6.25, cy, PLATFORM-.1), (.9, 3.3, .2))])

selected = []
for component in CENSUS['components']:
    material = component['materialSlots'][0]
    low, high = np.asarray(component['boundsMainBlender'])
    mid = (low+high)/2
    category = None
    if material == 'Travertine' and any(near_bounds(component, e) for e in expected_treads):
        category = 'old-tread'
    elif material == 'PublicFloorMarble' and any(near_bounds(component, e) for e in expected_landings):
        category = 'old-landing'
    elif material == 'AgedBronze':
        category = 'old-stair-or-well-guard'
    elif material == 'PaintedStructuralIron':
        if component['polygonCount'] == 14 and high[2] < -.04:
            category = 'old-stair-stringer'
        elif abs(mid[0]-(OLD_HEAD-.7)) < .00003 and any(abs(abs(mid[1]-r['centreBlenderY'])-2.15)<.00003 for r in PLAN['rows']):
            if component['polygonCount'] == 194 and abs(low[2]) < .00003 and abs(high[2]-4.8768) < .00003:
                category = 'old-indicator-shaft'
            elif component['polygonCount'] == 26 and (abs(mid[2]-3.57)<.00003 or abs(mid[2]-4.27)<.00003):
                category = 'old-indicator-cabinet'
    elif material == 'ClockFace' and abs(mid[0]-(OLD_HEAD-.7)) < .32 and component['polygonCount'] == 6:
        category = 'old-indicator-card'
    if category:
        selected.append(dict(component, category=category))
counts = Counter(c['category'] for c in selected)
assert counts == {'old-tread':441, 'old-landing':27, 'old-stair-or-well-guard':684,
                  'old-stair-stringer':54, 'old-indicator-shaft':18,
                  'old-indicator-cabinet':36, 'old-indicator-card':72}, counts

by_object = {}
for c in selected:
    by_object.setdefault(c['object'], []).append(c)
before = {o.name: object_signature(o) for o in bpy.context.scene.objects}
old_collection = bpy.data.collections.new('Phase6 exact old access removal')
bpy.context.scene.collection.children.link(old_collection)
new_collection = bpy.data.collections.new('Phase6 corrected departure access')
bpy.context.scene.collection.children.link(new_collection)
removed_objects, component_proofs, kept_proofs = [], [], []
new_materials, removal_materials = {}, {}

def module_material(source_name, new_name):
    if new_name in new_materials:
        return new_materials[new_name]
    material = bpy.data.materials[source_name].copy()
    material.name = new_name
    for key in list(material.keys()):
        if 'lighting' in key or 'illumination' in key or 'atlas' in key:
            del material[key]
    material['phase6_access_interpretation'] = 'New departure module; source topology supported, minor dimensions and surface appearance reconstructed; requires its own lighting.'
    new_materials[new_name] = material
    return material

def removal_material(source):
    if source.name not in removal_materials:
        m = bpy.data.materials.new('REMOVAL_'+source.name)
        m.use_nodes = True
        m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = source.diffuse_color
        m['original_material_name'] = source.name
        removal_materials[source.name] = m
    return removal_materials[source.name]

def subset_mesh(original, faces, name, material_override=None):
    source = original.data
    vertices, normals, uv = arrays(source)
    loops = np.array([i for p in faces for i in source.polygons[p].loop_indices], dtype=np.int64)
    target = bpy.data.meshes.new(name)
    target.from_pydata(vertices.tolist(), [], [list(source.polygons[p].vertices) for p in faces])
    for material in source.materials:
        target.materials.append(material_override(material) if material_override else material)
    target.update()
    for p, old in zip(target.polygons, faces):
        p.use_smooth = source.polygons[old].use_smooth
        p.material_index = source.polygons[old].material_index
    for layer_name, a in uv.items():
        layer = target.uv_layers.new(name=layer_name)
        layer.data.foreach_set('uv', a[loops].ravel())
    if source.has_custom_normals:
        target.normals_split_custom_set(normals[loops].tolist())
    target.update()
    new_vertices, new_normals, new_uv = arrays(target)
    assert np.array_equal(vertices, new_vertices), 'Retained source vertex storage changed'
    assert np.array_equal(normals[loops], new_normals), 'Source corner normals changed'
    for key in uv:
        assert np.array_equal(uv[key][loops], new_uv[key]), 'Source UV changed'
    return target, loops

for name, parts in by_object.items():
    obj = bpy.data.objects[name]
    removed_faces = sorted({p for c in parts for p in c['polygons']})
    removed_vertices = {v for c in parts for v in c['vertices']}
    removed_face_set = set(removed_faces)
    keep = [p.index for p in obj.data.polygons if p.index not in removed_face_set]
    assert not any(v in removed_vertices for p in keep for v in obj.data.polygons[p].vertices), 'A selected part shares vertices with retained architecture'
    edge_counts = Counter()
    for p in removed_faces:
        vertices = list(obj.data.polygons[p].vertices)
        for a,b in zip(vertices, vertices[1:]+vertices[:1]):
            edge_counts[tuple(sorted((a,b)))] += 1
    assert all(n == 2 for n in edge_counts.values()), (name, 'removed component is not closed')
    removed_mesh, _ = subset_mesh(obj, removed_faces, name+' removed', removal_material)
    old = bpy.data.objects.new(name+' removed exact', removed_mesh)
    old_collection.objects.link(old)
    old.matrix_world = obj.matrix_world.copy()
    old.location.z += DROP
    removed_objects.append(old)
    if keep:
        kept_mesh, source_loops = subset_mesh(obj, keep, name+' retained')
        kept_proofs.append({'object':name,'retainedPolygons':len(keep),'retainedCorners':len(source_loops),
                            'positionsExact':True,'cornerNormalsExact':True,'allUvLayersExact':True})
        obj.data = kept_mesh
    else:
        obj.hide_render = True
        obj.hide_viewport = True
        obj['phase6_all_faces_replaced'] = True
    component_proofs.extend([{k:v for k,v in c.items() if k not in ['vertices','polygons']} | {'sourceVertexIds':c['vertices'],'sourcePolygonIds':c['polygons']} for c in parts])

numerals = [o for o in bpy.context.scene.objects if o.type=='FONT' and o.name.startswith('Plan-derived track indicator number')]
assert len(numerals) == 72, len(numerals)
numeral_names = {o.name for o in numerals}
for obj in numerals:
    copy = obj.copy(); copy.data = obj.data.copy()
    old_collection.objects.link(copy)
    copy.location.z += DROP
    copy.data.materials.clear()
    copy.data.materials.append(removal_material(bpy.data.materials['ClockFace']))
    removed_objects.append(copy)

def export(objects, path):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.hide_viewport = False
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_texcoords=True, export_normals=True,
        export_materials='EXPORT', export_extras=True)

def reuse_artifact(name):
    previous = ARGS.reuse_unchanged_from.resolve()
    proof = json.loads((previous/'departure-source-proof.json').read_text())
    assert proof['sourceSha256'] == SOURCE_SHA, 'Reuse must match exact source'
    assert proof['removedCounts'] == dict(counts), 'Reuse must match removed scope'
    path = previous/name
    assert hashlib.sha256(path.read_bytes()).hexdigest() == proof['outputs'][name]['sha256'], 'Reused artifact hash changed'
    shutil.copyfile(path, OUT/name)

if ARGS.reuse_unchanged_from:
    reuse_artifact('old-access-removal.glb')
else:
    export(removed_objects, OUT/'old-access-removal.glb')
# Reused exports do not trigger the glTF exporter's dependency-graph update.
# Flush Main=0 transforms explicitly before copying indicator mesh positions.
bpy.context.view_layer.update()

def mesh_object(name, vertices, faces, material, smooth=False):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces); mesh.update(); mesh.materials.append(material)
    uv = mesh.uv_layers.new(name='ArchitecturalUV')
    for face in mesh.polygons:
        face.use_smooth = smooth
        axis = max(range(3), key=lambda k:abs(face.normal[k]))
        axes = [k for k in range(3) if k!=axis]
        for i in face.loop_indices:
            v = mesh.vertices[mesh.loops[i].vertex_index].co
            uv.data[i].uv = (v[axes[0]]/1.5, v[axes[1]]/1.5)
    obj = bpy.data.objects.new(name, mesh); new_collection.objects.link(obj)
    return obj

def box(name, center, size, material):
    c, r = Vector(center), Vector(size)/2
    corners=[(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]
    return mesh_object(name, [tuple(c+Vector((a*r.x,b*r.y,d*r.z))) for a,b,d in corners],
        [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)], material)

def section(name, start, end, profile, material):
    a,b = Vector(start),Vector(end)
    tangent=(b-a).normalized()
    across=Vector((0,1,0))
    up=tangent.cross(across).normalized()
    vertices=[tuple(p+across*u+up*v) for p in [a,b] for u,v in profile]
    n=len(profile)
    if n == 12:
        # Explicit I-section caps avoid degenerate diagonals when Blender's
        # generic ngon triangulator encounters collinear flange/web corners.
        cap=[(0,1,3),(0,3,10),(0,10,11),(1,2,3),(10,3,4),
             (10,4,9),(8,9,7),(9,4,7),(4,6,7),(4,5,6)]
        faces=[tuple(reversed(t)) for t in cap]
        faces.extend(tuple(n+i for i in t) for t in cap)
    else:
        faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces.extend((i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n))
    return mesh_object(name, vertices, faces, material)

def rail(name, a, b, width, height, material):
    return section(name, a, b, [(-width/2,-height/2),(width/2,-height/2),(width/2,height/2),(-width/2,height/2)], material)

STONE=module_material('Travertine','TravertineDepartureStairStone')
STONE['surface_identity']='Pale tread/landing finish is interpreted; original stair finish is not certified.'
IRON=module_material('PaintedStructuralIron','PaintedStructuralIronAccess')
BRONZE=module_material('PaintedStructuralIron','PaintedStructuralIronAccessGuard')
BRONZE['source_identity']='Gibbs256 ornamental cast iron/steel stair and fence work; exact small finish and profiles interpreted.'
CONCRETE=module_material('ConcourseOpaqueCirculationConcrete','ConcourseOpaqueCirculationConcreteAccessInfill')
MARBLE=module_material('PublicFloorMarble','PublicFloorMarbleAccessInfill')
indicator_map={'PaintedStructuralIron':'PaintedStructuralIronAccessIndicators','ClockFace':'ClockFaceAccessIndicators'}

# Move exact existing indicator profiles; no new destinations or times.
for c in selected:
    if c['category'] not in ['old-indicator-shaft','old-indicator-cabinet','old-indicator-card']:
        continue
    source = bpy.data.objects[c['object']]
    # The removal mesh is the complete original source data subset and retains
    # original polygon IDs only in the explicit component manifest. Build from
    # the original removal subset's per-component source coordinates directly.
    original_obj = next(o for o in removed_objects if o.type=='MESH' and o.name.startswith(c['object']))
    original = original_obj.data
    ids=c['sourceVertexIds'] if 'sourceVertexIds' in c else c['vertices']
    bounds=np.asarray(c['boundsMainBlender']); old_mid=bounds.mean(axis=0)
    row=PLAN['rows'][c['row']-1];cy=row['centreBlenderY']
    side=1 if old_mid[1]>cy else -1
    # Keep exact V3 intrinsic profile, triangulation, normals and UVs. Only an
    # object transform carries the separately interpreted indicator adjustment.
    delta=Vector((PLAN['gateX']-(OLD_HEAD-.7),side*(1.55-2.15),0))
    # Recover the exact source component from the untouched original vertex
    # storage and its original faces held in the removal collection.
    face_ids=c['polygons']
    original_source = source.data
    # Stored source vertices remain identical even in the retained mesh.
    vertices=[original_source.vertices[i].co.copy() for i in ids]
    lookup={v:i for i,v in enumerate(ids)}
    # Census polygon lists reference original indices, so use the removal
    # object's geometry by closed component vertex membership instead.
    faces=[tuple(lookup[v] for v in p.vertices) for p in original.polygons if all(v in lookup for v in p.vertices)]
    points=[original_obj.matrix_world@v+delta for v in vertices]
    obj=mesh_object('Repositioned '+c['category']+f" row{c['row']}",points,faces,
        module_material(c['materialSlots'][0],indicator_map[c['materialSlots'][0]]),smooth=c['category']=='old-indicator-shaft')
    obj.location.x += INDICATOR_X-PLAN['gateX']

for old in numerals:
    cy=min((r['centreBlenderY'] for r in PLAN['rows']),key=lambda y:abs(old.location.y-y))
    side=1 if old.location.y>cy else -1
    copy=old.copy();copy.data=old.data.copy();new_collection.objects.link(copy)
    copy.name='Repositioned departure indicator number'
    copy.location.x+=INDICATOR_X-(OLD_HEAD-.7)
    copy.location.y+=side*(1.55-2.15)
    copy.location.z+=DROP
    copy.data.materials.clear();copy.data.materials.append(module_material('ClockFace','ClockFaceAccessIndicators'))
    old.hide_render=True;old.hide_viewport=True;old['phase6_replaced_indicator']=True

flight_records=[]
for row in PLAN['rows']:
    cy=row['centreBlenderY']; number=row['workingPlatform']
    for f in PLAN['flights']:
        x0,x1=f['startX'],f['endX'];z0,z1=f['startMainRelativeY'],f['endMainRelativeY'];count=f['risers']
        run=(x1-x0)/count;rise=(z1-z0)/count
        physical_width=PLAN['clearWidth']+.14
        for k in range(count):
            box(f'Departure{number} flight{f["flight"]} tread{k+1}',
                (x0+run*(k+.5),cy,z0+rise*k-.115),(run,physical_width,.23),STONE)
        for side in [-1,1]:
            yy=cy+side*1.035
            profile=[(-.075,-.15),(.075,-.15),(.075,-.125),(.012,-.125),(.012,.125),(.075,.125),(.075,.15),(-.075,.15),(-.075,.125),(-.012,.125),(-.012,-.125),(-.075,-.125)]
            section(f'Departure{number} supporting stringer', (x0,yy,z0-.18),(x1,yy,z1-.18),profile,IRON)
            rail(f'Departure{number} sloping handrail',(x0,yy,z0+1.06),(x1,yy,z1+1.06),.06,.055,BRONZE)
            for k in range(count+1):
                x=x0+run*k;z=z0+rise*k
                # Rooted in the steel stringer, passing through tread material.
                rail(f'Departure{number} stair baluster',(x,yy,z-.22),(x,yy,z+1.06),.024,.024,BRONZE)
        flight_records.append({'row':number,'label':f'Departure platform{number} flight{f["flight"]}',
            'start':[x0,z0-DROP,row['centreWorldZ']],'end':[x1,z1-DROP,row['centreWorldZ']],
            'width':PLAN['clearWidth'],'physicalTreadWidth':physical_width,'steps':count})
    for j,landing in enumerate(PLAN['intermediateLandings']+[PLAN['platformLanding']]):
        a,b,z=landing['startX'],landing['endX'],landing['mainRelativeY']
        if j < len(PLAN['intermediateLandings']):
            box(f'Departure{number} independent landing{j+1}',((a+b)/2,cy,z-.15),(b-a,2.14,.30),STONE)
        # The real railway platform owns the final receiving surface. Adding
        # another nominal-height slab would duplicate/bury a competing top.
        for side in [-1,1]:
            yy=cy+side*1.035
            rail(f'Departure{number} landing handrail',(a,yy,z+1.06),(b,yy,z+1.06),.06,.055,BRONZE)
            for x in [a,(a+b)/2,b]:
                rail(f'Departure{number} landing guard',(x,yy,z-.1),(x,yy,z+1.06),.024,.024,BRONZE)
    old_x0,old_x1=OLD_HEAD-6.4,OLD_HEAD
    new_x0,new_x1=PLAN['upperApertureX']
    old_half,new_half=1.65,PLAN['openingEnvelopeWidth']/2
    strips=[(old_x0,new_x0,cy-old_half,cy+old_half),
            (new_x1,old_x1,cy-old_half,cy+old_half),
            (new_x0,new_x1,cy-old_half,cy-new_half),
            (new_x0,new_x1,cy+new_half,cy+old_half)]
    for si,(a,b,c,d) in enumerate(strips):
        # The central axial passage has a200mm existing marble finish. Keep
        # that finish separate from concrete bedding, with no coincident tops.
        cuts=sorted({a,b,max(a,min(b,-44.4))}) if number==6 else [a,b]
        for lo,hi in zip(cuts,cuts[1:]):
            if hi-lo<1e-6:continue
            marble=number==6 and (lo+hi)/2 > -44.4
            depth=.20 if marble else 0
            box(f'Departure{number} old-hole concrete infill{si}',((lo+hi)/2,(c+d)/2,-(.44+depth)/2),(hi-lo,d-c,.44-depth),CONCRETE)
            if marble:
                box(f'Departure{number} axial marble infill{si}',((lo+hi)/2,(c+d)/2,-.10),(hi-lo,d-c,.20),MARBLE)
    # Side guards around the active Main aperture stand on the new opaque
    # infill, outside the clear stair profile. They stop at the western gate.
    for side in [-1,1]:
        yy=cy+side*1.17
        rail(f'Departure{number} Main well top rail',(new_x0,yy,1.12),(new_x1,yy,1.12),.045,.045,BRONZE)
        for x in np.linspace(new_x0,new_x1,13):
            rail(f'Departure{number} Main well upright',(float(x),yy,-.05),(float(x),yy,1.12),.022,.022,BRONZE)

# Old components are no longer needed in the candidate scene after export.
bpy.data.batch_remove(ids=removed_objects)
bpy.data.collections.remove(old_collection)
for obj in list(bpy.context.scene.objects):
    if obj.get('phase6_all_faces_replaced') or obj.get('phase6_replaced_indicator'):
        bpy.data.objects.remove(obj, do_unlink=True)

new_objects=list(new_collection.objects)
export(new_objects,OUT/'departure-access-module.glb')
# A texture-free retained concourse is the exact source occluder for the new
# bounded atlas. Temporary materials keep original names and optical scalars.
if ARGS.reuse_unchanged_from:
    reuse_artifact('retained-concourse-occluder.glb')
else:
    retained_objects=[o for o in bpy.context.scene.objects if o.type in {'MESH','FONT'}
                      and any(c.name.startswith('03 ') for c in o.users_collection)]
    saved_matrices={o:o.matrix_world.copy() for o in retained_objects}
    saved_slots={o.data:list(o.data.materials) for o in retained_objects}
    original_materials=set(m for slots in saved_slots.values() for m in slots if m)
    original_names={m:m.name for m in original_materials}
    occluder_materials={}
    for m in original_materials:
        m.name='P6TEMP_'+original_names[m]
    for m,name in original_names.items():
        clone=bpy.data.materials.new(name);clone.use_nodes=True
        p=clone.node_tree.nodes.get('Principled BSDF')
        old=m.node_tree.nodes.get('Principled BSDF') if m.use_nodes else None
        for key in ['Base Color','Roughness','Metallic','Transmission Weight','IOR']:
            if old and old.inputs.get(key):p.inputs[key].default_value=old.inputs[key].default_value
        occluder_materials[m]=clone
    for data,slots in saved_slots.items():
        data.materials.clear()
        for m in slots:data.materials.append(occluder_materials[m] if m else None)
    for obj,matrix in saved_matrices.items():
        obj.matrix_world=Matrix.Translation((0,0,DROP))@matrix
    bpy.context.view_layer.update()
    export(retained_objects,OUT/'retained-concourse-occluder.glb')
    for obj,matrix in saved_matrices.items():obj.matrix_world=matrix
    for data,slots in saved_slots.items():
        data.materials.clear()
        for m in slots:data.materials.append(m)
    for clone in occluder_materials.values():bpy.data.materials.remove(clone)
    for m,name in original_names.items():m.name=name
# Saved scene opens in the common world; exported module retains Main=0.
for obj in new_objects:
    obj.location.z-=DROP
bpy.context.view_layer.update()
changed=set(by_object)|numeral_names
after={o.name:object_signature(o) for o in bpy.context.scene.objects if o.name in before and o.name not in changed}
assert all(after[name]==before[name] for name in after), 'Unrelated source object changed'
assert set(after)==set(before)-changed, 'Unrelated source object disappeared'
bpy.context.scene['phase6_departure_access']='Three interpreted straight eastward flights per row; departure does not join provisional retained arrival Exit deck. Source nominal gate registration conflict remains documented.'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'penn-station-phase6-departure-candidate.blend'),compress=True)
report={'source':str(ARGS.source),'sourceSha256':SOURCE_SHA,'recipeSha256':hashlib.sha256(ARGS.recipe.read_bytes()).hexdigest(),
        'scope':'Qualified departure-only candidate; actual surrounding scene retained, no production promotion.',
        'coordinateContract':'GLBs use concourse Main=0/glTFYup; saved scene common world Main−4.2672m.',
        'indicatorRegistration':{'gateX':PLAN['gateX'],'indicatorX':INDICATOR_X,'status':'Indicator placement interpreted independently; stair registration unchanged'},
        'removedCounts':dict(counts),'removedNumeralObjects':72,'removedComponents':component_proofs,
        'retainedBatches':kept_proofs,'unrelatedObjectsExact':len(after),
        'unrelatedObjectSignatures':after,'stairSupportFlights':flight_records,
        'retainedExitDeck':'Provisional old arrival deck and22lamp supports intentionally retained pending separate arrival reconstruction; no departure landing joins it.',
        'sourceQualification':PLAN['whyNotSourceNominalGate'],'runtimeAcceptance':'Pending actual decoded/body/headroom/walking and camera validation.',
        'outputs':{}}
for name in ['old-access-removal.glb','departure-access-module.glb','retained-concourse-occluder.glb','penn-station-phase6-departure-candidate.blend']:
    p=OUT/name;report['outputs'][name]={'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(OUT/'departure-source-proof.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'status':'SOURCE CANDIDATE EXPORTED; RUNTIME ACCEPTANCE PENDING','outputs':report['outputs'],'unrelatedObjectsExact':len(after)}))
