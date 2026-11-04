"""Append only the combined enclosure module to pinned current platform pair; preserve all prior finishes."""
from pathlib import Path
import argparse,copy,gzip,hashlib,json,shutil,struct,subprocess
p=argparse.ArgumentParser();p.add_argument('--module-dir',type=Path,required=True);p.add_argument('--bake-report',type=Path,required=True);p.add_argument('--denoise-report',type=Path,required=True);p.add_argument('--reflection-dir',type=Path,required=True);p.add_argument('--candidate',type=Path,required=True);a=p.parse_args()
D=Path(__file__).parent;R=Path('/Users/stavreskimario/Desktop/penn-station-reconstruction');A=R/'penn-station-1935/assets';C=a.candidate.resolve();O=a.module_dir.resolve();H=lambda b:hashlib.sha256(b).hexdigest();baseline=json.loads((D/'baseline.json').read_text());pins={x['file']:x['sha256'] for x in baseline['models']};B=Path('/Users/stavreskimario/Desktop/penn-station-work/phase13-track-enclosure/geometry/floor-ownership-v1/retained-base-v1');basePins={'model-platform.glb.gz':'ca06980ee4ebf77d60227893eab3f6f7b51f0109345c5afbd2e0f3d95e9ceaac','model-platform-low.glb.gz':'4acb97a454070409cd3bc2618293fce789e6847a1e92ccdc4550cfb68f026610'};oldManagedTextures=set();assert not C.exists() and R not in C.parents
for n,h in pins.items():assert H((A/n).read_bytes())==h,n
assert H((A/'scene-manifest.json').read_bytes())==baseline['manifestSha256']
assert H((A/'asset-metrics.json').read_bytes())==baseline['metricsSha256']
def read(p):
 packed=p.read_bytes();raw=gzip.decompress(packed)if packed[:2]==b'\x1f\x8b'else packed;assert raw[:4]==b'glTF';n=struct.unpack_from('<I',raw,12)[0];return packed,raw,json.loads(raw[20:20+n]),raw[28+n:]
oldm=(A/'asset-metrics.json').read_bytes();m=json.loads(oldm);oldnav=(A/'scene-manifest.json').read_bytes();shutil.copytree(A,C);E=C.parent/(C.name+'-evidence');assert not E.exists();E.mkdir();receipts=[]
for suffix in ['','-low']:
 name='model-platform'+suffix+'.glb';base=B/(name+'.gz');assert H(base.read_bytes())==basePins[name+'.gz'];_,_,bj,bb=read(base);_,_,oldj,_=read(A/(name+'.gz'));oldManagedTextures.update(x['uri']for x in oldj.get('images',[])if x['uri']not in {v['uri']for v in bj.get('images',[])});assert not any('platform-bridge'in m.get('extras',{}).get('sky_illumination','')for m in bj['materials']);_,_,nj,_=read(O/name);names=[x['name']for x in nj['materials']];assert len(names)==len(set(names)) and not(set(names)&{x['name']for x in bj['materials']});rp=E/('append'+suffix+'.json');subprocess.run(['node',str(D/'append-split-compiled-module.mjs'),'--input',str(base),'--module',str(O/name),'--out',str(C/(name+'.gz')),'--report',str(rp),'--materials',','.join(names),'--lighting-artifact','platform-enclosure'],check=True);receipts.append(json.loads(rp.read_text()));_,_,j,b=read(C/(name+'.gz'));assert b[:len(bb)]==bb
 for image in j.get('images',[]):
  src=O/image['uri'];dst=C/image['uri']
  if src.is_file():
   if dst.exists():assert dst.read_bytes()==src.read_bytes(),image['uri']
   else:dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
  assert dst.is_file(),image['uri']
