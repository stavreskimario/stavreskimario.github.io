"""CPU-only acceptance of an unquantized arrivals lighting rebake.

Compare immutable original material/surface inputs, the UV-only input and the
actual raw export. This never writes a model. Runtime compression, appearance
and route acceptance remain separate gates.
"""
from pathlib import Path
from io import BytesIO
import argparse
import copy
import hashlib
import json
import math
import struct
import numpy as np
from PIL import Image

ORIGINAL_SHA = "f346aaa4177460c3b965217486d7f5d1944d9657c15281705b2735a096e8050d"
PRIORITY_SHA = "85bfe97fa8c9459aa82591a983efe3165d87b46a1ce86413c13ae18501a89994"
MAX_NORMAL_ANGLE = .5
MAX_UV_ROUNDTRIP = 2e-7


def sha(value):
    return hashlib.sha256(value).hexdigest()


class Glb:
    def __init__(self, path):
        self.path = Path(path)
        self.bytes = self.path.read_bytes()
        magic, version, total = struct.unpack_from("<III", self.bytes)
        assert magic == 0x46546c67 and version == 2 and total == len(self.bytes)
        length, kind = struct.unpack_from("<II", self.bytes, 12)
        assert kind == 0x4e4f534a
        self.json = json.loads(self.bytes[20:20 + length])
        offset = 20 + length
        size, kind = struct.unpack_from("<II", self.bytes, offset)
        assert kind == 0x004e4942
        self.binary = memoryview(self.bytes)[offset + 8:offset + 8 + size]
        assert not any(x in self.json.get("extensionsRequired", []) for x in
                       ("EXT_meshopt_compression", "KHR_draco_mesh_compression")), "Use the raw unquantized model"

    def accessor(self, index):
        row = self.json["accessors"][index]
        assert "sparse" not in row
        view = self.json["bufferViews"][row["bufferView"]]
        assert not view.get("extensions", {}).get("EXT_meshopt_compression")
        assert view.get("buffer", 0) == 0
        types = {5120: "i1", 5121: "u1", 5122: "<i2", 5123: "<u2", 5125: "<u4", 5126: "<f4"}
        widths = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
        dtype = np.dtype(types[row["componentType"]])
        width = widths[row["type"]]
        result = np.ndarray((row["count"], width), dtype, self.binary,
                            view.get("byteOffset", 0) + row.get("byteOffset", 0),
                            strides=(view.get("byteStride", width * dtype.itemsize), dtype.itemsize))
        assert not row.get("normalized"), "This acceptance gate expects unquantized authoring buffers"
        return result

    def image(self, texture_index):
        texture = self.json["textures"][texture_index]
        assert "source" in texture and "extensions" not in texture
        image = self.json["images"][texture["source"]]
        assert "bufferView" in image
        view = self.json["bufferViews"][image["bufferView"]]
        at = view.get("byteOffset", 0)
        return bytes(self.binary[at:at + view["byteLength"]]), image, texture

    def primitives(self):
        result = {}
        for node in self.json["nodes"]:
            if "mesh" not in node:
                continue
            assert not node.get("extensions", {}).get("EXT_mesh_gpu_instancing")
            for ordinal, primitive in enumerate(self.json["meshes"][node["mesh"]]["primitives"]):
                assert primitive.get("mode", 4) == 4
                material = self.json["materials"][primitive["material"]]["name"]
                key = (node["name"], ordinal, material)
                assert key not in result
                ids = self.accessor(primitive["indices"]).astype(np.int64).reshape(-1, 3)
                fields = {name: self.accessor(index)[ids] for name, index in primitive["attributes"].items()}
                result[key] = {"fields": fields, "indices": self.accessor(primitive["indices"]).tobytes(), "primitive": primitive}
        return result


