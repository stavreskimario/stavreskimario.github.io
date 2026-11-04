"""Append accepted gallery finish, then bind the authored floor material; no navigation edits."""
from pathlib import Path
import argparse,copy,gzip,hashlib,json,shutil,struct,subprocess
p=argparse.ArgumentParser();p.add_argument('--module-dir',required=True,type=Path);p.add_argument('--bake-report',required=True,type=Path);p.add_argument('--denoise-report',type=Path);p.add_argument('--candidate',required=True,type=Path);a=p.parse_args();R=Path('/Users/stavreskimario/Desktop/penn-station-reconstruction');ROOT_ASSETS=R/'penn-station-1935/assets';A=Path('/Users/stavreskimario/Desktop/penn-station-work/phase11-exit-street-fix/candidate-wall-v1');W=Path('/Users/stavreskimario/Desktop/penn-station-work');B=A;O=a.module_dir.resolve();C=a.candidate.resolve();assert not C.exists()and R not in C.parents;H=lambda b:hashlib.sha256(b).hexdigest();pins={'model-concourse.glb.gz':'45d7af0457ea473f4750e7ddbbba14fa4fb8c71f46472dda3ce9b22a25544a0a','model-concourse-low.glb.gz':'63b977ed4db677f7fe3ba267dbf0520b6e0bd619053ce187fde84c7b6eb62b21'}
def read(p):
 packed=p.read_bytes();raw=gzip.decompress(packed)if packed[:2]==b'\x1f\x8b'else packed;assert raw[:4]==b'glTF';n=struct.unpack_from('<I',raw,12)[0];return packed,raw,json.loads(raw[20:20+n]),raw[28+n:]
oldm=(A/'asset-metrics.json').read_bytes();m=json.loads(oldm);oldnav=(A/'scene-manifest.json').read_bytes();assert oldnav==(ROOT_ASSETS/'scene-manifest.json').read_bytes();
for _e in m['assets']:
 if not _e['file'].startswith('model-concourse'):assert (A/_e.get('transportFile',_e['file'])).read_bytes()==(ROOT_ASSETS/_e.get('transportFile',_e['file'])).read_bytes(),_e['file']
shutil.copytree(A,C);E=C.parent/(C.name+'-evidence');assert not E.exists();E.mkdir();receipts=[];floor_receipts=[]
for suffix in ['','-low']:
 name='model-concourse'+suffix+'.glb';base=B/(name+'.gz');assert H(base.read_bytes())==pins[name+'.gz'];_,_,bj,bb=read(base);_,_,currentj,currentb=read(A/(name+'.gz'));assert currentb[:len(bb)]==bb,'Current module still extends the frozen retained base'
 for table in ['nodes','meshes','materials','accessors','bufferViews']:assert currentj.get(table,[])[:len(bj.get(table,[]))]==bj.get(table,[]),table
 _,_,newj,_=read(O/name);names=[x['name']for x in newj['materials']];assert len(names)==len(set(names))and not(set(names)&{x['name']for x in bj['materials']});rp=E/('append'+suffix+'.json');subprocess.run(['node',str(R/'penn-station-1935/model/append_access_module.mjs'),'--input',str(base),'--module',str(O/name),'--out',str(C/(name+'.gz')),'--report',str(rp),'--materials',','.join(names),'--lighting-artifact','concourse-gallery-finish'],check=True);receipts.append(json.loads(rp.read_text()));_,_,j,b=read(C/(name+'.gz'));assert b[:len(bb)]==bb
 floorDirectory=W/'phase11-arrivals-finish/materials/packaged-v1';floorOutput=E/(name+'-floor.gz');floorReport=E/('floor'+suffix+'.json');subprocess.run(['node',str(Path(__file__).parent/'apply-floor-to-candidate.mjs'),str(C/(name+'.gz')),str(floorOutput),str(floorDirectory),'low'if suffix else 'full',str(floorReport)],check=True);floor_receipts.append(json.loads(floorReport.read_text()));shutil.copy2(floorOutput,C/(name+'.gz'));_,_,j,b=read(C/(name+'.gz'));assert b[:len(bb)]==bb
 for src in (floorDirectory/'textures').glob('*.ktx2'):
  dst=C/'textures'/src.name
  if dst.exists():assert dst.read_bytes()==src.read_bytes(),src.name
  else:shutil.copy2(src,dst)
 for image in j.get('images',[]):
  src=O/image['uri'];dst=C/image['uri']
  if src.is_file():
   if dst.exists():assert src.read_bytes()==dst.read_bytes(),image['uri']
   else:dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src,dst)
  assert dst.is_file(),image['uri']
