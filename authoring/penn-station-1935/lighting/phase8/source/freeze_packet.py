"""Freeze the reviewed P5 GI command. This file never runs Blender or a GPU."""
from pathlib import Path
import copy
import gzip
import hashlib
import json

D = Path(__file__).resolve().parent
W = D.parent
H = lambda b: hashlib.sha256(b).hexdigest()
packet = json.loads((D/'bake-command-preparation.json').read_text())
assembly_path = D/'assembly-proof-v3.json'
assembly = json.loads(assembly_path.read_text())
imports_path = D/'blender-import-comparison-v3.json'
imports = json.loads(imports_path.read_text())
cpu_path = D/'cpu-preflight-v3/preflight-proof.json'
cpu = json.loads(cpu_path.read_text())
visual_path = W/'arrivals-p5-curvature-study-v1/root-visual-v3/root-visual-review.json'
visual = json.loads(visual_path.read_text())
independent_path = W/'arrivals-p5-curvature-review-v1/final-v3/SUMMARY.json'
independent = json.loads(independent_path.read_text())
source_cpu_path = W/'arrivals-p5-curvature-study-v1/CPU-SUMMARY-v3.json'
source_cpu = json.loads(source_cpu_path.read_text())
input_hash = assembly['output']['sha256']
assert input_hash == '26f17e32c793a7a85ea279158a98cecac68e890b77fe2c5d18f74965b9e2713b'
assert H(Path(packet['argv'][1]).read_bytes()) == input_hash
assert imports['assembledInputSha256'] == cpu['inputSha256'] == input_hash
assert imports['allNewIronFaceBindingsCorrect'] and imports['allSevenPbrGraphsPackedImagesPropertiesExact']
assert imports['architectureAllBuffersUv0Uv1NormalsMatricesVisibilityExact'] and imports['unownedObjectsExact'] == 3898
assert cpu['noRenderingCallExecuted'] and cpu['actualDevice']['backend'] == 'CPU'
assert cpu['onlyArchitectureSelectedAndActive'] and len(cpu['contextCensus']) == 8
assert cpu['primaryImportedObjects'] == cpu['inputJsonNodes'] == 3920
assert len(cpu['surfaceProfiles']) == 28
assert cpu['importedBufferIntegrity']['allImportedPrimaryBuffersByteExactBeforeBake']
assert cpu['occluderMaterialIntegrity']['primaryMaterialGraphsExactSinceInitialImport']
assert H(visual_path.read_bytes()) == 'c1bf6bee1fdc6c0633078836855970978d9e957524b6b577c29f6c06427ea271'
assert H(independent_path.read_bytes()) == '9a7ec034fea5c15250d23aafdb8da1492a39f8d321913edfd1ae082904fd19d5'
assert H(source_cpu_path.read_bytes()) == '51961a17d91eea0c3bb3c6fee538ef67965a379958cf5e34520b106970d7a5f5'
assert visual['rawCandidateSha256'] == assembly['geometryCandidate']['sha256'] == source_cpu['candidateSha256']
assert visual['status'].startswith('PASS') and independent['status'].startswith('PASS')
assert assembly['generatorSha256'] == H((D/'assemble_input.py').read_bytes())
assert imports['generatorSha256'] == H((D/'compare_blender_imports.py').read_bytes())
assert cpu['generatorSha256'] == H((D/'run_full_context_preflight.py').read_bytes())

seen = {row['path'] for row in packet['filePins']}
def pin(path, role):
    path = Path(path).resolve()
    if str(path) not in seen:
        data = path.read_bytes()
        packet['filePins'].append({'path': str(path), 'bytes': len(data), 'sha256': H(data), 'role': role})
        seen.add(str(path))

for path, role in [(imports_path, 'Actual primary import/realized face-material check'),
                   (cpu_path, 'Actual eight-context CPU preparation; no bake'),
                   (visual_path, 'Root bounded appearance acceptance and historical qualifications'),
                   (independent_path, 'Independent actual source ownership/contact/material acceptance'),
                   (source_cpu_path, 'Raw source route/material/reopen acceptance'),
                   (D/'assembler-controls.json', 'Assembly rejection and shared-mesh controls'),
                   (D/'check_assembler_controls.py', 'Exact assembler control helper'),
                   (D/'freeze_packet.py', 'Exact command-freezing helper'),
                   (D/'toolchain.json', 'Verified offline toolchain'),
                   (Path(packet['freshAoBindingRegression']['path']), 'Retained fresh-AO exporter regression reference'),
                   (Path(packet['onlyOnePrimary']['proof']), 'Original deduplicated-context removal proof')]:
    pin(path, role)
geometry_manifest = json.loads(Path(packet['geometryOwnership']['manifest']).read_text())
for row in geometry_manifest['artifacts'].values():
    path = Path(row['path'])
    assert H(path.read_bytes()) == row['sha256']
    pin(path, 'Frozen actual Blender authoring or geometry export')

packet['status'] = 'FROZEN READY FOR ROOT REVIEW/QUIET METAL WINDOW: v3 source/import/context/appearance checks pass; NO GPU EXECUTED'
packet['cpuPreflight'] = {'path': str(cpu_path), 'sha256': H(cpu_path.read_bytes()),
                          'actualDevice': cpu['actualDevice'], 'primaryObjects': 3920, 'contexts': 8,
                          'actualNeighborProfiles': 28, 'allPrimaryImportedBuffersExact': True}
