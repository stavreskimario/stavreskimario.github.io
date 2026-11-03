"""Carry the arcade's authored corner normals through Blender UV preparation.

Joining and merging vertices can alter split custom normals at a groin, capital
or contact even when the visible geometry is unchanged. A temporary ordinary
corner attribute survives those operations. World-space values also survive
joining objects with different transforms. The attribute is removed before
export, and this helper never changes topology, UVs or smoothing flags.
"""
import math
import numpy as np

ATTRIBUTE = "_PennArcadeWorldCornerNormal"
# Blender re-encodes custom normals within each smooth fan. A sub-degree bound
# allows that codec step while rejecting the visible multi-degree seam drift.
MINIMUM_RESTORED_DOT = math.cos(math.radians(0.5))


def _corner_normals(mesh):
    values = np.empty(len(mesh.loops) * 3, dtype=np.float32)
    mesh.corner_normals.foreach_get("vector", values)
    return values.reshape(-1, 3).astype(np.float64)


def _unit(values):
    lengths = np.linalg.norm(values, axis=1)
    if not np.isfinite(values).all() or (lengths < 0.9).any():
        raise RuntimeError("Arcade corner-normal preservation contains invalid vectors")
    return values / lengths[:, None]


def _hemisphere(mesh, normals):
    face = np.empty(len(mesh.polygons) * 3, dtype=np.float32)
    mesh.polygons.foreach_get("normal", face)
    counts = np.empty(len(mesh.polygons), dtype=np.int32)
    mesh.polygons.foreach_get("loop_total", counts)
    face = np.repeat(face.reshape(-1, 3), counts, axis=0)
    dots = np.sum(normals * face, axis=1)
    return {"negativeCorners": int((dots < -0.0002).sum()),
            "minimumFaceAlignment": float(dots.min()) if len(dots) else 1.0}


def preserve_arcade_corner_normals(objects):
    """Snapshot before join/transform/weld; only pass this artifact's solids."""
    report = {"schema": 1, "scope": "arcade-enclosure authored corner normals",
              "temporaryAttribute": ATTRIBUTE, "sourceObjects": 0,
              "sourceCorners": 0, "sourceNegativeHemisphereCorners": 0,
              "sourceMinimumFaceAlignment": 1.0}
    for obj in objects:
        if obj.type != "MESH":
            continue
        mesh = obj.data
        if mesh.attributes.get(ATTRIBUTE):
            raise RuntimeError("Arcade temporary corner-normal attribute already exists")
        local = _unit(_corner_normals(mesh))
        normal_matrix = np.array(obj.matrix_world.to_3x3().inverted().transposed())
        world = _unit(local @ normal_matrix.T)
        attribute = mesh.attributes.new(ATTRIBUTE, "FLOAT_VECTOR", "CORNER")
        attribute.data.foreach_set("vector", world.astype(np.float32).reshape(-1))
        hemisphere = _hemisphere(mesh, local)
        report["sourceObjects"] += 1
        report["sourceCorners"] += len(mesh.loops)
        report["sourceNegativeHemisphereCorners"] += hemisphere["negativeCorners"]
        report["sourceMinimumFaceAlignment"] = min(report["sourceMinimumFaceAlignment"], hemisphere["minimumFaceAlignment"])
    if not report["sourceObjects"]:
        raise RuntimeError("No arcade solids available for normal preservation")
    return report


def restore_arcade_corner_normals(architecture, report):
    """Restore after topology/UV operations, before Cycles sees the geometry."""
    mesh = architecture.data
    attribute = mesh.attributes.get(ATTRIBUTE)
    if not attribute or attribute.domain != "CORNER" or len(attribute.data) != len(mesh.loops):
        raise RuntimeError("Arcade normal-preservation corner data was lost during UV preparation")
    world = np.empty(len(mesh.loops) * 3, dtype=np.float32)
    attribute.data.foreach_get("vector", world)
    world = _unit(world.reshape(-1, 3))
    # N_world = inverse(M).transpose() * N_local, hence N_local = M.transpose()
    # * N_world. Rows therefore multiply by M's linear transform directly.
    local = _unit(world @ np.array(architecture.matrix_world.to_3x3()))
    mesh.normals_split_custom_set(local.tolist())
    mesh.update()
    actual = _unit(_corner_normals(mesh))
    dots = np.sum(actual * local, axis=1)
    hemisphere = _hemisphere(mesh, actual)
    report = dict(report)
    report.update({"restoredCorners": len(mesh.loops),
                   "minimumRestoredSourceNormalDot": float(dots.min()),
                   "maxEncodingAngleDegrees": math.degrees(math.acos(float(np.clip(dots.min(), -1, 1)))),
                   "maxAllowedEncodingAngleDegrees": 0.5,
                   "restoredNegativeHemisphereCorners": hemisphere["negativeCorners"],
                   "restoredMinimumFaceAlignment": hemisphere["minimumFaceAlignment"],
                   "finiteUnitNormals": True})
    mesh.attributes.remove(attribute)
    report["temporaryAttributeRemoved"] = not bool(mesh.attributes.get(ATTRIBUTE))
    if (dots < MINIMUM_RESTORED_DOT).any():
        bad = np.flatnonzero(dots < MINIMUM_RESTORED_DOT)
        examples = [{"corner": int(i), "dot": float(dots[i]),
                     "requested": local[i].tolist(), "actual": actual[i].tolist()}
                    for i in bad[:8]]
        raise RuntimeError(f"Arcade authored corner normals were not restored accurately: {len(bad)} / {len(dots)}; minimum {dots.min()}; examples {examples}; report {report}")
    if hemisphere["negativeCorners"] > report["sourceNegativeHemisphereCorners"]:
        raise RuntimeError("Arcade UV preparation introduced new inward corner normals")
    report["status"] = "PASS"
    return report
