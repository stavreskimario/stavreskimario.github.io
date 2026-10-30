"""Small Blender regression: coherent charts must preserve split normals/UV0."""
from pathlib import Path
import math
import sys

import bpy
import numpy as np
from bpy_extras.mesh_utils import mesh_linked_uv_islands

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "penn-station-1935/model"))
from vault_lighting_uv import prepare_vault_uv

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
report = prepare_vault_uv(obj, 1024, 4)
assert report["cornerAssociationPreservedExactly"]
assert report["architecturalUv0PreservedExactly"]
assert report["cornerCount"] == 6 and report["triangles"] == 2
assert report["verticesBefore"] == 6 and report["verticesAfter"] == 4
assert report["maximumNormalStorageAngleDegrees"] < .1
assert "penn_authored_corner_id" not in mesh.attributes
assert len(mesh_linked_uv_islands(mesh)) == 1, "The two faces need one coherent lighting chart"
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
print("PASS: one welded chart, exact corner/UV0 associations, retained split normals and repeated-unwrap rejection")
