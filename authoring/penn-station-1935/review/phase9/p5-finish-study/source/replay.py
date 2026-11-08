"""Portable CPU authoring replay. Requires bpy4.3.0/numpy<2; never renders."""
from pathlib import Path
import argparse,ast,hashlib,json,runpy,sys
import bpy
from recover import recover,ROOT
H=lambda b:hashlib.sha256(b).hexdigest()
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--out',type=Path,required=True);a=p.parse_args();out=recover(a.out)
flat_frozen=json.loads((out/'frozen/flat-study-manifest.json').read_text());curve_frozen=json.loads((out/'frozen/curve-study-manifest.json').read_text())
flat_builder=ROOT/'source/build_flat.py';assert H(flat_builder.read_bytes())==flat_frozen['generatorSha256'];flat=out/'rebuilt-flat'
sys.argv=[str(flat_builder),'--source',str(out/'source/arrivals-module.glb'),'--proposal',str(ROOT/'proposal/PROPOSAL.json'),'--source-proof',str(out/'source/source-proof.json'),'--out',str(flat)];flat_ns=runpy.run_path(str(flat_builder),run_name='__main__');fm=json.loads((flat/'study-manifest.json').read_text())
for key in ['importedSourceStateHashes','importedSourceMaterialHashes','skins','preservation']:assert fm[key]==flat_frozen[key],key
assert (flat/'p5-study-source-plus-finish.glb').read_bytes()==(out/'source/p5-flat-source.glb').read_bytes()
curves=out/'rebuilt-curves';builder=ROOT/'source/build_curves.py'
sys.argv=[str(builder),'--flat-glb',str(out/'source/p5-flat-source.glb'),'--flat-blend',str(flat/'editable.blend'),'--flat-builder',str(flat_builder),'--feasibility',str(ROOT/'source/feasibility-v3.json'),'--source-proof',str(out/'source/source-proof.json'),'--expected-frozen-manifest',str(out/'frozen/curve-study-manifest.json'),'--flat-reference-manifest',str(out/'frozen/flat-study-manifest.json'),'--out',str(curves)];curve_ns=runpy.run_path(str(builder),run_name='__main__');cm=json.loads((curves/'curve-study-manifest.json').read_text())
assert (curves/'west-p5-curved-study.glb').read_bytes()==(out/'frozen/west-p5-curved-study.glb').read_bytes(),'Final raw GLB differs'
for key in ['nonownedImportedSourceHashes','curveParameters','haunches','ownedRailChanges','preservation','evaluatedActualSurfaceMaterialNames','rawRailPrimitiveMaterialNames']:assert cm[key]==curve_frozen[key],key
proof=json.loads((ROOT/'evidence/editable-addon-proof.json').read_text());names=set(proof['objectStateHashes']);helpers={'ns':flat_ns,'bpy':bpy}
for node in ast.parse((ROOT/'source/extract-editable-addon.original.py').read_text()).body:
 if isinstance(node,ast.FunctionDef)and node.name in {'state','evaluated'}:exec(compile(ast.Module(body=[node],type_ignores=[]),'<frozen-addon-state-helper>','exec'),helpers)
rows=[]
for label,path in [('rebuilt-full',curves/'editable-curves.blend'),('exact22-object-addon',out/'frozen/p5-curved-editable-addon.blend')]:
 pin=H(path.read_bytes());bpy.context.preferences.filepaths.use_scripts_auto_execute=False;bpy.ops.wm.open_mainfile(filepath=str(path));scene=next(s for s in bpy.data.scenes if set(o.name for o in s.objects)>=names);bpy.context.window.scene=scene;objects={o.name:o for o in scene.objects if o.name in names};assert set(objects)==names
 states={k:H(json.dumps(helpers['state'](o),sort_keys=True).encode())for k,o in objects.items()};assert states==proof['objectStateHashes'],'Editable component states differ';assert sum(o.type=='CURVE'for o in objects.values())==6 and sum(o.type=='MESH'for o in objects.values())==16
 mats={v for o in objects.values()for v in o.data.materials if v};assert {v.name:flat_ns['material_state'](v)for v in mats}=={v.name:flat_frozen['importedSourceMaterialHashes'][v.name]for v in mats}
 actual={k:helpers['evaluated'](o)for k,o in objects.items()if o.type=='CURVE'};assert actual==proof['actualEvaluatedRailMaterials']
 if label=='rebuilt-full':
  assert len(scene.objects)==4063;owned={r['node']for r in curve_frozen['ownedRailChanges']}|{r['name']for r in curve_frozen['haunches']};assert {o.name:flat_ns['source_state'](o)for o in scene.objects if o.name not in owned}==curve_frozen['nonownedImportedSourceHashes']
 else:assert len(scene.objects)==22
 assert H(path.read_bytes())==pin;rows.append({'file':label,'objects':len(scene.objects),'componentStatesExact':22,'editableGNCurves':6,'actualExistingIronMaterialConfirmed':True,'fileUnchanged':True,'sha256':pin})
report={'schema':1,'status':'PASS: portable CPU replay reproduces final raw GLB bytes and all source/owned/addon logical states','baseGlbSha256':'ba0969961ed97c854742e86c43fd16326f142f8e4289b3acd55acb8a910f58cc','flatGlbSha256':'ba851616344808c23d2fb1868f29c30f8cfbe0ca7b4f5645d5f64677700f610f','curvedRawSha256':H((curves/'west-p5-curved-study.glb').read_bytes()),'all4055NonownedSourceStatesExact':True,'allSourceMaterialStatesExact':True,'reopened':rows,'exactFullBlendSerializationClaimed':False,'qualification':'Regenerated full.blend serialization may differ. The exact accepted full.blend remains separately backed externally.','noRenderingGpuCanonicalOrRootChanges':True};(out/'portable-replay-proof.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
