from pathlib import Path
import json,hashlib,gzip,difflib
D=Path(__file__).resolve().parent;H=lambda b:hashlib.sha256(b).hexdigest();source=D/'bake-source-v2';V1=D.with_name('arrivals-lighting-uv-priority-v1');packet=json.loads((D/'bake-command-preparation.json').read_text());proof_path=D/'cpu-preflight-v1/preflight-proof.json';proof=json.loads(proof_path.read_text());ao_path=V1/'ao-source-regression-v1/fresh-ao-export-proof.json';ao=json.loads(ao_path.read_text());lineage_path=V1/'context-dedup-v1/retained-lineage-comparison-resolved.json';lineage=json.loads(lineage_path.read_text());assert proof['status'].startswith('PASS')and ao['status'].startswith('PASS')and lineage['status'].startswith('PASS');assert proof['noRenderingCallExecuted']and proof['onlyArchitectureSelectedAndActive'];assert len(ao['bindings'])==4;assert proof['bakerSha256']==H((source/'bake_lighting.py').read_bytes());assert proof['occlusionHelperSha256']==ao['helperSha256']==H((source/'baked_occlusion_binding.py').read_bytes())
for row in packet['filePins']:assert H(Path(row['path']).read_bytes())==row['sha256']
report_bytes=proof_path.read_bytes();archive=gzip.compress(report_bytes,mtime=0);archive_path=D/'cpu-preflight-v1/preflight-proof.json.gz';archive_path.write_bytes(archive)
packet['status']='READY FOR ROOT REVIEW: corrected occluder-PBR4K/256-sample Main0 arrivals command; NOT EXECUTED'
packet['v1Superseded']={'status':'V1 held, not executed','frozenCommandSha256':H((V1/'frozen-bake-command.json').read_bytes()),'reason':'V1 omitted reviewed library calibration on raw neighboring contexts. V2 maps only actual occluders, preserving the primary exactly.'}
packet['occluderPbrCalibration']={'libraryPath':str(Path(packet['argv'][packet['argv'].index('--occluder-materials')+1])),'actualNeighborProfiles':len(proof['surfaceProfiles']),'actualNeighborMaterialGraphsChanged':len(proof['occluderMaterialIntegrity']['neighbourMaterialGraphsChanged']),'actualNeighborUV0MeshDatasetsChanged':proof['occluderMaterialIntegrity']['neighbourUV0MeshDataChangedCount'],'actualUniqueLibraryImagesUsed':len(set(row['path']for row in proof['actualLibraryImagesUsed'])),'allPrimaryMaterialGraphsPackedImagesAndPropertiesExactSinceInitialImport':True,'primaryMaterialCount':proof['occluderMaterialIntegrity']['primaryMaterialCount'],'oldTenNeighborProfileRecordsExact':True,'proof':str(D/'neighbor-profile-restoration.json'),'proofSha256':H((D/'neighbor-profile-restoration.json').read_bytes())}
repo=Path('/Users/stavreskimario/Desktop/penn-station-reconstruction')
for relative,expected in [('authoring/penn-station-1935/penn-station-phase5.blend','c4aa88af40c449bb111a7e3d9d41a9b071bde2205a6d0c2525f25c5d00815fcc'),('authoring/penn-station-1935/railway-phase3-corrected.blend','c24c5ce587799ebe8fce6d629664a2187a6b1dfb180a753e798832a2aaaeb0ad')]:
 path=repo/relative;data=path.read_bytes();assert H(data)==expected;packet['filePins'].append({'path':str(path),'bytes':len(data),'sha256':expected,'role':'Canonical geometry prerequisite; a later geometry change requires fresh contexts.'})