def compare_geometry(original, priority, actual):
    old, authored, new = (x.primitives() for x in (original, priority, actual))
    assert old.keys() == authored.keys() == new.keys(), "The exported object/material primitive partition changed"
    assert original.json["nodes"] == actual.json["nodes"], "Transforms, hierarchy, visibility/extras or object binding changed"
    assert original.json["scenes"] == actual.json["scenes"] and original.json.get("scene", 0) == actual.json.get("scene", 0), "Scene membership changed"
    counts = {"triangleCorners": 0, "rawIndexPayloadsExact": 0, "primitiveCount": len(old)}
    maximum_angle = maximum_uv0 = maximum_uv1 = maximum_position = 0.
    normals_exact = uv0_exact = uv1_exact = positions_exact = True
    for key, row in old.items():
        a, p, b = row["fields"], authored[key]["fields"], new[key]["fields"]
        assert a.keys() == p.keys() == b.keys()
        for name in a:
            assert a[name].shape == b[name].shape
            assert np.isfinite(b[name]).all(), "Non-finite exported attribute: " + name
        assert np.array_equal(a["POSITION"], p["POSITION"])
        assert np.array_equal(a["NORMAL"], p["NORMAL"])
        assert np.array_equal(a["TEXCOORD_0"], p["TEXCOORD_0"])
        delta = float(np.abs(a["POSITION"] - b["POSITION"]).max())
        maximum_position = max(maximum_position, delta)
        positions_exact &= np.array_equal(a["POSITION"], b["POSITION"])
        old_n = a["NORMAL"].astype(np.float64)
        new_n = b["NORMAL"].astype(np.float64)
        assert np.isfinite(new_n).all()
        lengths = np.linalg.norm(new_n, axis=-1)
        assert np.max(np.abs(lengths - 1)) < 1e-4
        old_n /= np.linalg.norm(old_n, axis=-1)[..., None]
        new_n /= lengths[..., None]
        dot = np.clip(np.sum(old_n * new_n, axis=-1), -1, 1)
        maximum_angle = max(maximum_angle, float(np.degrees(np.arccos(dot)).max()))
        normals_exact &= np.array_equal(a["NORMAL"], b["NORMAL"])
        for name in a:
            if name == "NORMAL" or name.startswith("TEXCOORD_") or name == "POSITION":
                continue
            assert np.array_equal(a[name], b[name]), "Unexpected attribute changed: " + name
        uv0 = float(np.abs(a["TEXCOORD_0"] - b["TEXCOORD_0"]).max())
        maximum_uv0 = max(maximum_uv0, uv0)
        uv0_exact &= np.array_equal(a["TEXCOORD_0"], b["TEXCOORD_0"])
        if "TEXCOORD_1" in p:
            uv1 = float(np.abs(p["TEXCOORD_1"] - b["TEXCOORD_1"]).max())
            maximum_uv1 = max(maximum_uv1, uv1)
            uv1_exact &= np.array_equal(p["TEXCOORD_1"], b["TEXCOORD_1"])
        counts["triangleCorners"] += a["POSITION"].shape[0] * 3
        counts["rawIndexPayloadsExact"] += int(row["indices"] == new[key]["indices"])
    assert positions_exact, "Any physical position change is rejected"
    assert maximum_angle <= MAX_NORMAL_ANGLE, "Normal round-trip exceeds the declared encoding bound"
    assert maximum_uv0 <= MAX_UV_ROUNDTRIP and maximum_uv1 <= MAX_UV_ROUNDTRIP, "UV map changed beyond Float32 round-trip bound"
    return {**counts, "nodeJsonExact": True, "sceneMembershipExact": True, "positionsExact": bool(positions_exact),
            "maximumPositionComponentDeltaM": maximum_position,
            "rawNormalsExact": bool(normals_exact), "maximumNormalRoundtripAngleDegrees": maximum_angle,
            "allowedNormalRoundtripAngleDegrees": MAX_NORMAL_ANGLE,
            "surfaceUv0Exact": bool(uv0_exact), "maximumSurfaceUv0Delta": maximum_uv0,
            "priorityUv1Exact": bool(uv1_exact), "maximumPriorityUv1Delta": maximum_uv1,
            "allowedUvFloat32RoundtripDelta": MAX_UV_ROUNDTRIP,
            "qualification": "All oriented triangle corners must retain positions exactly. Index renumbering is reported, never substituted for the corner comparison. Normal re-encoding and UV V-flip Float32 round-trip, if present, are measured rather than called byte-exact."}


def material_without_radiance(material):
    material = copy.deepcopy(material)
    material.get("extras", {}).pop("sky_illumination_scale", None)
    return material