for n in ['lighting-concourse-gallery-finish-sky.webp','lighting-concourse-gallery-finish-sky-low.webp','lighting-concourse-gallery-finish-denoise.json']:shutil.copy2(O/n,C/n)
if a.denoise_report:shutil.copy2(a.denoise_report,C/'lighting-concourse-gallery-finish-denoise.json')
shutil.copy2(a.bake_report,C/'lighting-concourse-gallery-finish.json');report=json.loads(a.bake_report.read_text());assert report['zone']=='concourse-gallery-finish';unchanged=[];shared=set();illum=set();modelbytes=0
for e in m['assets']:
 n=e['file'];transport=e.get('transportFile',n);packed,raw,j,_=read(C/transport);modelbytes+=len(packed);shared.update(x['uri']for x in j.get('images',[]))
 if n.startswith('model-concourse'):
  e.update(bytes=len(raw),transportBytes=len(packed),sha256=H(raw),transportSha256=H(packed),externalTextures=[{'uri':x['uri'],'bytes':(C/x['uri']).stat().st_size}for x in j.get('images',[])],nodes=len(j.get('nodes',[])),meshes=len(j.get('meshes',[])),materials=len(j.get('materials',[])),textures=len(j.get('textures',[])),extensionsUsed=j.get('extensionsUsed',[]))
 else:assert packed==(A/transport).read_bytes();unchanged.append({'file':transport,'sha256':H(packed)})
 for mat in j.get('materials',[]):
  sky=mat.get('extras',{}).get('sky_illumination')
  if sky:illum.add(sky.replace('-sky.webp','-sky-low.webp')if '-low.'in n else sky)
assert len(unchanged)==10;assert(C/'scene-manifest.json').read_bytes()==oldnav
probes=['reflection-probes.json','reflection-exterior-probe.json','reflection-arcade-probe.json']+[f'reflection-{z}{s}.hdr.gz'for z in ['waiting-room','concourse','platform','arcade']for s in['','-low']];total=modelbytes+sum((C/x).stat().st_size for x in shared|illum)+sum((C/x).stat().st_size for x in probes)+(C/'sky.hdr').stat().st_size;m.update(sharedTextureFiles=len(shared),modelTextureAndLightingBytes=total,navigationBytes=len(oldnav));m.setdefault('arrivalsGalleryFinish',{}).update(status='Phase11 gallery and floor candidate; static browser acceptance remains separate',lightingRevision=11,previousMetricsSha256=H(oldm),newMaterialNames=names,existingCutBaseBinaryPrefixesExact=True,unchangedOtherModels=unchanged,sharedReferencedKtx=len(shared),aggregateBytes=total,newBakeReportSha256=H(a.bake_report.read_bytes()),newDenoiseReportSha256=H((C/'lighting-concourse-gallery-finish-denoise.json').read_bytes()),newSourceSha256=report['sourceSha256'],runtimeNavigationUnchanged=True);(C/'asset-metrics.json').write_text(json.dumps(m,indent=2)+'\n');proof={'status':'PASS replacement append; ten other model transports and runtime navigation byte-exact','candidate':str(C),'metricsSha256':H((C/'asset-metrics.json').read_bytes()),'manifestSha256':H(oldnav),'aggregateBytes':total,'unchangedOtherModels':unchanged,'acceptedWallBasePins':pins,'appendReports':receipts,'floorMaterialReports':floor_receipts,'newSourceSha256':report['sourceSha256'],'floorMaterialReports':floor_receipts,'helperSha256':H(Path(__file__).read_bytes())};(E/'replacement.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps({k:v for k,v in proof.items()if k not in ['unchangedOtherModels','appendReports']},indent=2))
