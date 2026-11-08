from pathlib import Path
import bpy,numpy as np,json,math,hashlib
from bpy_extras.mesh_utils import mesh_linked_uv_islands
w=Path('/Users/stavreskimario/Desktop/penn-station-work/phase5-materials');out=w/'welded-uv-proof';out.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);source=w/'normal-source/model-waiting-room.glb';bpy.ops.import_scene.gltf(filepath=str(source));objs=[o for o in bpy.context.scene.objects if o.type=='MESH' and len(o.data.materials)==1 and o.data.materials[0].name=='PaleVaultPlaster'];assert len(objs)==1;obj=objs[0];m=obj.data;bpy.context.view_layer.objects.active=obj;bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
n=np.empty(len(m.loops)*3,np.float32);m.corner_normals.foreach_get('vector',n);n=n.reshape(-1,3);uv=np.empty(len(m.loops)*2,np.float32);m.uv_layers[0].data.foreach_get('uv',uv);uv=uv.reshape(-1,2)
import sys
sys.path.insert(0,'/Users/stavreskimario/Desktop/penn-station-reconstruction/penn-station-1935/model')
from vault_lighting_uv import prepare_vault_uv
report=prepare_vault_uv(obj,8192,8)
islands=mesh_linked_uv_islands(m);m.calc_loop_triangles();uvb=np.empty(len(m.loops)*2,np.float32);m.uv_layers['BakedLightingUV'].data.foreach_get('uv',uvb);loops=np.asarray([list(t.loops) for t in m.loop_triangles]);uvt=uvb.reshape(-1,2)[loops];e1=uvt[:,1]-uvt[:,0];e2=uvt[:,2]-uvt[:,0];report['atlasCoverage']=float(np.abs(e1[:,0]*e2[:,1]-e1[:,1]*e2[:,0]).sum()*.5);report['uvIslands']=len(islands);report['sourceSha256']=hashlib.sha256(source.read_bytes()).hexdigest();assert len(islands)==4328;assert .2741<report['atlasCoverage']<.2743
(out/'actual-helper-proof.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
