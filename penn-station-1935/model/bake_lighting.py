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
import bpy
import numpy as np

parser = argparse.ArgumentParser()
parser.add_argument("input", type=Path)
parser.add_argument("--out", type=Path, required=True)
parser.add_argument("--zone", required=True)
parser.add_argument("--resolution", type=int, default=2048)
parser.add_argument("--samples", type=int, default=32)
parser.add_argument("--threads", type=int, default=4)
parser.add_argument("--ao-only", action="store_true")
parser.add_argument("--materials", type=Path, help="Optional local CC0 material library; see material-provenance.json")
args = parser.parse_args()
args.out.mkdir(parents=True, exist_ok=True)
started = time.monotonic()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(args.input.resolve()))
scene = bpy.context.scene
for material in bpy.data.materials:
    if material.use_nodes and material.name.startswith("PaintedStructuralIron"):
        pbr = next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)
        if pbr:
            pbr.inputs["Metallic"].default_value = 0
if args.materials:
    for material in bpy.data.materials:
        if not material.use_nodes:
            continue
        identity = "Granite005A" if material.name.startswith(("MilfordGranite", "InteriorGranite")) else "Travertine009" if material.name.startswith("Travertine") else None
        if not identity:
            continue
        nodes, links = material.node_tree.nodes, material.node_tree.links
        pbr = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
        if not pbr:
            continue
        for suffix, slot in [("Color", "Base Color"), ("Roughness", "Roughness"), ("NormalGL", "Normal")]:
            filename = args.materials / identity / f"{identity}_2K-JPG_{suffix}.jpg"
            image = bpy.data.images.load(str(filename), check_existing=True)
            image.colorspace_settings.name = "sRGB" if suffix == "Color" else "Non-Color"
            texture = nodes.new("ShaderNodeTexImage")
            texture.image = image
            texture.label = f"ambientCG {identity} CC0 {suffix}"
            if suffix == "NormalGL":
                normal = nodes.new("ShaderNodeNormalMap")
                normal.inputs["Strength"].default_value = .25
                links.new(texture.outputs["Color"], normal.inputs["Color"])
                links.new(normal.outputs["Normal"], pbr.inputs["Normal"])
            else:
                links.new(texture.outputs["Color"], pbr.inputs[slot])
        material["surface_reference"] = f"ambientCG {identity}, CC0; modern material interpretation, not a sample of Penn Station"
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = args.samples
scene.cycles.max_bounces = 8
scene.cycles.diffuse_bounces = 6
scene.cycles.glossy_bounces = 4
scene.cycles.transparent_max_bounces = 8
scene.render.threads_mode = "FIXED"
scene.render.threads = max(1, args.threads)
scene.render.bake.margin = 8
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

all_meshes = [obj for obj in scene.objects if obj.type == "MESH"]
glazing = []
solids = []
temporary_links = []
for obj in all_meshes:
    names = [material.name.lower() for material in obj.data.materials if material]
    if names and all("glass" in name or "glazing" in name or "window" in name for name in names):
        glazing.append(obj)
        # A clear sky opening in the diffuse bake. The exported glass keeps its
        # authored PBR shader; no black/opaque placeholder shadows are baked.
        for material in obj.data.materials:
            if not material or not material.use_nodes:
                continue
            nodes, links = material.node_tree.nodes, material.node_tree.links
            output = next(node for node in nodes if node.type == "OUTPUT_MATERIAL")
            previous = [link.from_socket for link in output.inputs["Surface"].links]
            transparent = nodes.new("ShaderNodeBsdfTransparent")
            links.new(transparent.outputs["BSDF"], output.inputs["Surface"])
            temporary_links.append((material, output, previous, transparent))
    else:
        solids.append(obj)

if not solids:
    raise RuntimeError("No opaque architecture to bake")
bpy.ops.object.select_all(action="DESELECT")
for obj in solids:
    obj.select_set(True)
bpy.context.view_layer.objects.active = solids[0]
bpy.ops.object.join()
architecture = bpy.context.object
architecture.name = f"{args.zone} baked static architecture"
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
mesh = architecture.data
if not mesh.uv_layers:
    raise RuntimeError("Architecture must have its original material UVs")
