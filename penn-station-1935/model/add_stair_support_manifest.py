"""Add exact authored stair-flight metadata without rebuilding geometry.

The three reviewed stair_flight call expressions are read from the canonical
source and evaluated with that model's existing datums. No Blender operations
or other source expressions are executed. Receiving-landing centres are not
used as flight endpoints. Input manifests are preserved by writing a new file.
"""
import argparse
import ast
import copy
import hashlib
import json
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("input", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
assert args.input.resolve() != args.output.resolve()
source = Path(__file__).with_name("build_station.py")
tree = ast.parse(source.read_text())
loop = next(node for node in tree.body if isinstance(node, ast.For)
            and isinstance(node.iter, ast.Call) and isinstance(node.iter.func, ast.Name)
            and node.iter.func.id == "enumerate" and len(node.iter.args) == 1
            and isinstance(node.iter.args[0], ast.Name) and node.iter.args[0].id == "ACCESS_CENTRES")
calls = [node for node in loop.body if isinstance(node, ast.Expr) and isinstance(node.value, ast.Call)
         and isinstance(node.value.func, ast.Name) and node.value.func.id == "stair_flight"]
middle = [node for node in loop.body if isinstance(node, ast.Assign)
          and any(isinstance(target, ast.Name) and target.id == "middle" for target in node.targets)]
assert len(calls) == 3 and len(middle) == 1
loop = copy.deepcopy(loop)
loop.body = [calls[0], middle[0], calls[1], calls[2]]
lower_shift = next(node.value.value for node in tree.body if isinstance(node, ast.Assign)
                   and isinstance(node.value, ast.Constant)
                   and any(isinstance(target, ast.Name) and target.id == "LOWER_SHIFT" for target in node.targets))
raw = args.input.read_bytes()
manifest = json.loads(raw)
before = copy.deepcopy(manifest)
drop = manifest["levels"]["mainToStreet"]
records = []
def record(name, x0, x1, cy, z0, z1, width, steps):
    records.append({"label": f"{name} at Z{-cy:.6f}", "start": [x0, z0-drop, -cy],
                    "end": [x1, z1-drop, -cy], "width": width})
namespace = {"enumerate": enumerate, "ACCESS_CENTRES": [-s["centerZ"] for s in manifest["accessStairs"]],
             "STAIR_HEAD_X": manifest["accessStairs"][0]["mainFlight"]["start"][0],
             "EXIT_LEVEL": manifest["levels"]["exitWorld"] + drop,
             "PLATFORM_LEVEL": manifest["levels"]["platformWorld"] + drop,
             "LOWER_SHIFT": lower_shift, "stair_flight": record}
exec(compile(ast.Module(body=[loop], type_ignores=[]), str(source), "exec"), {"__builtins__": {}}, namespace)
assert len(records) == 27
for stair, main, first, returning in zip(manifest["accessStairs"], records[::3], records[1::3], records[2::3]):
    for actual, expected in zip(main["start"] + main["end"], stair["mainFlight"]["start"] + stair["mainFlight"]["end"]):
        assert abs(actual - expected) < 1e-10
    assert main["width"] == 3 and first["width"] == returning["width"] == 1.45
    assert first["end"][0] == returning["start"][0]
    assert abs(first["end"][1] - returning["start"][1]) < 1e-10
manifest["stairSupportFlights"] = records
before.pop("stairSupportFlights", None)
unchanged = copy.deepcopy(manifest)
unchanged.pop("stairSupportFlights")
assert before == unchanged
out = (json.dumps(manifest, indent=2) + "\n").encode()
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_bytes(out)
receipt = {"source": str(source.name), "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(),
           "input": args.input.name, "inputSha256": hashlib.sha256(raw).hexdigest(),
           "output": args.output.name, "outputSha256": hashlib.sha256(out).hexdigest(),
           "flights": len(records), "otherManifestDataUnchanged": True,
           "method": "Evaluate only canonical three stair_flight calls and their middle-level assignment for the nine existing registered access centres",
           "scope": "Physical flight footprints and world datums; browser support still requires actual ray hits, with no analytic floor introduced"}
args.output.with_suffix(".flights-receipt.json").write_text(json.dumps(receipt, indent=2) + "\n")
print(json.dumps({"output": str(args.output), "flights": len(records), "sha256": receipt["outputSha256"]}))
