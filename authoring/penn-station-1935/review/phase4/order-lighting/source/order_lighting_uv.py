"""Independent lighting partition/UVs for the eight authored colossal orders.

This is lightmap preparation only. It does not change architecture, normals,
materials or ArchitecturalUV/UV0. Coordinates are the registered raw waiting-room
Blender frame, before the browser's -4.2672m Main-floor offset. Carving remains
an interpretation; the atlas provides no new historical evidence.
"""
from __future__ import annotations
import hashlib
import math
import bpy
import numpy as np

ORDER_CENTRES = tuple((sx * 14.2, y) for sx in (-1, 1) for y in (-42.216, -14.072, 14.072, 42.216))
ORDER_TOP = (9 + 4 / 12 + 3 + 3 / 12 + 48 + 8 + 3 / 12) * .3048
ORDER_HALF_WIDTH = 1.76  # encloses the authored3.30m plinth /3.00m abacus, below the impost
ELIGIBLE = ('Travertine', 'InteriorGranite', 'BotticinoMarble')


def _world_vertices(obj):
    p = np.empty(len(obj.data.vertices) * 3, dtype=np.float32)
    obj.data.vertices.foreach_get('co', p)
    matrix = np.asarray(obj.matrix_world, dtype=np.float64)
    return p.reshape(-1, 3) @ matrix[:3, :3].T + matrix[:3, 3]


def _order_faces(obj):
    """Select whole geometrically connected stone components, never crop faces."""
    mesh = obj.data
    if not mesh.polygons or not any(m and m.name.startswith(ELIGIBLE) for m in mesh.materials):
        return np.zeros(len(mesh.polygons), dtype=bool), {}
    points = _world_vertices(obj)
    # Position welding is for graph classification only; mesh vertices are untouched.
    unique, inverse = np.unique(np.round(points, 5), axis=0, return_inverse=True)
    parent = np.arange(len(unique), dtype=np.int32)
    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = int(parent[i])
        return i
    def union(a, b):
        a, b = find(int(a)), find(int(b))
        if a != b:
            parent[max(a, b)] = min(a, b)
    eligible = np.array([bool(mesh.materials[p.material_index]) and mesh.materials[p.material_index].name.startswith(ELIGIBLE) for p in mesh.polygons], dtype=bool)
    for poly in mesh.polygons:
        if eligible[poly.index]:
            vertices = inverse[list(poly.vertices)]
            for v in vertices[1:]:
                union(vertices[0], v)
    labels = np.array([find(i) for i in range(len(unique))], dtype=np.int32)
    lo = np.full((len(unique), 3), np.inf)
    hi = np.full((len(unique), 3), -np.inf)
    np.minimum.at(lo, labels, unique)
    np.maximum.at(hi, labels, unique)
    selected_roots = {}
    for root in np.unique(labels):
        if lo[root, 2] < -.0001 or hi[root, 2] > ORDER_TOP + .0001:
            continue
        for index, (x, y) in enumerate(ORDER_CENTRES):
            if lo[root, 0] >= x-ORDER_HALF_WIDTH and hi[root, 0] <= x+ORDER_HALF_WIDTH and lo[root, 1] >= y-ORDER_HALF_WIDTH and hi[root, 1] <= y+ORDER_HALF_WIDTH:
                selected_roots[int(root)] = index
                break
    selected = np.array([bool(eligible[p.index] and int(labels[inverse[p.vertices[0]]]) in selected_roots) for p in mesh.polygons], dtype=bool)
    per_order = {str(i): 0 for i in range(8)}
    for p in mesh.polygons:
        if selected[p.index]:
            per_order[str(selected_roots[int(labels[inverse[p.vertices[0]]])])] += 1
    return selected, per_order


