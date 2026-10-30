from pathlib import Path
import sys,json,time,hashlib,argparse
import bpy
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'source'))
from order_lighting_uv import split_waiting_order_objects,prepare_order_uv,corner_signature
parser=argparse.ArgumentParser();parser.add_argument('--input',type=Path,required=True);parser.add_argument('--out',type=Path,required=True);args=parser.parse_args();out=args.out;out.mkdir(parents=True,exist_ok=True);source=args.input
started=time.monotonic();bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source));primary=list(bpy.context.scene.objects)
print('Imported',len(primary),flush=True)
before=corner_signature(primary);print('Signature before',flush=True)
orders,others,selection=split_waiting_order_objects(primary);print('Partition',len(orders),len(others),flush=True)
after=corner_signature(orders+others);print('Signatures equal',before==after,flush=True)
if before!=after:raise RuntimeError(json.dumps({'before':before,'after':after}))
bpy.ops.object.select_all(action='DESELECT')
for obj in orders:obj.select_set(True)
bpy.context.view_layer.objects.active=orders[0];bpy.ops.object.join();obj=bpy.context.object;obj.name='Eight colossal orders — dedicated lighting'
uv_before=corner_signature([obj]);metrics=prepare_order_uv(obj,4096,4);uv_after=corner_signature([obj]);print(json.dumps(metrics,indent=2),flush=True)
if uv_before!=uv_after:raise RuntimeError('Unwrap changed authored geometry, normals or UV0')
try:
 prepare_order_uv(obj,4096,4)
 raise RuntimeError('Existing lighting-layer guard failed')
except ValueError:
 pass
report={'existingLightingLayerGuard':'PASS','source':str(source),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sourceHelperSha256':hashlib.sha256((Path(__file__).resolve().parents[1]/'source/order_lighting_uv.py').read_bytes()).hexdigest(),'selection':selection,'originalSignature':before,'partitionSignature':after,'unwrapBefore':uv_before,'unwrapAfter':uv_after,'metrics':metrics,'elapsedSeconds':time.monotonic()-started}
(out/'order-uv-proof.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
bpy.ops.export_scene.gltf(filepath=str(out/'order-uv-prepared.glb'),export_format='GLB',use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True)
print('PASS',flush=True)
