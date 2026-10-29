"""Blender control for a normal-only repair; no renderer or asset mutation."""
from pathlib import Path
import sys

import bpy
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "penn-station-1935/model"))
from surface_finish_normals import clamp_backfacing_corner_normals


mesh = bpy.data.meshes.new("Normal hemisphere negative control")
mesh.from_pydata([(0, 0, 0), (1, 0, 0), (0, 1, 0)], [], [(0, 1, 2)])
mesh.update()
for face in mesh.polygons:
    face.use_smooth = True
uv = mesh.uv_layers.new(name="ArchitecturalUV")
for corner, value in zip(uv.data, [(0, 0), (1, 0), (0, 1)]):
    corner.uv = value
mesh.normals_split_custom_set([(0, 0, -1)] * 3)
positions = np.asarray([vertex.co[:] for vertex in mesh.vertices])
texture_coordinates = np.asarray([corner.uv[:] for corner in mesh.uv_layers["ArchitecturalUV"].data])
result = clamp_backfacing_corner_normals(mesh)
assert result["oppositeCornersBefore"] == 3
assert result["oppositeCornersAfter"] == 0
assert result["minimumDotAfter"] > .99
assert np.array_equal(positions, np.asarray([vertex.co[:] for vertex in mesh.vertices]))
assert np.array_equal(texture_coordinates, np.asarray([
    corner.uv[:] for corner in mesh.uv_layers["ArchitecturalUV"].data]))
second = clamp_backfacing_corner_normals(mesh)
assert second["changedCorners"] == 0
assert second["normalSha256Before"] == second["normalSha256After"]
for invalid in [0, 1, -.1, 1.1]:
    try:
        clamp_backfacing_corner_normals(mesh, invalid)
    except ValueError:
        pass
    else:
        raise AssertionError("Invalid normal bound accepted")
quad = bpy.data.meshes.new("Unreviewed quad control")
quad.from_pydata([(0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)], [], [(0, 1, 2, 3)])
quad.update()
try:
    clamp_backfacing_corner_normals(quad)
except ValueError:
    pass
else:
    raise AssertionError("Untriangulated geometry accepted without review")
print("PASS: backward corner normals, unchanged positions/UV0, idempotence and invalid geometry/bounds")
