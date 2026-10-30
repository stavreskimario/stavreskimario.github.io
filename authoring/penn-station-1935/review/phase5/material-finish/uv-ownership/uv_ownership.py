"""Reject lightmap projection folds, including folds smaller than one texel.

UV winding alone is insufficient: two distant, equally oriented surfaces can
project into one chart. This check uses strict convex triangle interiors and
therefore permits ordinary shared chart edges without permitting two owners.
"""
import time

import numpy as np


def audit_uv_ownership(triangle_uv, tolerance=1e-12):
    triangles = np.asarray(triangle_uv, dtype=np.float64)
    if triangles.ndim != 3 or triangles.shape[1:] != (3, 2) or not len(triangles):
        raise ValueError("A nonempty array of UV triangles is required")
    if not np.isfinite(triangles).all() or not 0 < tolerance < 1e-6:
        raise ValueError("Finite UVs and a small positive ownership tolerance are required")
    started = time.monotonic()
    count = len(triangles)
    lower, upper = triangles.min(axis=1), triangles.max(axis=1)
    if lower.min() < -1e-6 or upper.max() > 1 + 1e-6:
        raise ValueError("Lighting UVs must stay inside their atlas")
    # Broad phase only. All candidate pairs then receive the same geometric
    # test, independent of atlas pixel resolution or raster sample placement.
    bins = 128
    cell_lower = np.floor(lower * bins).astype(np.int64)
    cell_upper = np.floor(upper * bins).astype(np.int64)
    cells = {}
    for i, (a, b) in enumerate(zip(cell_lower, cell_upper)):
        for y in range(a[1], b[1] + 1):
            for x in range(a[0], b[0] + 1):
                cells.setdefault((x, y), []).append(i)
    keys = []
    for bucket in cells.values():
        if len(bucket) < 2:
            continue
        i, j = np.triu_indices(len(bucket), 1)
        bucket = np.asarray(bucket, dtype=np.int64)
        a, b = bucket[i], bucket[j]
        possible = np.all(np.minimum(upper[a], upper[b]) - np.maximum(lower[a], lower[b]) > tolerance, axis=1)
        keys.append(a[possible] * count + b[possible])
    pairs = np.unique(np.concatenate(keys)) if keys else np.empty(0, dtype=np.int64)
    failures = []
    for offset in range(0, len(pairs), 32768):
        part = pairs[offset:offset + 32768]
        i, j = part // count, part % count
        a, b = triangles[i], triangles[j]
        edges = np.concatenate((np.roll(a, -1, axis=1) - a, np.roll(b, -1, axis=1) - b), axis=1)
        axes = np.stack((-edges[:, :, 1], edges[:, :, 0]), axis=2)
        axes /= np.maximum(np.linalg.norm(axes, axis=2)[:, :, None], 1e-30)
        projection_a = np.einsum("bvc,bac->bav", a, axes)
        projection_b = np.einsum("bvc,bac->bav", b, axes)
        depth = (np.minimum(projection_a.max(axis=2), projection_b.max(axis=2))
                 - np.maximum(projection_a.min(axis=2), projection_b.min(axis=2)))
        positive = np.all(depth > tolerance, axis=1)
        failures.extend([[int(x), int(y)] for x, y in zip(i[positive], j[positive])])
    determinant = np.cross(triangles[:, 1] - triangles[:, 0], triangles[:, 2] - triangles[:, 0])
    return {"method": "Float64 convex separating-axis test of strict triangle interiors; shared edges excluded",
            "uvDistanceTolerance": tolerance, "triangles": count, "candidatePairs": len(pairs),
            "overlappingTrianglePairs": len(failures), "firstOverlappingPairs": failures[:20],
            "zeroAreaTriangles": int((np.abs(determinant) <= 1e-16).sum()),
            "minimumTriangleUvArea": float(np.min(np.abs(determinant)) / 2),
            "elapsedSeconds": time.monotonic() - started}


def require_unique_uv_ownership(triangle_uv):
    report = audit_uv_ownership(triangle_uv)
    if report["zeroAreaTriangles"] or report["overlappingTrianglePairs"]:
        raise RuntimeError("Lighting UV pack has collapsed triangles or multiple owners: " + str(report))
    return report