def compare_materials(original, actual, radiance_scale=None):
    a, b = original.json["materials"], actual.json["materials"]
    assert len(a) == len(b) == 7
    assert [x["name"] for x in a] == [x["name"] for x in b]
    roles = [(None, "normalTexture"), ("pbrMetallicRoughness", "baseColorTexture"),
             ("pbrMetallicRoughness", "metallicRoughnessTexture"), (None, "emissiveTexture")]
    rows = []
    for old, new in zip(a, b):
        assert material_without_radiance(old) == material_without_radiance(new), "Non-lighting material JSON changed: " + old["name"]
        if "lighting_atlas_uv" in old.get("extras", {}):
            assert radiance_scale is None or new["extras"]["sky_illumination_scale"] == radiance_scale
        for container, name in roles:
            old_role = old.get(container, {}) if container else old
            new_role = new.get(container, {}) if container else new
            if name not in old_role:
                continue
            left, right = old_role[name], new_role[name]
            old_bytes, old_image, old_texture = original.image(left["index"])
            new_bytes, new_image, new_texture = actual.image(right["index"])
            assert old_bytes == new_bytes, "Authored PBR image changed: " + old["name"] + "/" + name
            assert old_texture == new_texture
            rows.append({"material": old["name"], "role": name, "sha256": sha(new_bytes),
                         "bytes": len(new_bytes), "imagePayloadExact": True,
                         "sourceImageName": old_image.get("name"), "exportImageName": new_image.get("name")})
    return {"materialCount": len(b), "allPbrScalarsExtensionsAndNonLightingExtrasExact": True,
            "allowedChangedExtra": "sky_illumination_scale (must equal the actual report)",
            "sourceImages": rows}


def compare_fresh_ao(actual, fresh_path):
    fresh_bytes = Path(fresh_path).read_bytes()
    fresh = np.asarray(Image.open(BytesIO(fresh_bytes)).convert("RGB"))
    rows = []
    for material in actual.json["materials"]:
        role = material.get("occlusionTexture")
        if not role:
            continue
        assert role.get("texCoord", 0) == 1, "Raw arrivals AO must use its authored lighting UV1"
        image_bytes, image, _ = actual.image(role["index"])
        pixels = np.asarray(Image.open(BytesIO(image_bytes)).convert("RGB"))
        assert pixels.shape == fresh.shape
        assert np.array_equal(pixels[:, :, 0], fresh[:, :, 0]), "Stale or different AO export: " + material["name"]
        rows.append({"material": material["name"], "texCoord": 1, "image": image.get("name"),
                     "imagePayloadSha256": sha(image_bytes), "redChannelPixelsExact": True,
                     "rgbPixelsExact": bool(np.array_equal(pixels, fresh)),
                     "pngBytesExact": image_bytes == fresh_bytes})
    assert len(rows) == 4
    return {"freshStandalonePngSha256": sha(fresh_bytes), "dimensions": [fresh.shape[1], fresh.shape[0]],
            "litMaterialCount": len(rows), "allOcclusionRedChannelPixelsFreshExact": True, "bindings": rows}


def density(original, actual):
    old, new = original.primitives(), actual.primitives()
    rows = []
    for key in old:
        if key[0] != "concourse-arrivals baked static architecture":
            continue
        p = old[key]["fields"]["POSITION"].astype(np.float64)
        normal = np.cross(p[:, 1] - p[:, 0], p[:, 2] - p[:, 0])
        double_area = np.linalg.norm(normal, axis=1)
        normal /= np.maximum(double_area, 1e-30)[:, None]
        area = double_area * .5
        masks = {}
        if key[2] == "TravertineArrivalsStairStone":
            masks["public_treads_landings"] = normal[:, 1] > .5
            masks["public_stair_risers"] = np.abs(normal[:, 0]) > .7
        elif key[2] in ("PublicFloorMarbleArrivalsRetainedNorth", "ConcourseOpaqueArrivalsConcrete"):
            masks["public_retained_floor" if key[2].startswith("PublicFloor") else "public_gallery_floor"] = normal[:, 1] > .5
        for label, mask in masks.items():
            assert mask.any()
            uv = [row[key]["fields"]["TEXCOORD_1"].astype(np.float64) for row in (old, new)]
            uvarea = [np.abs((u[:, 1, 0] - u[:, 0, 0]) * (u[:, 2, 1] - u[:, 0, 1]) -
                             (u[:, 1, 1] - u[:, 0, 1]) * (u[:, 2, 0] - u[:, 0, 0])) * .5 for u in uv]
            ratio = np.sqrt(uvarea[1][mask] / np.maximum(uvarea[0][mask], 1e-30))
            before, after = [math.sqrt(float(x[mask].sum()) / float(area[mask].sum())) * 4096 for x in uvarea]
            assert ratio.min() >= 1, "A public face lost lighting atlas density"
            rows.append({"class": label, "triangles": int(mask.sum()), "worldAreaM2": float(area[mask].sum()),
                         "oldGi4096TexelsPerM": before, "newGi4096TexelsPerM": after,
                         "newAo2048TexelsPerMIfDownsized": after / 2,
                         "minimumPerTriangleLinearDensityRatio": float(ratio.min())})
    return {"publicFacesNeverLoseDensity": True, "classes": rows}


