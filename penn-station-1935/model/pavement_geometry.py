"""Remove overlapping coplanar paving tops without moving street boundaries.

Only axis-aligned upward rectangles of the named paving materials participate.
Buried slab volumes remain unchanged. Existing UV fields are interpolated, so
the repair does not change physical texture scale or add street inventory.
"""
import json
from pathlib import Path
from collections import defaultdict
import bpy
import bmesh
import numpy as np
from mathutils import Vector


def area(rect):
    return max(0, rect[1]-rect[0]) * max(0, rect[3]-rect[2])


def subtract(rect, blocker):
    x0, x1, y0, y1 = rect
    ix0, ix1 = max(x0, blocker[0]), min(x1, blocker[1])
    iy0, iy1 = max(y0, blocker[2]), min(y1, blocker[3])
    if ix1-ix0 <= 1e-7 or iy1-iy0 <= 1e-7:
        return [rect]
    pieces = [(x0,x1,y0,iy0), (x0,x1,iy1,y1), (x0,ix0,iy0,iy1), (ix1,x1,iy0,iy1)]
    return [p for p in pieces if area(p) > 1e-9]


def repair_paving_tops(objects, audit_path=None):
    groups = defaultdict(list)
    names = ('PeriodAsphaltRoadSurface', 'CitySidewalkStone')
    for obj in sorted(objects, key=lambda o: o.name):
        if obj.type != 'MESH' or obj.hide_render:
            continue
        normal_matrix = obj.matrix_world.to_3x3().inverted().transposed()
        for poly in obj.data.polygons:
            if len(poly.vertices) != 4 or poly.material_index >= len(obj.data.materials):
                continue
            material = obj.data.materials[poly.material_index]
            if not material or not material.name.startswith(names):
                continue
            normal = (normal_matrix @ poly.normal).normalized()
            if normal.z < .99999:
                continue
            points = [obj.matrix_world @ obj.data.vertices[i].co for i in poly.vertices]
            z = sum(p.z for p in points) / 4
            if max(abs(p.z-z) for p in points) > 1e-5:
                continue
            rect = (min(p.x for p in points), max(p.x for p in points), min(p.y for p in points), max(p.y for p in points))
            corners = {(round(p.x,5),round(p.y,5)) for p in points}
            expected = {(round(x,5),round(y,5)) for x in rect[:2] for y in rect[2:]}
            if corners != expected or area(rect) <= 1e-6:
                continue
            groups[(material.name, round(z,5))].append({'object':obj,'polygon':poly.index,'points':points,'rect':rect,'z':z})
    modifications = defaultdict(list)
    original_area = final_area = 0
    records = []
    for (material,z), candidates in sorted(groups.items()):
        accepted = []
        # Preserve original object/face order for a deterministic ownership of
        # shared intersection surfaces; all same-height/material tops agree.
        for item in candidates:
            pieces = [item['rect']]
            original_area += area(item['rect'])
            for blocker in accepted:
                pieces = [piece for rect in pieces for piece in subtract(rect, blocker)]
            final_area += sum(area(piece) for piece in pieces)
            if len(pieces) != 1 or pieces[0] != item['rect']:
                item['pieces'] = pieces
                modifications[item['object']].append(item)
                records.append({'object':item['object'].name,'polygon':item['polygon'],'material':material,'height':z,
                                'original':item['rect'],'replacement':pieces})
            accepted.extend(pieces)
        for i, a in enumerate(accepted):
            for b in accepted[i+1:]:
                overlap = (max(a[0],b[0]), min(a[1],b[1]), max(a[2],b[2]), min(a[3],b[3]))
                if area(overlap) > 1e-7:
                    raise RuntimeError('Paving repair left a coplanar overlap')
    max_uv_error = 0
    for obj, changes in modifications.items():
        if obj.data.users > 1:
            obj.data = obj.data.copy()
        mesh = obj.data
        bm = bmesh.new(); bm.from_mesh(mesh); bm.faces.ensure_lookup_table()
        original_faces = {item['polygon']: bm.faces[item['polygon']] for item in changes}
        inverse = obj.matrix_world.inverted()
        for item in changes:
            face = original_faces[item['polygon']]
            interpolation = {}
            world = [obj.matrix_world @ loop.vert.co for loop in face.loops]
            basis = np.asarray([[p.x,p.y,1] for p in world], dtype=np.float64)
            for layer in bm.loops.layers.uv.values():
                uv = np.asarray([list(loop[layer].uv) for loop in face.loops], dtype=np.float64)
                coefficient, _, _, _ = np.linalg.lstsq(basis, uv, rcond=None)
                error = float(np.abs(basis @ coefficient-uv).max())
                max_uv_error = max(max_uv_error, error)
                if error > 2e-5:
                    raise RuntimeError('Paving source UVs are not affine; refuse an unscoped repair')
                interpolation[layer] = coefficient
            for x0,x1,y0,y1 in item['pieces']:
                corners = [(x0,y0),(x1,y0),(x1,y1),(x0,y1)]
                vertices = [bm.verts.new(inverse @ Vector((x,y,item['z']))) for x,y in corners]
                replacement = bm.faces.new(vertices)
                replacement.material_index = face.material_index
                replacement.smooth = face.smooth
                for loop, (x,y) in zip(replacement.loops, corners):
                    for layer, coefficient in interpolation.items():
                        loop[layer].uv = tuple(np.array([x,y,1]) @ coefficient)
            bm.faces.remove(face)
        bm.normal_update(); bm.to_mesh(mesh); bm.free(); mesh.update()
    report = {'scope':'Only upward rectangular asphalt/sidewalk tops; street footprint, heights, buried slabs and inventory retained',
              'candidateTops':sum(map(len,groups.values())), 'changedObjects':len(modifications), 'replacedFaces':len(records),
              'originalTopArea':original_area, 'uniqueTopArea':final_area, 'removedDuplicateArea':original_area-final_area,
              'remainingCoplanarOverlapArea':0, 'maximumAffineUvError':max_uv_error, 'changes':records}
    if audit_path:
        Path(audit_path).write_text(json.dumps(report,indent=2)+'\n')
    return report
