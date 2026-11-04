"""Bounded CPU proof on actual linear-atlas patches, not a rendered-image blur."""
from pathlib import Path
import hashlib
import json
import math
import struct

import bpy
import numpy as np
from PIL import Image

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
OUT = HERE / "bilateral-patches"
OUT.mkdir(exist_ok=True)
source = HERE / "denoised/lighting-waiting-room-vault-sky-denoised-linear.hdr"
model = ROOT / "vault-baked-v3/model-waiting-room-vault.glb"
blob = model.read_bytes()
length = struct.unpack_from("<I", blob, 12)[0]
gltf = json.loads(blob[20:20 + length])
binary = memoryview(blob)[28 + length:]

def accessor(index):
    a = gltf["accessors"][index]
    view = gltf["bufferViews"][a["bufferView"]]
    dtype = {5123: "<u2", 5125: "<u4", 5126: "<f4"}[a["componentType"]]
    size = {"VEC2": 2, "SCALAR": 1}[a["type"]]
    return np.ndarray((a["count"], size), dtype=dtype, buffer=binary,
                      offset=view.get("byteOffset", 0) + a.get("byteOffset", 0),
                      strides=(view.get("byteStride", np.dtype(dtype).itemsize * size), np.dtype(dtype).itemsize))

primitive = gltf["meshes"][0]["primitives"][0]
uv = accessor(primitive["attributes"]["TEXCOORD_1"]).astype(np.float64)
uv[:, 1] = 1 - uv[:, 1]
triangles = uv[accessor(primitive["indices"]).reshape(-1, 3)]
parent = np.arange(len(triangles), dtype=np.int32)

def find(i):
    while parent[i] != i:
        parent[i] = parent[parent[i]]
        i = parent[i]
    return i

edges = {}
for i, triangle in enumerate(triangles):
    for j in range(3):
        a, b = tuple(triangle[j]), tuple(triangle[(j + 1) % 3])
        key = (a, b) if a < b else (b, a)
        if key in edges:
            x, y = find(i), find(edges[key])
            parent[max(x, y)] = min(x, y)
        else:
            edges[key] = i
components = np.asarray([find(i) + 1 for i in range(len(triangles))], dtype=np.int32)
component_count = len(np.unique(components))
normals = np.load(HERE / "vault-normal-guide.npy", mmap_mode="r")
image = bpy.data.images.load(str(source), check_existing=False)
image.colorspace_settings.name = "Non-Color"
pixels = np.empty(len(image.pixels), np.float32)
image.pixels.foreach_get(pixels)
linear = pixels.reshape(8192, 8192, 4)[:, :, :3]

def filter_patch(rgb, normal, labels, sigma_range, radius=2):
    total = np.zeros_like(rgb, dtype=np.float64)
    weight_sum = np.zeros(rgb.shape[:2], dtype=np.float64)
    luma = rgb.mean(axis=2)
    h, w = labels.shape
    normal_sigma = 1 - math.cos(math.radians(5))
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            ys, xs = slice(max(0, -dy), min(h, h - dy)), slice(max(0, -dx), min(w, w - dx))
            yn, xn = slice(max(0, dy), min(h, h + dy)), slice(max(0, dx), min(w, w + dx))
            dot = np.einsum("ijk,ijk->ij", normal[ys, xs], normal[yn, xn])
            same = (labels[ys, xs] > 0) & (labels[ys, xs] == labels[yn, xn]) & (dot > math.cos(math.radians(10)))
            delta = luma[ys, xs] - luma[yn, xn]
            weight = (same * np.exp(-(dx * dx + dy * dy) / (2 * 1.2**2))
                      * np.exp(-np.maximum(0, 1 - dot) / normal_sigma)
                      * np.exp(-(delta * delta) / (2 * sigma_range**2)))
            total[ys, xs] += rgb[yn, xn] * weight[:, :, None]
            weight_sum[ys, xs] += weight
    return np.divide(total, weight_sum[:, :, None], out=rgb.astype(np.float64).copy(),
                     where=weight_sum[:, :, None] > 0).astype(np.float32)

def save_preview(path, rgb):
    x = np.maximum(rgb * 8, 0)
    encoded = np.where(x <= .0031308, 12.92 * x, 1.055 * x**(1 / 2.4) - .055)
    Image.fromarray(np.rint(np.clip(encoded, 0, 1) * 255).astype(np.uint8)[::-1]).resize((384, 384), Image.Resampling.NEAREST).save(path)

