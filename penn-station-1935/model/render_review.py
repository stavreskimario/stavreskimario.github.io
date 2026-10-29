"""Optional Blender geometry-review render; does not modify the delivered assets."""
from pathlib import Path
import bpy
from mathutils import Vector

ROOT=Path(__file__).resolve().parent.parent
bpy.ops.wm.open_mainfile(filepath=str(ROOT/'model'/'penn-station-study.blend'))
scene=bpy.context.scene
for col in bpy.data.collections:
    if col.name.startswith(('01 ','03 ')):
        col.hide_render=True
world=bpy.data.worlds.new('Review daylight')
world.use_nodes=True
nodes=world.node_tree.nodes
environment=nodes.new('ShaderNodeTexEnvironment')
environment.image=bpy.data.images.load(str(ROOT/'assets'/'sky.hdr'))
world.node_tree.links.new(environment.outputs['Color'],nodes.get('Background').inputs['Color'])
nodes.get('Background').inputs['Strength'].default_value=.7
scene.world=world
light_data=bpy.data.lights.new('Review sun','SUN')
light_data.energy=2.5
light_data.angle=.015
light=bpy.data.objects.new('Review sun',light_data)
scene.collection.objects.link(light)
light.rotation_euler=(.5,-.6,-.8)
camera_data=bpy.data.cameras.new('Review camera')
camera=bpy.data.objects.new('Review camera',camera_data)
scene.collection.objects.link(camera)
camera.location=(0,-36,2.1)
camera.rotation_euler=(Vector((0,23,24))-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.lens=24
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.samples=24
scene.cycles.use_denoising=True
scene.render.resolution_x=1280
scene.render.resolution_y=960
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.render.image_settings.file_format='PNG'
scene.render.filepath='/private/tmp/penn-waiting-geometry-review.png'
bpy.ops.render.render(write_still=True)
