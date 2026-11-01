"""Connected loggia/vestibule, executed by the external Blender authoring job.

Primary plan/photo relationships; fine profiles and hidden bearing inferred.
All geometry is world street0. Source Main arch/jambs/public stairs stay exact.
"""
from mathutils.geometry import tessellate_polygon

extension_records=[];walkable_additions=[];repair_materials={}
def profile_prism(name,profile,a0,a1,mat,axis='X'):
 pts=[]
 for p in profile:
  q=tuple(map(float,p))
  if not pts or math.dist(q,pts[-1])>1e-7:pts.append(q)
 if math.dist(pts[0],pts[-1])<1e-7:pts.pop()
 # Collinear cap vertices can create zero-area ear triangles.
 change=True
 while change and len(pts)>3:
  change=False
  for i in range(len(pts)):
   p,q,r=pts[i-1],pts[i],pts[(i+1)%len(pts)]
   if abs((q[0]-p[0])*(r[1]-q[1])-(q[1]-p[1])*(r[0]-q[0]))<1e-10:
    pts.pop(i);change=True;break
 pp=[Vector((u,z,0))for u,z in pts];cap=[tuple(int(q)for q in t)for t in tessellate_polygon([pp])];n=len(pp)
 v=[(a,u,z)if axis=='X'else(u,a,z)for a in [a0,a1]for u,z in pts]
 f=cap+[tuple(n+i for i in reversed(t))for t in cap]+[((i+1)%n,i,i+n,(i+1)%n+n)for i in range(n)]
 return mesh(name,v,f,mat)

# Preserve the actual Main-room stone arch and its jambs. The old flat
# backing and superficial ashlar cut across its opening and are the blockers.
PORTAL_SPRING=10.5328;PORTAL_R=6.3374
def clear_h(y):
 return PORTAL_SPRING+math.sqrt(max(0,PORTAL_R**2-y*y))if abs(y)<=PORTAL_R else -100.
