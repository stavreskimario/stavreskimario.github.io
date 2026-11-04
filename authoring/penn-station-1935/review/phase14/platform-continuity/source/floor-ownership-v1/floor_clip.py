"""One geometric clipping core for runtime receiver partition and cache cuts."""
import math
EPS=1e-10

def area(v):
 if len(v)<3:return 0.
 p=v[0]['pos'];total=0.
 for i in range(1,len(v)-1):
  a=[v[i]['pos'][k]-p[k]for k in range(3)];b=[v[i+1]['pos'][k]-p[k]for k in range(3)];c=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];total+=math.sqrt(sum(x*x for x in c))/2
 return total

def mix(a,b,t):
 r={}
 for key in a:
  if a[key]is None:r[key]=None
  else:r[key]=[x+(y-x)*t for x,y in zip(a[key],b[key])]
 if r.get('normal'):
  l=math.sqrt(sum(x*x for x in r['normal']));r['normal']=[x/l for x in r['normal']]
 return r

def half(poly,axis,edge,above):
 out=[]
 for i,p in enumerate(poly):
  q=poly[(i+1)%len(poly)];dp=(p['pos'][axis]-edge)*(1 if above else-1);dq=(q['pos'][axis]-edge)*(1 if above else-1);pin=dp>=-EPS;qin=dq>=-EPS
  if pin:out.append(p)
  if pin!=qin:
   t=(edge-p['pos'][axis])/(q['pos'][axis]-p['pos'][axis]);v=mix(p,q,t);v['pos'][axis]=edge;out.append(v)
 return out

def triangles(poly):return[[poly[0],poly[i],poly[i+1]]for i in range(1,len(poly)-1)if area([poly[0],poly[i],poly[i+1]])>1e-11]

def partition(poly,roi):
 inside=poly;outside=[]
 for axis,edge,above in[(0,roi['x'][0],True),(0,roi['x'][1],False),(2,roi['z'][0],True),(2,roi['z'][1],False)]:
  if not inside:break
  outer=half(inside,axis,edge,not above)
  if area(outer)>1e-11:outside+=triangles(outer)
  inside=half(inside,axis,edge,above)
 return triangles(inside),outside
