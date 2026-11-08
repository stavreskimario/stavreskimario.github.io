from pathlib import Path
import argparse,hashlib,json,struct,sys,ast
P=argparse.ArgumentParser();P.add_argument('--input',required=True,type=Path);P.add_argument('--construction',required=True,type=Path);P.add_argument('--out',required=True,type=Path);A=P.parse_args()
D=Path(__file__).resolve().parent;W=Path('/Users/stavreskimario/Desktop/penn-station-work');R=Path('/Users/stavreskimario/Desktop/penn-station-reconstruction');H=lambda b:hashlib.sha256(b).hexdigest();assert not A.out.exists();A.out.mkdir(parents=True)
old=json.loads((R/'authoring/penn-station-1935/lighting/phase8/source/frozen-bake-command.json').read_text());contexts=old['contexts'];contexts=[dict(x) for x in contexts]
for c in contexts:
 if c['zone']=='context':c['path']=str(W/'phase10-arrivals-exit/geometry-route-v1/raw-context-cut-v1/model-context.glb')
contexts.append({'zone':'concourse','path':str(D/'contexts/arrivals-without-north-research-guard.glb'),'bakerHeightOffsetM':0.,'sourceFrame':'concourse'})
for c in contexts:
 b=Path(c['path']).read_bytes();n=struct.unpack_from('<I',b,12)[0];j=json.loads(b[20:20+n]);c.update({'sha256':H(b),'bytes':len(b),'jsonNodes':len(j['nodes']),'sceneRoots':len(j['scenes'][j.get('scene',0)]['nodes'])})
inputb=A.input.read_bytes();n=struct.unpack_from('<I',inputb,12)[0];j=json.loads(inputb[20:20+n]);lights=j.get('extensions',{}).get('KHR_lights_punctual',{}).get('lights',[]);assert lights and all(x.get('type')=='point' and x.get('intensity',0)>0 for x in lights),'Explicit primary point lights required'
visibility=Path(old['sourceVisibility']['proof']);assert H(visibility.read_bytes())==old['sourceVisibility']['sha256']
raw=A.out/'raw';denoised=A.out/'denoised';pack=A.out/'package';scratch=A.out/'package-work';baker=D/'source/bake_lighting.py'
argv=[str(baker),str(A.input),'--out',str(raw),'--zone','concourse','--artifact-name','concourse-exits','--occluder-materials',str(W/'phase5-materials/material-library'),'--resolution','4096','--samples','128','--device','METAL','--threads','4','--uv-margin-pixels','4','--source-visibility-proof',str(visibility)]
for c in contexts:argv+=['--occluder',c['zone']+'='+c['path']]
pins=[]
def pin(p,role):
 p=Path(p);b=p.read_bytes();pins.append({'path':str(p),'sha256':H(b),'bytes':len(b),'role':role})
for p in sorted((D/'source').glob('*.py')):pin(p,'Frozen exit bake/denoise implementation')
for p in [A.input,A.construction,visibility,D/'contexts/arrivals-guard-omission.json',W/'phase10-arrivals-exit/geometry-route-v1/raw-context-cut-v1/raw-context-cut.json',D/'preflight.py',Path(__file__)]:pin(p,'Primary, route or control proof')
for c in contexts:pin(c['path'],'Registered neighbor context')
lib=W/'phase5-materials/material-library'
for row in old['filePins']:
 p=Path(row['path'])
 if p.is_relative_to(lib):pin(p,'Reviewed neighbor PBR map')
packet={'schema':1,'status':'PREPARED; CPU importer/light/visibility preflight and root quiet-window approval required','artifact':'concourse-exits','frame':'Main0 glTF Y-up; Blender Z-up','argv':argv,'out':str(raw),'denoisedOut':str(denoised),'packageOut':str(pack),'packageWork':str(scratch),'filePins':pins,'contexts':contexts,'sourceVisibility':old['sourceVisibility'],'primary':{'path':str(A.input),'sha256':H(inputb),'jsonNodes':len(j['nodes']),'declaredPointLights':lights},'construction':{'path':str(A.construction),'sha256':H(A.construction.read_bytes())},'electricLightingQualification':'Primary point lamps and emissive globes contribute to the bake. Positions, power and warm color are interpreted, not historical photometry. No directional sun is baked.','next':'Run preflight.py on CPU; root reviews actual lamp census and source appearance, then only root-approved runner may use METAL.'}
(A.out/'packet.json').write_text(json.dumps(packet,indent=2)+'\n');print(json.dumps({'packet':str(A.out/'packet.json'),'sha256':H((A.out/'packet.json').read_bytes()),'contexts':len(contexts),'declaredPointLights':len(lights),'filePins':len(pins)},indent=2))
