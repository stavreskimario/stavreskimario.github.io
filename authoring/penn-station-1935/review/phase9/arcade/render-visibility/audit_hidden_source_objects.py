"""Read-only direct source render-visibility inventory; no name-based guesses."""
from pathlib import Path
import bpy,json,hashlib
from mathutils import Vector
P=Path(__file__).resolve().parent;R=Path('/Users/stavreskimario/Desktop/penn-station-reconstruction');H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
paths={'core-c96':R/'authoring/penn-station-1935/penn-station-phase5.blend','core-c4aa':P/'connected-v12/formal-arcade-review.blend','railway-current':R/'authoring/penn-station-1935/railway-phase3-corrected.blend','context-current':R/'authoring/penn-station-1935/context-neighbourhood.blend','trains-current':R/'authoring/penn-station-1935/model-trains-phase3-corrected.blend'}
receipt={'schema':1,'scope':'Actual hide_render flags in named source files; no fuzzy template-name filter.','sources':{}}
for label,path in paths.items():
 before=H(path);bpy.ops.wm.open_mainfile(filepath=str(path));bpy.context.view_layer.update();hidden=[];names=[]
 for o in bpy.context.scene.objects:
  names.append(o.name)
  if o.hide_render:
   b=[o.matrix_world@Vector(q)for q in o.bound_box]if o.type in ['MESH','FONT']else[]
   hidden.append({'name':o.name,'type':o.type,'hide_render':True,'hide_viewport':o.hide_viewport,'collections':sorted(c.name for c in o.users_collection),'matrixWorld':[list(row)for row in o.matrix_world],'boundsBlenderWorld':[[min(q[i]for q in b)for i in range(3)],[max(q[i]for q in b)for i in range(3)]]if b else None})
 assert H(path)==before
 receipt['sources'][label]={'file':str(path),'sha256':before,'allSceneObjectNames':names,'hiddenRenderObjects':hidden,'hiddenRenderObjectCount':len(hidden),'hiddenRenderCollections':[c.name for c in bpy.data.collections if c.hide_render]}
(P/'hidden-source-visibility.json').write_text(json.dumps(receipt,indent=2)+'\n');print(json.dumps({k:{'sha256':v['sha256'],'hidden':v['hiddenRenderObjectCount'],'hiddenCollections':v['hiddenRenderCollections']}for k,v in receipt['sources'].items()},indent=2),flush=True)
