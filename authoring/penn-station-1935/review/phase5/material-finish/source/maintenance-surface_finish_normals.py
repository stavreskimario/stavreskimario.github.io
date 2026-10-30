"""Bound rare coffer cusp normals to their actual triangle's front hemisphere.

This changes shading vectors only. It neither moves vertices nor repairs a
silhouette by smoothing geometry. Existing custom normals are retained except
where a derivative evaluated across the intersecting barrels points behind its
own triangle. Sharp boundaries between the authored moulding bands stay split.
"""
import hashlib
import math

import numpy as np


def clamp_backfacing_corner_normals(mesh, minimum_dot=.25):
    if not 0 < minimum_dot < 1:
        raise ValueError("Normal hemisphere bound must lie strictly between0 and1")
    mesh.calc_loop_triangles()
    if any(len(face.vertices) != 3 for face in mesh.polygons):
        raise ValueError("The coffer normal proof requires its existing triangulated surface")
    positions = np.empty(len(mesh.vertices) * 3, dtype=np.float32)
    mesh.vertices.foreach_get("co", positions)
    positions = positions.reshape(-1, 3)
    triangles = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    mesh.loop_triangles.foreach_get("vertices", triangles)
    triangles = triangles.reshape(-1, 3)
    loops = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
    mesh.loop_triangles.foreach_get("loops", loops)
    loops = loops.reshape(-1, 3)
    normals = np.empty(len(mesh.loops) * 3, dtype=np.float32)
    mesh.corner_normals.foreach_get("vector", normals)
    normals = normals.reshape(-1, 3)
    original = normals.copy()
    points = positions[triangles]
    face_normals = np.cross(points[:, 1] - points[:, 0], points[:, 2] - points[:, 0])
    lengths = np.linalg.norm(face_normals, axis=1)
    if np.any(lengths <= 1e-10):
        raise ValueError("A degenerate triangle needs geometry review, not a shading-vector clamp")
    face_normals /= lengths[:, None]
    before_dot = np.einsum("tj,tvj->tv", face_normals, normals[loops])
    corrections = np.argwhere(before_dot < minimum_dot)
    for face_index, corner in corrections:
        index = loops[face_index, corner]
        normal = face_normals[face_index]
        tangent = normals[index] - normal * before_dot[face_index, corner]
        length = np.linalg.norm(tangent)
        normals[index] = (normal if length < 1e-10 else
                          tangent / length * math.sqrt(1 - minimum_dot ** 2) + normal * minimum_dot)
    mesh.normals_split_custom_set(normals.tolist())
    mesh.update()
    actual = np.empty_like(normals)
    mesh.corner_normals.foreach_get("vector", actual.reshape(-1))
    after_dot = np.einsum("tj,tvj->tv", face_normals, actual[loops])
    if float(after_dot.min()) < minimum_dot - .002:
        raise RuntimeError("Blender did not preserve the bounded coffer corner normals")
    return {"changedCorners": len(corrections), "totalCorners": len(normals),
            "minimumDotBefore": float(before_dot.min()), "minimumDotAfter": float(after_dot.min()),
            "oppositeCornersBefore": int((before_dot < 0).sum()),
            "oppositeCornersAfter": int((after_dot < 0).sum()),
            "minimumDotBound": minimum_dot,
            "normalSha256Before": hashlib.sha256(original.tobytes()).hexdigest(),
            "normalSha256After": hashlib.sha256(actual.tobytes()).hexdigest()}
