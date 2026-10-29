"""Capture room-specific HDR reflections from the authored complete station.

These are static architectural probes, not historical environment photographs
or position-correct ray tracing. All input chunks use their documented frames.
"""
from pathlib import Path
import argparse
import gzip
import hashlib
import json
import math
import time
import bpy
import numpy as np
from mathutils import Vector
from material_library import apply_materials, prepare_surface_uvs

parser = argparse.ArgumentParser()
for zone in ("exterior", "waiting", "concourse", "platform", "context", "trains"):
    parser.add_argument(f"--{zone}", type=Path, required=zone in ("exterior", "waiting", "concourse"))
parser.add_argument("--materials", type=Path, required=True)
parser.add_argument("--out", type=Path, required=True)
parser.add_argument("--width", type=int, default=1024)
parser.add_argument("--samples", type=int, default=64)
parser.add_argument("--threads", type=int, default=4)
parser.add_argument("--only", choices=("waiting-room", "concourse", "platform", "exterior"))
parser.add_argument("--platform-probe", default="-65,-10.1,-0.341442588", help="World X,Y-up,Z-south")
parser.add_argument("--exterior-probe", default="142,12,0", help="Representative elevated Seventh Avenue position; world X,Y-up,Z-south. Captured only with --only exterior.")
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
started = time.monotonic()
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
frames = {"exterior": 0, "context": 0, "waiting": -4.2672, "concourse": -4.2672,
          "platform": -4.2672, "trains": -13.154025}
inputs = []
for zone, height in frames.items():
    filename = getattr(args, zone)
    if not filename:
        continue
    previous = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(filename.resolve()))
    imported = set(scene.objects) - previous
    for obj in imported:
        if obj.parent not in imported:
            obj.location.z += height
            if zone == "trains":
                obj.location.y -= 8.690045261
    inputs.append({"zone": zone, "file": filename.name,
                   "sha256": hashlib.sha256(filename.read_bytes()).hexdigest(), "objects": len(imported)})
prepare_surface_uvs(list(scene.objects))
surface_report = apply_materials(bpy.data.materials, args.materials)
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = args.samples
scene.cycles.diffuse_bounces = 6
scene.cycles.glossy_bounces = 4
scene.cycles.transmission_bounces = 8
scene.cycles.transparent_max_bounces = 12
scene.cycles.use_denoising = True
scene.render.threads_mode = "FIXED"
scene.render.threads = args.threads
world = bpy.data.worlds.new("Neutral room-probe daylight")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (.58, .66, .76, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1
scene.world = world
sun_data = bpy.data.lights.new("Afternoon reference sun", "SUN")
sun_data.energy = 3.8
sun_data.angle = math.radians(.53)
sun_data.color = (1, .956, .875)
sun = bpy.data.objects.new("Afternoon reference sun", sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler = (-Vector((95, 65, 125))).to_track_quat("-Z", "Y").to_euler()
camera_data = bpy.data.cameras.new("Architectural reflection capture")
camera_data.type = "PANO"
camera_data.panorama_type = "EQUIRECTANGULAR"
camera = bpy.data.objects.new("Architectural reflection capture", camera_data)
scene.collection.objects.link(camera)
# Equirectangular centre faces east: matches Three's atan(z,x) UV convention.
camera.rotation_euler = (math.pi / 2, 0, -math.pi / 2)
scene.camera = camera
scene.render.resolution_x = args.width
scene.render.resolution_y = args.width // 2
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "HDR"
scene.render.image_settings.color_mode = "RGB"
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1
probes = {"waiting-room": [0, -1.7672, 0], "concourse": [-70, -2.2672, 4.5],
          "platform": [float(value) for value in args.platform_probe.split(",")]}
# Preserve the default three-room output/report contract. Exterior capture is
# explicit and normally runs in its own scratch directory.
if args.only == "exterior":
    probes = {"exterior": [float(value) for value in args.exterior_probe.split(",")]}
outputs = []
for name, position in probes.items():
    if args.only and args.only != name:
        continue
    camera.location = (position[0], -position[2], position[1])
    filename = args.out / f"reflection-{name}.hdr"
    scene.render.filepath = str(filename)
    bpy.ops.render.render(write_still=True)
    data = filename.read_bytes()
    packed = gzip.compress(data, compresslevel=9, mtime=0)
    (args.out / (filename.name + ".gz")).write_bytes(packed)
    mobile = bpy.data.images.load(str(filename), check_existing=False)
    mobile.scale(512, 256)
    mobile.file_format = "HDR"
    mobile.filepath_raw = str(args.out / f"reflection-{name}-low.hdr")
    mobile.save()
    mobile_bytes = Path(mobile.filepath_raw).read_bytes()
    mobile_packed = gzip.compress(mobile_bytes, compresslevel=9, mtime=0)
    Path(mobile.filepath_raw + ".gz").write_bytes(mobile_packed)
    values = np.empty(len(mobile.pixels), dtype=np.float32)
    mobile.pixels.foreach_get(values)
    assert np.isfinite(values).all(), "Non-finite captured radiance"
    outputs.append({"zone": name, "worldPosition": position, "fullFile": filename.name + ".gz",
                    "fullBytes": len(packed), "decodedSha256": hashlib.sha256(data).hexdigest(),
                    "lowFile": Path(mobile.filepath_raw).name + ".gz", "lowBytes": len(mobile_packed),
                    "maximumRadiance": float(values.reshape(-1, 4)[:, :3].max())})
report = {"engine": bpy.app.version_string + " Cycles", "createdInputs": inputs,
          "width": args.width, "samples": args.samples, "surfaces": surface_report,
          "probeOrientation": "Centre east(+X); increasing U turns toward south(+Z in Three)",
          "lighting": "Neutral dome and fixed afternoon reference sun; interpretation, not a dated historic exposure",
          "limitation": "Static room-centre approximation; no parallax correction, moving-passenger capture or time-specific indirect relighting",
          "probes": outputs, "elapsedSeconds": time.monotonic() - started}
report_name = "reflection-probes.json"
if args.only == "exterior":
    report_name = "reflection-exterior-probe.json"
    report["limitation"] = "Static elevated Seventh Avenue approximation from the authored station and limited contextual buildings. Not a historical panorama, complete1935 streetscape, parallax-correct local reflection or time-varying indirect lighting. Sky is the neutral interpreted dome; no modern field/forest photograph is used."
(args.out / report_name).write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report), flush=True)