controls = []
normal = np.zeros((32, 32, 3), np.float32)
normal[:, :, 2] = 1
labels = np.ones((32, 32), np.int32)
for name, field, chart in [("constant018", np.full((32, 32, 3), .18, np.float32), labels),
                           ("indirectEdge", np.broadcast_to(np.where(np.arange(32)[None, :, None] < 16, .09, .27), (32, 32, 3)).astype(np.float32), labels),
                           ("chartEdge", np.broadcast_to(np.where(np.arange(32)[None, :, None] < 16, .12, .15), (32, 32, 3)).astype(np.float32), np.broadcast_to(np.where(np.arange(32)[None, :] < 16, 1, 2), (32, 32)))]:
    result = filter_patch(field, normal, chart, .005)
    error = float(np.abs(result - field).max())
    assert error < 1e-6
    controls.append({"name": name, "maximumError": error})

samples = json.loads((ROOT / "pepper-dense-rays-v3.json").read_text())["records"][1]["rays"]
selected = [s for s in samples if s["screen"] in [[635, 205], [635, 230], [645, 205], [645, 220]]]
reports = []
for sample in selected:
    u, v = sample["hits"][0]["uv"]
    x, y = round(u * 8192 - .5), round((1 - v) * 8192 - .5)
    x0, y0, size = max(0, min(8096, x - 48)), max(0, min(8096, y - 48)), 96
    labels = np.zeros((size, size), np.int32)
    t = triangles * 8192 - np.asarray([x0, y0])
    relevant = np.flatnonzero(np.all(t.max(axis=1) >= 0, axis=1) & np.all(t.min(axis=1) < size, axis=1))
    for k in relevant:
        a, b, c = t[k]
        lo = np.maximum(np.ceil(t[k].min(axis=0) - .5).astype(int), 0)
        hi = np.minimum(np.floor(t[k].max(axis=0) - .5).astype(int) + 1, size)
        if np.any(hi <= lo):
            continue
        xx, yy = np.meshgrid(np.arange(lo[0], hi[0]) + .5, np.arange(lo[1], hi[1]) + .5)
        e1, e2 = b - a, c - a
        d = np.cross(e1, e2)
        p = ((xx - a[0]) * e2[1] - (yy - a[1]) * e2[0]) / d
        q = (e1[0] * (yy - a[1]) - e1[1] * (xx - a[0])) / d
        inside = (p >= -1e-9) & (q >= -1e-9) & (p + q <= 1 + 1e-9)
        labels[lo[1]:hi[1], lo[0]:hi[0]][inside] = components[k]
    rgb, normal = linear[y0:y0 + size, x0:x0 + size].copy(), np.asarray(normals[y0:y0 + size, x0:x0 + size])
    differences = []
    for axis in (0, 1):
        a, b = [slice(None), slice(None)], [slice(None), slice(None)]
        a[axis], b[axis] = slice(1, None), slice(None, -1)
        a, b = tuple(a), tuple(b)
        good = (labels[a] > 0) & (labels[a] == labels[b]) & (np.einsum("ijk,ijk->ij", normal[a], normal[b]) > .999)
        differences.extend(np.abs(rgb[a].mean(axis=2) - rgb[b].mean(axis=2))[good].tolist())
    sigma_noise = max(float(np.median(differences)) / (.67448975 * math.sqrt(2)), 1e-6)
    sigma_range = sigma_noise * 2.5
    filtered = filter_patch(rgb, normal, labels, sigma_range)
    valid = labels > 0
    energy = float(filtered[valid].mean(dtype=np.float64) / rgb[valid].mean(dtype=np.float64) - 1)
    stem = f"patch-{sample['screen'][0]}-{sample['screen'][1]}"
    save_preview(OUT / (stem + "-before.png"), rgb)
    save_preview(OUT / (stem + "-after.png"), filtered)
    np.savez_compressed(OUT / (stem + ".npz"), before=rgb, after=filtered, normal=normal, component=labels)
    reports.append({"screen": sample["screen"], "atlasOriginBlenderXY": [x0, y0], "pixels": int(valid.sum()),
                    "estimatedNoiseSigma": sigma_noise, "irradianceRangeSigma": sigma_range,
                    "relativeMeanChangeOnGeometry": energy,
                    "standardDeviationBefore": float(rgb[valid].mean(axis=1).std()),
                    "standardDeviationAfter": float(filtered[valid].mean(axis=1).std()),
                    "maximumChange": float(np.abs(filtered - rgb).max()),
                    "outsideChartPixelsUnchanged": bool(np.array_equal(filtered[~valid], rgb[~valid]))})
report = {"scope": "Actual linear guidedHDR patches only; no render-image blur, AO, geometry, UV or sourceGI changes",
          "sourceSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "modelSha256": hashlib.sha256(blob).hexdigest(),
          "uvConnectedComponents": component_count, "radiusPixels": 2, "spatialSigmaPixels": 1.2,
          "normalSigmaDegrees": 5, "maximumNormalAngleDegrees": 10,
          "rangeSigmaMethod": "2.5 times robust same-chart, same-normal adjacent-pixel noise estimate",
          "controls": controls, "patches": reports,
          "limitation": "Patch proof only; real chart-gutter and mapped architectural-edge review required before a whole-atlas candidate"}
(OUT / "patch-report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report), flush=True)