def validate_report(report):
    assert report["zone"] == "concourse-arrivals" and report["frameZone"] == "concourse"
    assert report["sourceSha256"] == PRIORITY_SHA
    assert report["resolution"] == 4096 and report["samples"] == 256
    assert report["authoredUvIntegrity"]["allImportedPrimaryBuffersByteExactBeforeBake"]
    assert report["authoredUvIntegrity"]["onlyArchitectureSelectedAndActiveBeforeBake"]
    assert report["occlusionBindingIntegrity"]["status"] == "PASS"
    integrity = report["occluderMaterialIntegrity"]
    assert integrity["primaryMaterialGraphsExactSinceInitialImport"]
    assert integrity["primaryMaterialGraphsPackedImagesAndPropertiesExact"]
    assert len(report["registeredOccluders"]) == len(report["sourceRenderVisibility"]["contexts"]) == 8
    assert len(report["surfaceProfiles"]) == 28
    assert report["radianceScale"] > 0 and report["illumination"]["maximum"] > 0
    return {"authoredImportedBuffersExact": True, "onlyArchitectureSelectedActive": True,
            "primaryShaderImageStatesExactSinceInitialImport": True,
            "eightContextsAndVisibilityReceiptsPresent": True, "neighborSurfaceProfiles": 28,
            "actualRadianceScale": report["radianceScale"], "engine": report["engine"],
            "elapsedBakeSeconds": report["elapsedSeconds"]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original", type=Path, required=True)
    parser.add_argument("--priority-input", type=Path, required=True)
    parser.add_argument("--new", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--fresh-ao", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    assert not args.out.exists(), "Review output must be fresh"
    inputs = [args.original, args.priority_input, args.new, args.report, args.fresh_ao]
    before = {str(path.resolve()): sha(path.read_bytes()) for path in inputs}
    assert before[str(args.original.resolve())] == ORIGINAL_SHA
    assert before[str(args.priority_input.resolve())] == PRIORITY_SHA
    original, priority, actual = [Glb(path) for path in inputs[:3]]
    report = json.loads(args.report.read_text())
    receipt = {"schema": 1, "status": "PASS: raw arrivals rebake preservation and fresh AO export",
               "inputs": before, "actualReport": validate_report(report),
               "geometry": compare_geometry(original, priority, actual),
               "materials": compare_materials(original, actual, report["radianceScale"]),
               "freshAo": compare_fresh_ao(actual, args.fresh_ao),
               "physicalLightingDensity": density(original, actual),
               "limits": ["This gate reads unquantized raw export; it does not certify compression or runtime UV channel remapping.",
                          "Byte-exact source UV-only proof and preflight buffers are separate from measured export round-trip drift.",
                          "The material library and reconstructed geometry are appearance/architecture interpretations; no new historic verification is claimed.",
                          "Denoising, actual browser appearance, walking routes, performance and deployment remain required parent gates."],
               "generatorSha256": sha(Path(__file__).read_bytes())}
    assert before == {str(path.resolve()): sha(path.read_bytes()) for path in inputs}, "An input changed while being checked"
    args.out.write_text(json.dumps(receipt, indent=2) + "\n")
    print(json.dumps({key: receipt[key] for key in ("status", "geometry", "physicalLightingDensity")}, indent=2))


if __name__ == "__main__":
    main()
