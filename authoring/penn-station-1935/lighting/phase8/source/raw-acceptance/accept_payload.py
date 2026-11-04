"""Actual completed raw payload acceptance; CPU only, no rendering or writes to inputs."""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import math
import subprocess
import numpy as np
from PIL import Image

D = Path(__file__).resolve().parent
W = D.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--root-confirmed-complete', action='store_true')
args = parser.parse_args()
assert args.root_confirmed_complete, 'Do not read partial output as a completed bake'
P = W/'arrivals-p5-bake-preparation-v1'
O = W/'arrivals-p5-baked-v1'
packet_path = P/'frozen-bake-command.json'
packet = json.loads(packet_path.read_text())
input_path = Path(packet['argv'][1])
model_path = O/'model-concourse-arrivals.glb'
report_path = O/'lighting-concourse-arrivals.json'
ao_path = O/'lighting-concourse-arrivals-ao.png'
hdr_path = O/'lighting-concourse-arrivals-sky.hdr'
out = D/'raw-payload-acceptance.json'
assert not out.exists()
H = lambda b: hashlib.sha256(b).hexdigest()
assert H(packet_path.read_bytes()) == 'a5c2c7ffba1535cd7fafa7b730b9d34fd9f1b0376cd7c02756c55379eeeee34d'
for row in packet['filePins']:
    data = Path(row['path']).read_bytes()
    assert len(data) == row['bytes'] and H(data) == row['sha256'], row['path']
inputs = [input_path, model_path, report_path, ao_path, hdr_path,
          O/'lighting-concourse-arrivals-sky.png', O/'lighting-concourse-arrivals-sky-low.png']
before = {str(path): {'sha256': H(path.read_bytes()), 'bytes': path.stat().st_size} for path in inputs}
assert before[str(input_path)]['sha256'] == '26f17e32c793a7a85ea279158a98cecac68e890b77fe2c5d18f74965b9e2713b'
assert before[str(model_path)]['sha256'] == '25bc201678022895b1255d598fa4b62edad107b49f7a90a2ffa09615e426521b'
spec = importlib.util.spec_from_file_location('p5_actual_raw_audit_reference', D/'audit_reference.py')
ref = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ref)
ref.PRIORITY_SHA = before[str(input_path)]['sha256']
source, actual = ref.Glb(input_path), ref.Glb(model_path)
report = json.loads(report_path.read_text())
geometry = ref.compare_geometry(source, source, actual)
materials = ref.compare_materials(source, actual, report['radianceScale'])
fresh_ao = ref.compare_fresh_ao(actual, ao_path)
assert fresh_ao['dimensions'] == [4096, 4096]
actual_report = ref.validate_report(report)
assert report['radianceScale'] == 1
assert report['device']['backend'] == 'METAL' and report['device']['requested'] == 'METAL'
assert report['atlasSurfaceArea'] == .7242227792739868
assert report['sourceRenderVisibility']['proofSha256'] == packet['sourceVisibility']['sha256']
for expected, exported in zip(packet['contexts'], report['registeredOccluders']):
    assert exported['source'] == Path(expected['path']).name and exported['sha256'] == expected['sha256']
    assert abs(exported['heightOffset'] - expected['bakerHeightOffsetM']) < 1e-12
visibility_changes = [obj for row in report['sourceRenderVisibility']['contexts'] for obj in row.get('changedObjects', [])]
assert len(visibility_changes) == 2
assert all(obj['hideRenderAfter'] and obj['sourceHideRender'] and obj['sourceToBakeFrameOffsetZ'] == 4.2672 and obj['boundErrorM'] < .00002 for obj in visibility_changes)
for kind in ['ambientOcclusion', 'illumination']:
    statistics = report[kind]
    assert all(math.isfinite(statistics[key]) for key in ['minimum', 'mean', 'maximum'])
    assert 0 <= statistics['minimum'] <= statistics['mean'] <= statistics['maximum']
    assert statistics['mean'] > 0 and statistics['maximum'] > 0
    assert 0 < statistics['coveredPixels'] <= 4096**2
assert report['ambientOcclusion']['maximum'] <= 1
assert report['occlusionBindingIntegrity']['status'] == 'PASS'

