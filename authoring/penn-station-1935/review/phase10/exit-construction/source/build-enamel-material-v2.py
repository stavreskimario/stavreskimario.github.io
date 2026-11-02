"""Bake a Blender-authored, tileable interpreted enamel-brick PBR material.
Gibbs1910 printed254/PDF442 documents enameled brick under33rdStreet.
Bond/module, pale cream hue, roughness, glaze and mortar relief are inferred.
CPU/two threads only. This is a new procedural material, not a historic image.
"""
from pathlib import Path
import bpy,json,hashlib,time
OUT=Path('/Users/stavreskimario/Desktop/penn-station-work/phase10-arrivals-exit/construction-v1/enamel-material-v2')
assert not OUT.exists();OUT.mkdir()
start=time.time();bpy.ops.wm.read_factory_settings(use_empty=True)
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=1
s.render.threads_mode='FIXED';s.render.threads=2;s.render.bake.margin=0
s.view_settings.view_transform='Standard';s.view_settings.look='None';s.view_settings.exposure=0;s.view_settings.gamma=1
bpy.ops.mesh.primitive_plane_add(size=2,location=(0,0,0));o=bpy.context.object;o.name='Interpreted enamel brick periodic2.032x1.9812m patch';o.scale=(1.016,.9906,1)
bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
m=bpy.data.materials.new('EnameledBrick33rdStreet-Interpreted1910');m.use_nodes=True;o.data.materials.append(m)
n=m.node_tree.nodes;n.clear();l=m.node_tree.links
bs=n.new('ShaderNodeBsdfPrincipled');bs.inputs['Roughness'].default_value=.26;bs.inputs['IOR'].default_value=1.5;bs.inputs['Metallic'].default_value=0;bs.inputs['Coat Weight'].default_value=.18;bs.inputs['Coat Roughness'].default_value=.13
out=n.new('ShaderNodeOutputMaterial');l.new(bs.outputs['BSDF'],out.inputs['Surface'])
tc=n.new('ShaderNodeTexCoord');scale=n.new('ShaderNodeVectorMath');scale.operation='MULTIPLY';scale.inputs[1].default_value=(2.032,1.9812,1);l.new(tc.outputs['UV'],scale.inputs[0])
brick=n.new('ShaderNodeTexBrick');brick.offset=.5;brick.offset_frequency=2;brick.squash=1;brick.squash_frequency=2;l.new(scale.outputs['Vector'],brick.inputs['Vector'])
brick.inputs['Scale'].default_value=1;brick.inputs['Mortar Size'].default_value=.0015;brick.inputs['Mortar Smooth'].default_value=.0004;brick.inputs['Bias'].default_value=0;brick.inputs['Brick Width'].default_value=.2032;brick.inputs['Row Height'].default_value=.0762
lin=lambda c:c/12.92 if c<=.04045 else((c+.055)/1.055)**2.4
for key,col in [('Color1',(.825,.8125,.77)),('Color2',(.825,.8125,.77)),('Mortar',(.58,.575,.55))]:brick.inputs[key].default_value=(*[lin(v)for v in col],1)
# Embed UV on a4Dtorus so all subtle variation is periodic in both axes.
uvsep=n.new('ShaderNodeSeparateXYZ');l.new(tc.outputs['UV'],uvsep.inputs[0]);period=[]
for axis in ['X','Y']:
 a=n.new('ShaderNodeMath');a.operation='MULTIPLY';a.inputs[1].default_value=6.283185307179586;l.new(uvsep.outputs[axis],a.inputs[0])
 for op in ['COSINE','SINE']:
  f=n.new('ShaderNodeMath');f.operation=op;l.new(a.outputs[0],f.inputs[0]);period.append(f.outputs[0])