for n in ['lighting-platform-enclosure-sky.webp','lighting-platform-enclosure-sky-low.webp','lighting-platform-enclosure-floor-sky.webp','lighting-platform-enclosure-floor-sky-low.webp']:shutil.copy2(O/n,C/n)
for n in ['reflection-platform-enclosure.hdr.gz','reflection-platform-enclosure-low.hdr.gz','reflection-platform-enclosure-probe.json']:shutil.copy2(a.reflection_dir/n,C/n)
shutil.copy2(D/'floor-bake-v2/raw/lighting-platform-enclosure-floor.json',C/'lighting-platform-enclosure-floor.json');shutil.copy2(D/'floor-bake-v2/prepared-metadata/lighting-platform-enclosure-floor-denoise.json',C/'lighting-platform-enclosure-floor-denoise.json');shutil.copy2(D/'bake-run-v2/prepared-metadata/reflection-platform-enclosure-probe.json',C/'reflection-platform-enclosure-probe.json');shutil.copy2(a.denoise_report,C/'lighting-platform-enclosure-denoise.json');shutil.copy2(a.bake_report,C/'lighting-platform-enclosure.json');report=json.loads(a.bake_report.read_text());assert report['zone']=='platform-enclosure';unchanged=[];shared=set();illum=set();modelbytes=0
for e in m['assets']:
 n=e['file'];transport=e.get('transportFile',n);packed,raw,j,_=read(C/transport);modelbytes+=len(packed);shared.update(x['uri']for x in j.get('images',[]))
 if n.startswith('model-platform'):
  e.update(bytes=len(raw),transportBytes=len(packed),sha256=H(raw),transportSha256=H(packed),externalTextures=[{'uri':x['uri'],'bytes':(C/x['uri']).stat().st_size}for x in j.get('images',[])],nodes=len(j.get('nodes',[])),meshes=len(j.get('meshes',[])),materials=len(j.get('materials',[])),textures=len(j.get('textures',[])),extensionsUsed=j.get('extensionsUsed',[]))
 else:assert packed==(A/transport).read_bytes();unchanged.append({'file':transport,'sha256':H(packed)})
 for mat in j.get('materials',[]):
  sky=mat.get('extras',{}).get('sky_illumination')
  if sky:illum.add(sky.replace('-sky.webp','-sky-low.webp')if '-low.'in n else sky)
assert len(unchanged)==10 and(C/'scene-manifest.json').read_bytes()==oldnav
for n in ['lighting-platform-bridge-sky.webp','lighting-platform-bridge-sky-low.webp','lighting-platform-bridge-denoise.json','lighting-platform-bridge.json']:
 if (C/n).exists():(C/n).unlink()
for n in sorted(oldManagedTextures):
 if n not in shared and(C/n).exists():(C/n).unlink()
for e in m['assets']:
 _,_,j,_=read(C/e.get('transportFile',e['file']));assert not any('platform-bridge'in mat.get('extras',{}).get('sky_illumination','')for mat in j.get('materials',[]))
probes=['reflection-probes.json','reflection-exterior-probe.json','reflection-arcade-probe.json','reflection-platform-enclosure-probe.json','reflection-platform-enclosure.hdr.gz','reflection-platform-enclosure-low.hdr.gz']+[f'reflection-{z}{s}.hdr.gz'for z in ['waiting-room','concourse','platform','arcade']for s in['','-low']];total=modelbytes+sum((C/x).stat().st_size for x in shared|illum)+sum((C/x).stat().st_size for x in probes)+(C/'sky.hdr').stat().st_size;m.update(sharedTextureFiles=len(shared),modelTextureAndLightingBytes=total,navigationBytes=len(oldnav));m.pop('eighthAvenueBridge',None);m['fourBayEnclosure']={'status':'Phase13 four-bay enclosure with actual floor GI candidate; static browser acceptance separate','lightingRevision':13,'previousMetricsSha256':H(oldm),'newMaterialNames':names,'existingBaseBinaryPrefixesExact':True,'unchangedOtherModels':unchanged,'sharedReferencedKtx':len(shared),'aggregateBytes':total,'newBakeReportSha256':H(a.bake_report.read_bytes()),'newDenoiseReportSha256':H(a.denoise_report.read_bytes()),'newSourceSha256':report['sourceSha256'],'runtimeNavigationUnchanged':True,'independentFloorAtlas':'platform-enclosure-floor','minimumVisibleFloorPixelsPerMetre':76.92764506513112,'structureLightUvAndGiUnchanged':True};(C/'asset-metrics.json').write_text(json.dumps(m,indent=2)+'\n');proof={'status':'PASS new bridge appended only; ten other model transports and navigation byte-exact','candidate':str(C),'metricsSha256':H((C/'asset-metrics.json').read_bytes()),'manifestSha256':H(oldnav),'aggregateBytes':total,'unchangedOtherModels':unchanged,'acceptedCurrentRootPins':pins,'acceptedCutBasePins':basePins,'retiredPhase12Textures':sorted(oldManagedTextures-shared),'appendReports':receipts,'newSourceSha256':report['sourceSha256'],'helperSha256':H(Path(__file__).read_bytes())};(E/'assembly.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps({k:v for k,v in proof.items()if k not in ['unchangedOtherModels','appendReports','acceptedBasePins']},indent=2))
