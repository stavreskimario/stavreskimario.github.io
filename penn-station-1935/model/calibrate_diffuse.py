"""Measure the units of a Cycles diffuse-lighting bake with a Lambertian patch.

An unobstructed unit-radiance hemisphere has irradiance pi. A unit-albedo
Lambertian patch emits radiance1. The bake must be measured, not guessed.
"""
from pathlib import Path
import argparse
import json
import bpy
import numpy as np
from render_device import configure_device

parser = argparse.ArgumentParser()
parser.add_argument("--out", type=Path, required=True)
parser.add_argument("--device", choices=("CPU", "METAL"), default="CPU")
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
device = configure_device(scene, args.device)
scene.cycles.samples = 64
scene.cycles.diffuse_bounces = 2
scene.render.threads_mode = "FIXED"
scene.render.threads = 2
world = bpy.data.worlds.new("Unit radiance hemisphere")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1
scene.world = world
bpy.ops.mesh.primitive_plane_add(size=2)
plane = bpy.context.object
material = bpy.data.materials.new("Measured Lambertian patch")
material.use_nodes = True
nodes, links = material.node_tree.nodes, material.node_tree.links
nodes.clear()
output = nodes.new("ShaderNodeOutputMaterial")
diffuse = nodes.new("ShaderNodeBsdfDiffuse")
diffuse.inputs["Color"].default_value = (.5, .5, .5, 1)
links.new(diffuse.outputs[0], output.inputs["Surface"])
plane.data.materials.append(material)
image = bpy.data.images.new("Unit diffuse lighting", 32, 32, float_buffer=True)
image.colorspace_settings.name = "Non-Color"
target = nodes.new("ShaderNodeTexImage")
target.image = image
nodes.active = target
scene.render.bake.use_pass_direct = True
scene.render.bake.use_pass_indirect = True
scene.render.bake.use_pass_color = False
bpy.ops.object.bake(type="DIFFUSE", margin=0)
pixels = np.asarray(image.pixels[:], dtype=np.float32).reshape(32, 32, 4)[4:-4, 4:-4, :3]
mean = float(pixels.mean())
assert abs(mean - 1) < .025, f"Expected unit-albedo outgoing radiance1, got{mean}"
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.color_depth = "8"
encoding = image.copy()
encoding.colorspace_settings.name = "Linear Rec.709"
patch = np.ones((32, 32, 4), dtype=np.float32)
patch[:, :, :3] = .18
encoding.pixels.foreach_set(patch.ravel())
encoding.save_render(str(args.out / "linear-018-standard-srgb.png"), scene=scene)
# HDR retention must preserve radiance, without the display transform applied
# by Image.save() to a generated image tagged Linear Rec.709.
hdr_image = bpy.data.images.new("Retained linear0.18", 32, 32, float_buffer=True)
hdr_image.colorspace_settings.name = "Non-Color"
hdr_image.pixels.foreach_set(patch.ravel())
hdr_image.update()
hdr_image.file_format = "HDR"
hdr_image.filepath_raw = str(args.out / "linear-018-noncolor.hdr")
hdr_image.save()
retained = bpy.data.images.load(hdr_image.filepath_raw, check_existing=False)
retained.colorspace_settings.name = "Non-Color"
hdr_pixels = np.asarray(retained.pixels[:], dtype=np.float32).reshape(32, 32, 4)[:, :, :3]
hdr_mean = float(hdr_pixels.mean())
assert abs(hdr_mean - .18) < .002, f"Retained HDR changed radiance: {hdr_mean}"
report = {"engine": bpy.app.version_string, "device": device, "worldRadiance": 1, "surfaceAlbedo": .5,
          "bakeColourPass": False, "measuredBakeMean": mean,
          "expectedHemisphereIrradiance": float(np.pi),
          "conversionToThreeLightMap": float(np.pi),
          "retainedHdr018Mean": hdr_mean,
          "explanation": "Cycles lighting-only diffuse bake is unit-albedo outgoing radiance. Three.js lightMap enters Lambert irradiance, so multiply the decoded map by pi.",
          "passed": True}
(args.out / "cycles-diffuse-calibration.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report), flush=True)