original_uv = mesh.uv_layers[0].name
light_uv_name = "BakedLightingUV"
mesh.uv_layers.new(name=light_uv_name)
mesh.uv_layers.active_index = len(mesh.uv_layers) - 1
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=.00001)
bpy.ops.uv.smart_project(angle_limit=math.radians(75), island_margin=.0001, area_weight=.5, correct_aspect=True, scale_to_bounds=True)
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
    image = bpy.data.images.new(f"{args.zone}-{label}", width=args.resolution, height=args.resolution, alpha=True, float_buffer=float_buffer)
    image.colorspace_settings.name = "Non-Color"
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
bpy.ops.object.bake(type="EMIT", uv_layer=light_uv_name, use_clear=True, margin=8)
for material, output, sockets, occlusion, emission in ao_outputs:
    for socket in sockets:
        material.node_tree.links.new(socket, output.inputs["Surface"])
    material.node_tree.nodes.remove(emission)
    material.node_tree.nodes.remove(occlusion)
ao.file_format = "PNG"
ao.filepath_raw = str(args.out / f"lighting-{args.zone}-ao.png")
ao.save()
print("AO bake saved", flush=True)

illumination = None
if not args.ao_only:
    illumination = bake_image("sky", float_buffer=True)
    scene.render.bake.use_pass_direct = True
    scene.render.bake.use_pass_indirect = True
    scene.render.bake.use_pass_color = False
    bpy.ops.object.bake(type="DIFFUSE", uv_layer=light_uv_name, use_clear=True, margin=8)
    illumination.file_format = "HDR"
    illumination.filepath_raw = str(args.out / f"lighting-{args.zone}-sky.hdr")
    illumination.save()
    # The neutral diffuse dome is bounded below 1.0 (no sun is baked).
    # Encode it as sRGB PNG for transport; the browser linearises it for lightMap.
    # Preserve the linear HDR authoring output separately for future refinement.
    if max(illumination.pixels[:]) > 1.001:
        raise RuntimeError("Sky bake exceeds the bounded PNG range; use a float runtime encoding")
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.image_settings.color_depth = "8"
    scene.render.image_settings.compression = 80
    illumination.save_render(str(args.out / f"lighting-{args.zone}-sky.png"), scene=scene)
    mobile_illumination = illumination.copy()
    mobile_illumination.scale(512, 512)
    mobile_illumination.file_format = "HDR"
    mobile_illumination.filepath_raw = str(args.out / f"lighting-{args.zone}-sky-low.hdr")
    mobile_illumination.save()
    mobile_illumination.save_render(str(args.out / f"lighting-{args.zone}-sky-low.png"), scene=scene)
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
        material["sky_illumination"] = f"lighting-{args.zone}-sky.png"

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
for obj in glazing:
    obj.select_set(True)
target = args.out / f"model-{args.zone}.glb"
bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLB", use_selection=True, export_yup=True, export_texcoords=True, export_normals=True, export_materials="EXPORT", export_extras=True)

def image_stats(image):
    pixels = np.asarray(image.pixels[:], dtype=np.float32).reshape(-1, 4)
    filled = pixels[pixels[:, 3] > .1, :3]
    return {"minimum": float(filled.min()), "maximum": float(filled.max()), "mean": float(filled.mean()), "coveredPixels": len(filled)} if len(filled) else {}

report = {"zone": args.zone, "source": args.input.name, "resolution": args.resolution, "samples": args.samples, "engine": bpy.app.version_string + " Cycles CPU", "atlasSurfaceArea": atlas_area, "sky": "Neutral diffuse dome; direct sky visibility and six-bounce diffuse transport; no directional sun baked; adjacent city occluders not included", "ambientOcclusion": image_stats(ao), "illumination": image_stats(illumination) if illumination else None, "elapsedSeconds": time.monotonic() - started, "architectureUv": original_uv, "bakedUv": light_uv_name, "artifact": target.name}
(args.out / f"lighting-{args.zone}.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report), flush=True)
