"""Restore the superseded Phase10 addon byte for byte without overwriting other content."""
from pathlib import Path
import argparse,hashlib,json,subprocess
ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--repository',type=Path,required=True);a=ap.parse_args()
r=a.repository.resolve();d=json.loads(Path(__file__).with_name('phase10-addon-recovery.json').read_text());f=d['old']
assert f['repositoryPath']=='authoring/penn-station-1935/review/phase10/exit-construction/model/arrivals-exit-addon.blend'
assert f['sha256']=='b696eb1452cf29698084c657b8053436d9dd1ddf97e21fb82383d1e3d6fc750a'
b=subprocess.check_output(['git','show',f"{f['immutableCommit']}:{f['repositoryPath']}"],cwd=r)
assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256']
p=(r/f['repositoryPath']).resolve();assert r in p.parents
if p.exists():assert p.read_bytes()==b,'Refusing to overwrite a different file.'
else:
 p.parent.mkdir(parents=True,exist_ok=True)
 with p.open('xb') as out:out.write(b)
 assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
print('Exact historical Phase10 addon present:',p)
