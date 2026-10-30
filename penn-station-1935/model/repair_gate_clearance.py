"""Move interpreted gate indicators out of the eastern walking aisle in Blender.

Apply after the stair-head and office-sign repairs, retaining the previous
editable scene as input. Canonical placements are in build_station.py.
"""
import argparse
import hashlib
import json
from pathlib import Path
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("input", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
assert args.input.resolve() != args.output.resolve()
bpy.ops.wm.open_mainfile(filepath=str(args.input.resolve()))
head = -42.2563
old_x, new_x = head + .40, head - .70
centres = [68.764528, 54.791453, 40.818378, 27.149065, 13.327870, -.341443, -13.555112, -27.224425, -40.321460]
slots = [(centre, side, centre + side * 1.95, centre + side * 2.15) for centre in centres for side in [-1, 1]]
report = {"input": args.input.name, "inputSha256": hashlib.sha256(args.input.read_bytes()).hexdigest(),
          "oldX": old_x, "newX": new_x, "oldTransverseOffset": 1.95, "newTransverseOffset": 2.15,
          "meshes": [], "fonts": [], "qualification": "Exact indicator placement is reconstructed; documented paired16ft order retained"}

def locate(point):
    x, y, z = point.x, point.z + 4.2672, -point.y
    if abs(x - old_x) > .337 or not -.008 <= y <= 4.89:
        return -1
    return next((i for i, (_, _, old_z, _) in enumerate(slots) if abs(z - old_z) <= .337), -1)

for material in ["PaintedStructuralIron", "ClockFace"]:
    obj = bpy.data.objects.get("03 Glass and iron concourse — " + material)
    assert obj and obj.type == "MESH"
    data = obj.data
    parents = list(range(len(data.vertices)))
    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    def union(a, b):
        a, b = find(a), find(b)
        if a != b:
            parents[b] = a
    for edge in data.edges:
        union(*edge.vertices)
    coincident = {}
    tags = []
    for vertex in data.vertices:
        key = tuple(round(float(v), 5) for v in vertex.co)
        if key in coincident:
            union(vertex.index, coincident[key])
        else:
            coincident[key] = vertex.index
        tags.append(locate(obj.matrix_world @ vertex.co))
    groups = {}
    for vertex in data.vertices:
        root, tag = find(vertex.index), tags[vertex.index]
        if root not in groups:
            groups[root] = tag
        elif groups[root] != tag:
            groups[root] = -1
    counts = [0] * len(slots)
    inverse = obj.matrix_world.inverted()
    for vertex in data.vertices:
        slot = groups[find(vertex.index)]
        if slot < 0:
            continue
        world = obj.matrix_world @ vertex.co
        world.x += new_x - old_x
        world.y -= slots[slot][3] - slots[slot][2]
        vertex.co = inverse @ world
        counts[slot] += 1
    assert all(count > 0 for count in counts), (material, counts)
    data.update()
    report["meshes"].append({"material": material, "movedVertices": sum(counts), "countsPerPost": counts})

for obj in bpy.data.objects:
    if obj.type != "FONT" or not obj.name.startswith("Plan-derived track indicator number"):
        continue
    world = obj.matrix_world.translation
    slot = locate(world)
    assert slot >= 0, obj.name
    obj.location += Vector((new_x - old_x, -(slots[slot][3] - slots[slot][2]), 0))
    report["fonts"].append({"name": obj.name, "slot": slot})
assert len(report["fonts"]) == 72
bpy.context.scene["gate_indicator_maintenance"] = "Paired16ft indicators on supported stair flanks; exact placement reconstructed. Clears eastern walking aisle."
bpy.context.preferences.filepaths.save_version = 0
args.output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(args.output.resolve()), compress=True)
report["output"] = args.output.name
report["outputSha256"] = hashlib.sha256(args.output.read_bytes()).hexdigest()
args.output.with_suffix(".gate-repair.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps({"output": str(args.output), "sha256": report["outputSha256"], "meshes": report["meshes"], "fonts": len(report["fonts"])}))
