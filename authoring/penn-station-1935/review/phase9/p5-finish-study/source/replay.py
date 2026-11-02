"""Bounded CPU authoring replay. Run with bpy4.3.0/numpy<2; never renders."""
from pathlib import Path
import argparse,hashlib,json,runpy,sys
import bpy
from recover import recover,ROOT
H=lambda b:hashlib.sha256(b).hexdigest()
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,required=True);a=p.parse_args();out=recover(a.out);target=out/'rebuilt';frozen=json.loads((out/'frozen/study-manifest.json').read_text());builder=ROOT/'source/build_study.py';assert H(builder.read_bytes())==frozen['generatorSha256']
sys.argv=[str(builder),'--source',str(out/'source/arrivals-module.glb'),'--proposal',str(ROOT/'proposal/PROPOSAL.json'),'--source-proof',str(out/'source/source-proof.json'),'--out',str(target)];namespace=runpy.run_path(str(builder),run_name='__main__');rebuilt=json.loads((target/'study-manifest.json').read_text())
assert rebuilt['importedSourceStateHashes']==frozen['importedSourceStateHashes'];assert rebuilt['importedSourceMaterialHashes']==frozen['importedSourceMaterialHashes'];assert rebuilt['skins']==frozen['skins'];assert rebuilt['preservation']==frozen['preservation']
for name in ['p5-study-source-plus-finish.glb','finish-addon.glb']:assert (target/name).read_bytes()==(out/'frozen'/name).read_bytes(),name
bpy.context.preferences.filepaths.use_scripts_auto_execute=False;expected={s['name']for s in frozen['skins']};rows=[]
for name,file in [('full-rebuilt',target/'editable.blend'),('exact-addon',out/'frozen/addon.blend')]:
 before=H(file.read_bytes());bpy.ops.wm.open_mainfile(filepath=str(file));scene=bpy.context.scene;assert {o.name for o in scene.objects if o.name in expected}==expected
 if name=='full-rebuilt':
  assert len(scene.objects)==4061;actual={o.name:namespace['source_state'](o)for o in scene.objects if o.name not in expected};assert actual==frozen['importedSourceStateHashes'];materials={m for o in scene.objects if o.name not in expected for m in o.data.materials if m};assert {m.name:namespace['material_state'](m)for m in materials}==frozen['importedSourceMaterialHashes']
 else:assert len(scene.objects)==14
 assert H(file.read_bytes())==before;rows.append({'file':name,'objects':len(scene.objects),'sha256':before,'unchangedOnReopen':True})
report={'schema':1,'status':'PASS: portable CPU replay reproduces both raw GLBs byte-for-byte and full source/component states','builderSha256':H(builder.read_bytes()),'originalSourceStatesExact':4047,'allSourceMaterialStatesExact':True,'newSkinsExact':14,'combinedGlbByteExact':True,'addonGlbByteExact':True,'reopened':rows,'fullEditableBlendBinaryReplayClaimed':False,'fullBlendQualification':'Rebuilt full-scene file may have different Blender serialization bytes; geometry, materials and source states are exact. Original d33 full blend remains in verified external backup.','noRenderingOrGpu':True};(out/'portable-replay-proof.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
