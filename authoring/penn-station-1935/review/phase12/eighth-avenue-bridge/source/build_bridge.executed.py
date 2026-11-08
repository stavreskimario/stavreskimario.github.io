"""Source-qualified Eighth Avenue TWO-BENT bay. Blender/GN authoring only."""
from pathlib import Path
from collections import Counter
import bpy,math,json,hashlib,time
from mathutils import Vector
D=Path(__file__).resolve().parent;O=D/'candidate-v3';assert not O.exists();O.mkdir();started=time.monotonic()
S=D.parent.parent/'research/FROZEN-DESIGN-SCOPE-v1.json';e=json.loads(S.read_text());scope=e['firstVisibleNewEnclosure'];H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for p in e['sources']:assert H(Path(p['path']))==p['sha256']
bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
C=bpy.data.collections.new('Phase12 documented Eighth Avenue two-bent bay');scene.collection.children.link(C)
X=scope['columnStationsWorldX'];Z=[6.33,13.0];CAP=-14.023848;LOW=-8.208264;BD=2.1971;TOP=LOW+BD;LD=1.3335;PLATE=.1016;T=.0127;FT=.01905;CW=.4064+2*FT
records=[];objects=[]
def mat(name,col,rough,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*col,1);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;m['historical_qualification']='Documented material family; local hue/roughness not measured historic sample.';return m
steel=mat('PaintedStructuralIronEighthAvenueBridge',(.075,.083,.078),.64,.72);granite=mat('GraniteCapstoneEighthAvenueBridge',(.36,.32,.28),.86);concrete=mat('StructuralConcreteEighthAvenueBridge',(.37,.365,.335),.88);waterproof=mat('BuriedWaterproofingEighthAvenueBridge',(.026,.024,.021),.98)
M=[steel,granite,concrete,waterproof];BF=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
def mesh_parts(name,parts,origin,role,gn=False):
 if gn:parts=[([lo[k]+origin[k]for k in range(3)],[hi[k]+origin[k]for k in range(3)],mi)for lo,hi,mi in parts]
 verts=[];faces=[];mi=[]
 for lo,hi,material in parts:
  assert all(hi[i]>lo[i]for i in range(3)),(name,lo,hi)
  n=len(verts)
  for c in[(0,0,0),(1,0,0),(1,1,0),(0,1,0),(0,0,1),(1,0,1),(1,1,1),(0,1,1)]:
   p=[hi[k]if c[k]else lo[k]for k in range(3)];verts.append((p[0]-origin[0],-(p[2]-origin[2]),p[1]-origin[1]))
  faces += [tuple(n+i for i in f)for f in BF];mi += [material]*6
 mesh=bpy.data.meshes.new(name+' mesh');mesh.from_pydata(verts,[],faces);mesh.update()
 for m in M:mesh.materials.append(m)
 uv=mesh.uv_layers.new(name='ArchitecturalUV')
 for p,matIndex in zip(mesh.polygons,mi):
  p.material_index=matIndex;p.use_smooth=False;axes=[k for k in range(3)if k!=max(range(3),key=lambda k:abs(p.normal[k]))]
  for li in p.loop_indices:
   co=mesh.vertices[mesh.loops[li].vertex_index].co;uv.data[li].uv=(co[axes[0]]/1.5,co[axes[1]]/1.5)
 o=bpy.data.objects.new(name,mesh);C.objects.link(o);o.location=(origin[0],-origin[2],origin[1]+4.2672);o['source_family']=role;o['reconstruction_status']='Documented bridge family; local thickness/depth schedule and qualified world registration inferred.';objects.append(o);records.append({'owner':name,'role':role,'sourceParts':len(parts),'sourcePartBoundsWorld':[{'min':a,'max':b,'material':M[k].name}for a,b,k in parts],'originWorld':origin,'geometryNodesRepeated':gn});return o

def repeat22(o):
 g=bpy.data.node_groups.new(o.name+' documented10ft x2bents','GeometryNodeTree');g.interface.new_socket(name='Geometry',in_out='INPUT',socket_type='NodeSocketGeometry');g.interface.new_socket(name='Geometry',in_out='OUTPUT',socket_type='NodeSocketGeometry');n=g.nodes;l=g.links;gi=n.new('NodeGroupInput');go=n.new('NodeGroupOutput')
 line=n.new('GeometryNodeMeshLine');line.mode='OFFSET';line.inputs['Count'].default_value=11;line.inputs['Start Location'].default_value=(0,0,0);line.inputs['Offset'].default_value=(3.048,0,0)
 inst=n.new('GeometryNodeInstanceOnPoints');l.new(line.outputs['Mesh'],inst.inputs['Points']);l.new(gi.outputs['Geometry'],inst.inputs['Instance']);real=n.new('GeometryNodeRealizeInstances');l.new(inst.outputs['Instances'],real.inputs['Geometry'])
 rows=n.new('GeometryNodeMeshLine');rows.mode='OFFSET';rows.inputs['Count'].default_value=2;rows.inputs['Start Location'].default_value=(0,0,0);rows.inputs['Offset'].default_value=(0,-6.67,0)
 inst2=n.new('GeometryNodeInstanceOnPoints');l.new(rows.outputs['Mesh'],inst2.inputs['Points']);l.new(real.outputs['Geometry'],inst2.inputs['Instance']);out=n.new('GeometryNodeRealizeInstances');l.new(inst2.outputs['Instances'],out.inputs['Geometry']);l.new(out.outputs['Geometry'],go.inputs['Geometry']);mod=o.modifiers.new('Documented eleven10ft stations ×two permanent rows','NODES');mod.node_group=g

