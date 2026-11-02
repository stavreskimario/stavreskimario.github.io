"""Assemble a new independent exit module over the exact reviewed interface cuts.

External output only. This does not promote a model or certify native walking.
"""
from pathlib import Path
import argparse,copy,gzip,hashlib,json,shutil,struct,subprocess
p=argparse.ArgumentParser();p.add_argument('--module-dir',required=True,type=Path);p.add_argument('--denoise-report',type=Path);p.add_argument('--route',required=True,type=Path);p.add_argument('--bake-report',required=True,type=Path);p.add_argument('--candidate',required=True,type=Path);p.add_argument('--cuts',type=Path,default=Path('/Users/stavreskimario/Desktop/penn-station-work/phase10-arrivals-exit/geometry-route-v1/cuts-v5'));a=p.parse_args()
R=Path('/Users/stavreskimario/Desktop/penn-station-reconstruction');A=R/'penn-station-1935/assets';O=a.module_dir.resolve();C=a.candidate.resolve();B=a.cuts.resolve();assert not C.exists() and R not in C.parents
H=lambda b:hashlib.sha256(b).hexdigest()
expected={'model-concourse.glb.gz':'45da359a564f02c599961807662bd8e6d14d3bdc9bf1d032261955cb37c6cefe','model-concourse-low.glb.gz':'e6f15fb4d5ea04501f320894e5216bac959b2e563a6c8f17bd91800f4d3ce8dd','model-context.glb.gz':'3bce9f15959a899f03c6eb60ceacd987d9d4f18e741de874e76eb87936a2c104','model-context-low.glb.gz':'491ff6c75d7f14752f09a66e5ae0a463e793997eb7aacb55c9bb659ac9273263'}
for n,h in expected.items():assert H((B/n).read_bytes())==h,n
assert json.loads(a.bake_report.read_text())['zone']=='concourse-exits'
def read(path):
 packed=path.read_bytes();raw=gzip.decompress(packed) if packed[:2]==b'\x1f\x8b' else packed;assert raw[:4]==b'glTF';n=struct.unpack_from('<I',raw,12)[0];return packed,raw,json.loads(raw[20:20+n]),raw[28+n:]
oldmetrics=(A/'asset-metrics.json').read_bytes();m=json.loads(oldmetrics);before=copy.deepcopy(m);shutil.copytree(A,C);receipts=[];side=C.parent/(C.name+'-assembly-evidence');assert not side.exists();side.mkdir()
for suffix in ['','-low']:
 n='model-concourse'+suffix+'.glb';_,_,bj,bb=read(B/(n+'.gz'));_,_,mj,_=read(O/n);names=[x['name'] for x in mj['materials']];assert len(names)==len(set(names));assert not(set(names)&{x['name'] for x in bj['materials']}),'New illuminated exit material identities must not shadow old material names'
 report=side/('append'+suffix+'.json');subprocess.run(['node',str(R/'penn-station-1935/model/append_access_module.mjs'),'--input',str(B/(n+'.gz')),'--module',str(O/n),'--out',str(C/(n+'.gz')),'--report',str(report),'--materials',','.join(names),'--lighting-artifact','concourse-exits'],check=True);receipts.append(json.loads(report.read_text()));_,_,j,binary=read(C/(n+'.gz'));assert binary[:len(bb)]==bb
 for im in j.get('images',[]):
  uri=im['uri'];src=O/uri;dst=C/uri
  if src.is_file():
   if dst.exists():assert src.read_bytes()==dst.read_bytes(),uri
   else:dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
  assert dst.is_file(),uri