for c in connected['components']:
 repair_start=len(objects)
 lo,hi=c['boundsBlenderWorld'];role=c['role'];oldmat=c['materialNames'][0]
 if oldmat not in repair_materials:
  mat=bpy.data.materials[oldmat].copy();mat.name=oldmat+'ArcadeRepairPhase9';mat['source_material_identity']=oldmat;mat['surface_source_name']=oldmat;repair_materials[oldmat]=mat
 mat=repair_materials[oldmat]
 if role.startswith('replace-flat-'):
  yl=max(lo[1],-PORTAL_R);yr=min(hi[1],PORTAL_R)
  samples=np.linspace(math.asin(yl/PORTAL_R),math.asin(yr/PORTAL_R),97)
  profile=[(PORTAL_R*math.sin(t),PORTAL_SPRING+PORTAL_R*math.cos(t))for t in samples]
  profile += [(yr,hi[2]),(yl,hi[2])]
  profile_prism('Loggia matched curved backing above retained Main arch',profile,lo[0],hi[0],mat)
  if role=='replace-flat-main-axial-backing-with-matched-arch':
   # Actual source face backing ends at16.535 while the exterior curved
   # backing begins16.5608. Bridge that measured26mm slit, continuing to
   # the Main backing at16.565, with the identical clear arch profile.
   profile_prism('Loggia actual arched reveal bridge from face to backing',profile,16.535,16.565,mat)
   extension_records.append({'role':'measured portal reveal closure','worldX':[16.535,16.565],'sourceFaces':'clipped original ashlar back16.535, Exterior backing front16.5608, Main backing front16.565','clearOpeningUnchanged':True,'newFoundationAdded':False})
  for aa,bb in [(lo[1],yl),(yr,hi[1])]:
   if bb-aa>1e-6:box('Loggia retained backing side strip',((lo[0]+hi[0])/2,(aa+bb)/2,(lo[2]+hi[2])/2),(hi[0]-lo[0],bb-aa,hi[2]-lo[2]),mat)
  extension_records.append({'role':role,'oldObject':c['object'],'oldOrdinal':c['componentOrdinal'],'clearanceRadius':PORTAL_R,'retainedArch722Unchanged':True})
 elif role=='clip-ashlar-face-to-real-arch-opening':
  aa,bb=lo[1],hi[1];cuts=[aa,bb]
  for zz in [lo[2],hi[2]]:
   if PORTAL_SPRING<zz<PORTAL_SPRING+PORTAL_R:
    yy=math.sqrt(PORTAL_R**2-(zz-PORTAL_SPRING)**2);cuts += [-yy,yy]
  cuts += [-PORTAL_R,PORTAL_R,0]
  cuts=sorted({max(aa,min(bb,x))for x in cuts})
  for u,v in zip(cuts,cuts[1:]):
   if v-u<1e-6:continue
   if clear_h((u+v)/2)>=hi[2]-1e-6:continue
   floor=lambda y:max(lo[2],clear_h(y))
   yy=np.linspace(u,v,17)if abs((u+v)/2)<PORTAL_R and clear_h((u+v)/2)>lo[2]else[u,v]
   pp=[(y,min(hi[2],floor(y)))for y in yy]+[(v,hi[2]),(u,hi[2])]
   profile_prism('Loggia clipped source ashlar outside true portal',pp,lo[0],hi[0],mat)
 elif role=='local-foundation-top-rebate-under-added-floor-strips':
  rectangles=connected['floorRebateRects'];xx=sorted({lo[0],hi[0],*[max(lo[0],min(hi[0],r[k]))for r in rectangles for k in [0,1]]});yy=sorted({lo[1],hi[1],*[max(lo[1],min(hi[1],r[k]))for r in rectangles for k in [2,3]]})
  for xa,xb in zip(xx,xx[1:]):
   for ya,yb in zip(yy,yy[1:]):
    if xb-xa<1e-6 or yb-ya<1e-6:continue
    cx,cy=(xa+xb)/2,(ya+yb)/2;rebate=any(r[0]<=cx<=r[1]and r[2]<=cy<=r[3]for r in rectangles);top=-.18 if rebate else hi[2]
    box('Loggia vestibule local footing with finish rebate'if rebate else'Loggia vestibule protected footing remainder',(cx,cy,(lo[2]+top)/2),(xb-xa,yb-ya,top-lo[2]),mat)
 # Preserve the original component's primary UV basis on repaired pieces.
 # Existing protected source data and all of its UV layers remain untouched.
 control=source_primary_uv[(c['object'],c['componentOrdinal'])];exact_count=0;new_count=0
 for o in objects[repair_start:]:
  uv=o.data.uv_layers[0]
  for face in o.data.polygons:
   axis=max(range(3),key=lambda i:abs(face.normal[i]));key=(axis,1 if face.normal[axis]>=0 else -1);plane=control['planes'].get(key,control['planes'].get((axis,-key[1])))
   assert plane is not None,(c['object'],c['componentOrdinal'],key)
   for li in face.loop_indices:
    w=o.data.vertices[o.data.loops[li].vertex_index].co;lookup=(key,tuple(np.asarray(w,dtype=np.float32)))
    if lookup in control['exact']:uv.data[li].uv=control['exact'][lookup];exact_count+=1
    else:
     axes=plane['axes'];uv.data[li].uv=np.array([w[axes[0]],w[axes[1]],1.])@plane['coefficients'];new_count+=1
  if control['surfaceRevision']is not None:o['penn_surface_revision']=control['surfaceRevision'];o.data['penn_surface_revision']=control['surfaceRevision']
 extension_records.append({'role':'repair primary UV inheritance','oldObject':c['object'],'oldOrdinal':c['componentOrdinal'],'identicalCornerUvsCopiedExactly':exact_count,'newBoundaryCornersInterpolatedInOriginalBasis':new_count,'inheritedSurfaceRevision':control['surfaceRevision']})

