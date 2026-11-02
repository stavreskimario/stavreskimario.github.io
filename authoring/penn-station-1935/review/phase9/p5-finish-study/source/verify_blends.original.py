"""Reopen frozen study blends with CPU I/O only; never render or save them."""
from pathlib import Path
import ast,hashlib,json
import bpy,numpy as np
D=Path(__file__).resolve().parent;C=D/'candidate-v2';H=lambda b:hashlib.sha256(b).hexdigest();manifest=json.loads((C/'study-manifest.json').read_text());tree=ast.parse((D/'build_study.py').read_text());namespace={'np':np,'H':H,'json':json};names={'safe_props','value_array','source_state','material_state'}
for node in tree.body:
 if isinstance(node,ast.FunctionDef)and node.name in names:exec(compile(ast.Module(body=[node],type_ignores=[]),str(D/'build_study.py'),'exec'),namespace)
expected={s['name']for s in manifest['skins']};rows=[];bpy.context.preferences.filepaths.use_scripts_auto_execute=False
for filename in['editable.blend','addon.blend']:
 path=C/filename;before=H(path.read_bytes());assert before==manifest['blends'][filename]['sha256'];bpy.ops.wm.open_mainfile(filepath=str(path));scene=bpy.context.scene;skins=[o for o in scene.objects if o.name in expected];assert len(skins)==14 and {o.name for o in skins}==expected;assert all(o.type=='MESH'for o in scene.objects);row={'file':filename,'sha256':before,'sceneCount':len(bpy.data.scenes),'sceneObjects':len(scene.objects),'skinNamesExact':True,'newSourceChanges':0}
 if filename=='editable.blend':
  assert len(scene.objects)==4061
  actual={o.name:namespace['source_state'](o)for o in scene.objects if o.name not in expected};assert actual==manifest['importedSourceStateHashes'],'Source state changed on blend reopen';row['all4047ImportedSourceStatesExactOnReopen']=True
  materials={m for o in scene.objects if o.name not in expected for m in o.data.materials if m};actual_mat={m.name:namespace['material_state'](m)for m in materials};assert actual_mat==manifest['importedSourceMaterialHashes'];row['allImportedSourceMaterialStatesExactOnReopen']=True
 else:assert len(scene.objects)==14 and len(bpy.data.materials)==1
 assert H(path.read_bytes())==before;row['inputFileUnchanged']=True;rows.append(row)
report={'schema':1,'status':'PASS: both frozen blends reopen with intended editable source/addon contents','rows':rows,'noRenderingOrSaving':True,'generatorSha256':H(Path(__file__).read_bytes())};out=D/'blends-reopen-proof.json';assert not out.exists();out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True)
