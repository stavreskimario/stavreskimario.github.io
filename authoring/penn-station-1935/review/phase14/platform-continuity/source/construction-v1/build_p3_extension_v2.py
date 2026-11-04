from pathlib import Path
import bpy,json,math,hashlib,ast,time
D=Path(__file__).parent;G=D.parent;O=D/'candidate-v2';assert not O.exists();O.mkdir();H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();P=Path('/Users/stavreskimario/Desktop/penn-station-work/phase13-track-enclosure/geometry/construction-v1/candidate-v2/bridge-bay.blend');A=Path('/Users/stavreskimario/Desktop/penn-station-work/phase13-track-enclosure/geometry/construction-v1/candidate-v2/bridge-bay.glb');R=G/'research/FROZEN-P3-BAY-SCOPE-v2.json';scope=json.loads(R.read_text());F=G/'floor-ownership-v1/partition-full.json';parts=json.loads(F.read_text());bpy.ops.wm.open_mainfile(filepath=str(P));scene=bpy.context.scene;original_struct=[o for o in scene.objects if not o.name.startswith('Fresh true receiver ')];assert len(original_struct)==24
for o in list(scene.objects):
 if o.name.startswith('Fresh true receiver '):bpy.data.objects.remove(o,do_unlink=True)
C=bpy.data.collections.new('Phase14 observed P3 permanent bridge bay');scene.collection.children.link(C);M=[bpy.data.materials[n]for n in ['PaintedStructuralIronEighthAvenueBridge','GraniteCapstoneEighthAvenueBridge','StructuralConcreteEighthAvenueBridge','BuriedWaterproofingEighthAvenueBridge']];objects=[];records=[];T=.0127;FT=.01905;CW=.4064+2*FT;TOP=-6.011164;BD=2.1971;LD=1.3335;PLATE=.1016;CAP=-14.023848;X=scope['newRow']['sourceNativeObservations'];xs=[r['authoringWorldX']for r in X];za=scope['retainedBentRows'][-1];zb=scope['newRow']['authoringWorldZ'];BF=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
# Exact accepted authoring helpers; old source objects are never regenerated.
oldbuilder=Path('/Users/stavreskimario/Desktop/penn-station-work/phase13-track-enclosure/geometry/construction-v1/build_enclosure.py');tree=ast.parse(oldbuilder.read_text());defs=[n for n in tree.body if isinstance(n,ast.FunctionDef)and n.name in ['mesh_parts','box','beam']];exec(compile(ast.Module(body=defs,type_ignores=[]),str(oldbuilder),'exec'),globals());assert len(defs)==3

def copy_row(prefix,name,role):
 old=next(o for o in original_struct if o.name.startswith(prefix));new=old.copy();new.data=old.data.copy();new.name=name;C.objects.link(new);new.location.y=-zb
 for mod in new.modifiers:
  if mod.type=='NODES':mod.node_group=mod.node_group.copy();mod.node_group.name=name+' observed11capstations'
 new['source_family']=role;new['source_row_native_u']=615.;new['source_observed_nominal_world_z']=scope['newRow']['observedNominalWorldZ'];new['source_coordination_delta_z']=-.75;new['source_row_qualification']='Observed cap chain retained; adopted row shifted−0.75m to existing platform taper by qualified registration fit, no source-survey or track movement claim.';objects.append(new);records.append({'owner':new.name,'role':role,'sourceMasterOwner':old.name,'actualMasterMeshAndGNFamilyUnchanged':True,'worldZ':zb,'columnStations':11});return new
copy_row('Bridge permanent row B4','Bridge permanent row B5 source P3 built-up Icolumns','Observed PlateLIX next permanent P3 cap chain; accepted built-up Isection/11stations retained')
copy_row('Buried granite and concrete bearings row B4','Buried granite and concrete bearings row B5 P3','Documented buried granite/concrete bearing family, actual adopted P3 receiver; pierdepth/rock surface qualified')