for n in ['model-context.glb.gz','model-context-low.glb.gz']:shutil.copy2(B/n,C/n)
for n in ['lighting-concourse-exits-sky.webp','lighting-concourse-exits-sky-low.webp','lighting-concourse-exits-denoise.json']:shutil.copy2(O/n,C/n)
shutil.copy2(a.bake_report,C/'lighting-concourse-exits.json')
if a.denoise_report:shutil.copy2(a.denoise_report,C/'lighting-concourse-exits-denoise.json')
subprocess.run(['python3',str(Path(__file__).parent/'patch-exit-navigation.py'),'--manifest',str(A/'scene-manifest.json'),'--route',str(a.route),'--out',str(side/'scene-manifest.json'),'--report',str(side/'navigation-insertion.json')],check=True);shutil.copy2(side/'scene-manifest.json',C/'scene-manifest.json')
unchanged=[];shared=set();illumination=set();modelbytes=0
for e in m['assets']:
 n=e['file'];transport=e.get('transportFile',n);packed,raw,j,_=read(C/transport);modelbytes+=len(packed);shared.update(im['uri'] for im in j.get('images',[]))
 if n.startswith('model-concourse') or n.startswith('model-context'):
  e.update({'bytes':len(raw),'transportFile':transport,'transportBytes':len(packed),'sha256':H(raw),'transportSha256':H(packed),'externalTextures':[{'uri':im['uri'],'bytes':(C/im['uri']).stat().st_size} for im in j.get('images',[])],'nodes':len(j.get('nodes',[])),'meshes':len(j.get('meshes',[])),'materials':len(j.get('materials',[])),'textures':len(j.get('textures',[])),'extensionsUsed':j.get('extensionsUsed',[])})
 else:
  assert packed==(A/transport).read_bytes();assert e==next(x for x in before['assets'] if x['file']==n);unchanged.append({'file':transport,'sha256':H(packed)})
 for material in j.get('materials',[]):
  sky=material.get('extras',{}).get('sky_illumination')
  if sky:illumination.add(sky.replace('-sky.webp','-sky-low.webp') if '-low.' in n else sky)
assert len(unchanged)==8
probes=['reflection-probes.json','reflection-exterior-probe.json','reflection-arcade-probe.json']+[f'reflection-{z}{s}.hdr.gz' for z in ['waiting-room','concourse','platform','arcade'] for s in ['','-low']]
total=modelbytes+sum((C/n).stat().st_size for n in shared)+sum((C/n).stat().st_size for n in illumination)+sum((C/n).stat().st_size for n in probes)+(C/'sky.hdr').stat().st_size
m.update({'sharedTextureFiles':len(shared),'modelTextureAndLightingBytes':total,'navigationBytes':(C/'scene-manifest.json').stat().st_size,'scope':'Connected station with a new independently authored arrivals exit route. Geometry, lighting, native movement and historical scope require separate acceptance.'})
m['arrivalsExits']={'status':'ASSEMBLED CANDIDATE; no runtime promotion or native acceptance claimed','previousMetricsSha256':H(oldmetrics),'interfaceCutInputs':expected,'newMaterialNames':names,'existingCutBaseBinaryPrefixesExact':True,'unchangedOtherModels':unchanged,'sharedReferencedKtx':len(shared),'aggregateBytes':total,'routeSpecificationSha256':H(a.route.read_bytes()),'newBakeReportSha256':H(a.bake_report.read_bytes()),'newDenoiseReportSha256':H((C/'lighting-concourse-exits-denoise.json').read_bytes())}
(C/'asset-metrics.json').write_text(json.dumps(m,indent=2)+'\n');proof={'status':'PASS exact reviewed-cut-base append and asset accounting; source/CPU/native/public acceptance separate','candidate':str(C),'moduleDirectory':str(O),'appendReports':receipts,'unchangedOtherModels':unchanged,'metricsSha256':H((C/'asset-metrics.json').read_bytes()),'sharedTextures':len(shared),'aggregateBytes':total,'navigationReport':json.loads((side/'navigation-insertion.json').read_text()),'helperSha256':H(Path(__file__).read_bytes())};(side/'assembly.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps({k:v for k,v in proof.items() if k not in ['appendReports','unchangedOtherModels','navigationReport']},indent=2))
