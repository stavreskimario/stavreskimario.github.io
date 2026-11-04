"""Synthetic assembly safeguards; never modifies authoritative source inputs."""
from pathlib import Path
import copy
import hashlib
import importlib.util
import json

D = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('p5_assembly_guarded', D/'assemble_input.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
H = lambda b: hashlib.sha256(b).hexdigest()
proof = json.loads((D/'assembly-proof-v3.json').read_text())
base = Path(proof['base']['path'])
candidate = Path(proof['geometryCandidate']['path'])
manifest_path = D.parent/'arrivals-p5-curvature-study-v1/candidate-v3-material-fixed/curve-study-manifest.json'
manifest = json.loads(manifest_path.read_text())
pins = {str(path): H(path.read_bytes()) for path in [base, candidate, manifest_path, D/'assemble_input.py']}
work = D/'assembly-controls-v1'
assert not work.exists()
work.mkdir()
raw, source, binary = module.read_glb(candidate)
owned_name = manifest['ownedRailChanges'][0]['node']
owner_index = next(i for i, node in enumerate(source['nodes']) if node.get('name') == owned_name)
new_index = next(i for i, node in enumerate(source['nodes']) if node.get('name', '').startswith('P5Curve '))
rows = []

def reject(label, mutate):
    changed = copy.deepcopy(source)
    mutate(changed)
    path = work/(label+'.glb')
    data = module.write_glb(path, changed, binary)
    declaration = copy.deepcopy(manifest)
    declaration['candidate']['path'] = str(path)
    declaration['candidate']['sha256'] = H(data)
    declaration_path = work/(label+'.json')
    declaration_path.write_text(json.dumps(declaration))
    try:
        module.assemble(base, path, declaration_path, work/(label+'-out.glb'), work/(label+'-out.json'))
    except (AssertionError, KeyError) as error:
        rows.append({'case': label, 'result': 'REJECTED', 'exception': type(error).__name__, 'message': str(error)})
    else:
        raise AssertionError('Unsafe synthetic assembly was accepted: '+label)

reject('owned-rail-frame-change', lambda j: j['nodes'][owner_index].update(translation=[.1, 0, 0]))
reject('nonfinite-addition-frame', lambda j: j['nodes'][new_index].update(translation=[float('nan'), 0, 0]))
def reparent(j):
    j['scenes'][j.get('scene', 0)]['nodes'].remove(new_index)
    j['nodes'][0]['children'] = [new_index]
reject('addition-parent-frame-would-be-lost', reparent)
def wrong_material(j):
    mesh = j['meshes'][j['nodes'][owner_index]['mesh']]
    mesh['primitives'][0]['material'] = next(i for i, material in enumerate(j['materials']) if material['name'] == 'PaintedStructuralIronArrivalsStructure')
reject('wrong-owned-rail-material', wrong_material)
reject('duplicate-node-name', lambda j: j['nodes'][new_index].update(name=owned_name))

# A controlled shared-mesh fixture demonstrates that only the owned node is
# redirected; no unowned user of the old rail mesh receives the new geometry.
_, b, bb = module.read_glb(base)
owned_base_index = next(i for i, node in enumerate(b['nodes']) if node.get('name') == owned_name)
shared_mesh = b['nodes'][owned_base_index]['mesh']
other = next(i for i, node in enumerate(b['nodes']) if i != owned_base_index and i != 0 and node.get('mesh') != shared_mesh)
b['nodes'][other]['mesh'] = shared_mesh
fixture = work/'shared-base.glb'
fixture_bytes = module.write_glb(fixture, b, bb)
module.BASE_SHA = H(fixture_bytes)  # fixture-only in-memory pin, not production code
output = work/'shared-mesh-out.glb'
receipt = work/'shared-mesh-out.json'
module.assemble(fixture, candidate, manifest_path, output, receipt)
_, after, _ = module.read_glb(output)
assert after['nodes'][other] == b['nodes'][other]
assert after['meshes'][shared_mesh] == b['meshes'][shared_mesh]
assert after['nodes'][owned_base_index]['mesh'] != shared_mesh
rows.append({'case': 'shared-owned-mesh', 'result': 'PASS: unowned user and old mesh exact; only owned node redirected'})
for path, digest in pins.items():
    assert H(Path(path).read_bytes()) == digest
result = {'schema': 1, 'status': 'PASS', 'scope': 'Five repinned unsafe synthetic inputs rejected; one synthetic shared-mesh branch preserves unowned geometry. These are assembly safeguards, not historical or physical candidate acceptance.',
          'cases': rows, 'authoritativeInputsUnchanged': True, 'sourcePins': pins,
          'generatorSha256': H(Path(__file__).read_bytes())}
(D/'assembler-controls.json').write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({'status': 'PASS', 'rejectedCases': 5, 'sharedMeshCase': 'PASS'}), flush=True)
