"""Shared physical surface setup for Cycles bakes and reflection captures.

Historic records identify stone families, not calibrated albedo/roughness samples.
The CC0 maps and optical values below are declared appearance interpretations.
Architectural UVs are planar metre coordinates scaled by .28 in the source.
"""
from pathlib import Path
import hashlib
import bpy

REVISION = 3
# UV revision3 is intentionally retained. These scalar changes do not retile
# geometry; the separately reviewed colour derivatives are applied downstream.
NORMAL_APPEARANCE_REVISION = 4
SURFACES = [
    (("MilfordGranite",), "Granite005A", 1.0, .045, .88),
    (("InteriorGranite",), "Granite005A", 1.0, .025, .50),
    (("Travertine",), "Travertine009", 1.5, .035, .95),
    (("PublicFloorMarble", "TennesseeMarble"), "Marble018", 1.8, .018, .48),
    (("BotticinoMarble",), "Marble018", 1.25, .025, .58),
    (("BedfordLimestoneConcourse",), "BedfordLimestoneConcourse", 1.5, .15, 1.0),
]


def surface_profile(material):
    for prefixes, identity, tile_metres, normal, roughness_factor in SURFACES:
        if material.name.startswith(prefixes):
            return identity, tile_metres, normal, roughness_factor
    return None


def prepare_surface_uvs(objects):
    """Preserve a physical grain scale instead of stretching grain over walls."""
    for obj in objects:
        if obj.type != "MESH" or obj.get("penn_surface_revision") == REVISION:
            continue
        if not obj.data.uv_layers:
            continue
        if obj.data.get("penn_surface_revision") == REVISION:
            obj["penn_surface_revision"] = REVISION
            continue
        uv = obj.data.uv_layers[0]
        for face in obj.data.polygons:
            if face.material_index >= len(obj.data.materials):
                continue
            material = obj.data.materials[face.material_index]
            profile = surface_profile(material) if material else None
            if not profile:
                continue
            factor = 1 / (.28 * profile[1])
            offset = (0, 0)
            if material.name.startswith("TravertineAshlar"):
                digest = hashlib.sha256(material.name.split(".")[0].encode()).digest()
                offset = (digest[0] / 255, digest[1] / 255)
            for index in face.loop_indices:
                point = uv.data[index].uv
                point.x = point.x * factor + offset[0]
                point.y = point.y * factor + offset[1]
        obj["penn_surface_revision"] = REVISION
        obj.data["penn_surface_revision"] = REVISION


