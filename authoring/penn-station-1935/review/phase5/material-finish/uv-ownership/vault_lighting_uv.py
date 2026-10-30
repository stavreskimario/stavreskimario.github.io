"""Pack coherent vault charts while retaining authored split corner normals.

Coincident vertices are welded only in a UV-packing workspace. A temporary
integer corner attribute follows the original face corners through Blender's
edit operations. Packed UVs transfer back onto an untouched source-mesh copy,
retaining original geometry, architectural UVs and split-normal storage exactly.
"""
import hashlib
import math

import bpy
import numpy as np
from uv_ownership import require_unique_uv_ownership


def prepare_vault_uv(obj, resolution, margin_pixels):
    mesh = obj.data
    if obj.type != "MESH" or not mesh.uv_layers:
        raise ValueError("A vault mesh with architectural UV0 is required")
    if "BakedLightingUV" in mesh.uv_layers or "penn_authored_corner_id" in mesh.attributes:
        raise ValueError("Vault UV preparation must start from unbaked source geometry")
    if any(len(face.vertices) != 3 for face in mesh.polygons):
        raise ValueError("Only the existing triangulated coffer surface is supported")
    untouched = mesh.copy()
    source_normals = np.empty(len(mesh.loops) * 3, dtype=np.float32)
    mesh.corner_normals.foreach_get("vector", source_normals)
    source_normals = source_normals.reshape(-1, 3)
    source_uv = np.empty(len(mesh.loops) * 2, dtype=np.float32)
    mesh.uv_layers[0].data.foreach_get("uv", source_uv)
    source_uv = source_uv.reshape(-1, 2)
    source_vertex = np.empty(len(mesh.loops), dtype=np.int32)
    mesh.loops.foreach_get("vertex_index", source_vertex)
    source_points = np.asarray([vertex.co[:] for vertex in mesh.vertices], dtype=np.float32)[source_vertex]
    before_vertices, before_triangles = len(mesh.vertices), len(mesh.polygons)
    identity = mesh.attributes.new("penn_authored_corner_id", "INT", "CORNER")
    identity.data.foreach_set("value", np.arange(len(mesh.loops), dtype=np.int32))
    mesh.uv_layers.new(name="BakedLightingUV")
    mesh.uv_layers.active_index = len(mesh.uv_layers) - 1
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=.00001)
    # A75degree chart folded across separate coffer pockets despite consistent
    # winding. The measured25degree pack retains coherent relief charts and
    # passes a strict, resolution-independent multiple-owner gate below.
    bpy.ops.uv.smart_project(angle_limit=math.radians(25), island_margin=margin_pixels / resolution,
                            margin_method="FRACTION", area_weight=.5,
                            correct_aspect=True, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    ids = np.empty(len(mesh.loops), dtype=np.int32)
    mesh.attributes["penn_authored_corner_id"].data.foreach_get("value", ids)
    if not np.array_equal(np.sort(ids), np.arange(len(source_normals))):
        raise RuntimeError("Welding lost or duplicated an authored vault face corner")
    if len(mesh.polygons) != before_triangles:
        raise RuntimeError("Vault UV preparation changed its triangle count")
    mesh.calc_loop_triangles()
    triangle_loops = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    mesh.loop_triangles.foreach_get("loops", triangle_loops)
    light_uv = np.empty(len(mesh.loops) * 2, dtype=np.float32)
    mesh.uv_layers["BakedLightingUV"].data.foreach_get("uv", light_uv)
    ownership = require_unique_uv_ownership(light_uv.reshape(-1, 2)[triangle_loops.reshape(-1, 3)])
    packing_vertices = len(mesh.vertices)
    # Blender's weld can average duplicate coordinates by a few float ULPs.
    # Retain its chart solution while restoring the entire original mesh,
    # including topology and the encoded split-normal data, without tolerance.
    restored_uv = np.empty_like(light_uv.reshape(-1, 2))
    restored_uv[ids] = light_uv.reshape(-1, 2)
    obj.data = untouched
    if mesh.users == 0:
        bpy.data.meshes.remove(mesh)
    mesh = untouched
    layer = mesh.uv_layers.new(name="BakedLightingUV")
    layer.data.foreach_set("uv", restored_uv.reshape(-1))
    mesh.uv_layers.active_index = len(mesh.uv_layers) - 1
    actual_vertex = np.empty(len(mesh.loops), dtype=np.int32)
    mesh.loops.foreach_get("vertex_index", actual_vertex)
    actual_points = np.asarray([vertex.co[:] for vertex in mesh.vertices], dtype=np.float32)[actual_vertex]
    if not np.array_equal(actual_points, source_points) or len(mesh.vertices) != before_vertices:
        raise RuntimeError("UV transfer changed original architectural positions or topology")
    actual_uv = np.empty(len(mesh.loops) * 2, dtype=np.float32)
    mesh.uv_layers[0].data.foreach_get("uv", actual_uv)
    if not np.array_equal(actual_uv.reshape(-1, 2), source_uv):
        raise RuntimeError("Welding changed an authored architectural UV0 corner")
    actual_normals = np.empty_like(source_normals)
    mesh.corner_normals.foreach_get("vector", actual_normals.reshape(-1))
    if not np.array_equal(actual_normals, source_normals):
        raise RuntimeError("UV transfer changed an authored split normal")
    return {"method": "Welded UV workspace; exact CORNER-ID UV transfer onto untouched source mesh",
            "cornerCount": len(ids), "cornerAssociationPreservedExactly": True,
            "architecturalUv0PreservedExactly": True, "weldCoincidentVertices": True,
            "architecturalFaceCornerPositionsPreservedExactly": True,
            "architecturalTopologyPreservedExactly": True,
            "authoredSplitNormalsPreservedExactly": True,
            "weldForUvPackingOnly": True, "uvPackingVerticesAfterWeld": packing_vertices,
            "smartProjectAngleDegrees": 25, "uvOwnership": ownership,
            "weldToleranceMetres": .00001, "verticesBefore": before_vertices,
            "verticesAfter": len(mesh.vertices), "triangles": before_triangles,
            "maximumNormalStorageAngleDegrees": 0.0,
            "meanNormalStorageAngleDegrees": 0.0,
            "expectedNormalsSha256": hashlib.sha256(source_normals.tobytes()).hexdigest(),
            "actualNormalsSha256": hashlib.sha256(actual_normals.tobytes()).hexdigest()}
