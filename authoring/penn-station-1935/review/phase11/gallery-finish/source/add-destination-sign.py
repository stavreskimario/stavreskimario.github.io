from pathlib import Path
import bpy,math,json,hashlib,time
from mathutils import Vector
D=Path('/Users/stavreskimario/Desktop/penn-station-work/phase11-arrivals-finish/geometry-v1');O=D/'candidate-v4';assert not O.exists();O.mkdir()
H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
source=D/'candidate-v3/addon.blend';oldglb=D/'candidate-v3/finish-addon.glb';t=time.monotonic();bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene;old=[o for o in scene.objects if o.type=='MESH'];assert len(old)==98

def state(o):
 return{'matrix':list(sum((list(r)for r in o.matrix_world),[])),'vertices':[tuple(v.co)for v in o.data.vertices],'polygons':[(tuple(p.vertices),p.use_smooth,p.material_index)for p in o.data.polygons],'uv':[[tuple(x.uv)for x in uv.data]for uv in o.data.uv_layers],'materials':[m.name for m in o.data.materials]}
before={o.name:state(o)for o in old};oldmaterials={m.name:m.diffuse_color[:]for o in old for m in o.data.materials if m}
vec=lambda p:Vector((p[0],-p[2],p[1]+4.2672))
# Main0 Blender scene; world coordinates are explicitly converted once.
def material(name,color,rough=.6):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;return m
boardmat=material('IvoryEnamel33rdStreetDestinationBoard',(.72,.68,.56),.45);textmat=material('Lettering33rdStreetDestination',(.018,.022,.02),.85);textmat.use_backface_culling=True;textmat['skip_lighting_atlas']=True
metal=bpy.data.materials['PaintedStructuralIronArrivalsStructure'];new=[]
BOX=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
def box(name,lo,hi,mat):
 center=[(a+b)/2 for a,b in zip(lo,hi)];corners=[(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)];verts=[]
 for c in corners:
  w=[hi[k]if c[k]else lo[k]for k in range(3)];verts.append((w[0]-center[0],-(w[2]-center[2]),w[1]-center[1]))
 mesh=bpy.data.meshes.new(name+' mesh');mesh.from_pydata(verts,[],BOX);mesh.update();mesh.materials.append(mat);uv=mesh.uv_layers.new(name='ArchitecturalUV')
 for p in mesh.polygons:
  axes=[k for k in range(3)if k!=max(range(3),key=lambda k:abs(p.normal[k]))]
  for i in p.loop_indices:
   co=mesh.vertices[mesh.loops[i].vertex_index].co;uv.data[i].uv=(co[axes[0]],co[axes[1]])
 o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);o.location=vec(center);new.append(o);return o
board=box('33rd Street destination ivory board',[-64.9,-5.23,-75.0125],[-63.1,-4.89,-74.9875],boardmat)
for i,x in enumerate([-64.6,-63.4],1):box('33rd Street destination ceiling stem '+str(i),[x-.009,-4.89,-75.009],[x+.009,-4.7072,-74.991],metal)
texts=[]
for side,sgn in [('south',1),('north',-1)]:
 data=bpy.data.curves.new('33rd STREET '+side+' lettering','FONT');data.body='33rd STREET';data.align_x='CENTER';data.align_y='CENTER';data.size=.22;data.extrude=0;data.fill_mode='FRONT';data.resolution_u=8
 o=bpy.data.objects.new('33rd Street destination '+side+' readable lettering',data);scene.collection.objects.link(o);o.rotation_euler=(math.pi/2,0,0 if sgn>0 else math.pi);o.location=vec([-64,-5.06,-75+sgn*.0135]);o.data.materials.append(textmat);o['skip_lighting_atlas']=True;o['source_qualification']='33rd STREET destination is source-photographed; location, built-in Bfont glyphs, case/spacing and board profile inferred.'
 bpy.context.view_layer.update()
 if o.dimensions.x>1.62:o.scale*=1.62/o.dimensions.x
 bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.convert(target='MESH');o=bpy.context.object;o.data.name=o.name+' mesh';new.append(o);texts.append(o)
for o in new:o['penn_destination_sign']=1;o['reconstruction_status']='Source-family destination sign; exact placement, lettering and minor fabrication inferred.'
bpy.context.view_layer.update();assert before=={o.name:state(o)for o in old};assert oldmaterials=={m.name:m.diffuse_color[:]for o in old for m in o.data.materials if m}
for o in scene.objects:o.select_set(o.type=='MESH')
bpy.context.view_layer.objects.active=board;assert len([o for o in scene.objects if o.type=='MESH'])==103
bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(O/'addon.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(O/'finish-addon.glb'),export_format='GLB',use_selection=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True)
assert before=={o.name:state(o)for o in old}
report={'status':'103-object addon candidate: 98 retained plus supported two-sided destination sign','sourceAddon':{'path':str(source),'sha256':H(source)},'sourceGlb':{'path':str(oldglb),'sha256':H(oldglb)},'addon':{'path':str(O/'finish-addon.glb'),'sha256':H(O/'finish-addon.glb'),'bytes':(O/'finish-addon.glb').stat().st_size},'editableAddon':{'path':str(O/'addon.blend'),'sha256':H(O/'addon.blend'),'bytes':(O/'addon.blend').stat().st_size},'all98BlenderStatesExact':True,'oldMaterialColorsExact':True,'newObjects':[o.name for o in new],'panelWorldBounds':[[-64.9,-5.23,-75.0125],[-63.1,-4.89,-74.9875]],'actualCeilingUndersideWorldY':-4.7072,'panelBottomHeadClearanceM':2.2376,'stemHeightM':.1828,'textMaterial':textmat.name,'textMaterialSkipLightingAtlas':True,'font':'Blender builtin Bfont; glyphs, case/spacing inferred','sourceFamily':'PRR1910 booklet PDF53 Exit Concourse photograph shows 33rd STREET destination family; placement/profile inferred','elapsedSeconds':time.monotonic()-t}
(O/'sign-manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2),flush=True)