packet['noGpuUseByThisWorker']=True;packet['noBakeOrRenderExecuted']=True;packet['cpuPreflight']={'path':str(proof_path),'sha256':H(report_bytes),'compressedPath':str(archive_path),'compressedSha256':H(archive),'actualPrimaryObjects':proof['primaryImportedObjects'],'actualContextObjects':sum(row['actualImportedObjects']for row in proof['contextCensus']),'sourceBuffersUv0Uv1NormalsMatricesVisibilityExact':proof['importedBufferIntegrity']['allImportedPrimaryBuffersByteExactBeforeBake'],'onlyArchitectureSelectedAndActive':True,'cpuPreparationSeconds':proof['elapsedSeconds']}
packet['freshAoBindingRegression']={'path':str(ao_path),'sha256':H(ao_path.read_bytes()),'allFourMaterialsFreshAoPixelsExact':True,'reusedByComposition':'Primary input85bf and fresh AO helperc77 are byte-identical to V1 regression; V2 full-context preflight proves primary shader/image state unchanged since initial import.','fixturePurpose':'Distinct current ARC AO pixels used only as a CPU binding/export regression fixture. They are not arrivals lighting and are not a bake input or promotable result.'}
packet['retainedCurrentVsPhase8Lineage']={'path':str(lineage_path),'sha256':H(lineage_path.read_bytes()),'all7182NodesMatched':True,'maximumWorldResidualM':lineage['maximumMatchedWorldCornerErrorM'],'roundingBoundaryCaseResolvedDirectly':True}
packet['postBakeGates']=['Verify newly exported shared AO image red pixels against the actual newly baked ARR AO PNG before optimization.','Denoise/transfer0.18, zero-clipping and source/hash controls; source normals/UV preservation and all8context/visibility records.','Geometry/binding replacement ownership, texture compression and unchanged unrelated model/binary proofs.','Both encoded variants actual-route contacts and full native walking through both arrival directions, plus rendering review and performance limits.','Matching feature-branch deployment and actual public response verification. This packet is bake preparation, not delivery.']
freeze_path=D/'frozen-bake-command.json';freeze_path.write_text(json.dumps(packet,indent=2)+'\n');frozen_sha=H(freeze_path.read_bytes())
runner='''"""Verify the frozen arrivals lighting packet; run only with explicit review flag."""
from pathlib import Path
import os,sys,json,hashlib,subprocess,shlex
D=Path(__file__).resolve().parent
EXPECTED_PACKET_SHA=PACKET_PIN
p=D/'frozen-bake-command.json';raw=p.read_bytes()
assert hashlib.sha256(raw).hexdigest()==EXPECTED_PACKET_SHA,'Frozen packet changed'
a=json.loads(raw)
for row in a['filePins']:
 b=Path(row['path']).read_bytes();assert len(b)==row['bytes']and hashlib.sha256(b).hexdigest()==row['sha256'],row['path']
assert not Path(a['out']).exists(),'Fresh external output directory required'
cmd=['uv','run','--offline','--no-project','--python','3.11','--with','bpy==4.3.0','--with','numpy<2','--with','pillow==13.0.0','python']+a['argv']
if sys.argv[1:]==['--show-command']:
 print(shlex.join(cmd));raise SystemExit(0)
if sys.argv[1:]!=['--run-reviewed-metal']:
 print('PASS: all frozen files verified. No bake ran. Use --show-command to inspect or --run-reviewed-metal after review.');raise SystemExit(0)
env=dict(os.environ);env['UV_CACHE_DIR']='/Users/stavreskimario/Desktop/penn-station-work/uv-cache'
raise SystemExit(subprocess.run(cmd,cwd=D,env=env,check=False).returncode)
'''.replace('PACKET_PIN',repr(frozen_sha));(D/'run_frozen_bake.py').write_text(runner)
base=Path('/Users/stavreskimario/Desktop/penn-station-work/phase9-interiors/arcade-independent-v1/lighting-uv-priority-v1/preserve-mode-v4');diff=[]
for name in ['bake_lighting.py','authored_lighting_uv_guard.py','restore_imported_visibility.py','baked_occlusion_binding.py']:
 old=(base/name).read_text().splitlines(True)if(base/name).exists()else[];new=(source/name).read_text().splitlines(True);diff.extend(difflib.unified_diff(old,new,fromfile='preserve-mode-v4/'+name if old else '/dev/null',tofile='arrivals-bake-source-v1/'+name))
(D/'arrivals-preserve-mode.patch').write_text(''.join(diff))
manifest={}
for path in sorted(D.rglob('*')):
 if path.is_file()and'__pycache__'not in path.parts and path.suffix in {'.py','.json','.gz','.patch','.md'}and path.name not in ['FROZEN-PACKET-MANIFEST.json']:
  manifest[str(path.relative_to(D))]={'bytes':path.stat().st_size,'sha256':H(path.read_bytes())}
(D/'FROZEN-PACKET-MANIFEST.json').write_text(json.dumps({'schema':1,'status':'READY FOR ROOT REVIEW; no GPU/bake/render run','frozenCommandSha256':frozen_sha,'fileIndex':manifest},indent=2)+'\n');print(json.dumps({'frozenCommandSha256':frozen_sha,'launcherSha256':H((D/'run_frozen_bake.py').read_bytes()),'bakerSha256':proof['bakerSha256'],'allPrimaryObjects':proof['primaryImportedObjects'],'allContextObjects':packet['cpuPreflight']['actualContextObjects']}))
