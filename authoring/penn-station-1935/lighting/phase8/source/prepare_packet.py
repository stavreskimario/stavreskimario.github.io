"""Freeze a reviewable command; does not invoke Blender, Cycles or a GPU."""
from pathlib import Path
import argparse
import hashlib
import json
import struct

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--input', type=Path, required=True)
parser.add_argument('--assembly-proof', type=Path, required=True)
parser.add_argument('--geometry-manifest', type=Path, required=True)
args = parser.parse_args()
D = Path(__file__).resolve().parent
W = D.parents[1]
H = lambda b: hashlib.sha256(b).hexdigest()
prior = json.loads((D.with_name('arrivals-lighting-uv-priority-v2')/'frozen-bake-command.json').read_text())
assembly = json.loads(args.assembly_proof.read_text())
input_bytes = args.input.read_bytes()
assert H(input_bytes) == assembly['output']['sha256']
assert H(args.geometry_manifest.read_bytes()) == assembly['geometryManifestSha256']
assert assembly['allOpaqueArchitectureMeshAndAccessorBytesExact']
assert assembly['allOriginalMaterialTextureImageSamplerDefinitionsAndImageBytesExact']
assert assembly['outputNodeCount'] == 3920
out = D.with_name('arrivals-p5-baked-v1')
assert not out.exists()
source = D/'bake-source-current'
argv = [str(source/'bake_lighting.py'), str(args.input.resolve()), '--out', str(out),
        '--zone', 'concourse', '--artifact-name', 'concourse-arrivals',
        '--preserve-authored-uv1', '--occluder-materials', str(W/'phase5-materials/material-library'),
        '--resolution', '4096', '--samples', '256', '--device', 'METAL', '--threads', '4',
        '--uv-margin-pixels', '4', '--source-visibility-proof', prior['sourceVisibility']['proof']]
for context in prior['contexts']:
    argv += ['--occluder', context['zone']+'='+context['path']]
files = []
seen = set()
def pin(path, role):
    path = Path(path).resolve()
    if str(path) in seen:
        return
    seen.add(str(path))
    data = path.read_bytes()
    files.append({'path': str(path), 'bytes': len(data), 'sha256': H(data), 'role': role})

for path in source.glob('*.py'):
    pin(path, 'Frozen current production bake helper')
pin(args.input, 'Unquantized primary with preserved opaque architecture/UV/PBR and changed unbaked P5 iron')
pin(args.assembly_proof, 'Source assembly preservation proof')
pin(args.geometry_manifest, 'Geometry ownership and reconstruction limits; not visual approval')
for key in ['base', 'geometryCandidate']:
    assert H(Path(assembly[key]['path']).read_bytes()) == assembly[key]['sha256']
    pin(assembly[key]['path'], 'Exact source-assembly input; not read by Cycles directly')
pin(D/'assemble_input.py', 'Exact Blender-geometry assembler; no generated architecture')
for name in ['prepare_packet.py', 'compare_blender_imports.py', 'run_full_context_preflight.py']:
    pin(D/name, 'Exact packet or CPU-preflight preparation helper')
pin(D/'base-optical-lineage.json', 'Optical PBR/current normal-image lineage')
for context in prior['contexts']:
    assert H(Path(context['path']).read_bytes()) == context['sha256']
    pin(context['path'], 'Registered existing context')
pin(prior['sourceVisibility']['proof'], 'Original two-template source render visibility')
material_pins = json.loads((D.with_name('arrivals-lighting-uv-priority-v2')/'material-library-pins.json').read_text())
for row in material_pins['files']:
    assert H(Path(row['path']).read_bytes()) == row['sha256']
    pin(row['path'], 'Reviewed neighbour-only PBR library')
for row in prior['filePins']:
    if row.get('role', '').startswith('Canonical'):
        assert H(Path(row['path']).read_bytes()) == row['sha256']
        pin(row['path'], 'Unchanged canonical prerequisite/context source')
n = struct.unpack_from('<I', input_bytes, 12)[0]
j = json.loads(input_bytes[20:20+n])
assert len(j['nodes']) == 3920 and len(j['materials']) == 7
assert j['nodes'][0]['name'] == 'concourse-arrivals baked static architecture'
assert len(j['meshes'][j['nodes'][0]['mesh']]['primitives']) == 4
packet = {'schema': 1,
    'status': 'PREPARATION ONLY; SOURCE GEOMETRY/VISUAL ACCEPTANCE AND CPU PREFLIGHT PENDING; NO GPU EXECUTED',
    'artifact': 'concourse-arrivals', 'frame': 'Main0;glTFYup/BlenderZup', 'argv': argv, 'out': str(out),
    'filePins': files, 'contexts': prior['contexts'], 'sourceVisibility': prior['sourceVisibility'],
    'onlyOnePrimary': {**prior['onlyOnePrimary'], 'newUnbakedIronAdditions': 16, 'ownedUnbakedRailMeshesReplaced': 6,
                       'weightedOpaqueSourceSha256': assembly['base']['sha256'], 'atlasRepacked': False},
    'sourceAssembly': {'path': str(args.assembly_proof.resolve()), 'sha256': H(args.assembly_proof.read_bytes())},
    'geometryOwnership': {'manifest': str(args.geometry_manifest.resolve()), 'sha256': H(args.geometry_manifest.read_bytes()),
                          'sourceVisualAcceptedByThisWorker': False},
    'occluderPbrCalibration': prior['occluderPbrCalibration'],
    'freshAoBindingRegression': prior['freshAoBindingRegression'],
    'atlas': {'resolution': 4096, 'samples': 256, 'allOriginalUv0Uv1OpaqueBuffersExact': True,
              'treadLandingGiPixelsPerMetre': 115.81, 'existingAtlasReusedWithoutRepack': True},
    'limits': ['Only the root may run the guarded Metal command after source/visual acceptance and a quiet GPU window.',
               'This preparation executes no rendering, GPU, baking, encoding, browser integration or root mutation.',
               'Old AO and old sky metadata in the authoritative pre-bake input are placeholders. Actual fresh AO/export, HDR/calibration and pixel checks remain mandatory.',
               'Reconstruction includes inferred radii/thickness; upper haunch and broader historical holds remain separate.',
               'No directional sun is baked; this is neutral-sky transport from current interpreted geometry/materials.']}
packet['freshAoBindingRegression'] = dict(packet['freshAoBindingRegression'])
packet['freshAoBindingRegression']['reusedByComposition'] = 'The new input preserves opaque architecture/material/image definitions and the original BIN prefix from85bf; the c77 fresh-AO binding helper is unchanged. Current CPU preflight must prove primary shader/image states remain unchanged, and the actual fresh bake must prove all four exported AO images.'
packet['freshAoBindingRegression']['currentHelperSha256'] = H((source/'baked_occlusion_binding.py').read_bytes())
packet['freshAoBindingRegression']['currentInputIsWholeFileIdenticalToPriorRegression'] = False
packet['occluderPbrCalibration'] = {'priorAcceptedReference': prior['occluderPbrCalibration'], 'currentActualPreflightPending': True}
(D/'bake-command-preparation.json').write_text(json.dumps(packet, indent=2)+'\n')
print(json.dumps({'status': packet['status'], 'filePins': len(files), 'primaryNodes': len(j['nodes']), 'contexts': len(packet['contexts']), 'out': str(out)}, indent=2))
