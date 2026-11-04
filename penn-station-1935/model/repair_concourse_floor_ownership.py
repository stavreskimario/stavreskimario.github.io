"""Remove competing Main-level finish/concrete faces in the editable scene.

Existing marble extents and thicknesses are the authority. No survey claim,
floor extension, hole filler, visual depth offset or navigation plane is added.
"""
from pathlib import Path
import argparse
import hashlib
import json
import bpy
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

parser = argparse.ArgumentParser()
parser.add_argument('--input', type=Path, required=True)
parser.add_argument('--out-blend', type=Path, required=True)
parser.add_argument('--out-glb', type=Path, required=True)
parser.add_argument('--report', type=Path, required=True)
args = parser.parse_args()
assert args.input.resolve() != args.out_blend.resolve(), 'Preserve the input scene'
bpy.ops.wm.open_mainfile(filepath=str(args.input.resolve()))
main = float(bpy.context.scene.get('main_floor_world', -4.2672))
# Blender truncates ID names; the longer construction label is not retained.
prefix = 'Main concourse concrete bearing'

def bounds(obj):
    points = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    return tuple(min(p[i] for p in points) for i in range(3)), tuple(max(p[i] for p in points) for i in range(3))

def signature(obj):
    h = hashlib.sha256()
    h.update(np.asarray(obj.matrix_world, dtype='<f8').tobytes())
    if obj.type == 'MESH':
        vertices = np.empty(len(obj.data.vertices) * 3, dtype=np.float32)
        obj.data.vertices.foreach_get('co', vertices)
        loops = np.empty(len(obj.data.loops), dtype=np.int32)
        obj.data.loops.foreach_get('vertex_index', loops)
        h.update(vertices.tobytes()); h.update(loops.tobytes())
        normals = np.empty(len(obj.data.corner_normals)*3,dtype=np.float32)
        obj.data.corner_normals.foreach_get('vector',normals)
        h.update(normals.tobytes())
        for layer in obj.data.uv_layers:
            uv = np.empty(len(layer.data)*2,dtype=np.float32)
            layer.data.foreach_get('uv',uv);h.update(uv.tobytes())
        h.update('|'.join(m.name if m else '' for m in obj.data.materials).encode())
    return h.hexdigest()

concrete = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and any(m and m.name == 'ConcourseOpaqueCirculationConcrete' for m in obj.data.materials)]
assert len(concrete) == 1, 'Expected the canonical joined circulation-concrete mesh'
slab = concrete[0]
# Exact extents/thicknesses of the existing three finishes in build_station.py.
# The canonical scene is batched by material, so its original slab ID names
# no longer exist. These regions are also checked against actual marble rays.
room_half = (108+8/12)*.3048/2
finishes = [
    {'name':'Axial passage marble', 'bounds':[-44.4,-room_half,-7.75,7.75], 'bottom':main-.20},
    {'name':'North subsidiary marble', 'bounds':[-41.5,-18.5,8.5,45.5], 'bottom':main-.22},
    {'name':'South subsidiary marble', 'bounds':[-41.5,-18.5,-45.5,-8.5], 'bottom':main-.22},
]
before = {obj.name: signature(obj) for obj in bpy.context.scene.objects if obj != slab}
depsgraph = bpy.context.evaluated_depsgraph_get()
marble = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH' and any(m and m.name == 'PublicFloorMarble' for m in obj.data.materials)]
marble_trees = [(obj, BVHTree.FromObject(obj,depsgraph)) for obj in marble]

def ray_height(obj, tree, x, y):
    inverse = obj.matrix_world.inverted()
    start = inverse @ Vector((x,y,main+.1))
    direction = (inverse.to_3x3() @ Vector((0,0,-1))).normalized()
    point, normal, index, distance = tree.ray_cast(start,direction,1)
    return (obj.matrix_world @ point).z if point is not None else None

probes = []
old_tree = BVHTree.FromObject(slab,depsgraph)
for x,y in [(-43,2.13),(-43,-2.13),(-41.13,25),(-41.13,-25),(-41.13,43.13),(-41.13,-43.13)]:
    heights = [h for obj,tree in marble_trees if (h:=ray_height(obj,tree,x,y)) is not None and abs(h-main)<.002]
    old = ray_height(slab,old_tree,x,y)
    assert heights and old is not None and abs(old-main)<.002, (x,y,old,heights)
    probes.append({'x':x,'y':y,'marbleHeight':max(heights),'concreteBefore':old})
original_bounds = bounds(slab)
original_polygons = len(slab.data.polygons)
# Rebuild the joined slab from its own occupied top polygons. Booleaning the
# batched touching/bevelled cells can silently drop disconnected cells, so the
# footprint is partitioned explicitly and its area/bounds are checked below.
def area(poly):
    return sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(poly,poly[1:]+poly[:1]))/2

def clip(poly, axis, value, sign):
    result=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        da,db=sign*(a[axis]-value),sign*(b[axis]-value)
        if da >= -1e-10: result.append(a)
        if (da < 0 < db) or (db < 0 < da):
            t=da/(da-db)
            result.append(tuple(a[k]+t*(b[k]-a[k]) for k in range(2)))
    cleaned=[]
    for p in result:
        p=tuple(round(c/1e-5)*1e-5 for c in p)
        if not cleaned or p != cleaned[-1]: cleaned.append(p)
    if len(cleaned)>1 and cleaned[0]==cleaned[-1]: cleaned.pop()
    return cleaned if len(cleaned)>=3 and abs(area(cleaned))>1e-9 else []

