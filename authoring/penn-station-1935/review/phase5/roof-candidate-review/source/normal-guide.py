"""One-sample object-space NORMAL guide on the existing packed vault UV."""
from pathlib import Path
import bpy,numpy as np,json,hashlib,gzip,time,sys
root=Path('/Users/stavreskimario/Desktop/penn-station-work/phase5-materials');out=root/'guided-normal-v3';source=root/'vault-baked-v3/model-waiting-room-vault.glb';started=time.monotonic()
sys.path.insert(0,'/Users/stavreskimario/Desktop/penn-station-reconstruction/penn-station-1935/model')
from render_device import configure_device
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(source));objects=[o for o in bpy.context.scene.objects if o.type=='MESH'];assert len(objects)==1;obj=objects[0];mesh=obj.data;mesh.calc_loop_triangles()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def mesh_receipt():
 h=hashlib.sha256()
 for collection,attr,size,dtype in [(mesh.vertices,'co',3,np.float32),(mesh.loops,'vertex_index',1,np.int32),(mesh.corner_normals,'vector',3,np.float32)]:
  values=np.empty(len(collection)*size,dtype);collection.foreach_get(attr,values);h.update(values.tobytes())
 for uv in mesh.uv_layers:
  values=np.empty(len(mesh.loops)*2,np.float32);uv.data.foreach_get('uv',values);h.update(uv.name.encode());h.update(values.tobytes())
 return h.hexdigest()
before=mesh_receipt();uv_index=1;assert len(mesh.uv_layers)==2
values=np.empty(len(mesh.loops)*2,np.float32);mesh.uv_layers[uv_index].data.foreach_get('uv',values);assert values.min()>=0 and values.max()<=1
mesh.uv_layers.active_index=uv_index;mesh.uv_layers[uv_index].active_render=True
scene=bpy.context.scene;scene.render.engine='CYCLES';device=configure_device(scene,'METAL');scene.cycles.samples=1;scene.cycles.max_bounces=0;scene.render.threads_mode='FIXED';scene.render.threads=8;scene.render.bake.normal_space='OBJECT';scene.render.bake.normal_r='POS_X';scene.render.bake.normal_g='POS_Y';scene.render.bake.normal_b='POS_Z';scene.view_settings.view_transform='Raw';scene.view_settings.look='None';scene.view_settings.exposure=0;scene.view_settings.gamma=1
image=bpy.data.images.new('Object-space normal guide',width=8192,height=8192,alpha=True,float_buffer=True);image.colorspace_settings.name='Non-Color'
for material in mesh.materials:
 material.use_nodes=True
 for node in material.node_tree.nodes:node.select=False
 target=material.node_tree.nodes.new('ShaderNodeTexImage');target.image=image;target.select=True;material.node_tree.nodes.active=target
bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
print('START NORMAL ONLY, OBJECT,8192,1sample',flush=True)
bpy.ops.object.bake(type='NORMAL',normal_space='OBJECT',normal_r='POS_X',normal_g='POS_Y',normal_b='POS_Z',uv_layer=mesh.uv_layers[uv_index].name,use_clear=True,margin=8)
pixels=np.empty(len(image.pixels),np.float32);image.pixels.foreach_get(pixels);rgba=pixels.reshape(8192,8192,4);encoded=rgba[:,:,:3].copy();mask=np.any(encoded>1e-6,axis=2);normal=encoded*2-1;length=np.linalg.norm(normal,axis=2);valid=mask&(length>1e-5);normal=np.divide(normal,length[:,:,None],out=np.zeros_like(normal),where=valid[:,:,None]);normal[~valid]=0
assert np.isfinite(normal).all();assert np.max(np.abs(np.linalg.norm(normal[valid],axis=1)-1))<1e-5
npy=out/'vault-normal-guide.npy';np.save(npy,normal,allow_pickle=False)
assert mesh_receipt()==before
print('NEW25DEGREE NORMAL GUIDE SAVED; lossless rawNPY retained, compressed copies deferred',flush=True)
report={'schemaVersion':1,'purpose':'Object-space normal guidance only; no GI/illumination/AO/geometry rebake or modification','input':str(source),'sourceSha256':sha(source),'resolution':[8192,8192],'samples':1,'engine':'Cycles NORMAL OBJECT','device':device,'packedUvIndex':uv_index,'packedUvName':mesh.uv_layers[uv_index].name,'bakeMarginPixels':8,'normalEncoding':'Cycles OBJECT normal RGB0..1 decoded2RGB-1 and normalized to unit signed vectors; untouched background zero','guideArrayRowOrder':'Blender image pixels, bottom-to-top; same as linear GI pixels read by bpy','coveredPixels':int(valid.sum()),'normalLengthMaximumError':float(np.max(np.abs(np.linalg.norm(normal[valid],axis=1)-1))),'meshPositionsNormalsAndBothUvsSha256Before':before,'meshPositionsNormalsAndBothUvsSha256After':mesh_receipt(),'files':{},'elapsedSeconds':time.monotonic()-started}
for p in [npy]:report['files'][p.name]={'bytes':p.stat().st_size,'sha256':sha(p)}
report['archiveStatus']='Raw losslessNPY retained in persistentwork; redundant209MBcompressed/EXR exports deferred; exactnewpackedGLB reproduces guide';(out/'normal-guide-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report),flush=True)
