"""Append the verified bracket pair and bounded finish to the repaired source.

The input already contains the scoped coffer-normal and floor-ownership repair.
Existing geometry, transforms, UVs and corner normals must remain unchanged.
The new roughness images are packed and use portable authoring-relative paths.
"""
from pathlib import Path
import argparse
import hashlib
import json
import bpy
import numpy as np
from mathutils import Matrix

parser=argparse.ArgumentParser()
for name in ('input','brackets','library','out','report'):
    parser.add_argument('--'+name,type=Path,required=True)
args=parser.parse_args()
assert args.input.resolve()!=args.out.resolve()
bpy.ops.wm.open_mainfile(filepath=str(args.input.resolve()))
main=float(bpy.context.scene.get('main_floor_world',-4.2672))

def geometry_hash(obj):
    h=hashlib.sha256(np.asarray(obj.matrix_world,dtype='<f8').tobytes())
    if obj.type=='MESH':
        for collection,prop,components,dtype in [(obj.data.vertices,'co',3,np.float32),(obj.data.loops,'vertex_index',1,np.int32),(obj.data.corner_normals,'vector',3,np.float32)]:
            values=np.empty(len(collection)*components,dtype=dtype);collection.foreach_get(prop,values);h.update(values.tobytes())
        for layer in obj.data.uv_layers:
            values=np.empty(len(layer.data)*2,dtype=np.float32);layer.data.foreach_get('uv',values);h.update(values.tobytes())
    return h.hexdigest()

before={obj.name:geometry_hash(obj) for obj in bpy.context.scene.objects}
existing_materials={name:bpy.data.materials[name] for name in ('AgedBronze','OpalCandelabraGlass')}
with bpy.data.libraries.load(str(args.brackets.resolve()),link=False) as (source,target):
    assert 'Phase5 photographed wall-bracket pair' in source.collections
    target.collections=['Phase5 photographed wall-bracket pair']
collection=target.collections[0]
bpy.context.scene.collection.children.link(collection)
# Evaluate linked anchor transforms before applying the Main-to-world offset.
bpy.context.view_layer.update()
added=list(collection.all_objects)
assert len(added)==6 and sum(obj.type=='MESH' for obj in added)==4 and sum(obj.type=='EMPTY' for obj in added)==2
for obj in added:
    if obj.type!='MESH': continue
    for index,material in enumerate(obj.data.materials):
        name=material.name.split('.')[0]
        assert name in existing_materials
        obj.data.materials[index]=existing_materials[name]
for obj in added:
    if obj.parent not in added:
        obj.matrix_world=Matrix.Translation((0,0,main))@obj.matrix_world
bpy.context.view_layer.update()
bindings=[]
for material in bpy.data.materials:
    profile=next((p for p in ('InteriorGranite','MilfordGranite','Travertine') if material.name.startswith(p)),None)
    if not profile or not material.use_nodes: continue
    source=args.library/f'{profile}-roughness.png'
    assert source.is_file()
    image=bpy.data.images.load(str(source.resolve()),check_existing=True)
    image.colorspace_settings.name='Non-Color'
    if not image.packed_file:image.pack()
    source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
    assert hashlib.sha256(image.packed_file.data).hexdigest()==source_hash
    image.filepath=f'//materials/phase5/{source.name}'
    pbr=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    texture=material.node_tree.nodes.new('ShaderNodeTexImage');texture.image=image
    texture.label='Phase5 bounded linear roughness; unit multiplier'
    material.node_tree.links.new(texture.outputs['Color'],pbr.inputs['Roughness'])
    material['surface_roughness_factor']=1.0
    material['surface_roughness_revision']=5
    material['surface_roughness_profile']=profile+' bounded B interpretation; no measured historical finish'
    bindings.append({'material':material.name,'profile':profile,'sourceSha256':source_hash,'roughnessFactor':1,'packed':True})
opal=existing_materials['OpalCandelabraGlass']
pbr=next(n for n in opal.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
pbr.inputs['Base Color'].default_value=(.94,.93,.89,1)
pbr.inputs['Roughness'].default_value=.30
pbr.inputs['Transmission Weight'].default_value=.18
pbr.inputs['IOR'].default_value=1.5
after={obj.name:geometry_hash(obj) for obj in bpy.context.scene.objects if obj.name in before}
assert before==after,'Existing geometry, transforms, UVs or corner normals changed'
bpy.context.scene['phase5_finish_revision']=5
bpy.context.scene['phase5_wall_brackets']='Two photographed foreground twin-globe brackets; minor dimensions and registration inferred'
args.out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(args.out.resolve()),compress=True)
report={'scope':__doc__.strip(),'inputSha256':hashlib.sha256(args.input.read_bytes()).hexdigest(),'bracketModuleBlendSha256':hashlib.sha256(args.brackets.read_bytes()).hexdigest(),'originalObjectsGeometryExact':len(before),'newMeshObjects':sum(obj.type=='MESH' for obj in added),'newAnchorObjects':sum(obj.type=='EMPTY' for obj in added),'newObjectNames':[o.name for o in added],'newFixtureCount':2,'newLiveLights':0,'bracketMainWorldOffset':main,'finishBindings':bindings,'outputSha256':hashlib.sha256(args.out.read_bytes()).hexdigest(),'outputBytes':args.out.stat().st_size}
args.report.parent.mkdir(parents=True,exist_ok=True);args.report.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
