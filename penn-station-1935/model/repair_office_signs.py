"""Turn the four office labels toward the hall in an existing editable scene.

Apply after repair_stair_heads.py to retain that independent correction.
Glyphs rotate rigidly about their original anchors; wording stays unchanged.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import bpy

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("input", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
assert args.input.resolve() != args.output.resolve(), "Preserve the previous authored scene"
bpy.ops.wm.open_mainfile(filepath=str(args.input.resolve()))
objects = [o for o in bpy.data.objects if o.name.startswith("Opening-era office lettering")]
assert len(objects) == 4 and all(o.type == "FONT" for o in objects), "Four editable source labels must exist"
anchors = []
for obj in objects:
    p = obj.matrix_world.translation
    assert abs(abs(p.x) - 15.51) < .0001 and abs(abs(p.y) - 28.144) < .0001
    assert abs(p.z - (3.68 - 4.2672)) < .0001
    before = tuple(obj.rotation_euler)
    assert abs(before[2] - (math.pi / 2 if p.x > 0 else -math.pi / 2)) < .0001
    obj.rotation_euler.z = -math.pi / 2 if p.x > 0 else math.pi / 2
    anchors.append({"object": obj.name, "text": obj.data.body, "anchor": list(p),
                    "beforeRotation": before, "afterRotation": tuple(obj.rotation_euler)})
bpy.context.scene["office_label_maintenance"] = "Phase4: four office labels rigidly turned toward waiting-room passengers; original words and anchors retained"
bpy.context.preferences.filepaths.save_version = 0
args.output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()), compress=True)
report = {"input": args.input.name, "inputSha256": hashlib.sha256(args.input.read_bytes()).hexdigest(),
          "output": args.output.name, "outputSha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
          "labels": anchors, "operation": "Rigid180degree rotation around world vertical through each source anchor"}
args.output.with_suffix(".office-repair.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report))
