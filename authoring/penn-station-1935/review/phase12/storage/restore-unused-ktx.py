"""Restore exactly four historical KTX transports from verified immutable Git."""
from pathlib import Path
import argparse,hashlib,json,subprocess
ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--repository',type=Path,required=True);ap.add_argument('--receipt',type=Path,default=Path(__file__).with_name('retired-unused-ktx.json'));a=ap.parse_args();root=a.repository.resolve();r=json.loads(a.receipt.read_text())
allowed={
 'penn-station-1935/assets/textures/53979fdafe89bc4df9ca.ktx2',
 'penn-station-1935/assets/textures/5ac4f28aafa1a2c0c811.ktx2',
 'penn-station-1935/assets/textures/ddcf2fd7dbaf55312d00.ktx2',
 'penn-station-1935/assets/textures/e017da17bfe8d12ca1ad.ktx2',
}
assert {f['path'] for f in r['files']}==allowed and len(r['files'])==4
for f in r['files']:
 assert f['commit']=='7e035d1cea1cfda183143db0dfe37d2dd5fe6f23'
 assert subprocess.check_output(['git','rev-parse',f"{f['commit']}:{f['path']}"],cwd=root,text=True).strip()==f['blob']
 b=subprocess.check_output(['git','cat-file','blob',f['blob']],cwd=root)
 assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256']
 p=(root/f['path']).resolve();assert root in p.parents
 if p.exists():assert p.read_bytes()==b,'Refusing to overwrite differing bytes.'
 else:
  p.parent.mkdir(parents=True,exist_ok=True)
  with p.open('xb') as out:out.write(b)
  assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
 print('Exact historical texture present:',f['path'])