def split_waiting_order_objects(primary_objects):
    """Return (order_objects, other_primary_objects, report).

    Call after glTF import/material preparation, before joining bake solids.
    The non-order objects remain present as ordinary occluders. Add returned
    objects to the caller's primary set, since Blender separation creates IDs.
    """
    order, other, audit = [], [], []
    bpy.ops.object.mode_set(mode='OBJECT') if bpy.context.object and bpy.context.object.mode != 'OBJECT' else None
    for obj in list(primary_objects):
        if obj.type != 'MESH':
            other.append(obj)
            continue
        selected, counts = _order_faces(obj)
        count = int(selected.sum())
        if not count:
            other.append(obj)
            continue
        original = obj.name
        if count == len(obj.data.polygons):
            order.append(obj)
        else:
            before = set(bpy.context.scene.objects)
            bpy.ops.object.select_all(action='DESELECT')
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.context.tool_settings.mesh_select_mode = (False, False, True)
            for p in obj.data.polygons:
                p.select = bool(selected[p.index])
            bpy.ops.object.mode_set(mode='EDIT')
            bpy.ops.mesh.separate(type='SELECTED')
            bpy.ops.object.mode_set(mode='OBJECT')
            separated = list(set(bpy.context.scene.objects) - before)
            if len(separated) != 1 or len(separated[0].data.polygons) != count:
                raise RuntimeError('Order partition failed to preserve selected whole components')
            separated[0].name = original + ' — colossal order lighting partition'
            order.extend(separated)
            other.append(obj)
        audit.append({'sourceObject': original, 'selectedPolygons': count, 'polygonsByOrder': counts})
    counts = {str(i): sum(x['polygonsByOrder'].get(str(i), 0) for x in audit) for i in range(8)}
    if not order or any(v == 0 for v in counts.values()):
        raise RuntimeError('Dedicated order partition must contain all eight authored columns')
    return order, other, {'frame': 'raw waiting-room Blender/Main0', 'orderTopMetres': ORDER_TOP, 'centresXY': ORDER_CENTRES, 'selection': 'whole connected stone components inside the eight authored plinth/shaft/capital envelopes; imposts/walls excluded', 'objects': audit, 'polygonsByOrder': counts}


def corner_signature(objects):
    """Order-independent exact per-corner geometry/normal/UV0 proof."""
    arrays = []
    for obj in objects:
        if obj.type != 'MESH':
            continue
        mesh = obj.data
        points = _world_vertices(obj).astype('<f4')
        loops = np.empty(len(mesh.loops), dtype=np.int32)
        mesh.loops.foreach_get('vertex_index', loops)
        normals = np.empty(len(mesh.loops) * 3, dtype=np.float32)
        mesh.corner_normals.foreach_get('vector', normals)
        rotation = np.asarray(obj.matrix_world.to_3x3().inverted().transposed(), dtype=np.float64)
        normals = normals.reshape(-1, 3) @ rotation.T
        lengths = np.linalg.norm(normals, axis=1)[:, None]
        np.divide(normals, lengths, out=normals, where=lengths > 0)
        uv = np.zeros((len(mesh.loops), 2), dtype=np.float32)
        if mesh.uv_layers:
            mesh.uv_layers[0].data.foreach_get('uv', uv.reshape(-1))
        arrays.append(np.concatenate((points[loops], normals.astype('<f4'), uv), axis=1))
    rows = np.concatenate(arrays)
    order = np.lexsort(tuple(rows[:, i] for i in range(7, -1, -1)))
    rows = rows[order]
    return {'corners': len(rows), 'positionsSha256': hashlib.sha256(rows[:, :3].tobytes()).hexdigest(), 'normalsSha256': hashlib.sha256(rows[:, 3:6].tobytes()).hexdigest(), 'uv0Sha256': hashlib.sha256(rows[:, 6:].tobytes()).hexdigest(), 'combinedSha256': hashlib.sha256(rows.tobytes()).hexdigest()}