def box(lo,hi,m=0):return(lo,hi,m)
def beam(axis,a,b,center,top,depth,width=.3556,ft=FT,wt=T):
 # Closed built-up web and two cover/flange plates, mating interfaces are opposed.
 if axis=='X':return[box([a,top-depth+ft,center-wt/2],[b,top-ft,center+wt/2]),box([a,top-depth,center-width/2],[b,top-depth+ft,center+width/2]),box([a,top-ft,center-width/2],[b,top,center+width/2])]
 return[box([center-wt/2,top-depth+ft,a],[center+wt/2,top-ft,b]),box([center-width/2,top-depth,a],[center+width/2,top-depth+ft,b]),box([center-width/2,top-ft,a],[center+width/2,top,b])]
# Source buried cut-granite capstone datum; no invented above-platform pedestal.
col=[box([-.2032,0,-T/2],[.2032,TOP-CAP,T/2])]
for sign in[-1,1]:
 x0=sign*.2032
 col.append(box([x0-FT if sign<0 else x0,0,-.2286],[x0 if sign<0 else x0+FT,TOP-CAP,.2286]))
 # Four8x6in flangeL's: visible built-up angle legs, plate thickness inferred.
 for side in[-1,1]:
  za=side*T/2;zb=side*(T/2+.2032);xmin=x0 if sign<0 else x0-.1524;xmax=x0+.1524 if sign<0 else x0
  col.append(box([xmin,0,min(za,za+side*T)],[xmax,TOP-CAP,max(za,za+side*T)]))
  xlo=x0 if sign<0 else x0-T;xhi=x0+T if sign<0 else x0
  col.append(box([xlo,0,min(za,zb)],[xhi,TOP-CAP,max(za,zb)]))
col.append(box([-.3048,0,-.3048],[.3048,.0254,.3048]))
# Two1.5in fox-bolt shanks,12in long, interpreted square/hex fitting detail.
for x in[-.1651,.1651]:col += [box([x-.01905,-.3048,-.01905],[x+.01905,.0381,.01905]),box([x-.03175,.0254,-.03175],[x+.03175,.0508,.03175])]
o=mesh_parts('Bridge11station built-upIcolumns ×two sourcebents',col,[X[0],CAP,Z[0]],'Francis163:16inweb,four8×6inangles,18incoverplates;2foxbolts; plate thickness inferred',True);repeat22(o)
found=[box([-.4572,-.3048,-.4572],[.4572,0,.4572],1),box([-.6096,-1.2192,-.6096],[.6096,-.3048,.6096],2)]
o=mesh_parts('Buried granite capstones and concrete piers ×22',found,[X[0],CAP,Z[0]],'PlateLIXcapstopEl287; granite/concrete sourcefamily; localpierdepth/rocksurface inferred',True);repeat22(o)
# Face-connected bentgirders between every pair ofcolumnfaces.
for zi,z in enumerate(Z,1):
 parts=[]
 for xa,xb in zip(X,X[1:]):parts += beam('X',xa+CW/2,xb-CW/2,z,TOP,BD)
 mesh_parts(f'Permanent bent{zi} deep face-connected girders',parts,[round((X[0]+X[-1])/2),round(TOP),round(z)],'Francis163 deepbent5ft–7ft2.5in; selected7ft2.5in local schedule inferred')
# Longitudinalgirders:3ft4inouter10ftbays,5ftinternalbays.
xs=sorted(set([X[0]+u*.3048 for u in [0,10/3,20/3,*range(10,91,5),280/3,290/3,100]]));parts=[]
for x in xs:
 parts += beam('Z',Z[0]+.2286,Z[1]-.2286,x,TOP,LD)
 for z,sign in[(Z[0],1),(Z[1],-1)]:
  lo,hi=sorted([z+sign*T/2,z+sign*.2286]);parts.append(box([x-T/2,TOP-LD+FT,lo],[x+T/2,TOP-FT,hi]))
