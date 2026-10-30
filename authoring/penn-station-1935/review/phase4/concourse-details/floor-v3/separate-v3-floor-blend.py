"""Material-role-only edit of a new output copy; geometry input is immutable."""
from pathlib import Path
import hashlib,json
import bpy
from mathutils import Vector
work=Path('/Users/stavreskimario/Desktop/penn-station-work')
source=work/'phase4-core-floor-v3/penn-station-study.blend'
out=work/'phase4-core-floor-v3-ready'
out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(source))
old=bpy.data.materials['ConcourseReinforcedVaultLightConcrete']
new=old.copy();new.name='ConcourseOpaqueCirculationConcrete'
new['source_identity']='Retained opaque circulation and bearing slab around documented vault lights; surface finish reconstructed.'
new['lighting_atlas_role']='Large opaque floor and bearing surrounds retain baked global illumination; distinct from repeated fine panel webs.'
changed=[]
for obj in bpy.data.objects:
 if obj.type!='MESH' or old not in list(obj.data.materials):continue
 points=[obj.matrix_world@Vector(c) for c in obj.bound_box]
 if max(v.x for v in points)-min(v.x for v in points)>10 and max(v.y for v in points)-min(v.y for v in points)>10:
  for i,material in enumerate(obj.data.materials):
   if material==old:obj.data.materials[i]=new
  changed.append(obj.name)
if len(changed)!=1:raise RuntimeError('Expected one large opaque floor mesh')
bpy.context.preferences.filepaths.save_version=0
target=out/'penn-station-study.blend'
bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
report={'scope':'Separate saved-scene material-role edit only. Geometry and its original exported source are preserved.','inputBlendSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'outputBlendSha256':hashlib.sha256(target.read_bytes()).hexdigest(),'changedObjects':changed,'opaqueMaterial':new.name,'repeatedWebMaterial':old.name}
(out/'floor-blend-material-separation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report),flush=True)