def add_walkable(o,label,bounds,source):
 x0,x1,y0,y1=bounds;gltf=[x0,x1,-y1,-y0]
 if o is not None:
  o['walkable_bounds']=gltf;o['walkable_floor']=0.;o['walkable_frame']='gltf-world-street0-xz';o['walkable_source']=source
 walkable_additions.append({'label':label,'bounds':gltf,'floor':0.,'frame':'gltf-world-street0-xz','blenderBounds':bounds,'source':source,'existingMeshUntouched':o is None})
add_walkable(None,'Existing street-level loggia landing',[24.9,32.71,-7.75,7.75],'Exact retained canonical PublicFloorMarble component12 bounds; no existing field or mesh change.')

def lathe(name,cx,cy,profile,mat,N=64):
 v=[(cx+r*math.cos(2*math.pi*i/N),cy+r*math.sin(2*math.pi*i/N),z)for z,r in profile for i in range(N)]
 f=[tuple(range(N-1,-1,-1)),tuple((len(profile)-1)*N+i for i in range(N))]
 for j in range(len(profile)-1):
  for i in range(N):a=j*N+i;b=j*N+(i+1)%N;f.append((a,b,b+N,a+N))
 o=mesh(name,v,f,mat,True)
 for p in o.data.polygons:p.use_smooth=p.index>=2
 return o
def tube(name,points,r,mat,N=10):
 points=[Vector(p)for p in points];v=[]
 for i,p in enumerate(points):
  t=(points[min(i+1,len(points)-1)]-points[max(0,i-1)]).normalized();ref=Vector((1,0,0))if abs(t.x)<.85 else Vector((0,1,0));u=t.cross(ref).normalized();w=t.cross(u)
  v += [tuple(p+r*(u*math.cos(2*math.pi*j/N)+w*math.sin(2*math.pi*j/N)))for j in range(N)]
 f=[tuple(range(N-1,-1,-1)),tuple((len(points)-1)*N+j for j in range(N))]
 for i in range(len(points)-1):
  for j in range(N):a=i*N+j;b=i*N+(j+1)%N;f.append((a,b,b+N,a+N))
 return mesh(name,v,f,mat,True)
def ionic_column(cx,cy,orientation='X',label='loggia screen'):
 # The order's broad relationships come from 071930; minute profiles are
 # reconstructed. Solid overlapping pedestal/base/shaft/capital contacts.
 paired=label=='paired axial screen'
 box('Loggia '+label+' Ionic pedestal between bearing courses',(cx,cy,.36),(1.46 if paired else 1.65,1.65,.48),STONE)
 for za,zb,w in [(.0,.12,1.78),(.60,.72,1.72),(.72,.80,1.55)]:box('Loggia Ionic pedestal rooted moulding',(cx,cy,(za+zb)/2),(min(1.55,w)if paired else w,w,zb-za),STONE)
 profile=[(.79,.74),(.85,.77),(.91,.73),(.95,.61),(1.0,.58),(1.05,.64),(1.11,.63),(1.16,.54)]
 lathe('Loggia Ionic torus and scotia base',cx,cy,profile,STONE)
 shaft=[]
 for t in np.linspace(0,1,29):shaft.append((1.15+t*(7.78-1.15),.535-.072*t+.027*math.sin(math.pi*t)))
 lathe('Loggia Ionic shaft with restrained entasis',cx,cy,shaft,STONE,80)
 lathe('Loggia Ionic neck and echinus',cx,cy,[(7.74,.468),(7.82,.48),(7.86,.55),(7.94,.64),(8.02,.71),(8.10,.72),(8.17,.66)],STONE)
 # Body supports the volutes and their low relief egg ornament.
 dims=(1.12,1.55,.33)if orientation=='X'else(1.55,1.12,.33)
 box('Loggia Ionic capital continuous volute bearing',(cx,cy,8.13),dims,STONE)
 for za,zb,w in [(8.27,8.40,1.62),(8.40,8.53,1.72),(8.53,8.72,1.65)]:box('Loggia Ionic square abacus',(cx,cy,(za+zb)/2),(min(1.48,w)if paired else w,w,zb-za),STONE)
 for face in [-1,1]:
  for side in [-1,1]:
   pp=[]
   for t in np.linspace(0,1,97):
    ang=-math.pi/2+t*math.pi*4.6;rr=.255*(1-t)+.043;u=side*.61+rr*math.cos(ang);z=8.12+rr*math.sin(ang)
    pp.append((cx+face*.555,cy+u,z)if orientation=='X'else(cx+u,cy+face*.555,z))
   tube('Loggia Ionic attached spiral volute',pp,.043,STONE)
 # Shallow eggs are rooted in the echinus, not floating decorative beads.
 for k in range(16):
  ang=k*math.pi/8;rr=.665;center=(cx+rr*math.cos(ang),cy+rr*math.sin(ang),7.98)
  lathe('Loggia Ionic rooted echinus egg',center[0],center[1],[(7.89,.016),(7.93,.045),(8.00,.048),(8.05,.027)],STONE,12)
 contacts.append({'role':'new Ionic column','position':[cx,cy,0],'abacusTop':8.72,'support':'retained landing or new rebated finish slab and actual continuous footing','orientation':orientation})

