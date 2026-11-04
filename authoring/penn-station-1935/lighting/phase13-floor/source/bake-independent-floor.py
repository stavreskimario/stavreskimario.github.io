from pathlib import Path
import argparse,json,hashlib,time,math,sys
import bpy,numpy as np
sys.path.insert(0,str(Path(__file__).parent/'source-v2'))
from render_device import configure_device
p=argparse.ArgumentParser();p.add_argument('--packet',type=Path,required=True);a=p.parse_args();d=json.loads(a.packet.read_text());H=lambda b:hashlib.sha256(b).hexdigest();assert H(Path(d['scene']).read_bytes())==d['sceneSha256'];assert H(Path(d['input']).read_bytes())==d['sourceSha256'];uvproof=json.loads(Path(d['uvPreflight']).read_text());assert uvproof['status'].startswith('PASS')and uvproof['minimumVisibleTopDensity']>=60;assert uvproof['selectedTrial']['physicalPositionNormalUV0Exact']and uvproof['selectedTrial']['structureLightUVExact'];started=time.monotonic();bpy.ops.wm.open_mainfile(filepath=d['scene']);scene=bpy.context.scene;control=json.loads(Path(d['baseControl']).read_text());architecture=bpy.data.objects[uvproof['architecture']];mesh=architecture.data;assert len(mesh.polygons)==402 and len(mesh.materials)==3;assert [u.name for u in mesh.uv_layers]==['UVMap','BakedLightingUV'];original_uv='UVMap';light_uv_name='BakedLightingUV';artifact_zone='platform-enclosure-floor';args=argparse.Namespace(input=Path(d['input']),out=Path(d['out']),zone='platform',surface_group='all',uv_margin_pixels=4,resolution=4096,samples=128,ao_only=False,source_visibility_proof=Path(control['arguments']['source_visibility_proof']));assert not args.out.exists();args.out.mkdir();scene.render.engine='CYCLES';device=configure_device(scene,'METAL');scene.cycles.samples=128;scene.cycles.max_bounces=8;scene.cycles.diffuse_bounces=6;scene.cycles.glossy_bounces=4;scene.cycles.transparent_max_bounces=8;scene.render.threads_mode='FIXED';scene.render.threads=4;scene.render.bake.margin=4;scene.render.bake.use_clear=True;bpy.ops.object.select_all(action='DESELECT');architecture.select_set(True);bpy.context.view_layer.objects.active=architecture;mesh.uv_layers.active_index=1;normals=np.empty(len(mesh.loops)*3,np.float32);mesh.corner_normals.foreach_get('vector',normals);assert np.isfinite(normals).all()and np.all(np.abs(np.linalg.norm(normals.reshape(-1,3),axis=1)-1)<.001);arcade_normal_integrity=dict(control['authoredNormalIntegrity']);arcade_normal_integrity.update(scope='Three original receiver owners; authored source normals transferred byte-exact through UV-only separation/repacking',sourceObjects=3,sourceCorners=len(mesh.loops),restoredCorners=len(mesh.loops),additionalRepackNormalDrift=0,temporaryAttributeRemoved=True,finiteUnitNormals=True,physicalCornerDigest=uvproof['physicalDigest'],uvPreflightSha256=H(Path(d['uvPreflight']).read_bytes()));assert arcade_normal_integrity['status']=='PASS';context_membership=control['contextMembership'];primary_static_lights=[];registered_static_lights=control['registeredStaticLights'];assert len(registered_static_lights)==10;source_visibility=control['sourceVisibility'];surface_report=control['surfaceProfiles'];occluder_material_integrity=control['occluderMaterialIntegrity'];occluders=list(control['occluders'])+[{'zone':'platform','source':Path(d['input']).name,'sha256':d['sourceSha256'],'objects':24,'role':'The unchanged remaining source structural owners retained as physical context'}];gallery_atlas_scope={'sourceMeshes':3,'sourceFileMeshOwners':27,'opaquePrimaryMeshesBeforeJoin':3,'unbakedLetteringMeshes':0,'primaryAtlasSourceNames':uvproof['sourceFloorOwnerNames'],'retainedSourceStructuralOwners':24,'selectedTriangles':402,'currentBlenderObjects':1,'classification':'Exactly the three original floor receiver owners; new lightUV only. All physical structure/context retained.'};authored_uv_integrity=None;order_audit=None;order_uv_audit=None;vault_normal_integrity=None;temporary_links=[];unbaked=[];glazing=[];pre={'status':'PASS exact independent floor UV/normal/selection/context preflight before GPU','primaryAtlasScope':gallery_atlas_scope,'authoredNormalIntegrity':arcade_normal_integrity,'floorUvDensity':uvproof['selectedTrial'],'contextMembership':context_membership};(args.out/'actual-prebake-acceptance.json').write_text(json.dumps(pre,indent=2)+'\n');print('FLOOR PREBAKE PASS:402 exact faces,3 source owners, density '+str(uvproof['minimumVisibleTopDensity']),flush=True)

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

