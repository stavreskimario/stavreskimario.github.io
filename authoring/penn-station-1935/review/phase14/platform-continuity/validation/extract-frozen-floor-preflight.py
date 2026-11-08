from pathlib import Path
import bpy,json,hashlib,math
D=Path(__file__).parent;P=Path('/Users/stavreskimario/Desktop/penn-station-work/phase14-platform-continuity/integration/floor-uv-v1/independent-floor-prebake-scene.blend');H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();before=H(P);assert before=='4540f65f8329d9ce677323d647bdc62eb0f344a90f585cd526888c55a3b0ce02'
bpy.ops.wm.open_mainfile(filepath=str(P));o=bpy.data.objects['Continuity exact original floor receivers'];m=o.data;m.calc_loop_triangles();rows=[];layer=m.uv_layers['BakedLightingUV']
for t in m.loop_triangles:
 points=[(o.matrix_world@m.vertices[i].co)for i in t.vertices];normal=(points[1]-points[0]).cross(points[2]-points[0]).normalized();name=m.materials[t.material_index].name
 # Blenderworldup=Z; convert toMain0glTF[x,z,-y] for independentJS.
 rows.append({'material':name,'worldMain0Points':[[p.x,p.z,-p.y]for p in points],'geometricNormalWorld':[normal.x,normal.z,-normal.y],'uv1':[[layer.data[l].uv.x,1-layer.data[l].uv.y]for l in t.loops],'uv0':[[m.uv_layers[0].data[l].uv.x,1-m.uv_layers[0].data[l].uv.y]for l in t.loops]})
assert len(rows)==600;assert H(P)==before
r={'status':'FROZEN_SCENE_CPU_EXTRACTION_NO_GPU_NO_SAVE','scene':{'path':str(P),'sha256':before},'object':o.name,'uvLayer':layer.name,'triangles':rows,'plannedLightingResolution':[4096,4096],'basis':'Actual evaluatedobjectworldpositions andactualnewlightUV; Blender[x,y,z]→Main0glTF[x,z,-y]. Vflip preserves Jacobian singular values.'};q=D/'prepared-floor-loop-extraction.json';q.write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'scene':r['scene'],'object':o.name,'triangles':len(rows),'upwardStippledTriangles':sum('StippledGranolithic'in t['material']and t['geometricNormalWorld'][1]>.95 for t in rows),'extractionSHA256':H(q)}),flush=True)