def order_beam(name,x0,x1,y0,y1):
 for za,zb,proj in [(8.72,8.94,0),(8.94,9.55,-.06),(9.55,9.68,.06),(9.68,10.75,-.04),(10.75,11.02,.08),(11.02,11.15,.13)]:
  box(name,((x0+x1)/2,(y0+y1)/2,(za+zb)/2),(x1-x0+proj*2,y1-y0+proj*2,zb-za),STONE)

def roof_grid(name,x0,x1,y0,y1,height,NX=80,NY=96):
 xs=np.linspace(x0,x1,NX+1);ys=np.linspace(y0,y1,NY+1);v=[]
 for dz in [0,.18]:
  v.extend((float(x),float(y),height(float(x),float(y))+dz)for x in xs for y in ys)
 n=(NX+1)*(NY+1);f=[]
 for i in range(NX):
  for j in range(NY):a=i*(NY+1)+j;b=a+NY+1;f.extend([(a,a+1,b+1,b),(a+n,b+n,b+n+1,a+n+1)])
 per=list(range(NY+1))+[i*(NY+1)+NY for i in range(1,NX+1)]+list(range(NX*(NY+1)+NY-1,NX*(NY+1)-1,-1))+[i*(NY+1)for i in range(NX-1,0,-1)]
 f += [(b,a,a+n,b+n)for a,b in zip(per,per[1:]+per[:1])]
 o=mesh(name,v,f,VAULT,True);ns=[]
 for p in o.data.polygons:
  p.use_smooth=p.index<NX*NY*2
  for li in p.loop_indices:
   vi=o.data.loops[li].vertex_index;x,y,z=o.data.vertices[vi].co
   if p.index>=NX*NY*2:q=p.normal.copy()
   else:
    e=1e-4;hx=(height(x+e,y)-height(x-e,y))/(2*e);hy=(height(x,y+e)-height(x,y-e))/(2*e);q=Vector((hx,hy,-1)).normalized()
    if vi>=n:q=-q
   ns.append(tuple(q))
 o.data.normals_split_custom_set(ns);return o

# Full connection around the retained grand stair. Its private bearing ledge
# gives the new wall a real base; public treads, cheeks and slabs are untouched.
for sign in [-1,1]:
 box('Loggia stair return continuous bearing ledge',((18.1356+24.9)/2,sign*7.04,-4.4172),(24.9-18.1356,2.08,.30),STONE)
 xlo,xhi=18.1356,24.9;plan=[(xlo,sign*6.0198),(xhi,sign*7.75),(xhi,sign*8.15),(xlo,sign*6.4198)]
 pp=[Vector((x,y,0))for x,y in plan];tri=[tuple(int(q)for q in t)for t in tessellate_polygon([pp])];n=len(pp)
 vv=[(x,y,z)for z in [-4.2672,18.9224]for x,y in plan];ff=tri+[tuple(n+i for i in reversed(t))for t in tri]+[((i+1)%n,i,i+n,(i+1)%n+n)for i in range(n)]
 mesh('Loggia grand-stair continuous widening side return',vv,ff,STONE)
 # S1PDF33 shows a niche beside this stair, but its exact location and any
 # counterpart inventory remain unregistered. No symmetric niche set invented.

