"""CPU-only import census: no renderer/bake/export and no source writes."""
from pathlib import Path
import argparse
import hashlib
import json
import sys
import time
import bpy

D = Path(__file__).resolve().parent
sys.path.insert(0, str(D/'bake-source-current'))
from authored_lighting_uv_guard import snapshot_primary
from occluder_materials import material_fingerprint
H = lambda b: hashlib.sha256(b).hexdigest()
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--assembly-proof', type=Path, default=D/'assembly-proof.json')
parser.add_argument('--out', type=Path, default=D/'blender-import-comparison.json')
args = parser.parse_args()
proof = json.loads(args.assembly_proof.read_text())
out = args.out
assert not out.exists()
owned = set(proof['ownedReplacedNames'])
new = set(proof['newMetalObjectNames'])
assert len(owned) == 6 and len(new) == 16
started = time.monotonic()
states = []
for key in ['base', 'output']:
    path = Path(proof[key]['path'])
    assert H(path.read_bytes()) == proof[key]['sha256']
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path.resolve()))
    bpy.context.view_layer.update()
    objects = list(bpy.context.scene.objects)
    assert all(obj.type == 'MESH' for obj in objects)
    snapshot = snapshot_primary(objects)
    materials = {m.name: material_fingerprint(m) for obj in objects for m in obj.data.materials if m}
    states.append({'objects': snapshot['states'], 'materials': materials,
                   'frames': {obj.name: [list(row) for row in obj.matrix_world] for obj in objects},
                   'bindings': {obj.name: {'slots': [m.name if m else None for m in obj.data.materials],
                                          'usedMaterials': sorted({obj.data.materials[p.material_index].name if obj.data.materials[p.material_index] else None for p in obj.data.polygons})}
                                for obj in objects}})
base, current = states
assert len(base['objects']) == 3904 and len(current['objects']) == 3920
assert set(current['objects']) == set(base['objects']) | new
failures = []
for name, state in base['objects'].items():
    if name in owned:
        for field in ['worldMatrix', 'renderVisibility', 'materialIndices']:
            # A new rail has more faces, so material-index array size changes.
            if field == 'materialIndices':
                continue
            assert current['objects'][name][field] == state[field]
    elif current['objects'][name] != state:
        failures.append({'node': name, 'changedFields': [field for field in state if state[field] != current['objects'][name].get(field)]})
    if name not in owned:
        assert current['bindings'][name] == base['bindings'][name]
for name in owned:
    assert current['bindings'][name]['usedMaterials'] == ['PaintedStructuralIronArrivalsGuard'], ('Incorrect realized rail material', name, current['bindings'][name])
    assert base['bindings'][name]['usedMaterials'] == current['bindings'][name]['usedMaterials']
for name in new:
    assert current['bindings'][name]['usedMaterials'] == ['PaintedStructuralIronArrivalsStructure']
assert not failures, failures[:10]
assert base['materials'] == current['materials'] and len(base['materials']) == 7
architecture = 'concourse-arrivals baked static architecture'
assert current['objects'][architecture] == base['objects'][architecture]
result = {'schema': 1, 'status': 'PASS: actual Blender CPU imports preserve all opaque/unowned states and all seven material graphs',
          'baseSha256': proof['base']['sha256'], 'assembledInputSha256': proof['output']['sha256'],
          'baseObjects': 3904, 'candidateObjects': 3920, 'unownedObjectsExact': 3898,
          'ownedRailFramesAndVisibilityExact': True, 'allSevenPbrGraphsPackedImagesPropertiesExact': True,
          'architectureAllBuffersUv0Uv1NormalsMatricesVisibilityExact': True,
          'newObjectFramesBlenderMain0': {name: current['frames'][name] for name in sorted(new)},
          'preservedArchitectureState': current['objects'][architecture],
          'materialHashes': current['materials'], 'elapsedSeconds': time.monotonic()-started,
          'ownedRailRealizedFaceMaterialBindings': {name: current['bindings'][name] for name in sorted(owned)},
          'allNewIronFaceBindingsCorrect': True,
          'noRenderBakeExportExecuted': True, 'blenderVersion': bpy.app.version_string,
          'generatorSha256': H(Path(__file__).read_bytes())}
out.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({key: result[key] for key in ['status', 'baseObjects', 'candidateObjects', 'unownedObjectsExact', 'elapsedSeconds']}), flush=True)