torus=n.new('ShaderNodeCombineXYZ')
for socket,value in zip(torus.inputs,[period[0],period[1],period[2]]):l.new(value,socket)
macro=n.new('ShaderNodeTexNoise');macro.noise_dimensions='4D';macro.inputs['Scale'].default_value=.8;macro.inputs['Detail'].default_value=2;l.new(torus.outputs[0],macro.inputs['Vector']);l.new(period[3],macro.inputs['W'])
variation=n.new('ShaderNodeMath');variation.operation='MULTIPLY_ADD';variation.inputs[1].default_value=.04;variation.inputs[2].default_value=.98;l.new(macro.outputs['Fac'],variation.inputs[0])
shade=n.new('ShaderNodeMixRGB');shade.blend_type='MULTIPLY';shade.inputs[0].default_value=1;l.new(brick.outputs['Color'],shade.inputs[1]);l.new(variation.outputs[0],shade.inputs[2]);l.new(shade.outputs[0],bs.inputs['Base Color'])
face=n.new('ShaderNodeMath');face.operation='SUBTRACT';face.inputs[0].default_value=1;l.new(brick.outputs['Fac'],face.inputs[1])
h=n.new('ShaderNodeMath');h.operation='MULTIPLY';h.inputs[1].default_value=.0018;l.new(face.outputs[0],h.inputs[0])
noise=n.new('ShaderNodeTexNoise');noise.noise_dimensions='4D';noise.inputs['Scale'].default_value=45;noise.inputs['Detail'].default_value=2;noise.inputs['Roughness'].default_value=.35;l.new(torus.outputs[0],noise.inputs['Vector']);l.new(period[3],noise.inputs['W'])
micro=n.new('ShaderNodeMath');micro.operation='MULTIPLY';micro.inputs[1].default_value=.00002;l.new(noise.outputs['Fac'],micro.inputs[0])
add=n.new('ShaderNodeMath');add.operation='ADD';l.new(h.outputs[0],add.inputs[0]);l.new(micro.outputs[0],add.inputs[1])
bump=n.new('ShaderNodeBump');bump.inputs['Strength'].default_value=1;bump.inputs['Distance'].default_value=1;l.new(add.outputs[0],bump.inputs['Height']);l.new(bump.outputs['Normal'],bs.inputs['Normal'])
rough=n.new('ShaderNodeMapRange');rough.inputs['From Min'].default_value=0;rough.inputs['From Max'].default_value=1;rough.inputs['To Min'].default_value=.26;rough.inputs['To Max'].default_value=.72;l.new(brick.outputs['Fac'],rough.inputs['Value']);l.new(rough.outputs['Result'],bs.inputs['Roughness'])
emit=n.new('ShaderNodeEmission');emit.inputs['Strength'].default_value=1
records=[]
def bake(name,kind,source=None):
 image=bpy.data.images.new(name,width=2048,height=2048,alpha=False,float_buffer=False)
 image.colorspace_settings.name='Non-Color' if kind=='NORMAL' or 'roughness'in name else 'sRGB'
 target=n.new('ShaderNodeTexImage');target.image=image;n.active=target;target.select=True
 if kind=='EMIT':
  l.new(source,emit.inputs['Color']);l.new(emit.outputs[0],out.inputs['Surface'])
 else:l.new(bs.outputs[0],out.inputs['Surface'])
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 bpy.ops.object.bake(type=kind,use_clear=True,margin=0,normal_space='TANGENT')
 path=OUT/(name+'.png');image.filepath_raw=str(path);image.file_format='PNG';image.save()
 px=list(image.pixels);mins=[min(px[k::4])for k in range(3)];maxs=[max(px[k::4])for k in range(3)]
 records.append({'file':path.name,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'type':kind,'colorSpace':image.colorspace_settings.name,'width':2048,'height':2048,'imagePixelsMin':mins,'imagePixelsMax':maxs})
 n.remove(target);print('BAKED',path.name,flush=True)
bake('enameled-brick-color','EMIT',shade.outputs[0])
bake('enameled-brick-normal','NORMAL')
bake('enameled-brick-roughness','EMIT',rough.outputs['Result'])
l.new(bs.outputs[0],out.inputs['Surface']);n.remove(emit)
m['historical_source']='Gibbs1910 printed254/PDF442: enameledbrickretainingwallsunder33rdStreet'
m['qualification']='Interpretednewproceduralmaterial; bond,module,glaze,hue andmortar notmeasuredhistoricsamples.'
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'enamel-brick-procedural.blend'),compress=True)
report={'schema':1,'status':'BlenderCPU baked proceduralmaterial; mappedstationreviewpending','source':'Gibbs1910 printed254/PDF442','sourceUrl':'https://archive.org/download/transactionsofam69amer/transactionsofam69amer.pdf#page=442','periodicPatchMetres':[2.032,1.9812],'brickModuleMetres':[.2032,.0762],'horizontalModules':10,'courses':26,'halfBondOffset':.5,'variationPeriodicity':'UV4Dtorus; identicalColor1/Color2 prevents nonperiodic perbrickrandomcolors','mortarNominalMetres':.003,'mortarRecessMetres':.0018,'brickRoughness':.26,'mortarRoughness':.72,'roughnessVariationInterpreted':True,'qualification':'Materialfamilydocumented; hue,module,bond,glaze andminorrelief are inferred. NewBlenderproceduralmaps, not historicalphotographs.','threads':2,'device':'CPU','samples':1,'runtimeSeconds':time.time()-start,'files':records,'scriptSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'blendSha256':hashlib.sha256((OUT/'enamel-brick-procedural.blend').read_bytes()).hexdigest()}
(OUT/'material-proof.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':report['status'],'seconds':report['runtimeSeconds'],'files':records}),flush=True)