def apply_materials(materials, library):
    library = Path(library)
    appearance_root = library / "phase4"
    # Photographic appearance interpretation, not a measured historic sample.
    colour_profiles = [("MilfordGranite", "MilfordFine"), ("InteriorGranite", "InteriorFine"),
                       ("Travertine", "RomanTravertine"), ("PublicFloorMarble", "HonedMarble"),
                       ("TennesseeMarble", "HonedMarble"), ("BotticinoMarble", "HonedMarble")]
    report = []
    for material in materials:
        if not material or not material.use_nodes:
            continue
        nodes, links = material.node_tree.nodes, material.node_tree.links
        pbr = next((node for node in nodes if node.type == "BSDF_PRINCIPLED"), None)
        if not pbr:
            continue
        if material.name.startswith("ConcourseReinforcedVaultLightConcrete"):
            # Thousands of tiny repeated web faces overwhelm whole-room UV
            # packing. They retain actual geometry, cast transport shadows and
            # use local room IBL/direct light, like the fine ironwork.
            material["skip_lighting_atlas"] = True
        if material.name.startswith("PaintedStructuralIron"):
            pbr.inputs["Metallic"].default_value = 0
            pbr.inputs["Roughness"].default_value = .46
        if material.name.startswith("MonelRoof"):
            pbr.inputs["Metallic"].default_value = 1
            pbr.inputs["Roughness"].default_value = .47
        if material.name.startswith("FlatRoofTile"):
            pbr.inputs["Metallic"].default_value = 0
            pbr.inputs["Roughness"].default_value = .72
        if material.name.startswith("ContextWindow"):
            pbr.inputs["Base Color"].default_value = (.018, .023, .024, 1)
            pbr.inputs["Metallic"].default_value = 0
            pbr.inputs["Roughness"].default_value = .09
            material["optical_interpretation"] = "Reflective dark office glazing/backing; office interiors remain unmodelled"
        if material.name.startswith("OpalCandelabraGlass"):
            pbr.inputs["Base Color"].default_value = (.94, .93, .89, 1)
            pbr.inputs["Metallic"].default_value = 0
            pbr.inputs["Roughness"].default_value = .30
            pbr.inputs["Transmission Weight"].default_value = .18
            pbr.inputs["IOR"].default_value = 1.5
            material["skip_lighting_atlas"] = True
            material["optical_interpretation"] = "Restrained milky opal globe response interpreted from primary photographs; no calibrated surviving glass sample or photometry"
        if material.name.startswith(("HistoricGlass", "LunetteGlazing")):
            pbr.inputs["Base Color"].default_value = (.985, .995, .99, 1)
            pbr.inputs["Metallic"].default_value = 0
            pbr.inputs["Roughness"].default_value = .035
            pbr.inputs["Transmission Weight"].default_value = 1
            pbr.inputs["IOR"].default_value = 1.52
            material["optical_interpretation"] = "Thin uncoated glass, IOR1.52; no surveyed historic optical sample"
        profile = surface_profile(material)
        if not profile:
            continue
        identity, tile_metres, normal_strength, roughness_factor = profile
        for suffix, slot in [("Color", "Base Color"), ("Roughness", "Roughness"), ("NormalGL", "Normal")]:
            filename = library / identity / f"{identity}_2K-JPG_{suffix}.jpg"
            if identity == "BedfordLimestoneConcourse":
                filename = appearance_root / f"{identity}-{suffix}.png"
                pbr.inputs["Base Color"].default_value = (1, 1, 1, 1)
            derivative = next((profile for prefix, profile in colour_profiles if material.name.startswith(prefix)), None)
            if suffix == "Color" and derivative and appearance_root.exists():
                filename = appearance_root / f"{derivative}-full.png"
                if not filename.is_file():
                    raise FileNotFoundError("Reviewed appearance library is incomplete: " + str(filename))
            image = bpy.data.images.load(str(filename), check_existing=True)
            image.colorspace_settings.name = "sRGB" if suffix == "Color" else "Non-Color"
            texture = nodes.new("ShaderNodeTexImage")
            texture.image = image
            texture.label = f"Authored Bedford surface {suffix}" if identity == "BedfordLimestoneConcourse" else f"ambientCG {identity} CC0 {suffix}"
            if suffix == "NormalGL":
                normal = nodes.new("ShaderNodeNormalMap")
                normal.inputs["Strength"].default_value = normal_strength
                links.new(texture.outputs["Color"], normal.inputs["Color"])
                links.new(normal.outputs["Normal"], pbr.inputs["Normal"])
            elif suffix == "Roughness":
                scale = nodes.new("ShaderNodeMath")
                scale.operation = "MULTIPLY"
                scale.inputs[1].default_value = roughness_factor
                links.new(texture.outputs["Color"], scale.inputs[0])
                links.new(scale.outputs[0], pbr.inputs[slot])
            else:
                links.new(texture.outputs["Color"], pbr.inputs[slot])
        material["surface_reference"] = "Original seeded Bedford surface interpretation; not a historic scan or calibrated sample" if identity == "BedfordLimestoneConcourse" else f"ambientCG {identity}, CC0; interpreted station appearance, not a historic sample"
        material["surface_tile_metres"] = tile_metres
        material["surface_normal_strength"] = normal_strength
        material["surface_roughness_factor"] = roughness_factor
        material["surface_revision"] = REVISION
        material["surface_normal_revision"] = NORMAL_APPEARANCE_REVISION
        report.append({"material": material.name, "asset": identity, "tileMetres": tile_metres,
                       "normalStrength": normal_strength, "roughnessFactor": roughness_factor,
                       "appearanceRevision": 4 if appearance_root.exists() else 3,
                       "colourProfile": next((profile for prefix, profile in colour_profiles if material.name.startswith(prefix)), None),
                       "interiorShaftFinish": "Smoother response interpreted from primary photographs; no measured polish/roughness specification" if material.name.startswith("InteriorGranite") else None})
    return report