def stair_roof(x,y):
 t=max(0,min(1,(x-18.1356)/(24.9-18.1356)));rr=PORTAL_R*(1-t)+R*t;sp=PORTAL_SPRING*(1-t)+SPRING*t
 return sp+math.sqrt(max(0,rr*rr-y*y))
roof_grid('Loggia connected grand-stair barrel transition',18.1356,24.9,-7.75,7.75,stair_roof,52,96)

LX0,LX1=24.9,32.71;LC=(LX0+LX1)/2;LR=(LX1-LX0)/2
def loggia_roof(x,y):
 main=main_h(x,y)if abs(y)<=R else SPRING
 cross=SPRING+R*math.sqrt(max(0,1-((x-LC)/LR)**2))
 return max(main,cross)
roof_grid('Loggia continuous intersecting vault and restaurant bay ceiling',LX0,LX1,-14.2,14.2,loggia_roof,80,128)
for sign in [-1,1]:
 for x in [26.55,29.95]:ionic_column(x,sign*7.36,'Y','restaurant entrance')
 # Backed restaurant entrance bays, not invented full dining-room interiors.
 slab=box('Loggia restaurant entrance added marble slab',(LC,sign*(7.75+14)/2,-.09),(LX1-LX0,14-7.75,.18),FLOOR)
 ya,yb=sorted([sign*7.75,sign*14]);add_walkable(slab,'Loggia restaurant entrance bay',[LX0,LX1,ya,yb],'S2 plate300 / S1PDF33 documented restaurant entrance relationship; actual finite new floor bounds, backing depth interpreted, minor threshold steps held.')
 box('Loggia restaurant entrance solid backing',(LC,sign*14.0,9.45),(LX1-LX0+.4,.4,18.9),STONE)
 for x in [LX0,LX1]:box('Loggia restaurant entrance side backing',(x,sign*(7.75+14.0)/2,9.45),(.4,14.0-7.75,18.9),STONE)
 # Central door recess and side timber panel family are not tenant fittings.
 box('Loggia restaurant backing recessed door leaf',(LC,sign*13.78,1.8),(2.4,.09,3.6),BRONZE)
 for x in [LC-1.3,LC+1.3]:box('Loggia restaurant doorway stone reveal',(x,sign*13.70,1.9),(.18,.23,3.8),STONE)
 box('Loggia restaurant doorway lintel',(LC,sign*13.70,3.85),(2.78,.23,.20),STONE)
 order_beam('Loggia restaurant Ionic supported entablature',LX0,LX1,min(sign*6.86,sign*8.05),max(sign*6.86,sign*8.05))
 # Corner masonry meets the arcade walls and makes the side openings finite.
 for x in [LX0,LX1]:box('Loggia grounded corner pier',(x,sign*7.20,4.36),(.82,1.10,8.72),STONE)
 box('Loggia formal-junction upper side closure',(LX1-.10,sign*(WALL+7.75)/2,(SPRING+18.9224)/2),(.20,7.75-WALL,18.9224-SPRING),STONE)

for x in connected['screenControls']['pairedX']:
 for y in connected['screenControls']['pairedY']:ionic_column(x,y,'X','paired axial screen')
