"""Author a restrained, physically scaled lower-gallery concrete material in Blender.

The existing grey floor is an explicitly qualified appearance interpretation.
This modern CC0 texture is not evidence for the demolished floor's composition.
"""
from pathlib import Path
import bpy, json, hashlib

ROOT = Path(__file__).parent
OUT = ROOT / 'authored-v1'
assert not OUT.exists()
OUT.mkdir()
bpy.ops.wm.read_factory_settings(use_empty=True)
m = bpy.data.materials.new('ConcourseOpaqueArrivalsConcrete')
m.use_nodes = True
m['surface_identity'] = 'Qualified neutral concrete appearance; complete historic Exit floor finish unverified.'
m['texture_source'] = 'ambientCG Concrete034, CC0-1.0; modern approximation, not a historic sample.'
m['physical_tile_metres'] = [1.1, .55]
m['mean_albedo_target'] = [.44, .445, .42]
n, l = m.node_tree.nodes, m.node_tree.links
p = n.get('Principled BSDF')
p.inputs['Metallic'].default_value = 0
p.inputs['Roughness'].default_value = 1
uv = n.new('ShaderNodeTexCoord')
mapping = n.new('ShaderNodeMapping')
mapping.inputs['Scale'].default_value = (1.5/1.1, 1.5/.55, 1)
l.new(uv.outputs['UV'], mapping.inputs['Vector'])
images = {}
for role, transfer in [('Color', 'sRGB'), ('NormalGL', 'Non-Color'), ('Roughness', 'Non-Color')]:
    image = bpy.data.images.load(str(ROOT/'Concrete034'/f'Concrete034_2K-JPG_{role}.jpg'))
    image.colorspace_settings.name = transfer
    image.pack()
    tex = n.new('ShaderNodeTexImage'); tex.image = image
    l.new(mapping.outputs['Vector'], tex.inputs['Vector'])
    images[role] = tex
multiply = n.new('ShaderNodeMixRGB'); multiply.blend_type = 'MULTIPLY'
multiply.inputs[0].default_value = 1
multiply.inputs[1].default_value = (.9127208966262771, .9230927201616019, .8712335809540819, 1)
l.new(images['Color'].outputs['Color'], multiply.inputs[2])
l.new(multiply.outputs[0], p.inputs['Base Color'])
normal = n.new('ShaderNodeNormalMap'); normal.inputs['Strength'].default_value = .22
l.new(images['NormalGL'].outputs['Color'], normal.inputs['Color'])
l.new(normal.outputs['Normal'], p.inputs['Normal'])
l.new(images['Roughness'].outputs['Color'], p.inputs['Roughness'])
# The sample only carries the authored material. Runtime station geometry stays exact.
bpy.ops.mesh.primitive_plane_add(size=1.5)
plane = bpy.context.object; plane.name = 'Material verification sample only'
plane.data.materials.append(m)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'gallery-floor-material.blend'), compress=True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'gallery-floor-material.glb'), export_format='GLB',
                         use_selection=True, export_extras=True, export_lights=False)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
(OUT/'authoring.json').write_text(json.dumps({
    'scope': 'Material only; sample geometry never appended to station',
    'inputs': json.loads((ROOT/'rights-and-inputs.json').read_text()),
    'tileMetres': [1.1, .55], 'oldUvTileMetres': 1.5,
    'normalStrength': .22, 'meanLinearAlbedo': [.44, .445, .42],
    'mapsUnmodified': True,
    'outputs': {name: sha(OUT/name) for name in ['gallery-floor-material.blend','gallery-floor-material.glb']}
}, indent=2)+'\n')
print('PASS authored CC0 gallery floor PBR; station geometry untouched')
