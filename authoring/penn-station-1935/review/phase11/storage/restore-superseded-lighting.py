"""Restore four byte-pinned superseded generated outputs from immutable local Git."""
from pathlib import Path
import argparse,hashlib,json,subprocess
ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--repository',type=Path,required=True);a=ap.parse_args();r=a.repository.resolve()
d=json.loads(Path(__file__).with_name('superseded-lighting-outputs.json').read_text())
allowed={
 'authoring/penn-station-1935/lighting/phase10-exits/raw/lighting-concourse-exits-sky.hdr.gz',
 'authoring/penn-station-1935/lighting/phase10-exits/denoised/lighting-concourse-exits-sky-denoised-linear.hdr.gz',
 'authoring/penn-station-1935/lighting/phase3/denoised/lighting-concourse-sky.png',
 'authoring/penn-station-1935/lighting/phase3/denoised/lighting-waiting-room-sky.png',
}
assert {f['repositoryPath'] for f in d['files']}==allowed
for f in d['files']:
 rel=f['repositoryPath'];p=(r/rel).resolve();assert r in p.parents
 b=subprocess.check_output(['git','show',f"{f['immutableCommit']}:{rel}"],cwd=r)
 assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256']
 if p.exists():assert p.read_bytes()==b,'Refusing to overwrite different bytes: '+str(p)
 else:
  p.parent.mkdir(parents=True,exist_ok=True)
  with p.open('xb') as out:out.write(b)
  assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
 print('Exact historical output present:',rel)
