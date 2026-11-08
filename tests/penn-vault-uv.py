"""Small Blender regression: coherent charts must preserve split normals/UV0."""
from pathlib import Path
import math
import sys

import bpy
import numpy as np
from bpy_extras.mesh_utils import mesh_linked_uv_islands

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "penn-station-1935/model"))
from vault_lighting_uv import prepare_vault_uv
from uv_ownership import audit_uv_ownership, require_unique_uv_ownership

# Same-winding triangles can fold onto one UV region. This fixture reproduces
# the failure that a winding check or a coarse pixel-centre mask would miss.
folded = np.asarray([[(.1, .1), (.7, .1), (.1, .7)],
                     [(.2, .2), (.8, .2), (.2, .8)]], dtype=np.float64)
assert audit_uv_ownership(folded)["overlappingTrianglePairs"] == 1
try:
    require_unique_uv_ownership(folded)
except RuntimeError:
    pass
else:
    raise AssertionError("Two distant relief surfaces cannot share atlas interiors")
shared_edge = np.asarray([[(0, 0), (1, 0), (1, 1)],
                         [(0, 0), (1, 1), (0, 1)]], dtype=np.float64)
assert require_unique_uv_ownership(shared_edge)["overlappingTrianglePairs"] == 0
collapsed = np.asarray([[(0, 0), (.5, .5), (1, 1)]], dtype=np.float64)
try:
    require_unique_uv_ownership(collapsed)
except RuntimeError:
    pass
else:
    raise AssertionError("A zero-area lighting triangle must fail before baking")

bpy.ops.wm.read_factory_settings(use_empty=True)
mesh = bpy.data.meshes.new("Two connected faces with separate authored normals")
mesh.from_pydata([(0, 0, 0), (1, 0, 0), (1, 1, .3),
                 (0, 0, 0), (1, 1, .3), (0, 1, 0)], [], [(0, 1, 2), (3, 4, 5)])
mesh.update()
for face in mesh.polygons:
    face.use_smooth = True
layer = mesh.uv_layers.new(name="ArchitecturalUV")
source_uv = np.asarray([(i / 10, (i + 1) / 10) for i in range(6)], dtype=np.float32)
layer.data.foreach_set("uv", source_uv.reshape(-1))
source_normals = [(0, 0, 1)] * 3 + [(0, .3, math.sqrt(.91))] * 3
mesh.normals_split_custom_set(source_normals)
obj = bpy.data.objects.new("Vault fixture", mesh)
bpy.context.scene.collection.objects.link(obj)
source_vertex_indices = np.asarray([corner.vertex_index for corner in mesh.loops], dtype=np.int32)
report = prepare_vault_uv(obj, 1024, 4)
mesh = obj.data
assert np.array_equal(np.asarray([corner.vertex_index for corner in mesh.loops], dtype=np.int32), source_vertex_indices)
assert report["cornerAssociationPreservedExactly"]
assert report["architecturalUv0PreservedExactly"]
assert report["architecturalFaceCornerPositionsPreservedExactly"]
assert report["uvOwnership"]["overlappingTrianglePairs"] == 0
assert report["uvOwnership"]["zeroAreaTriangles"] == 0
assert report["cornerCount"] == 6 and report["triangles"] == 2
assert report["verticesBefore"] == report["verticesAfter"] == 6
assert report["uvPackingVerticesAfterWeld"] == 4
assert report["authoredSplitNormalsPreservedExactly"]
assert report["architecturalTopologyPreservedExactly"]
assert report["maximumNormalStorageAngleDegrees"] < .1
assert "penn_authored_corner_id" not in mesh.attributes
# The original split vertices remain split. Their common architectural edge
# must nevertheless receive the same two UV coordinates from one packed chart.
light_uv = np.asarray([corner.uv[:] for corner in mesh.uv_layers["BakedLightingUV"].data])
assert np.array_equal(light_uv[0], light_uv[3])
assert np.array_equal(light_uv[2], light_uv[4])
actual_uv = np.asarray([corner.uv[:] for corner in mesh.uv_layers[0].data])
assert {tuple(v) for v in actual_uv} == {tuple(v) for v in source_uv}
normals = np.asarray([normal.vector[:] for normal in mesh.corner_normals])
assert np.any(normals[:, 1] > .29) and np.any(np.abs(normals[:, 1]) < .001)
try:
    prepare_vault_uv(obj, 1024, 4)
except ValueError:
    pass
else:
    raise AssertionError("A second unwrap must reject an already baked source")
print("PASS: uniquely owned coherent UV chart; exact original geometry, UV0 and split-normal storage; fold/collapse rejection")
