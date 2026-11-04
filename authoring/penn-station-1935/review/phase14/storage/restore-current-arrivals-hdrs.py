"""Restore exactly the two allowlisted current arrivals HDR archives from immutable Git objects."""
from pathlib import Path
import argparse,json,gzip,hashlib,re,subprocess
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--repository',type=Path,required=True);p.add_argument('--receipt',type=Path,default=Path(__file__).with_name('current-arrivals-hdr-archives.json'));p.add_argument('--output',type=Path);a=p.parse_args();repo=a.repository.resolve();out=(a.output or repo).resolve();d=json.loads(a.receipt.read_text());allowed={'authoring/penn-station-1935/lighting/phase8/raw/lighting-concourse-arrivals-sky.hdr.gz','authoring/penn-station-1935/lighting/phase8/denoised/lighting-concourse-arrivals-sky-denoised-linear.hdr.gz'};assert len(d['files'])==2 and {e['path']for e in d['files']}==allowed
verified=[]
for e in d['files']:
 assert re.fullmatch('[a-f0-9]{40}',e['commit']) and re.fullmatch('[a-f0-9]{40}',e['blob']) and re.fullmatch('[a-f0-9]{64}',e['sha256']);assert isinstance(e['bytes'],int)and not isinstance(e['bytes'],bool)and 0<e['bytes']<100000000;assert subprocess.check_output(['git','rev-parse',e['commit']+':'+e['path']],cwd=repo,text=True).strip()==e['blob'];b=subprocess.check_output(['git','cat-file','blob',e['blob']],cwd=repo);assert len(b)==e['bytes']and hashlib.sha256(b).hexdigest()==e['sha256'];raw=gzip.decompress(b);assert len(raw)==e['decodedBytes']and hashlib.sha256(raw).hexdigest()==e['decodedSha256'];assert raw.startswith(b'#?RADIANCE');m=re.search(rb'\n[+-]Y\s+(\d+)\s+[+-]X\s+(\d+)',raw[:4096]);assert m and[int(m[1]),int(m[2])]==[4096,4096];q=(out/e['path']).resolve();assert out in q.parents
 if q.exists():assert q.read_bytes()==b,'Refusing to overwrite different content.'
 verified.append((q,b,e))
for q,b,e in verified:
 if not q.exists():
  q.parent.mkdir(parents=True,exist_ok=True)
  with q.open('xb')as f:f.write(b)
 assert hashlib.sha256(q.read_bytes()).hexdigest()==e['sha256'];print('Exact4K current arrivals source present:',q)