# Node JSON and every oriented local corner were already checked exactly.
# These authoring nodes are direct roots with identity linear transforms;
# the two precision haunches retain only their explicit translations.
j = source.json
assert set(j['scenes'][j.get('scene', 0)]['nodes']) == set(range(len(j['nodes'])))
translated = []
for index, node in enumerate(j['nodes']):
    assert not node.get('children') and 'matrix' not in node
    assert node.get('rotation', [0, 0, 0, 1]) == [0, 0, 0, 1]
    assert node.get('scale', [1, 1, 1]) == [1, 1, 1]
    if 'translation' in node:
        assert node['translation'] == actual.json['nodes'][index]['translation']
        translated.append({'name': node['name'], 'translationMain0': node['translation']})
assert len(translated) == 2 and all(row['name'].startswith('P5Curve ') for row in translated)
geometry['worldPositionsExactFromActualLocalCornersAndExactRootFrames'] = True
geometry['normalWorldAnglesEqualLocalAnglesUnderIdentityLinearFrames'] = True
geometry['precisionHaunchTranslationsExact'] = translated

legacy = W.parent/'phase7-arrivals/baked-v1/model-concourse-arrivals.glb'
assert H(legacy.read_bytes()) == ref.ORIGINAL_SHA
density = ref.density(ref.Glb(legacy), actual)
subprocess.run(['node', str(D/'hdr_payload_stats.mjs'), str(hdr_path), str(D/'hdr-payload-stats.json')], check=True, capture_output=True)
hdr = json.loads((D/'hdr-payload-stats.json').read_text())
# RGBE is quantized. The decoded actual radiance is measured, not called
# byte/float-exact to the pre-save Cycles image statistics.
# The producer's image_stats() averages only alpha>.1 covered pixels. HDR
# discards alpha, so its complete-atlas mean must use the coverage denominator.
# Cycles starts a fresh image and clears the bake; uncovered radiance is zero.
coverage = report['illumination']['coveredPixels'] / (4096**2)
expected_whole_hdr_mean = report['illumination']['mean'] * coverage
relative_hdr_mean = abs(hdr['rgb']['mean'] / expected_whole_hdr_mean - 1)
assert relative_hdr_mean < .03, 'HDR transfer disagrees with source radiance beyond RGBE quantization allowance'
pngs = []
for suffix, size in [('', 4096), ('-low', 512)]:
    path = O/('lighting-concourse-arrivals-sky'+suffix+'.png')
    with Image.open(path) as image:
        assert image.size == (size, size)
        pngs.append({'file': path.name, 'width': size, 'height': size, 'sha256': H(path.read_bytes())})
for path in inputs:
    assert before[str(path)]['sha256'] == H(path.read_bytes()), 'Output changed during acceptance'
result = {'schema': 1, 'status': 'PASS: actual P5 raw geometry/UV/PBR/image preservation, fresh AO and HDR payloads',
          'inputs': before, 'actualReport': actual_report, 'geometry': geometry, 'materials': materials,
          'freshAo': fresh_ao, 'physicalLightingDensity': density,
          'actualHdrPayload': hdr, 'hdrMeanRelativeDifferenceFromUnquantizedReport': relative_hdr_mean,
          'hdrMeanComparison': {'producerMeanScope': 'Only alpha>.1 covered pixels', 'coveredFraction': coverage,
                               'expectedWholeAtlasMeanFromCoveredReport': expected_whole_hdr_mean,
                               'actualWholeAtlasHdrMean': hdr['rgb']['mean'],
                               'relativeDifference': relative_hdr_mean,
                               'qualification': 'Coverage denominator reconciled before the measured RGBE quantization difference; no covered/whole mean equivalence claim.'},
          'rawPngDimensions': pngs, 'actualVisibilityChanges': visibility_changes,
          'all68FrozenInputsRehashedExact': True, 'inputsUnchangedAtEnd': True,
          'limits': ['This is raw unquantized payload acceptance, not full/low encoded or native browser acceptance.',
                     'Normal re-encoding and UV Float32 round trips are measured under established0.5degree/2e-7bounds.',
                     'Fresh HDR is linear quantized RGBE; denoising,0.18 calibration, clipping and derivative-pixel checks remain next.',
                     'Source radii/fabrication/preciseP5identity and the upper haunch remain qualified.'],
          'referenceAuditSha256': H((D/'audit_reference.py').read_bytes()),
          'generatorSha256': H(Path(__file__).read_bytes())}
out.write_text(json.dumps(result, indent=2)+'\n')
print(json.dumps({'status': result['status'], 'geometry': geometry, 'freshAoMaterials': fresh_ao['litMaterialCount'],
                  'hdrMeanRelativeDifference': relative_hdr_mean, 'reportSha256': H(out.read_bytes())}, indent=2), flush=True)
