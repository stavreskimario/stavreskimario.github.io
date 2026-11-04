"""Restore a selected subset of six exact historical Phase12 source files."""
from pathlib import Path
import argparse,hashlib,json,subprocess
ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--repository',type=Path,required=True);ap.add_argument('--receipt',type=Path,default=Path(__file__).with_name('superseded-phase12-source-archives.json'));a=ap.parse_args();root=a.repository.resolve();d=json.loads(a.receipt.read_text());allowed={'authoring/penn-station-1935/lighting/phase12-bridge/raw/lighting-platform-bridge-sky.hdr.gz', 'authoring/penn-station-1935/review/phase12/eighth-avenue-bridge/model/bridge-addon.blend', 'authoring/penn-station-1935/review/phase12/eighth-avenue-bridge/model/bridge-addon.glb', 'authoring/penn-station-1935/lighting/phase12-bridge/denoised/lighting-platform-bridge-sky-low.png', 'authoring/penn-station-1935/lighting/phase12-bridge/denoised/lighting-platform-bridge-sky.png', 'authoring/penn-station-1935/lighting/phase12-bridge/denoised/lighting-platform-bridge-sky-denoised-linear.hdr.gz'};assert 1<=len(d['files'])<=6 and {f['path'] for f in d['files']}<=allowed
for f in d['files']:
 assert f['commit']=='659fffd1ccd6f179038b271147127aa2ae229a34';assert subprocess.check_output(['git','rev-parse',f"{f['commit']}:{f['path']}"],cwd=root,text=True).strip()==f['blob']
 b=subprocess.check_output(['git','cat-file','blob',f['blob']],cwd=root);assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256'];p=(root/f['path']).resolve();assert root in p.parents
 if p.exists():assert p.read_bytes()==b,'Refusing to overwrite differing file.'
 else:
  p.parent.mkdir(parents=True,exist_ok=True)
  with p.open('xb') as out:out.write(b)
  assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
 print('Exact historical Phase12source present:',f['path'])