polygons=[]
for face in slab.data.polygons:
    points=[slab.matrix_world @ slab.data.vertices[i].co for i in face.vertices]
    if any(abs(p.z-main)>2e-6 for p in points): continue
    poly=[(p.x,p.y) for p in points]
    if area(poly)<=1e-9: continue
    polygons.append(poly)
assert polygons
before_area=sum(area(poly) for poly in polygons)
planes=sorted({(axis,f['bounds'][k]) for f in finishes for axis,keys in [(0,(0,1)),(1,(2,3))] for k in keys})
for axis,value in planes:
    divided=[]
    for poly in polygons:
        if min(p[axis] for p in poly)<value-1e-6 and max(p[axis] for p in poly)>value+1e-6:
            divided.extend(p for sign in (-1,1) if (p:=clip(poly,axis,value,sign)))
        else:
            rounded=clip(poly,axis,value,1 if sum(p[axis] for p in poly)/len(poly)>=value else -1)
            if rounded: divided.append(rounded)
    polygons=divided
after_area=sum(area(poly) for poly in polygons)
assert abs(after_area-before_area)<.02, ('Occupied floor footprint changed',before_area,after_area)
vertices,faces,vertex_indices,edges=[],[],{},{}
def vertex(p,z):
    key=(round(p[0]/1e-5),round(p[1]/1e-5),round(z/1e-7))
    if key not in vertex_indices:
        vertex_indices[key]=len(vertices);vertices.append((p[0],p[1],z))
    return vertex_indices[key]
base=original_bounds[0][2]
for poly in polygons:
    centre=(sum(p[0] for p in poly)/len(poly),sum(p[1] for p in poly)/len(poly))
    covered=[f for f in finishes if f['bounds'][0]<centre[0]<f['bounds'][1] and f['bounds'][2]<centre[1]<f['bounds'][3]]
    top=min(f['bottom'] for f in covered) if covered else main
    faces.append(tuple(vertex(p,top) for p in poly))
    faces.append(tuple(vertex(p,base) for p in reversed(poly)))
    for a,b in zip(poly,poly[1:]+poly[:1]):
        key=tuple(sorted((a,b)))
        edges.setdefault(key,[]).append((a,b,top))
assert max(len(e) for e in edges.values())<=2, 'Overlapping source top polygons'
for owners in edges.values():
    if len(owners)==2 and abs(owners[0][2]-owners[1][2])<1e-7: continue
    a,b,top=max(owners,key=lambda item:item[2])
    low=min(item[2] for item in owners) if len(owners)==2 else base
    faces.append((vertex(a,top),vertex(a,low),vertex(b,low),vertex(b,top)))
material=slab.data.materials[0]
mesh=bpy.data.meshes.new('Concourse finish-owned occupied floor')
mesh.from_pydata(vertices,[],faces);mesh.materials.append(material);mesh.update()
slab.data=mesh
slab.matrix_world=Matrix.Identity(4)
bpy.context.view_layer.update()
repaired_bounds = bounds(slab)
bounds_error = max(abs(original_bounds[i][j]-repaired_bounds[i][j]) for i in range(2) for j in range(3))
assert bounds_error < 1e-5, ('Outer circulation-floor bounds changed',original_bounds,repaired_bounds,bounds_error)
bpy.context.view_layer.update()
new_tree=BVHTree.FromObject(slab,bpy.context.evaluated_depsgraph_get())
for probe in probes:
    height=ray_height(slab,new_tree,probe['x'],probe['y'])
    probe['concreteAfter']=height
    assert height is not None and height <= main-.199, probe
after = {obj.name: signature(obj) for obj in bpy.context.scene.objects if obj.name in before}
assert before == after, 'Unrelated geometry/transforms/material bindings changed'
for p in (args.out_blend,args.out_glb,args.report): p.parent.mkdir(parents=True,exist_ok=True)
bpy.context.scene['phase5_floor_ownership'] = 'Concrete top below existing marble finish; original finish footprints, support and stair openings retained'
bpy.ops.wm.save_as_mainfile(filepath=str(args.out_blend.resolve()), compress=True)
bpy.ops.object.select_all(action='DESELECT')
world_matrices = {obj:obj.matrix_world.copy() for obj in concrete}
for obj in concrete:
    obj.select_set(True)
    obj.matrix_world = Matrix.Translation((0,0,-main)) @ world_matrices[obj]
bpy.context.view_layer.update()
try:
    bpy.ops.export_scene.gltf(filepath=str(args.out_glb.resolve()), export_format='GLB', use_selection=True, export_apply=True, export_extras=True, export_normals=True, export_yup=True)
finally:
    for obj in concrete: obj.matrix_world = world_matrices[obj]
report = {'scope':__doc__.strip(), 'inputSha256':hashlib.sha256(args.input.read_bytes()).hexdigest(), 'sourceMainWorld':main, 'finishRegions':finishes, 'sourceRayProbes':probes, 'originalPolygons':original_polygons, 'repairedPolygons':len(slab.data.polygons), 'sourceFootprintArea':before_area, 'repairedFootprintArea':after_area, 'partitionSnapMetres':1e-5, 'outerBoundsMaximumErrorMetres':bounds_error, 'unrelatedObjectsUnchanged':len(before), 'moduleFrame':'glTF Y-up, Main floor=0, same frame as existing concourse transport chunk', 'sourceBlendSha256':hashlib.sha256(args.out_blend.read_bytes()).hexdigest(), 'moduleSha256':hashlib.sha256(args.out_glb.read_bytes()).hexdigest()}
args.report.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:report[k] for k in ('originalPolygons','repairedPolygons','unrelatedObjectsUnchanged','sourceRayProbes')}),flush=True)
