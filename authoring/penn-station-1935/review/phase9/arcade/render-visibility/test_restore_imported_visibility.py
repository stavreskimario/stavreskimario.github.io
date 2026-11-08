"""CPU-only import and exact named source-visibility restoration check."""
from pathlib import Path
import sys,json,hashlib
import bpy
P=Path(__file__).resolve().parent
sys.path.insert(0,str(P))
from restore_imported_visibility import restore_source_render_visibility
proof=P/'visible-occluders-v1/visible-context-proof.json'
report={'schema':1,'scope':'Blender4.3 CPU import only; no render or mesh mutation','files':[]}
for rule in json.loads(proof.read_text())['files']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 path=proof.parent/rule['output']
 bpy.ops.import_scene.gltf(filepath=str(path))
 imported=list(bpy.context.scene.objects)
 for obj in imported:
  if obj.parent is None:obj.location.z+=rule['heightOffset']
 bpy.context.view_layer.update()
 before={o.name:(o.hide_render,tuple(tuple(r)for r in o.matrix_world),o.data.as_pointer() if o.data else None,tuple(m.as_pointer()if m else None for m in o.data.materials)if o.type=='MESH'else None)for o in imported}
 result=restore_source_render_visibility(imported,path,proof)
 assert len(result['changedObjects'])==1
 for obj in imported:
  old=before[obj.name]
  assert obj.hide_render==(True if obj.name==rule['excludedNodeName']else old[0])
  assert tuple(tuple(r)for r in obj.matrix_world)==old[1]
  assert (obj.data.as_pointer()if obj.data else None)==old[2]
  assert (tuple(m.as_pointer()if m else None for m in obj.data.materials)if obj.type=='MESH'else None)==old[3]
 result.update({'allOtherVisibilityExact':True,'allObjectMatricesDataAndMaterialsExact':True,'objectCount':len(imported),'inputSha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 report['files'].append(result)
 print('RESTORE_PASS',json.dumps(result),flush=True)
report['status']='PASS'
(proof.parent/'blender-import-restoration-proof.json').write_text(json.dumps(report,indent=2)+'\n')
