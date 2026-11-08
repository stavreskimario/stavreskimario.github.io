from pathlib import Path
import bpy,json,hashlib
p=Path(__file__).resolve().parent.parent
r=next(q for q in p.parents if(q/'apps.json').is_file())
s=p/'model/arrivals-exit-addon.blend'
assert hashlib.sha256(s.read_bytes()).hexdigest()=='b696eb1452cf29698084c657b8053436d9dd1ddf97e21fb82383d1e3d6fc750a'
bpy.ops.wm.open_mainfile(filepath=str(s))
for d in json.loads((p/'material-dependencies.json').read_text())['images']:
 f=p/d['packageRelativeFile'] if'packageRelativeFile'in d else r/d['repositoryRelativeFile']
 assert hashlib.sha256(f.read_bytes()).hexdigest()==d['sha256']
 i=bpy.data.images.get(d['name']);assert i is not None
 i.filepath=str(f);i.reload()
print('Editable source opened; all12external images rebound to verified repo maps in memory. Original source not overwritten.')