packet['primaryImportComparison'] = {'path': str(imports_path), 'sha256': H(imports_path.read_bytes()),
                                    'allOwnedRailRealizedFacesUseExistingGuard': True,
                                    'allNewIronFacesUseExistingStructure': True}
packet['rootBoundedAppearance'] = {'path': str(visual_path), 'sha256': H(visual_path.read_bytes()),
                                   'status': visual['status'], 'allHistoricalDetailsVerified': False}
packet['independentSourceReview'] = {'path': str(independent_path), 'sha256': H(independent_path.read_bytes()),
                                    'status': independent['status']}
packet['occluderPbrCalibration'] = {'actualNeighborProfiles': 28,
    'actualNeighborMaterialGraphsChanged': len(cpu['occluderMaterialIntegrity']['neighbourMaterialGraphsChanged']),
    'actualNeighborUV0MeshDatasetsChanged': cpu['occluderMaterialIntegrity']['neighbourUV0MeshDataChangedCount'],
    'allPrimaryMaterialGraphsPackedImagesAndPropertiesExactSinceInitialImport': True,
    'primaryMaterialCount': 7, 'proof': str(cpu_path), 'proofSha256': H(cpu_path.read_bytes())}
packet['toolchain'] = json.loads((D/'toolchain.json').read_text())
packet['postBakeGates'] = ['Actual raw source geometry/UV0/UV1/normals/PBR and all unowned components must be audited against the frozen input.',
    'All four exported AO material bindings must match the newly baked AO pixels and correct UV channel, never prior placeholder AO.',
    'Retain raw HDR/AO/report; verify finite positive radiance, linear0.18 control, zero clipping and exact encoded derivative pixels.',
    'Only after denoising/encoding may full/fallback physical contacts/routes and native six-zone published verification run.',
    'The upper haunch, exact radii/fabrication/P5 photo identity and broader historical holds remain explicitly qualified.']
for row in packet['filePins']:
    data = Path(row['path']).read_bytes()
    assert len(data) == row['bytes'] and H(data) == row['sha256'], row['path']
assert not Path(packet['out']).exists()
frozen_path = D/'frozen-bake-command.json'
assert not frozen_path.exists()
frozen_path.write_text(json.dumps(packet, indent=2)+'\n')
packet_hash = H(frozen_path.read_bytes())
runner = '''"""Root-only quiet-window bake entrypoint. No action without its explicit flag."""
from pathlib import Path
import argparse,hashlib,json,os,subprocess
D=Path(__file__).resolve().parent
EXPECTED_PACKET_SHA='__PACKET_SHA__'
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--run-reviewed-metal',action='store_true')
args=parser.parse_args()
assert args.run_reviewed_metal,'Preparation only: root must explicitly grant the reviewed quiet GPU window'
data=(D/'frozen-bake-command.json').read_bytes()
assert hashlib.sha256(data).hexdigest()==EXPECTED_PACKET_SHA,'Frozen command changed'
packet=json.loads(data)
for row in packet['filePins']:
 b=Path(row['path']).read_bytes()
 assert len(b)==row['bytes'] and hashlib.sha256(b).hexdigest()==row['sha256'],row['path']
argv=packet['argv']
assert argv[argv.index('--device')+1]=='METAL'
assert argv[argv.index('--resolution')+1]=='4096'and argv[argv.index('--samples')+1]=='256'
assert '--preserve-authored-uv1'in argv and '--materials'not in argv and '--ao-only'not in argv
out=Path(packet['out']).resolve()
assert not out.exists(),'Choose/freeze a fresh output instead of overwriting a prior attempt'
assert out.parent==D.parent and out.name=='arrivals-p5-baked-v1'
env=dict(os.environ);env['UV_CACHE_DIR']=str(D.parents[1]/'uv-cache');env['PYTHONDONTWRITEBYTECODE']='1'
command=['uv','run','--offline','--no-project','--python','3.11','--with','bpy==4.3.0','--with','numpy==1.26.4','--with','pillow==13.0.0','python']+argv
print(json.dumps({'status':'ROOT REVIEWED METAL WINDOW STARTING','packetSha256':EXPECTED_PACKET_SHA,'argv':command}),flush=True)
result=subprocess.run(command,cwd=D,env=env)
raise SystemExit(result.returncode)
'''.replace('__PACKET_SHA__', packet_hash)
(D/'run_frozen_bake.py').write_text(runner)
compile(runner, str(D/'run_frozen_bake.py'), 'exec')
manifest = {'schema': 1, 'status': 'FROZEN PREPARATION ONLY; NO GPU/Bake/Render', 'commandSha256': packet_hash,
            'sourceGeometryInputSha256': input_hash, 'files': []}
for path in [frozen_path, D/'run_frozen_bake.py', D/'freeze_packet.py']:
    data = path.read_bytes()
    manifest['files'].append({'path': str(path), 'bytes': len(data), 'sha256': H(data)})
(D/'FROZEN-PACKET-MANIFEST.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps({'status': packet['status'], 'packetSha256': packet_hash, 'filePins': len(packet['filePins']),
                  'inputSha256': input_hash, 'runnerSha256': H((D/'run_frozen_bake.py').read_bytes()),
                  'output': packet['out']}, indent=2))