# Reuse imported settings; no stale previous AO group may win export.
from baked_occlusion_binding import bind_fresh_baked_occlusion
occlusion_binding_integrity = bind_fresh_baked_occlusion(materials, ao, light_uv_name)
for material in materials:
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
bpy.ops.export_scene.gltf(filepath=str(target), export_format="GLB", use_selection=True, export_yup=True, export_texcoords=True, export_normals=True, export_materials="EXPORT", export_extras=True, export_lights=False)

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
    "floorUvDensity":uvproof["selectedTrial"],
    "floorUvPreflightSha256":H(Path(d["uvPreflight"]).read_bytes()),
    "structureLightUvTransferredExact":True,
    "contextMembership":context_membership,
    "resolution": args.resolution,
    "samples": args.samples,
    "aoPathSamples": ao_path_samples,
    "aoNodeSamples": 24,
    "engine": bpy.app.version_string + " Cycles " + device["backend"],
    "device": device,
    "atlasSurfaceArea": atlas_area,
    "sky": ("Neutral diffuse dome plus explicitly interpreted static electric lamps; six-bounce diffuse transport; no directional sun baked" if artifact_zone in {"concourse-exits", "platform-enclosure", "platform-enclosure-floor"} else "Neutral diffuse dome; direct sky visibility and six-bounce diffuse transport; no directional sun baked"),
    "staticPracticalLights": primary_static_lights,
    "primaryAtlasScope": gallery_atlas_scope,
    "registeredStaticPracticalLights": registered_static_lights,
    "electricLightingQualification": "Positions, energy and warm color are interpreted appearance controls for documented electric-lit public accommodation; not measured historic photometry." if artifact_zone in {"concourse-exits", "platform-enclosure", "platform-enclosure-floor"} else None,
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
    "vaultNormalIntegrity": vault_normal_integrity,
}
if arcade_normal_integrity is not None:
    report["arcadeNormalIntegrity" if artifact_zone == "arcade-enclosure" else "authoredNormalIntegrity"] = arcade_normal_integrity
if artifact_zone in {"arcade-enclosure", "concourse-arrivals", "concourse-exits", "platform-enclosure", "platform-enclosure-floor"}:
    report["sourceRenderVisibility"] = {"proofSha256": hashlib.sha256(args.source_visibility_proof.read_bytes()).hexdigest(), "contexts": source_visibility}
if authored_uv_integrity is not None:
    report["authoredUvIntegrity"] = authored_uv_integrity
report["occlusionBindingIntegrity"] = occlusion_binding_integrity
if occluder_material_integrity is not None:
    report["occluderMaterialIntegrity"] = occluder_material_integrity
if not args.ao_only and not (report["illumination"] and report["illumination"]["maximum"] > 0 and report["illumination"]["mean"] > 0):
    raise RuntimeError("The complete daylight atlas contains no positive radiance; do not promote this bake")
(args.out / f"lighting-{artifact_zone}.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report), flush=True)
