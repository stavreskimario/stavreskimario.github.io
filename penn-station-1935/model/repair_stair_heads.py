"""Apply the delivered stair-head seam correction to the editable Blender scene.

This is the same120mm boundary change in build_station.py. The rest of the
batched geometry, Geometry Nodes, materials and source lighting stay intact.
Run with pinned bpy4.3.0 and preserve the input .blend.
"""
import argparse
import hashlib
import json
from pathlib import Path
import bpy

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("input", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
assert args.input.resolve() != args.output.resolve(), "Preserve the previous authored scene"
bpy.ops.wm.open_mainfile(filepath=str(args.input.resolve()))
floor = bpy.data.objects.get("03 Glass and iron concourse — PublicFloorMarble")
assert floor and floor.type == "MESH"
head = -42.2563
old = head + .12
changed = []
for vertex in floor.data.vertices:
    # This batch retains Main-relative local coordinates; its world object
    # transform lowers the floor4.2672m. Do not lower its vertices again.
    x, y, z = vertex.co
    if abs(x - old) <= .00002 and -.44002 <= z <= .00002:
        changed.append({"vertex": vertex.index, "before": [x, y, z]})
        vertex.co.x = head
assert changed, "Expected floor-hole vertices are missing"
floor.data.update()
bpy.context.scene["stair_head_maintenance"] = "Phase4: main-floor holes end at stair head X=-42.2563; closes118mm unsupported slot; authored tread positions unchanged"
bpy.context.preferences.filepaths.save_version = 0
args.output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()), compress=True)
report = {"input": str(args.input.name), "inputSha256": hashlib.sha256(args.input.read_bytes()).hexdigest(),
          "output": str(args.output.name), "outputSha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
          "stairHeadX": head, "previousHoleEdgeX": old, "revisedHoleEdgeX": head,
          "changedVertices": changed, "geometryScope": "Concourse PublicFloorMarble, main slab and axial passage floor only"}
args.output.with_suffix(".stair-repair.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"output": str(args.output), "changedVertices": len(changed), "sha256": report["outputSha256"]}))
