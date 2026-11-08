"""Restore only the two exact, reproducible floor-transition PNG derivatives."""
from pathlib import Path
import argparse,hashlib,json,struct,subprocess
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--repository',type=Path,required=True);p.add_argument('--receipt',type=Path,default=Path(__file__).with_name('derived-floor-png-archives.json'));a=p.parse_args();root=a.repository.resolve();entries=json.loads(a.receipt.read_text())['files'];base='authoring/penn-station-1935/lighting/phase13-floor/transition/';allowed={base+'lighting-platform-enclosure-floor-sky-transition.png':4096,base+'lighting-platform-enclosure-floor-sky-transition-low.png':512};assert len(entries)==2 and {e['path'] for e in entries}==set(allowed);ready=[]
for e in entries:
 assert subprocess.check_output(['git','rev-parse',e['commit']+':'+e['path']],cwd=root,text=True).strip()==e['blob'];b=subprocess.check_output(['git','cat-file','blob',e['blob']],cwd=root);assert len(b)==e['bytes'] and hashlib.sha256(b).hexdigest()==e['sha256'];assert b[:8]==bytes.fromhex('89504e470d0a1a0a') and struct.unpack('>II',b[16:24])==(allowed[e['path']],allowed[e['path']]);f=(root/e['path']).resolve();assert root in f.parents
 if f.exists():assert f.read_bytes()==b,'Refusing to overwrite differing content'
 ready.append((f,b))
for f,b in ready:
 if not f.exists():
  f.parent.mkdir(parents=True,exist_ok=True)
  with f.open('xb') as out:out.write(b)
 print('Exact derived PNG restored:',f)