def prepare_order_uv(obj, resolution=4096, margin_pixels=4, layer_name='BakedLightingUV'):
    """Create only a lighting channel, with coherent cylindrical shaft strips.

    Front/return carving surfaces use an89-degree projection limit, keeping
    shallow lobe tessellation together. Shaft strips unwrap around their actual
    registered axis; caps are separate planar islands. Equalized island density
    and final packing apply to the independent new channel only.
    """
    mesh = obj.data
    if layer_name in mesh.uv_layers:
        raise ValueError('Refuse to overwrite an existing lighting UV channel')
    if not mesh.uv_layers:
        raise ValueError('UV0 must already exist and remain unchanged')
    uv0_before = np.empty(len(mesh.loops)*2, dtype=np.float32)
    mesh.uv_layers[0].data.foreach_get('uv', uv0_before)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    mesh.uv_layers.new(name=layer_name)
    mesh.uv_layers.active_index = len(mesh.uv_layers)-1
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(89), island_margin=0, margin_method='FRACTION', area_weight=0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    points = _world_vertices(obj)
    uv = mesh.uv_layers[layer_name].data
    shaft_polygons = 0
    for poly in mesh.polygons:
        material = mesh.materials[poly.material_index]
        if not material or not material.name.startswith('InteriorGranite'):
            continue
        p = points[list(poly.vertices)]
        centre = min(ORDER_CENTRES, key=lambda c: (float(p[:, 0].mean())-c[0])**2+(float(p[:, 1].mean())-c[1])**2)
        if np.ptp(p[:, 2]) < 1e-6:
            values = p[:, :2] - np.asarray(centre)
            values[:, 0] += 20  # disjoint cap projection, packed below
        else:
            theta = np.arctan2(p[:, 1]-centre[1], p[:, 0]-centre[0])
            if np.ptp(theta) > math.pi:
                theta[theta < 0] += math.tau
            values = np.stack((theta, p[:, 2]), axis=1)
        for loop, value in zip(poly.loop_indices, values):
            uv[loop].uv = value
        shaft_polygons += 1
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.average_islands_scale()
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(udim_source='ACTIVE_UDIM', rotate=True, scale=True, margin_method='FRACTION', margin=margin_pixels/resolution)
    bpy.ops.object.mode_set(mode='OBJECT')
    uv0_after = np.empty_like(uv0_before)
    mesh.uv_layers[0].data.foreach_get('uv', uv0_after)
    if not np.array_equal(uv0_before, uv0_after):
        raise RuntimeError('Lighting preparation changed UV0')
    mesh.calc_loop_triangles()
    loops = np.empty(len(mesh.loop_triangles)*3, dtype=np.int32)
    mesh.loop_triangles.foreach_get('loops', loops)
    values = np.empty(len(mesh.loops)*2, dtype=np.float32)
    mesh.uv_layers[layer_name].data.foreach_get('uv', values)
    triangle_uv = values.reshape(-1, 2)[loops.reshape(-1, 3)]
    uarea = np.abs(np.cross(triangle_uv[:, 1]-triangle_uv[:, 0], triangle_uv[:, 2]-triangle_uv[:, 0]))*.5
    vertices = np.empty(len(mesh.loop_triangles)*3, dtype=np.int32)
    mesh.loop_triangles.foreach_get('vertices', vertices)
    pp = points[vertices.reshape(-1, 3)]
    world_area = np.linalg.norm(np.cross(pp[:, 1]-pp[:, 0], pp[:, 2]-pp[:, 0]), axis=1)*.5
    if not .01 <= float(uarea.sum()) <= 1.001 or triangle_uv.min() < -1e-5 or triangle_uv.max() > 1.00001:
        raise RuntimeError(f'Invalid dedicated order atlas: area={uarea.sum()}, UV bounds={triangle_uv.min()}..{triangle_uv.max()}')
    density = float(np.sqrt(uarea.sum()*resolution**2/world_area.sum()))
    return {'resolution': resolution, 'uvLayer': layer_name, 'uv0Unchanged': True, 'shaftCylindricalPolygons': shaft_polygons, 'projectionAngleDegrees': 89, 'marginPixels': margin_pixels, 'atlasSurfaceArea': float(uarea.sum()), 'worldAreaM2': float(world_area.sum()), 'meanTexelsPerMetre': density, 'interpretedLeafWidthMetres': .8, 'leafWidthTexels': density*.8, 'authoredLeafReturnDepthMetres': .055, 'leafReturnTexels': density*.055, 'aoAt2048': {'meanTexelsPerMetre': density*2048/resolution, 'leafWidthTexels': density*.8*2048/resolution, 'leafReturnTexels': density*.055*2048/resolution}, 'trianglePixelAreaPercentiles': {str(q): float(np.percentile(uarea*resolution**2, q)) for q in [0, 5, 50, 95, 100]}}