mesh_parts('Longitudinal girder field with actual web connection returns',parts,[round(sum(X)/len(X)),round(TOP),round(sum(Z)/2)],'Francis163 N-Sgirders; outer3ft4in/internal5ft spacing; selected4ft4.5in depth inferred')
#4intransversebeams embedded ingrouted concrete; every sixth rowstaggered atsourcegirder stations.
roof=[];n=38;pitch=(Z[1]-Z[0])/(n-1)
for i in range(n):
 z=Z[0]+i*pitch
 #Fullwidthbeam spans≥3longitudinalmembers; inferred jointseams do not alter bearing.
 roof += beam('X',scope['outerOverallWorldX'][0],scope['outerOverallWorldX'][1],z,TOP+PLATE,PLATE,width=.067,ft=.00635,wt=.005)
mesh_parts('4in transverse floorplate Ibeams embedded in concrete',roof,[round(sum(X)/len(X)),round(TOP),round(sum(Z)/2)],'Francis1634inbeams6–8incenters,span≥3girders; chosenpitch/jointfabrication inferred')
xa,xb=scope['outerOverallWorldX'];plateBottom=TOP-.0127;plateTop=TOP+PLATE
cover=[box([xa,plateBottom,Z[0]-.2286],[xb,plateTop,Z[1]+.2286],2),box([xa,plateTop,Z[0]-.2286],[xb,plateTop+.002,Z[1]+.2286],3),box([xa,plateTop+.002,Z[0]-.2286],[xb,plateTop+.1036,Z[1]+.2286],2)]
mesh_parts('Documented composite opaque roofplate and waterproof protective cover',cover,[round((xa+xb)/2),round(TOP),round(sum(Z)/2)],'Francis163/158concrete embeddedIbeamfloorplate+waterproofing/protectcover; local12.7mmgrout/4inprotectcover inferred')
# Leave allordinarygallery/stair/track/roadtransport sources untouched.
for o in scene.objects:o.select_set(o in objects)
bpy.context.view_layer.objects.active=objects[0];bpy.context.view_layer.update();bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(O/'bridge-bay.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(O/'bridge-bay.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True,export_lights=False)
report={'status':'FROZEN source-qualified first two-bent Eighth Avenue bay; no fullbridge/sidewall claim','sourceScope':{'path':str(S),'sha256':H(S)},'coordinateSpace':'Main0glTF;worldY=Main0Y−4.2672; BlenderX east/Y north/Zup','sourceWorldBounds':{'x':scope['outerOverallWorldX'],'z':[Z[0]-.2286,Z[1]+.2286],'y':[CAP-1.2192,plateTop+.1036]},'bentRowsWorldZ':Z,'columnStationsWorldX':X,'columnCount':22,'sourceCapTopWorldY':CAP,'clearanceComparisonWorldY':LOW,'lowestFramingWorldY':LOW,'deepGirderTopWorldY':TOP,'concreteRoofBottomWorldY':plateBottom,'floorplateBeamPitchM':pitch,'longitudinalGirderStationsWorldX':xs,'realReceiverEvidence':{'path':str(D.parent/'audit-v1/bridge-bearing-train-fit.json'),'sha256':H(D.parent/'audit-v1/bridge-bearing-train-fit.json')},'memberObjects':records,'sourceProfileDimensionsVerified':scope['verifiedProfileFamilies'],'qualification':['One boundedtwo-bentbay only; no whole525ftbridge or ordinarygalleryenclosure claim.','Source306.08 isunder-clearanceline, notroofslabunderside. Deepframing chosenaboveatthatline; topsfollowdocumenteddepthranges.','SourcecapstopEl287buriedbelowplatform/rail; noaboveplatformstoneplinths. Concretepierdepthandrocksurfacehereinferred; steelcolumnsintersectactualretainedplatform/trackbase atall22receiverstations.','Steelplate/anglethicknesses,roofgroutcover,materialhue,localdepthschedule,minorfastener/jointfabrication inferred.','Existingfirst8arrivalstairs, rails,platforms,objects,UVs,normals,navigation/transports untouched.','Noarbitrarysidewall,blackportal,droppedceilingor8mconcretebox. Sourcebackfillaboveprotectcover isnotmodeledinthisboundedstructuralbay.','All4inbeams fullbaywidthspanatleast3girders; sourcejointstaggerpatternnotfullyrecoveredandnotclaimedexact.'],'outputs':{p.name:{'path':str(p),'sha256':H(p),'bytes':p.stat().st_size}for p in[O/'bridge-bay.blend',O/'bridge-bay.glb']},'geometryNodes':'Two-stage11×2MeshLine/InstanceOnPoints/RealizeInstances; editablecolumn/capstone mastermesh; deterministic sourcepointspacing','elapsedSeconds':time.monotonic()-started,'builderSha256':H(Path(__file__))}
(O/'construction.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'outputs':report['outputs'],'objects':len(records),'columnCount':22,'elapsedSeconds':report['elapsedSeconds']},indent=2),flush=True)