order_beam('Loggia four-Ionic-column axial screen entablature',29.56,32.71,-7.75,7.75)
# A genuine transverse terminal arch joins the plain longitudinal barrel.
def ring_x(name,x0,x1,cy,cz,inner,outer,mat):
 tt=np.linspace(0,math.pi,145);v=[]
 for x in [x0,x1]:
  for rr in [inner,outer]:v += [(x,cy+rr*math.cos(t),cz+rr*math.sin(t))for t in tt]
 n=len(tt);f=[]
 for j in range(n-1):f.extend([(j,j+1,n+j+1,n+j),(2*n+j,3*n+j,3*n+j+1,2*n+j+1),(j,2*n+j,2*n+j+1,j+1),(n+j,n+j+1,3*n+j+1,3*n+j)])
 f += [(0,n,3*n,2*n),(n-1,3*n-1,4*n-1,2*n-1)]
 o=mesh(name,v,f,mat,True);normals=[]
 for p in o.data.polygons:
  kind=p.index%4 if p.index<4*(n-1)else -1;p.use_smooth=kind in [2,3]
  for li in p.loop_indices:
   vi=o.data.loops[li].vertex_index;x,y,z=o.data.vertices[vi].co
   if kind in [2,3]:q=Vector((0,y-cy,z-cz)).normalized();q=-q if kind==2 else q
   else:q=p.normal.copy()
   normals.append(tuple(q))
 o.data.normals_split_custom_set(normals);return o
ring_x('Loggia terminal transverse stone archivolt',32.31,32.71,0,SPRING,R-.20,R,STONE)
def terminal_sail():
 # 071930 reads as a continuous recessed opaque sail inside this archivolt,
 # not a second Main-room portal visible above the screen. Exact recess and
 # compound curvature are a qualified reconstruction of that photographed field.
 NR,NT=36,112;front=32.31;depth=.80;thick=.18;v=[]
 for layer in [0,1]:
  v.append((front-layer*thick,0,SPRING))
  for ri in range(1,NR+1):
   rr=R*ri/NR
   for t in np.linspace(0,math.pi,NT+1):
    y=rr*math.cos(t);zz=rr*math.sin(t);recess=2.598076211*depth*(zz/R)*(1-rr*rr/(R*R))
    v.append((front-recess-layer*thick,y,SPRING+zz))
 n=1+NR*(NT+1);f=[]
 for j in range(NT):f.append((0,1+j,2+j))
 for ri in range(NR-1):
  a=1+ri*(NT+1);b=a+NT+1
  for j in range(NT):f.append((a+j,b+j,b+j+1,a+j+1))
 front_count=len(f);f += [tuple(n+i for i in reversed(t))for t in f.copy()]
 per=[0]+[1+ri*(NT+1)for ri in range(NR)]+[1+(NR-1)*(NT+1)+j for j in range(1,NT+1)]+[1+ri*(NT+1)+NT for ri in range(NR-2,-1,-1)]
 f += [(b,a,a+n,b+n)for a,b in zip(per,per[1:]+per[:1])]
 o=mesh('Loggia source-photo recessed opaque terminal sail',v,f,VAULT,True);normals=[]
 for p in o.data.polygons:
  p.use_smooth=p.index<2*front_count
  for li in p.loop_indices:
   vi=o.data.loops[li].vertex_index;x,y,z=o.data.vertices[vi].co;zz=z-SPRING
   if p.index>=2*front_count:q=p.normal.copy()
   else:
    dy=2.598076211*depth*(zz/R)*(-2*y/(R*R));dz=2.598076211*depth/R*(1-(y*y+3*zz*zz)/(R*R));q=Vector((1,dy,dz)).normalized()
    if vi>=n:q=-q
   normals.append(tuple(q))
 o.data.normals_split_custom_set(normals)
 extension_records.append({'role':'opaque recessed terminal sail','source':'LOC071930 continuous surface with faint groin curvature inside archivolt; independently reviewed','recessM':depth,'thicknessM':thick,'qualification':'Exact sail curvature/recess reconstructed. Bottom seats on screen entablature, boundary contacts retained new terminal arch; public opening below untouched.'})
