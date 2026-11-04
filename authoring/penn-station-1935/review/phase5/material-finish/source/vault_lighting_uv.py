"""Pack coherent vault charts while retaining authored split corner normals.

Coincident vertices are welded for UV connectivity. A temporary integer corner
attribute follows each original face corner through Blender's edit operations,
so the original shading direction and architectural UV can be restored/proved
without approximate spatial matching. Normal fans are separated only after the
UV charts are packed; explicit custom normals retain the authored smooth bands.
"""
import hashlib
import math

import bpy
import numpy as np


def prepare_vault_uv(obj, resolution, margin_pixels):
    mesh = obj.data
    if obj.type != "MESH" or not mesh.uv_layers:
        raise ValueError("A vault mesh with architectural UV0 is required")
    if "BakedLightingUV" in mesh.uv_layers or "penn_authored_corner_id" in mesh.attributes:
        raise ValueError("Vault UV preparation must start from unbaked source geometry")
    if any(len(face.vertices) != 3 for face in mesh.polygons):
        raise ValueError("Only the existing triangulated coffer surface is supported")
    source_normals = np.empty(len(mesh.loops) * 3, dtype=np.float32)
    mesh.corner_normals.foreach_get("vector", source_normals)
    source_normals = source_normals.reshape(-1, 3)
    source_uv = np.empty(len(mesh.loops) * 2, dtype=np.float32)
    mesh.uv_layers[0].data.foreach_get("uv", source_uv)
    source_uv = source_uv.reshape(-1, 2)
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
    bpy.ops.uv.smart_project(angle_limit=math.radians(75), island_margin=margin_pixels / resolution,
                            margin_method="FRACTION", area_weight=.5,
                            correct_aspect=True, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    ids = np.empty(len(mesh.loops), dtype=np.int32)
    mesh.attributes["penn_authored_corner_id"].data.foreach_get("value", ids)
    if not np.array_equal(np.sort(ids), np.arange(len(source_normals))):
        raise RuntimeError("Welding lost or duplicated an authored vault face corner")
    if len(mesh.polygons) != before_triangles:
        raise RuntimeError("Vault UV preparation changed its triangle count")
    # Separate normal storage fans after packing. This preserves chart
    # connectivity and avoids large-direction quantization in mixed sharp fans.
    for edge in mesh.edges:
        edge.use_edge_sharp = True
    mesh.update()
    expected_normals = source_normals[ids]
    mesh.normals_split_custom_set(expected_normals.tolist())
    mesh.update()
    mesh.attributes.remove(mesh.attributes["penn_authored_corner_id"])
    actual_uv = np.empty(len(mesh.loops) * 2, dtype=np.float32)
    mesh.uv_layers[0].data.foreach_get("uv", actual_uv)
    if not np.array_equal(actual_uv.reshape(-1, 2), source_uv[ids]):
        raise RuntimeError("Welding changed an authored architectural UV0 corner")
    actual_normals = np.empty_like(source_normals)
    mesh.corner_normals.foreach_get("vector", actual_normals.reshape(-1))
    dot = np.einsum("ij,ij->i", expected_normals, actual_normals)
    angles = np.degrees(np.arccos(np.clip(dot, -1, 1)))
    if float(angles.max()) >= .1:
        raise RuntimeError("Blender normal storage changed a vault direction by more than0.1degree")
    return {"method": "Coherent welded UV charts; integer CORNER-ID restoration of authored split normals",
            "cornerCount": len(ids), "cornerAssociationPreservedExactly": True,
            "architecturalUv0PreservedExactly": True, "weldCoincidentVertices": True,
            "weldToleranceMetres": .00001, "verticesBefore": before_vertices,
            "verticesAfter": len(mesh.vertices), "triangles": before_triangles,
            "maximumNormalStorageAngleDegrees": float(angles.max()),
            "meanNormalStorageAngleDegrees": float(angles.mean()),
            "expectedNormalsSha256": hashlib.sha256(expected_normals.tobytes()).hexdigest(),
            "actualNormalsSha256": hashlib.sha256(actual_normals.tobytes()).hexdigest()}
