"""External CPU-only geometry review; never saves or alters the input scene."""
from pathlib import Path
import argparse
import hashlib
import json
import bpy
from mathutils import Vector

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--blend', type=Path, required=True)
parser.add_argument('--out', type=Path, required=True)
parser.add_argument('--eye', nargs=3, type=float, required=True, help='Blender Main0 coordinates')
parser.add_argument('--target', nargs=3, type=float, required=True)
parser.add_argument('--hide-name', action='append', default=[])
parser.add_argument('--lens', type=float, default=45)
args = parser.parse_args()
source = args.blend.resolve()
out = args.out.resolve()
assert not out.exists() and source != out
source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
bpy.context.preferences.filepaths.use_scripts_auto_execute = False
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
hidden = []
for name in args.hide_name:
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise ValueError('Missing explicitly named study object: ' + name)
    obj.hide_render = True
    hidden.append(name)
for obj in list(scene.objects):
    if obj.type in {'CAMERA', 'LIGHT'}:
        bpy.data.objects.remove(obj, do_unlink=True)
world = bpy.data.worlds.new('P5 neutral geometry review')
world.use_nodes = True
world.node_tree.nodes.get('Background').inputs['Color'].default_value = (.78, .78, .78, 1)
world.node_tree.nodes.get('Background').inputs['Strength'].default_value = .7
scene.world = world
sun_data = bpy.data.lights.new('P5 geometry review sun', 'SUN')
sun_data.energy = 2
sun_data.angle = .08
sun = bpy.data.objects.new(sun_data.name, sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (.45, -.6, -.8)
camera_data = bpy.data.cameras.new('P5 geometry review camera')
camera = bpy.data.objects.new(camera_data.name, camera_data)
scene.collection.objects.link(camera)
camera.location = args.eye
camera.rotation_euler = (Vector(args.target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
camera_data.lens = args.lens
camera_data.clip_start = .02
camera_data.clip_end = 300
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 24
scene.cycles.use_denoising = True
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.render.resolution_x = 1280
scene.render.resolution_y = 960
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.render.image_settings.file_format = 'PNG'
out.parent.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(out)
bpy.ops.render.render(write_still=True)
assert hashlib.sha256(source.read_bytes()).hexdigest() == source_hash
record = {'scope': 'CPU geometry study only; original imported materials, neutral review lighting, no final browser or historical-photograph claim',
          'input': str(source), 'inputSha256': source_hash, 'inputUnchanged': True,
          'output': str(out), 'outputSha256': hashlib.sha256(out.read_bytes()).hexdigest(),
          'cameraBlenderMain0': {'eye': args.eye, 'target': args.target, 'lens': args.lens},
          'hiddenStudyObjects': hidden, 'engine': 'CYCLES CPU', 'samples': 24}
out.with_suffix('.json').write_text(json.dumps(record, indent=2) + '\n')
print(json.dumps(record), flush=True)