newparts=[]
for a,b in zip(xs,xs[1:]):newparts+=beam('X',a+CW/2,b-CW/2,zb,TOP,BD)
mesh_parts('Permanent bent6 observed P3 face-connected girders',newparts,[round(sum(xs)/len(xs)),round(TOP),round(zb)],'Observed P3 permanent bent; source5ft–7ft2.5in family, retained local depth/thickness schedule')
gx=sorted(set([xs[0]+u*.3048 for u in [0,10/3,20/3,*range(10,91,5),280/3,290/3,100]]));newparts=[]
for x in gx:
 newparts+=beam('Z',za+.2286,zb-.2286,x,TOP,LD)
 for z,sign in [(za,1),(zb,-1)]:
  lo,hi=sorted([z+sign*T/2,z+sign*.2286]);newparts.append(box([x-T/2,TOP-LD+FT,lo],[x+T/2,TOP-FT,hi]))
mesh_parts('Bay5 P3 longitudinal girders and actual connection returns',newparts,[round(sum(xs)/len(xs)),round(TOP),round((za+zb)/2)],'Connected source bayB4–B5; nonuniform7.806m span; accepted5ft/3ft4in crosswidth station family')
newparts=[];n=math.ceil((zb-za)/.18)+1;pitch=(zb-za)/(n-1);assert .1524<=pitch<=.2032
for i in range(1,n):
 # First frame-line plate beam is retained from Bay4; never append its duplicate.
 z=za+i*pitch;newparts+=beam('X',scope['roof']['x'][0],scope['roof']['x'][1],z,TOP+PLATE,PLATE,width=.067,ft=.00635,wt=.005)
mesh_parts('Bay5 P3 embedded4in transverse floorplate beams',newparts,[round(sum(xs)/len(xs)),round(TOP),round((za+zb)/2)],'Source4in beams at6–8in centers; old common B4 line retained once, new line fabrication interpreted')

oldroof=next(o for o in original_struct if o.name.startswith('Documented composite opaque roofplate'));new=oldroof.copy();new.data=oldroof.data.copy();new.name='P3 roof extension from actual old south cover edge';C.objects.link(new);m=new.data;oldSouth=min(v.co.y for v in m.vertices);oldNorth=max(v.co.y for v in m.vertices);originZ=-new.location.y;newSouth=-(zb+.2286-originZ);newNorth=oldSouth
for v in m.vertices:v.co.y=newSouth+(v.co.y-oldSouth)/(oldNorth-oldSouth)*(newNorth-newSouth)
m.update()
for uv in m.uv_layers:
 for p in m.polygons:
  axes=[k for k in range(3)if k!=max(range(3),key=lambda k:abs(p.normal[k]))]
  for li in p.loop_indices:
   co=m.vertices[m.loops[li].vertex_index].co;uv.data[li].uv=(co[axes[0]]/1.5,co[axes[1]]/1.5)
new['source_family']='Exact accepted composite coversection, extension only beyond actual retained roof edge; no opaque gallery walls';objects.append(new);records.append({'owner':new.name,'sourceMasterOwner':oldroof.name,'oldRoofRetainedExact':True,'newNorthLocalY':newNorth,'newSouthLocalY':newSouth,'actualOldRoofSouthWorldZ':originZ-oldSouth,'roofSouthWorldZ':zb+.2286,'role':'Documented embedded floorplate/concrete/waterproof/protectcover family; local schedule retained'})

