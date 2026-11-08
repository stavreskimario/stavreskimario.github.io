"""Actual frozen Blender source preview; not the final browser lighting."""
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
from mathutils import Vector

work=Path('/Users/stavreskimario/Desktop/penn-station-work')
source=work/'phase4-core-floor-v3-ready/penn-station-study.blend'
output=work/'source-preview-concourse-floor-v3'
output.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(work/'lighting-phase4-source'))
from material_library import apply_materials,prepare_surface_uvs
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.context.scene
prepare_surface_uvs([o for o in scene.objects if o.type=='MESH'])
materials=apply_materials(bpy.data.materials,Path('/Users/stavreskimario/Desktop/penn-station-reconstruction/authoring/penn-station-1935/materials'))
world=bpy.data.worlds.new('Neutral daylight source-preview dome')
world.use_nodes=True
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.70,.75,.82,1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value=.70
scene.world=world
sun_data=bpy.data.lights.new('Source-preview afternoon sun','SUN')
sun_data.energy=2.2
sun_data.angle=.018
sun=bpy.data.objects.new('Source-preview afternoon sun',sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler=(.60,-.55,-.85)
eye_gltf=[-103.8,-2.4,33]
target_gltf=[-52,12,-18]
camera_data=bpy.data.cameras.new('Approximate LOC071935 source viewpoint')
camera=bpy.data.objects.new('Approximate LOC071935 source viewpoint',camera_data)
scene.collection.objects.link(camera)
camera.location=(eye_gltf[0],-eye_gltf[2],eye_gltf[1])
target=Vector((target_gltf[0],-target_gltf[2],target_gltf[1]))
camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
camera_data.sensor_fit='VERTICAL'
camera_data.sensor_height=24
camera_data.lens=24/(2*math.tan(math.radians(62)/2))
camera_data.clip_start=.10
camera_data.clip_end=1000
scene.camera=camera
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=32
scene.cycles.use_denoising=True
scene.cycles.diffuse_bounces=6
scene.cycles.glossy_bounces=6
scene.cycles.transmission_bounces=12
scene.cycles.max_bounces=16
scene.render.threads_mode='FIXED'
scene.render.threads=6
scene.render.resolution_x=1280
scene.render.resolution_y=900
scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
scene.view_settings.exposure=1.6
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(output/'concourse-floor-v3-source-preview.png')
report={'scope':'Actual frozen Blender core source with reviewed interpreted PBR colours and restrained source-review daylight. This is not the finished browser render, not historically calibrated weather/exposure and not a calibrated historical photograph or final browser acceptance. Floor coverage revision3 reconstructs the broad visible central open court with explicit uncertainty about exact panel edges and pitch.', 'sourceBlendSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'cameraGltf':{'eye':eye_gltf,'target':target_gltf,'verticalFov':62,'matching':'Approximate LOC071935 composition, not calibrated original camera'},'renderer':{'engine':'Cycles','device':'CPU','samples':32,'threads':6,'resolution':[1280,900],'viewTransform':'AgX','exposure':1.6,'sunEnergy':2.2,'domeStrength':.7},'materials':materials,'output':'concourse-floor-v3-source-preview.png'}
(output/'preview.json').write_text(json.dumps(report,indent=2)+'\n')
bpy.ops.render.render(write_still=True)
report['outputSha256']=hashlib.sha256((output/'concourse-floor-v3-source-preview.png').read_bytes()).hexdigest()
report['completed']=True
(output/'preview.json').write_text(json.dumps(report,indent=2)+'\n')
print('SOURCE_PREVIEW',output/'concourse-floor-v3-source-preview.png',flush=True)
