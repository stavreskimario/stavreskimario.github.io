"""Isolated, photograph-led twin-globe wall brackets; never exports the station.

Run with Blender 4.3 / bpy 4.3: python build_wall_brackets.py --out DIRECTORY
Local Blender Z=0 is Main; lower by 4.2672 m only when appending to the saved
world-datum station scene. The app's waiting chunk already applies that lowering.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

parser = argparse.ArgumentParser()
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'
collection = bpy.data.collections.new('Phase5 photographed wall-bracket pair')
scene.collection.children.link(collection)


def material(name, colour, roughness, metallic):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    principled = result.node_tree.nodes.get('Principled BSDF')
    principled.inputs['Base Color'].default_value = (*colour, 1)
    principled.inputs['Roughness'].default_value = roughness
    principled.inputs['Metallic'].default_value = metallic
    result['appearance_status'] = 'Existing palette interpretation, not a measured historic sample'
    return result


bronze = material('AgedBronze', (.19, .14, .085), .47, .65)
opal = material('OpalCandelabraGlass', (.78, .77, .72), .24, 0)
parts = []


def mesh(name, vertices, faces, mat):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    collection.objects.link(obj)
    data.materials.append(mat)
    for polygon in data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    parts.append(obj)
    return obj


def lathe(name, profile, axis='Z', at=(0, 0, 0), segments=64):
    vertices = []
    for height, radius in profile:
        for j in range(segments):
            angle = j * math.tau / segments
            point = (radius * math.cos(angle), radius * math.sin(angle), height)
            if axis == 'X':
                point = (point[2], point[0], point[1])
            vertices.append(tuple(point[i] + at[i] for i in range(3)))
    faces = []
    for ring in range(len(profile) - 1):
        for j in range(segments):
            k = (j + 1) % segments
            faces.append((ring * segments + j, ring * segments + k,
                          (ring + 1) * segments + k, (ring + 1) * segments + j))
    for ring, reverse in [(0, True), (len(profile) - 1, False)]:
        centre = [0, 0, profile[ring][0]]
        if axis == 'X':
            centre = [centre[2], centre[0], centre[1]]
        index = len(vertices)
        vertices.append(tuple(centre[i] + at[i] for i in range(3)))
        for j in range(segments):
            a, b = ring * segments + j, ring * segments + (j + 1) % segments
            faces.append((index, b, a) if reverse else (index, a, b))
    return mesh(name, vertices, faces, bronze)


def tube(name, points, radius, reference, segments=16):
    points = [Vector(point) for point in points]
    reference = Vector(reference)
    vertices = []
    for i, point in enumerate(points):
        tangent = (points[min(i + 1, len(points) - 1)] - points[max(i - 1, 0)]).normalized()
        first = tangent.cross(reference).normalized()
        second = tangent.cross(first).normalized()
        for j in range(segments):
            angle = j * math.tau / segments
            vertices.append(point + radius * (first * math.cos(angle) + second * math.sin(angle)))
    faces = []
    for i in range(len(points) - 1):
        for j in range(segments):
            k = (j + 1) % segments
            faces.append((i * segments + j, i * segments + k,
                          (i + 1) * segments + k, (i + 1) * segments + j))
    for ring, reverse in [(0, True), (len(points) - 1, False)]:
        index = len(vertices)
        vertices.append(points[ring])
        for j in range(segments):
            a, b = ring * segments + j, ring * segments + (j + 1) % segments
            faces.append((index, b, a) if reverse else (index, a, b))
    return mesh(name, vertices, faces, bronze)


# Unit axes: +X projects into the room, Y runs along the wall, Z is vertical.
# Only silhouette and construction vocabulary are photographic anchors.
rosette = lathe('Round moulded wall rosette', [(0, .170), (.008, .205), (.018, .218),
      (.032, .205), (.044, .172), (.052, .142)], axis='X')
controls = [Vector((.035, 0, -.020)), Vector((.220, 0, -.040)),
            Vector((.405, 0, .120)), Vector((.370, 0, .340))]
path = []
for j in range(41):
    t = j / 40
    path.append((1-t)**3 * controls[0] + 3*(1-t)**2*t*controls[1]
                + 3*(1-t)*t*t*controls[2] + t**3*controls[3])
tube('Swept projecting central support', path, .041, (0, 1, 0))
crown = lathe('Central stepped stem and modest finial', [(.245, .049), (.285, .061),
      (.320, .077), (.355, .069), (.415, .045), (.452, .051),
      (.475, .072), (.495, .070), (.515, .034), (.520, .012)], at=(.370, 0, 0))
path = []
for j in range(49):
    u = -.340 + .680 * j / 48
    path.append((.370 + .010 * (u / .340)**2, u, .380 - .050 * (u / .340)**2))
tube('Curved twin crossarm', path, .031, (1, 0, 0))
canopies = []
for sign in [-1, 1]:
    canopy = lathe('Downward stepped lamp cup', [(.035, .107), (.058, .145),
          (.087, .155), (.120, .139), (.160, .092), (.247, .070),
          (.276, .113), (.304, .147), (.330, .109)], at=(.380, sign * .340, 0))
    canopies.append((sign, canopy))
    bpy.ops.mesh.primitive_uv_sphere_add(segments=40, ring_count=24, radius=.160,
        location=(.380, sign * .340, -.120))
    globe = bpy.context.object
    for current in list(globe.users_collection):
        current.objects.unlink(globe)
    collection.objects.link(globe)
    globe.name = 'Downward pale globe'
    globe.data.materials.append(opal)
    for polygon in globe.data.polygons:
        polygon.use_smooth = True
    # Bake the local translation before joining into shared master geometry.
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    parts.append(globe)


def audit(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    result = {'name': obj.name, 'triangles': len(bm.faces),
              'nonManifoldEdges': sum(not edge.is_manifold for edge in bm.edges),
              'signedVolume': bm.calc_volume(signed=True)}
    bm.free()
    assert result['nonManifoldEdges'] == 0, result
    assert result['signedVolume'] > 0, result
    return result


component_audits = [audit(obj) for obj in parts]
interfaces = [("Support root in rosette", rosette, (.035, 0, -.020)),
              ("Support tip in central stem", crown, (.370, 0, .340)),
              ("Crossarm centre in central stem", crown, (.370, 0, .380))]
for sign, canopy in canopies:
    interfaces.extend([('Crossarm end meets lamp cup', canopy, (.380, sign * .340, .330)),
                       ('Globe crown seated in lamp cup', canopy, (.380, sign * .340, .040))])
contact_audits = []
for label, support, point in interfaces:
    bm = bmesh.new()
    bm.from_mesh(support.data)
    bmesh.ops.triangulate(bm, faces=list(bm.faces))
    tree = BVHTree.FromBMesh(bm)
    nearest, normal, index, distance = tree.find_nearest(Vector(point))
    signed = (Vector(point) - nearest).dot(normal)
    record = {'label': label, 'support': support.name, 'pointMaster': point,
              'nearestDistance': distance, 'outwardSignedDistance': signed,
              'touchesOrInside': signed <= .003}
    assert record['touchesOrInside'], record
    contact_audits.append(record)
    bm.free()
masters = []
material_parts = {mat.name: [obj for obj in parts if obj.data.materials[0] == mat]
                  for mat in [bronze, opal]}
for mat in [bronze, opal]:
    members = material_parts[mat.name]
    bpy.ops.object.select_all(action='DESELECT')
    for obj in members:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = members[0]
    bpy.ops.object.join()
    master = bpy.context.object
    master.name = 'Photographed bracket ' + ('metalwork' if mat == bronze else 'globes')
    masters.append(master)

for side, wall in [(-1, 'west'), (1, 'east')]:
    anchor = bpy.data.objects.new('Photo-supported ' + wall + ' wall bracket', None)
    collection.objects.link(anchor)
    anchor.location = (side * 15.655, -28.144, 8.600)
    anchor.rotation_euler.z = 0 if side == -1 else math.pi
    anchor['source'] = 'S23 LOC071928; Gibbs printed269'
    anchor['placement_status'] = 'Southern outer-bay registration; mounting height and minor offsets inferred'
    anchor['main_local_z'] = 0.0
    for master in masters:
        obj = master.copy()
        obj.data = master.data
        collection.objects.link(obj)
        obj.parent = anchor
        obj.location = (0, 0, 0)
        obj.rotation_euler = (0, 0, 0)
for master in masters:
    bpy.data.objects.remove(master, do_unlink=True)

scene['module_scope'] = 'Only two photo-visible waiting-room wall brackets; not the complete1935inventory'
scene['datum'] = 'MainlocalZ0; apply street lowering4.2672m exactly once on world-scene append'
scene['lights_added'] = 0
bpy.context.view_layer.update()
objects = [obj for obj in scene.objects if obj.type == 'MESH']
assert len(objects) == 4 and len({obj.data.as_pointer() for obj in objects}) == 2
assert not any(obj.type == 'LIGHT' for obj in scene.objects)
triangles = sum(len(obj.data.loop_triangles) for obj in objects)
for obj in objects:
    obj.data.calc_loop_triangles()
triangles = sum(len(obj.data.loop_triangles) for obj in objects)
report = {'scope': scene['module_scope'], 'datum': scene['datum'], 'fixtureCount': 2,
          'meshNodes': len(objects), 'sharedMeshes': 2, 'materialNames': [m.name for m in [bronze, opal]],
          'liveLights': 0, 'instancedTriangles': triangles, 'components': component_audits,
          'closedPositiveVolumeComponents': True, 'contactsPerFixture': contact_audits,
          'geometryStatus': 'Photograph-led profile, dimensions reconstructed',
          'mounts': [{'wall': wall, 'blenderMainLocal': [side * 15.655, -28.144, 8.6]}
                     for side, wall in [(-1, 'west'), (1, 'east')]]}
blend = args.out / 'waiting-wall-brackets.blend'
glb = args.out / 'waiting-wall-brackets.glb'
bpy.ops.wm.save_as_mainfile(filepath=str(blend), compress=True)
bpy.ops.export_scene.gltf(filepath=str(glb), export_format='GLB', export_extras=True,
    export_animations=False, export_cameras=False, export_lights=False)
report['blendSha256'] = hashlib.sha256(blend.read_bytes()).hexdigest()
report['glbSha256'] = hashlib.sha256(glb.read_bytes()).hexdigest()
report['glbBytes'] = glb.stat().st_size
(args.out / 'module-audit.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