# Rebuild only the expanded true floor ownership from original authoritative runtime faces.
def material(name,col,rough):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*col,1);p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*col,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=0;return m
for family,name,col,rough in [('Railway smooth concrete track base','RailwayTrackBaseConcreteEnclosure14',(.24,.245,.23),.93),('RailwayPlatformRubbedConcretePhase9','RailwayPlatformRubbedConcreteEnclosure14',(.39,.395,.37),.85),('RailwayPlatformStippledGranolithicPhase9','RailwayPlatformStippledGranolithicEnclosure14',(1,1,1),.87)]:
 m=material(name,col,rough);m['source_family']=family;m['floor_ownership_revision']=14;m['source_uv0_retained']=True
 if 'Stippled' in family:
  bs=m.node_tree.nodes.get('Principled BSDF')
  for fname,slot in [('granolithic-basecolor.png','Base Color'),('granolithic-roughness.png','Roughness'),('granolithic-normal.png','Normal')]:
   matches=[im for im in bpy.data.images if Path(im.filepath).name==fname];assert len(matches)==1,(fname,matches);tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=matches[0];tex.extension='REPEAT'
   if slot=='Normal':
    node=m.node_tree.nodes.new('ShaderNodeNormalMap');node.inputs['Strength'].default_value=1;m.node_tree.links.new(tex.outputs['Color'],node.inputs['Color']);m.node_tree.links.new(node.outputs['Normal'],bs.inputs['Normal'])
   else:m.node_tree.links.new(tex.outputs['Color'],bs.inputs[slot])
 tris=[t for t in parts['ownedTriangles']if t['material']==family];corners=[c for t in tris for c in t['corners']];origin=[-136,-8,20];verts=[(c['pos'][0]-origin[0],-(c['pos'][2]-origin[2]),c['pos'][1]-origin[1])for c in corners];faces=[(i,i+1,i+2)for i in range(0,len(verts),3)];me=bpy.data.meshes.new('Phase14 exact existing '+family);me.from_pydata(verts,[],faces);me.update();me.materials.append(m);uv=me.uv_layers.new(name='UVMap')
 for u,c in zip(uv.data,corners):u.uv=(c['uv0'][0],1-c['uv0'][1])
 for p in me.polygons:p.use_smooth=True
 me.normals_split_custom_set([(c['normal'][0],-c['normal'][2],c['normal'][1])for c in corners]);me.update();o=bpy.data.objects.new('Fresh true receiver '+family,me);C.objects.link(o);o.location=(origin[0],-origin[2],origin[1]);o['source_family']=family;o['no_overlay']=True;objects.append(o);records.append({'owner':o.name,'triangles':len(tris),'role':'Actual expanded P3/P4/P5 receiver floor, original P/N/UV0 copied/interpolated; newGI only','material':m.name})
allobjects=original_struct+objects;assert len(allobjects)==33
for o in scene.objects:o.select_set(o in allobjects)
bpy.context.view_layer.objects.active=allobjects[0];bpy.context.view_layer.update();bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(O/'p3-connected-enclosure.blend'),compress=True);bpy.ops.export_scene.gltf(filepath=str(O/'model-platform-enclosure.glb'),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_extras=True,export_lights=False)
r={'status':'FROZEN source-led firstP3connectedbay and expanded actualfloor receiver; source proofs pending','coordinateSpace':'Main0glTF;worldY=Main0Y−4.2672','oldStructure':{'editable':str(P),'editableSha256':H(P),'raw':str(A),'rawSha256':H(A),'meshOwners':24,'triangles':24996,'retainedOwners':[o.name for o in original_struct]},'newScope':{'path':str(R),'sha256':H(R)},'floorPartition':{'path':str(F),'sha256':H(F),'roi':parts['roi'],'ownedTriangles':600},'sourceObjects':len(allobjects),'newObjects':records,'primaryLamps':0,'columnCount':66,'bentRowsWorldZ':scope['retainedBentRows']+[zb],'sourceCapTopWorldY':CAP,'deepGirderTopWorldY':TOP,'clearanceComparisonWorldY':-8.208264,'floorplatePitchM':pitch,'sourceMaterialFamily':'Accepted dielectric structural paint0/.64/(.18,.19,.17) retained; newfloorSourceUV0/PBRgrain family retained','qualifications':['Exact prior24 structural owners retained, not regenerated or appended twice.','NextP3capchain nearU615 individually observed; subpixel skew not recovered, fitted straight row within stated raster uncertainty.','Only first connected newP3bay is authored here; farther oblique P2/P1 rows remain a separate actual-source trace, not a uniform extrapolation.','Real buried granite/concrete receiver family and adopted vertical schedule retained; no foundation capacity or surveyed rock surface claim.','Old common B4 embedded beam line retained once; newroof begins at actual old south edge, no overlap slab, opaque sidewall, dropped ceiling or new prism infill.','Native walking and mobile/Manhattan/flicker work remain out of scope.'],'outputs':[{'path':str(p),'sha256':H(p),'bytes':p.stat().st_size}for p in[O/'p3-connected-enclosure.blend',O/'model-platform-enclosure.glb']],'builderSha256':H(Path(__file__))};(O/'construction.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'outputs':r['outputs'],'sourceObjects':len(allobjects),'columns':66,'newBaySpanM':zb-za,'floorFragments':600},indent=2),flush=True)