terminal_sail()
# Transverse frieze and arch are supported by the Ionic screen, with no solid
# wall placed across the public opening below the entablature.

# The entrance vestibule widens to the primary ground-plan proportions.
VX0,VX1=101.29,111.1816;VC=(VX0+VX1)/2;VR=(VX1-VX0)/2;VW=10.5
def vestibule_roof(x,y):
 longitudinal=main_h(x,y)if abs(y)<=R else SPRING
 transverse=SPRING+R*math.sqrt(max(0,1-((x-VC)/VR)**2))
 return max(longitudinal,transverse)
roof_grid('Vestibule continuous connected intersecting vault',VX0,VX1,-VW,VW,vestibule_roof,88,112)
for sign in [-1,1]:
 slab=box('Vestibule added side marble bearing slab',(VC,sign*(7+VW)/2,-.09),(VX1-VX0,VW-7,.18),FLOOR)
 ya,yb=sorted([sign*7,sign*VW]);add_walkable(slab,'Seventh Avenue vestibule side circulation',[VX0,VX1,ya,yb],'S2 plate300 widened vestibule plan; half-width10.5m ±0.4m manual registration, current public centre paving exact.')
 box('Vestibule continuous backed side wall',(VC,sign*(VW+.2),9.45),(VX1-VX0,.4,18.9),STONE)
 box('Vestibule west widening return around real arcade opening',(VX0+.10,sign*(WALL+VW)/2,9.45),(.20,VW-WALL,18.9),STONE)
 for x in [VX0,VC,VX1]:
  for za,zb,depth in [(0,.35,.55),(.35,8.35,.35),(8.35,8.72,.55)]:box('Vestibule wall engaged pilaster',(x,sign*(VW-depth/2),(za+zb)/2),(.72,depth,zb-za),STONE)
 order_beam('Vestibule continuous side entablature',VX0,VX1,min(sign*(VW-.6),sign*(VW+.3)),max(sign*(VW-.6),sign*(VW+.3)))
 # Closed, backed side recesses at the locations of secondary circulation;
 # detailed upper stair/tenant reconstruction remains outside this module.
 box('Vestibule side recess backing',(VC,sign*(VW-.025),2.7),(3.5,.06,5.4),BACK)
 for dx in [-1.87,1.87]:box('Vestibule backed recess stone jamb',(VC+dx,sign*(VW-.10),2.8),(.18,.23,5.6),STONE)
 box('Vestibule backed recess lintel',(VC,sign*(VW-.10),5.65),(3.92,.23,.23),STONE)
 # Existing Avenue masonry already encloses the lower outside flanks. This
 # upper return bridges to it without sealing the open Doric portico.
 box('Vestibule front upper solid flank return',(VX1-.11,sign*(5.5+VW)/2,(13.18+19.2024)/2),(.22,VW-5.5,19.2024-13.18),STONE)

# Front glazing and open doorway give a real daylight/walking path to the
# existing portico. Its tall arched family is photographed looking east from
# the loggia; exact subdivisions remain qualified reconstruction.
FR=5.42;FS=11.15;FX=VX1-.10;DOOR=2.50;DH=3.80
for sign in [-1,1]:
 a,b=sorted([sign*DOOR,sign*FR]);box('Vestibule front closed side glass',(FX,(a+b)/2,(.25+FS)/2),(.028,b-a,FS-.25),GLASS)
 box('Vestibule front supported sill',(FX,(a+b)/2,.12),(.20,b-a,.24),STONE)
 for y in [a,b]:beam('Vestibule front metal vertical frame',(FX,y,.20),(FX,y,FS),.05,BRONZE)
 # Actual open leaves stand beside the jambs; no invisible collision glass
 # spans the central walking opening.
 leaf_y=sign*(DOOR-.08);leaf_x=FX-.62
 box('Vestibule actual open framed glass door leaf',(leaf_x,leaf_y,DH/2),(1.15,.028,DH-.20),GLASS)
 for x in [leaf_x-.60,leaf_x+.60]:box('Vestibule open door bronze stile',(x,leaf_y,DH/2),(.10,.10,DH),BRONZE)
 for z in [.05,DH-.05]:box('Vestibule open door bronze rail',(leaf_x,leaf_y,z),(1.30,.10,.10),BRONZE)
 beam('Vestibule open door rooted bronze pull',(leaf_x-.14,leaf_y-sign*.09,1.05),(leaf_x+.14,leaf_y-sign*.09,1.05),.022,BRONZE)
 for x in [leaf_x-.14,leaf_x+.14]:beam('Vestibule bronze pull fixing',(x,leaf_y,1.05),(x,leaf_y-sign*.09,1.05),.022,BRONZE)
