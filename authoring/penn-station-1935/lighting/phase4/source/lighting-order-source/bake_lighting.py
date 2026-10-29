"""Bake static sky illumination and AO in Cycles; preserve architectural UVs.

The sky is a neutral diffuse dome, with no directional sun baked into the maps.
Browser sunlight remains dynamic. This is lighting authoring, not historic colour
or weather calibration. Run via uv with the official Blender bpy module.
"""
from pathlib import Path
import argparse
import json
import math
import time
import hashlib
import bpy
import numpy as np
from material_library import apply_materials, prepare_surface_uvs
from render_device import configure_device

parser = argparse.ArgumentParser()
parser.add_argument("input", type=Path)
parser.add_argument("--out", type=Path, required=True)
parser.add_argument("--zone", required=True)
parser.add_argument("--resolution", type=int, default=2048)
parser.add_argument("--samples", type=int, default=32)
parser.add_argument("--threads", type=int, default=4)
parser.add_argument("--device", choices=("AUTO", "CPU", "METAL"), default="AUTO")
parser.add_argument("--ao-only", action="store_true")
parser.add_argument("--surface-group", choices=("all", "vault", "masonry", "order"), default="all")
parser.add_argument("--uv-margin-pixels", type=float, default=4)
parser.add_argument("--materials", type=Path, help="Optional local CC0 material library; see material-provenance.json")
parser.add_argument("--occluder", action="append", default=[], metavar="ZONE=GLB", help="Registered neighbouring chunk to include in light transport, without exporting it")
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
if args.surface_group != "all" and args.zone != "waiting-room":
    raise ValueError("Split surface groups currently apply only to the waiting room")
if not 0 < args.uv_margin_pixels < args.resolution / 16:
    raise ValueError("UV margin must be a small positive texel count")
artifact_zone = args.zone if args.surface_group == "all" else args.zone + "-" + args.surface_group
started = time.monotonic()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(args.input.resolve()))
scene = bpy.context.scene
primary_objects = list(scene.objects)
order_objects, order_audit = [], None
if args.zone == "waiting-room" and args.surface_group != "all":
    from order_lighting_uv import split_waiting_order_objects
    order_objects, _, order_audit = split_waiting_order_objects(primary_objects)
    primary_objects = list(scene.objects)
order_set = set(order_objects)
primary_set = set(primary_objects)
frames = {"exterior": 0, "context": 0, "waiting": -4.2672, "waiting-room": -4.2672,
          "concourse": -4.2672, "platform": -4.2672, "trains": -13.154025}
if args.zone not in frames:
    raise ValueError("Unknown architectural frame")
occluders = []
for specification in args.occluder:
    zone, filename = specification.split("=", 1)
    if zone not in frames:
        raise ValueError(f"Unknown occluder frame: {zone}")
    previous = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(Path(filename).resolve()))
    imported = set(scene.objects) - previous
    offset = frames[zone] - frames[args.zone]
    for obj in imported:
        if obj.parent not in imported:
            obj.location.z += offset
        if zone == "trains" and obj.parent not in imported:
            obj.location.y -= 8.690045261
    occluders.append({"zone": zone, "source": Path(filename).name, "sha256":hashlib.sha256(Path(filename).read_bytes()).hexdigest(), "heightOffset": offset, "objects": len(imported)})
surface_report = []
if args.materials:
    prepare_surface_uvs(list(scene.objects))
    surface_report = apply_materials(bpy.data.materials, args.materials)
scene.render.engine = "CYCLES"
device = configure_device(scene, args.device)
print("Cycles device: " + json.dumps(device), flush=True)
scene.cycles.samples = args.samples
scene.cycles.max_bounces = 8
scene.cycles.diffuse_bounces = 6
scene.cycles.glossy_bounces = 4
scene.cycles.transparent_max_bounces = 8
scene.render.threads_mode = "FIXED"
scene.render.threads = max(1, args.threads)
scene.render.bake.margin = max(1, round(args.uv_margin_pixels))
scene.render.bake.use_clear = True

