"""Restore exactly19byte-pinned old generated QA screenshots; never overwrite differing files."""
from pathlib import Path
import argparse,hashlib,json,subprocess
ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--repository',type=Path,required=True);ap.add_argument('--receipt',type=Path,default=Path(__file__).with_name('retired-old-generated-qa.json'));a=ap.parse_args();root=a.repository.resolve();d=json.loads(a.receipt.read_text());allowed={'authoring/penn-station-1935/review/phase9/arcade/acceptance/arcade-west.png', 'authoring/penn-station-1935/review/phase9/arcade-lighting-priority/native-ionic-screen.png', 'authoring/penn-station-1935/review/phase9/arrivals-lighting-priority/public-arrival-stair-from-platform.png', 'authoring/penn-station-1935/review/phase2/desktop-archive-comparison.png', 'authoring/penn-station-1935/review/phase2/recovered-after-model-failure.png', 'authoring/penn-station-1935/review/phase2/desktop-concourse.png', 'authoring/penn-station-1935/review/phase1/desktop-archive-comparison.png', 'authoring/penn-station-1935/review/phase2/mobile-recovery-after-text-fix/recovered-after-environment-failure.png', 'authoring/penn-station-1935/review/phase9/arcade/acceptance/ionic-screen-west.png', 'authoring/penn-station-1935/review/phase2/mobile-recovery-after-text-fix/recovered-after-model-failure.png', 'authoring/penn-station-1935/review/phase8/acceptance/native-return.png', 'authoring/penn-station-1935/review/phase1/desktop-waiting.png', 'authoring/penn-station-1935/review/phase9/p5-finish-integration/native-p5-wide-platform-pulled-back.png', 'authoring/penn-station-1935/review/phase2/desktop-waiting.png', 'authoring/penn-station-1935/review/phase9/p5-finish-integration/native-p5-stair-from-platform.png', 'authoring/penn-station-1935/review/phase2/desktop-hotel.png', 'authoring/penn-station-1935/review/phase2/recovered-after-environment-failure.png', 'authoring/penn-station-1935/review/phase9/arrivals-lighting-priority/public-arrival-stair-midflight.png', 'authoring/penn-station-1935/review/phase2/desktop-intro.png'}
assert {f['path'] for f in d['files']}==allowed and len(d['files'])==19
for f in d['files']:
 assert subprocess.check_output(['git','rev-parse',f"{f['commit']}:{f['path']}"],cwd=root,text=True).strip()==f['blob']
 b=subprocess.check_output(['git','cat-file','blob',f['blob']],cwd=root);assert len(b)==f['bytes'] and hashlib.sha256(b).hexdigest()==f['sha256'];assert b.startswith(b'\x89PNG\r\n\x1a\n')
 p=(root/f['path']).resolve();assert root in p.parents
 if p.exists():assert p.read_bytes()==b,'Refusing to overwrite different bytes.'
 else:
  p.parent.mkdir(parents=True,exist_ok=True)
  with p.open('xb') as o:o.write(b)
  assert hashlib.sha256(p.read_bytes()).hexdigest()==f['sha256']
 print('Exact historical QA PNG present:',f['path'])
