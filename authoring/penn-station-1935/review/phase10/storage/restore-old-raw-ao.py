"""Restore exact archived generated AO outputs without overwriting files."""
from pathlib import Path
import hashlib,json,subprocess
p=Path(__file__).resolve().parent
r=next(q for q in p.parents if(q/'apps.json').is_file())
d=json.loads((p/'old-raw-ao-output-reserve.json').read_text())
for e in d['movedFiles']:
 t=r/e['repositoryPath']
 if t.exists():
  assert hashlib.sha256(t.read_bytes()).hexdigest()==e['sha256'],str(t)
  continue
 b=subprocess.run(['git','show',e['immutableCommit']+':'+e['repositoryPath']],cwd=r,check=True,capture_output=True).stdout
 assert len(b)==e['bytes'] and hashlib.sha256(b).hexdigest()==e['sha256']
 t.parent.mkdir(parents=True,exist_ok=True)
 with t.open('xb') as f:f.write(b)
 print('Restored',e['repositoryPath'])
print('All three outputs present and exact; archive manifests still document their Git-backed retention.')