box('Vestibule central transom glass',(FX,0,(DH+FS)/2),(.028,DOOR*2,FS-DH),GLASS)
beam('Vestibule clear doorway metal head',(FX,-DOOR,DH),(FX,DOOR,DH),.07,BRONZE)
prof=[(-FR,FS),(FR,FS)]+[(FR*math.cos(t),FS+FR*math.sin(t))for t in np.linspace(0,math.pi,97)]
profile_prism('Vestibule full arched glazed transom',prof,FX-.014,FX+.014,GLASS)
for y in [-FR,-DOOR,0,DOOR,FR]:
 z=FS+math.sqrt(max(0,FR*FR-y*y));beam('Vestibule front arched glazing upright',(FX,y,DH if abs(y)<DOOR else .20),(FX,y,z),.035,BRONZE)
for y in [-4.05,-1.35,1.35,4.05]:
 z=FS+math.sqrt(FR*FR-y*y);beam('Vestibule period-scale intermediate glazing bar',(FX,y,DH if abs(y)<DOOR else .20),(FX,y,z),.022,BRONZE)
for z in [6.25,8.70,11.15,12.50,13.85,15.20]:
 reach=FR if z<=FS else math.sqrt(max(0,FR*FR-(z-FS)**2))
 beam('Vestibule period-scale horizontal glazing transom',(FX,-reach,z),(FX,reach,z),.023,BRONZE)
ring_x('Vestibule front arched stone reveal',VX1-.22,VX1,0,FS,FR,FR+.32,STONE)
for sign in [-1,1]:box('Vestibule front arch grounded jamb',(VX1-.11,sign*(FR+.16),FS/2),(.22,.32,FS),STONE)
# Close the spandrel above and alongside the arch at the real building face.
pp=[(FR*math.sin(t),FS+FR*math.cos(t))for t in np.linspace(-math.pi/2,math.pi/2,97)]+[(FR,19.2024),(-FR,19.2024)]
profile_prism('Vestibule front solid arched upper spandrel',pp,VX1-.22,VX1,STONE)
for aa,bb in [(-5.5,-FR),(FR,5.5)]:box('Vestibule front slender infill jamb',(VX1-.11,(aa+bb)/2,FS/2),(.22,bb-aa,FS),STONE)

extension_records.append({'status':'connected external source candidate','routeX':[18.1356,111.1816],'formal':[32.71,101.29],
 'IonicScreen':connected['screenControls'],'restaurantBaySupport':'retained public landing plus new marble finish and rebated actual footing',
 'vestibule':connected['vestibuleControls'],'outsidePortico':'111.1816..119.4816 left open and unchanged',
 'qualifications':['Arcade/loggia threshold steps held flat; all 28 Main risers preserved.','Vestibule side finish/bearing slab bridges the inner0.75m band absY7.0..7.75 and bears on the actual outer footing fromabsY7.75. This supported overhang is an inferred slab interpretation, not a new solid foundation.','Cross-vault profile, columns fine mouldings, hidden backing and secondary recess subdivisions reconstructed from plan/photo family.','No complete operating restaurant/bank interiors or authenticated tenant displays claimed.','Front high glass may be partly screened by retained exterior attic/portico; final daylight audit must distinguish lower clear entrance from upper occluded portions.']})
