"""Restore the exact current vault linear HDR; refuse differing existing content."""
from pathlib import Path
import argparse,hashlib,json,subprocess
ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--repository',type=Path,required=True);a=ap.parse_args();r=a.repository.resolve()
e=json.loads(Path(__file__).with_name('current-vault-hdr-archive.json').read_text())
assert e['path']=='authoring/penn-station-1935/lighting/phase4/denoised/lighting-waiting-room-vault-sky-denoised-linear.hdr.gz'
assert e['commit']=='7e035d1cea1cfda183143db0dfe37d2dd5fe6f23'
assert e['blob']=='db651f3bc0cb679cc502e9ed531c78d2a591c5a0'
assert subprocess.check_output(['git','rev-parse',f"{e['commit']}:{e['path']}"],cwd=r,text=True).strip()==e['blob']
b=subprocess.check_output(['git','cat-file','blob',e['blob']],cwd=r)
assert len(b)==66952392 and hashlib.sha256(b).hexdigest()=='66f34a8cdf5806b89955f941b6a8ca6eb1dbf4d4fafaf46c1267bdc9fa0dc69b'
p=(r/e['path']).resolve();assert r in p.parents
if p.exists():assert p.read_bytes()==b,'Refusing to overwrite different content.'
else:
 p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('xb') as out:out.write(b)
 assert hashlib.sha256(p.read_bytes()).hexdigest()==e['sha256']
print('Exact current vault linear HDR present:',p)
