"""Isolated new-layer geometry audit, not a complete station or final render."""
import ast
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

source = Path('/Users/stavreskimario/Desktop/penn-station-work/phase4-architecture-source/model/build_station.py')
out = Path('/Users/stavreskimario/Desktop/penn-station-work/concourse-detail-layer-v2')
out.mkdir(parents=True, exist_ok=True)
sys.path.insert(0, str(source.parent))
from concourse_details import ConcourseDetails
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
tree = ast.parse(source.read_text())
wanted = {'mat', 'mesh', 'box', 'arch', 'pierced_wall', 'beam', 'text'}
functions = ast.Module(body=[node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in wanted], type_ignores=[])
exec(compile(functions, str(source), 'exec'), globals())
COL = bpy.data.collections.new('Concourse new detail layer only')
bpy.context.scene.collection.children.link(COL)
FT = .3048
STREET_DROP = 14 * FT
GRANITE = mat('Review existing granite', (.5, .5, .5))
LIMESTONE = mat('Review existing stone', (.6, .6, .6))
FLOOR = mat('Review existing floor', (.5, .5, .5))
IRON = mat('PaintedStructuralIron', (.105, .12, .12), .55)
BLACK = mat('Lettering', (.055, .06, .055), .7)
CX = -73
CW = (210 + 11/12) * FT
CL = 320 * FT
WEST = CX - CW / 2
EW_SPANS = [(85 + 10/12) * FT, (95 + 4/12) * FT, (85 + 10/12) * FT]
X_WEST_INNER = WEST + (29 + 5/12) * FT
X_WEST_MIDDLE = X_WEST_INNER + (27 + 8/12) * FT
CROSS_LEFT = X_WEST_MIDDLE + (27 + 8/12) * FT
CROSS_RIGHT = CROSS_LEFT + 98 * FT
X_EAST_INNER = CROSS_RIGHT + (26 + 8/12) * FT
STAIR_HEAD_X = CX + CW/2 - 1.4
ACCESS_CENTRES = [-z for z in [68.764528, 54.791453, 40.818378, 27.149065, 13.327870, -.341443, -13.555112, -27.224425, -40.321460]]
MAIN_STAIR_HOLES = [(STAIR_HEAD_X - 6.4, STAIR_HEAD_X, y - 1.65, y + 1.65) for y in ACCESS_CENTRES]
WEST_ARCADE_SPANS = [26.5, 19+8/12, 46+2/12, 20, 26+2/12, 43, 26+2/12, 20, 46+2/12, 19+8/12, 26.5]
WEST_ARCADE_Y = [-CL/2]
for span in WEST_ARCADE_SPANS:
    WEST_ARCADE_Y.append(WEST_ARCADE_Y[-1] + span * FT)
NORTH_ARCADE_X = [WEST, X_WEST_INNER, X_WEST_MIDDLE, CROSS_LEFT, CROSS_LEFT + 27.5*FT, CROSS_LEFT + 70.5*FT, CROSS_RIGHT, X_EAST_INNER, CX + CW/2]
LOWER_SPRING = ((367 + 3/12) - 320) * FT
detail = ConcourseDetails(globals())
detail.prism_fields()
detail.perimeter(WEST_ARCADE_Y, NORTH_ARCADE_X, LOWER_SPRING)
report = detail.audit(out/'concourse-detail-audit.json')
bpy.context.view_layer.update()
vertices, faces = [], []
for obj in COL.objects:
    if obj.type != 'MESH' or any('Glass' in m.name for m in obj.data.materials if m):
        continue
    offset = len(vertices)
    vertices.extend(obj.matrix_world @ vertex.co for vertex in obj.data.vertices)
    faces.extend(tuple(offset + i for i in face.vertices) for face in obj.data.polygons)
bvh = BVHTree.FromPolygons(vertices, faces)
blocked = []
for y in np.linspace(-7.5, 7.5, 31):
    for z in [.20, 1.0, 1.68, 2.5, 3.95, 4.04]:
        origin = Vector((CX + CW/2 - 1, float(y), z))
        hit = bvh.ray_cast(origin, Vector((1, 0, 0)), 2)[0]
        if hit:
            blocked.append({'y': float(y), 'z': z, 'hit': list(hit)})
report['retainedPassageActualGeometrySweep'] = {'rays': 31*6, 'blocked': blocked}
report['buildSourceSha256'] = hashlib.sha256(source.read_bytes()).hexdigest()
report['detailModuleSha256'] = hashlib.sha256((source.parent/'concourse_details.py').read_bytes()).hexdigest()
report['scope'] = 'Isolated new-detail layer at Main0; excludes existing station roof, piers, floor and railway. Not a finished station model or a final lighting render.'
(out/'concourse-detail-audit.json').write_text(json.dumps(report, indent=2)+'\n')
if blocked:
    raise RuntimeError('Retained central passage obstructed')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(out/'concourse-detail-layer.glb'), export_format='GLB', use_selection=True, export_yup=True, export_normals=True, export_texcoords=True, export_materials='EXPORT', export_extras=True)
bpy.ops.wm.save_as_mainfile(filepath=str(out/'concourse-detail-layer.blend'), compress=True)
print(json.dumps({'windowCountBySide': report['windowCountBySide'], 'closedSurfaceChecks': len(report['closedSurfaceOrientation']), 'orientationFailures': len(report['orientationFailures']), 'passageRays': 186, 'passageFailures': len(blocked), 'panels': report['vaultLights']['panelCount']}), flush=True)