world = bpy.data.worlds.new("Diffuse sky bake reference")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (.58, .66, .76, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
scene.world = world
scene.view_settings.view_transform = "Standard"
scene.view_settings.look = "None"
scene.view_settings.exposure = 0
scene.view_settings.gamma = 1

all_meshes = [obj for obj in primary_objects if obj.type == "MESH"]
glazing = []
solids = []
unbaked = []
temporary_links = []
transparent_done = set()
for obj in [obj for obj in scene.objects if obj.type == "MESH"]:
    names = [material.name.lower() for material in obj.data.materials if material]
    if names and all(("glass" in name or "glazing" in name or "window" in name) and not name.startswith("opalcandelabra") for name in names):
        if obj in primary_set:
            glazing.append(obj)
        # A clear sky opening in the diffuse bake. The exported glass keeps its
        # authored PBR shader; no black/opaque placeholder shadows are baked.
        for material in obj.data.materials:
            if not material or not material.use_nodes or material in transparent_done:
                continue
            transparent_done.add(material)
            nodes, links = material.node_tree.nodes, material.node_tree.links
            output = next(node for node in nodes if node.type == "OUTPUT_MATERIAL")
            previous = [link.from_socket for link in output.inputs["Surface"].links]
            transparent = nodes.new("ShaderNodeBsdfTransparent")
            links.new(transparent.outputs["BSDF"], output.inputs["Surface"])
            temporary_links.append((material, output, previous, transparent))
    elif obj in primary_set:
        # Give the masonry/floors a useful atlas. Tiny iron lattice faces and
        # props retain their surface UVs and use room reflection/IBL probes;
        # they still occlude and reflect light during the Cycles bake.
        fine = ("PaintedStructuralIron", "AgedBronze", "WalnutBench", "ClockFace", "Lettering", "MonelRoof")
        if obj.data.materials and all(material and (material.name.startswith(fine) or material.get("skip_lighting_atlas")) for material in obj.data.materials):
            unbaked.append(obj)
        else:
            vault_materials = ("PaleVaultPlaster",)
            is_vault = bool(obj.data.materials) and all(material and material.name.startswith(vault_materials) for material in obj.data.materials)
            is_order = obj in order_set
            selected = (args.surface_group == "all"
                        or (args.surface_group == "vault" and is_vault)
                        or (args.surface_group == "order" and is_order)
                        or (args.surface_group == "masonry" and not is_vault and not is_order))
            if selected:
                solids.append(obj)
            # The other partition remains in the scene and participates in
            # transport; only selected opaque geometry is baked/exported.

if not solids:
    raise RuntimeError("No opaque architecture to bake")
bpy.ops.object.select_all(action="DESELECT")
for obj in solids:
    obj.select_set(True)
bpy.context.view_layer.objects.active = solids[0]
bpy.ops.object.join()
architecture = bpy.context.object
architecture.name = f"{artifact_zone} baked static architecture"
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
mesh = architecture.data
if not mesh.uv_layers:
    raise RuntimeError("Architecture must have its original material UVs")
original_uv = mesh.uv_layers[0].name
light_uv_name = "BakedLightingUV"
order_uv_audit = None
if args.surface_group == "order":
    from order_lighting_uv import prepare_order_uv
    order_uv_audit = prepare_order_uv(architecture, args.resolution, args.uv_margin_pixels)
else:
    mesh.uv_layers.new(name=light_uv_name)
    mesh.uv_layers.active_index = len(mesh.uv_layers) - 1
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.remove_doubles(threshold=.00001)
    bpy.ops.uv.smart_project(angle_limit=math.radians(75), island_margin=args.uv_margin_pixels / args.resolution, margin_method="FRACTION", area_weight=.5, correct_aspect=True, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode="OBJECT")
mesh.calc_loop_triangles()
uv_values = np.empty(len(mesh.loops) * 2, dtype=np.float32)
mesh.uv_layers[light_uv_name].data.foreach_get("uv", uv_values)
triangle_loops = np.empty(len(mesh.loop_triangles) * 3, dtype=np.int32)
mesh.loop_triangles.foreach_get("loops", triangle_loops)
triangle_uv = uv_values.reshape(-1, 2)[triangle_loops.reshape(-1, 3)]
uv_edge_a = triangle_uv[:, 1] - triangle_uv[:, 0]
uv_edge_b = triangle_uv[:, 2] - triangle_uv[:, 0]
atlas_area = float(np.abs(uv_edge_a[:, 0] * uv_edge_b[:, 1] - uv_edge_a[:, 1] * uv_edge_b[:, 0]).sum() * .5)
if not .01 <= atlas_area <= 1.001:
    raise RuntimeError(f"Unusable lighting atlas coverage {atlas_area}; inspect repeated microgeometry and packing before baking")
print(f"Atlas surface coverage: {atlas_area:.3f}", flush=True)
print(f"UV atlas ready: {len(mesh.polygons)} polygons at {args.resolution}px", flush=True)

materials = [material for material in mesh.materials if material and material.use_nodes]
for material in materials:
    nodes, links = material.node_tree.nodes, material.node_tree.links
    original = nodes.new("ShaderNodeUVMap")
    original.uv_map = original_uv
    for node in list(nodes):
        if node.type == "TEX_IMAGE" and not node.inputs["Vector"].is_linked:
            links.new(original.outputs["UV"], node.inputs["Vector"])

def bake_image(label, *, float_buffer):
    image = bpy.data.images.new(f"{artifact_zone}-{label}", width=args.resolution, height=args.resolution, alpha=True, float_buffer=float_buffer)
    image.colorspace_settings.name = "Linear Rec.709" if float_buffer else "Non-Color"
    for material in materials:
        nodes = material.node_tree.nodes
        for node in nodes:
            node.select = False
        target = nodes.new("ShaderNodeTexImage")
        target.name = f"Bake target {label}"
        target.image = image
        target.select = True
        nodes.active = target
    return image

ao = bake_image("ao", float_buffer=False)
ao_outputs = []
for material in materials:
    nodes, links = material.node_tree.nodes, material.node_tree.links
    output = next(node for node in nodes if node.type == "OUTPUT_MATERIAL")
    sockets = [link.from_socket for link in output.inputs["Surface"].links]
    occlusion = nodes.new("ShaderNodeAmbientOcclusion")
    occlusion.inputs["Distance"].default_value = 2.0
    occlusion.samples = 24
    emission = nodes.new("ShaderNodeEmission")
    links.new(occlusion.outputs["AO"], emission.inputs["Color"])
    links.new(emission.outputs["Emission"], output.inputs["Surface"])
    ao_outputs.append((material, output, sockets, occlusion, emission))
# The AO node already traces 24 rays per shader evaluation. Four outer samples
# provide 96 rays per texel. Keep this low-strength contact pass independent
# from the diffuse bake's 64-sample setting (which would trace 1,536 AO rays).
ao_path_samples = min(4, args.samples)
scene.cycles.samples = ao_path_samples
bpy.ops.object.bake(type="EMIT", uv_layer=light_uv_name, use_clear=True, margin=max(1, round(args.uv_margin_pixels)))
scene.cycles.samples = args.samples
for material, output, sockets, occlusion, emission in ao_outputs:
    for socket in sockets:
        material.node_tree.links.new(socket, output.inputs["Surface"])
    material.node_tree.nodes.remove(emission)
    material.node_tree.nodes.remove(occlusion)
ao.file_format = "PNG"
ao.filepath_raw = str(args.out / f"lighting-{artifact_zone}-ao.png")
ao.save()
print("AO bake saved", flush=True)

illumination = None
radiance_scale = 1.0
if not args.ao_only:
    illumination = bake_image("sky", float_buffer=True)
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    bpy.ops.object.bake(type="DIFFUSE", uv_layer=light_uv_name, use_clear=True, margin=max(1, round(args.uv_margin_pixels)))
    radiance = np.empty(len(illumination.pixels), dtype=np.float32)
    illumination.pixels.foreach_get(radiance)
    # Image.save() applies a display transfer to a generated Linear Rec.709
    # image even for HDR. A separate Non-Color buffer preserves actual radiance.
    retained_hdr = bpy.data.images.new(f"{artifact_zone}-linear-HDR", width=args.resolution, height=args.resolution, alpha=True, float_buffer=True)
    retained_hdr.colorspace_settings.name = "Non-Color"
    retained_hdr.pixels.foreach_set(radiance)
    retained_hdr.update()
    retained_hdr.file_format = "HDR"
    retained_hdr.filepath_raw = str(args.out / f"lighting-{artifact_zone}-sky.hdr")
    retained_hdr.save()
    bpy.data.images.remove(retained_hdr)
    # Save a normalized linear-radiance image through Standard/sRGB. Non-Color
    # bypasses that transfer and was the source of the previous double-darkening.
    # A per-atlas scale preserves values above1 without clipping practical light.
    peak = float(radiance.reshape(-1, 4)[:, :3].max())
    radiance_scale = float(2 ** max(0, math.ceil(math.log2(max(peak, 1e-6)))))
    encoded = illumination.copy()
    encoded.colorspace_settings.name = "Linear Rec.709"
    radiance.reshape(-1, 4)[:, :3] /= radiance_scale
    encoded.pixels.foreach_set(radiance)
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 80
    encoded.save_render(str(args.out / f"lighting-{artifact_zone}-sky.png"), scene=scene)
    mobile_illumination = encoded.copy()
    mobile_illumination.pixels.foreach_set(radiance)
    mobile_illumination.scale(512, 512)
    mobile_illumination.save_render(str(args.out / f"lighting-{artifact_zone}-sky-low.png"), scene=scene)
    print("Diffuse sky + bounce bake saved", flush=True)

# Standard glTF occlusion texture, explicitly sampled using the atlas UV set.
group = bpy.data.node_groups.new("glTF Material Output", "ShaderNodeTree")
group.interface.new_socket(name="Occlusion", in_out="INPUT", socket_type="NodeSocketFloat")
for material in materials:
    nodes, links = material.node_tree.nodes, material.node_tree.links
    uv = nodes.new("ShaderNodeUVMap")
    uv.uv_map = light_uv_name
    texture = nodes.new("ShaderNodeTexImage")
    texture.image = ao
    links.new(uv.outputs["UV"], texture.inputs["Vector"])
    settings = nodes.new("ShaderNodeGroup")
    settings.node_tree = group
    links.new(texture.outputs["Color"], settings.inputs["Occlusion"])
    material["lighting_atlas_uv"] = 1
    if illumination:
        material["sky_illumination"] = f"lighting-{artifact_zone}-sky.png"
        material["sky_illumination_scale"] = radiance_scale
        material["lightmap_encoding"] = "srgb-linear-radiance-v3"

for material, output, previous, transparent in temporary_links:
    links = material.node_tree.links
    for socket in previous:
        links.new(socket, output.inputs["Surface"])
    material.node_tree.nodes.remove(transparent)

# Keep ordinary material coordinates as the default. Atlas coordinates are used
# only by the glTF occlusion slot and the browser's decoded linear light map.
mesh.uv_layers.active_index = 0
mesh.uv_layers[0].active_render = True
bpy.ops.object.select_all(action="DESELECT")
architecture.select_set(True)
if args.surface_group in ("all", "masonry"):
    for obj in glazing + unbaked:
        obj.select_set(True)
target = args.out / f"model-{artifact_zone}.glb"
bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLB", use_selection=True, export_yup=True, export_texcoords=True, export_normals=True, export_materials="EXPORT", export_extras=True)

def image_stats(image):
    pixels = np.empty(len(image.pixels), dtype=np.float32)
    image.pixels.foreach_get(pixels)
    pixels = pixels.reshape(-1, 4)
    filled = pixels[pixels[:, 3] > .1, :3]
    return {"minimum": float(filled.min()), "maximum": float(filled.max()), "mean": float(filled.mean()), "coveredPixels": len(filled)} if len(filled) else {}

report = {
    "zone": artifact_zone,
    "frameZone": args.zone,
    "surfaceGroup": args.surface_group,
    "uvMarginPixels": args.uv_margin_pixels,
    "uvMarginMethod": "FRACTION",
    "source": args.input.name,
    "sourceSha256": hashlib.sha256(args.input.read_bytes()).hexdigest(),
    "resolution": args.resolution,
    "samples": args.samples,
    "aoPathSamples": ao_path_samples,
    "aoNodeSamples": 24,
    "engine": bpy.app.version_string + " Cycles " + device["backend"],
    "device": device,
    "atlasSurfaceArea": atlas_area,
    "sky": "Neutral diffuse dome; direct sky visibility and six-bounce diffuse transport; no directional sun baked",
    "registeredOccluders": occluders,
    "unbakedPrimaryMeshes": len(unbaked),
    "surfaceProfiles": surface_report,
    "diffuseEncoding": "Cycles outgoing unit-albedo radiance; Linear Rec.709 source → Standard/sRGB PNG → lossless WebP. Decode sRGB and multiply by pi times radianceScale for Three.js Lambert irradiance.",
    "radianceScale": radiance_scale,
    "retainedHdrTransfer": "linear; separate Non-Color float buffer set before pixel assignment",
    "ambientOcclusion": image_stats(ao),
    "illumination": image_stats(illumination) if illumination else None,
    "elapsedSeconds": time.monotonic() - started,
    "architectureUv": original_uv,
    "bakedUv": light_uv_name,
    "artifact": target.name,
    "orderSeparation": order_audit,
    "orderUv": order_uv_audit,
}
if not args.ao_only and not (report["illumination"] and report["illumination"]["maximum"] > 0 and report["illumination"]["mean"] > 0):
    raise RuntimeError("The complete daylight atlas contains no positive radiance; do not promote this bake")
(args.out / f"lighting-{artifact_zone}.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report), flush=True)
