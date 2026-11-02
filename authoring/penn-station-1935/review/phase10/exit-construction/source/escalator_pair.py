"""Photo-led static Penn Terminal escalator and adjacent public stone stair.

Source: Otis advertisement, Architecture November 1910, printed vii/PDF4;
Gibbs Table3, printed261/PDF451, and printed262/PDF452. The photograph
establishes the paired form, dark rounded panel balustrades and stone flight.
Clear escalator width4ft is documented. Working rise, inclination, riser count,
minor profiles, registration, adjacent-stair width and 1935 retention are qualified.
The adjacent stone stair supplies walkable egress; no motor animation is claimed.
"""
import math
from mathutils import Vector


def build(R, M, C, closed_mesh, prism, bar, point):
    cfg = R.get('escalatorPair', {})
    y0 = float(cfg.get('bottomY', -7.4676))
    y1 = float(cfg.get('topY', -.0023649))
    z0 = float(cfg.get('footZ', -76.065))
    z1 = float(cfg.get('topZ', -89.0))
    ex = float(cfg.get('escalatorCenterX', -6.0))
    sx = float(cfg.get('stairCenterX', -3.2))
    ew = float(cfg.get('escalatorWidth', 1.2192))
    sw = float(cfg.get('stairWidth', 2.4384))
    n = int(cfg.get('risers', 44))
    run, rise = z0-z1, y1-y0
    assert run > 0 and rise > 0 and 0 < rise/n <= .20
    assert run/n >= .25
    assert abs(ew-1.2192) < 1e-6, 'Retain documented4ftescalator clearwidth'
    owners = []
    BOX = [(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]

    def own(o, role):
        o['source_family'] = 'Otis1910PennTerminalAdPDF4;Gibbs261Table3+262'
        o['historical_qualification'] = 'Photo-led family; minor dimensions/riser count/1935 retention inferred.'
        o['exit_pair_role'] = role
        owners.append(o.name)
        return o

    def pos(x, s, y):
        return (x, y, z0-s)

    def rect(name, x, s0, s1, width, b0, b1, t0, t1, mat, role):
        return own(prism(name, pos(x,s0,b0), pos(x,s1,b1), width,b0,b1,t0,t1,mat),role)

    def tube(name, path, radius, mat):
        # One closed, capped mesh with transported circle sections, not hundreds
        # of separate cylinders. Path is monotone in the public ascent direction.
        vs = []
        segs = 12
        for j, p in enumerate(path):
            p = Vector(p)
            tang = Vector(path[min(j+1,len(path)-1)]) - Vector(path[max(0,j-1)])
            tang.normalize()
            u = Vector((1,0,0)); v = tang.cross(u).normalized()
            for k in range(segs):
                a = k*2*math.pi/segs
                vs.append(tuple(p+radius*(u*math.cos(a)+v*math.sin(a))))
        fs = [tuple(range(segs-1,-1,-1))]
        for j in range(len(path)-1):
            for k in range(segs):
                fs.append((j*segs+k,j*segs+(k+1)%segs,(j+1)*segs+(k+1)%segs,(j+1)*segs+k))
        fs.append(tuple(range((len(path)-1)*segs,len(path)*segs)))
        return own(closed_mesh(name,vs,fs,mat,True),'narrow metal cap/handrail')

    # A continuous structural waist seats every visible tread and each side.
    for name,x,width,mat in [('Otis escalator enclosed machine body',ex,ew+.42,'iron'),
                              ('33rd Street adjacent stone stair waist',sx,sw+.10,'stone')]:
        rect(name,x,-.06,run+.06,width,y0-.44,y1-.44,y0-.12,y1-.12,mat,'continuous bearing waist')

    # Stone/public and moving-step interpretations remain individual physical
    # horizontal surfaces. Their chosen44riser schedule meets the working floors.
    tread_meshes = []
    for role,x,width,mat in [('Otis static step train',ex,ew,'wood'),
                             ('33rd Street public stone stair',sx,sw,'stone')]:
        for j in range(n):
            a,b = run*j/n,run*(j+1)/n
            top = y0+rise*(j+1)/n
            # Horizontal treads overlap the continuous waist at both endpoints.
            o=rect(f'{role} tread {j+1:02d}',x,a-.0004,b+.0004,width,
                   top-.30,top-.30,top,top,mat,'physical public tread')
            tread_meshes.append(o.name)

    # Fine longitudinal cleats are a single batched mesh, seated in the dark
    # step tops. Their pitch/relief is inferred from the period mechanism image.
    vs,fs=[],[]
    count=24
    for j in range(n):
        a,b=run*j/n+.012,run*(j+1)/n-.012
        top=y0+rise*(j+1)/n
        for k in range(count):
            xx=ex-ew/2+(k+.5)*ew/count;hw=.008
            z_a,z_b=z0-a,z0-b
            local=[(xx-hw,top-.001,z_a),(xx-hw,top-.001,z_b),(xx+hw,top-.001,z_b),(xx+hw,top-.001,z_a),
                   (xx-hw,top+.003,z_a),(xx-hw,top+.003,z_b),(xx+hw,top+.003,z_b),(xx+hw,top+.003,z_a)]
            off=len(vs);vs.extend(local);fs.extend(tuple(off+i for i in f)for f in BOX)
    own(closed_mesh('Otis dark step longitudinal cleats',vs,fs,'wood'),'inferred physical cleat relief')

    # Solid paneled balustrades follow the photograph. The lower return rises
    # from a grounded, round-front shoe rather than a modern glass guard.
    # Profile coordinates are along public travel(s), with world vertical y.
    upper=[]
    upper.append((-.78,y0+.08));upper.append((-.78,y0+.60))
    for j in range(1,17):
        ang=math.pi-j*math.pi/32
        upper.append((-.38+.40*math.cos(ang),y0+.60+.40*math.sin(ang)))
    upper.append((0,y0+1.0))
    for j in range(1,65):
        s=run*j/64
        upper.append((s,y0+rise*s/run+1.0))
    upper.append((run+.38,y1+1.0))
    for j in range(1,13):
        ang=math.pi/2-j*math.pi/24
        upper.append((run+.38+.32*math.cos(ang),y1+.68+.32*math.sin(ang)))
    upper.append((run+.70,y1+.08))
    lower=[(run+.70,y1-.34),(-.78,y0-.34)]
    profile=upper+lower
    for side in [-1,1]:
        cx=ex+side*(ew/2+.105);th=.15
        vs=[]
        for xx in [cx-th/2,cx+th/2]:
            vs.extend(pos(xx,s,y)for s,y in profile)
        length=len(profile)
        fs=[tuple(range(length-1,-1,-1)),tuple(range(length,2*length))]
        fs.extend((j,(j+1)%length,(j+1)%length+length,j+length)for j in range(length))
        own(closed_mesh('Otis rounded dark paneled balustrade '+str(side),vs,fs,'wood'),'solid photo-led balustrade')
        # Narrow metal cap follows the full rounded shoulder and inclined crown.
        cap=[pos(cx,s,y+.012)for s,y in upper[1:-1]]
        tube('Otis narrow metal crown '+str(side),cap,.022,'bronze')
        # Raised stiles and two fine lining strips create physical panel relief.
        for h in [.20,.76]:
            a=pos(cx+side*(th/2+.006),.12,y0+h+.12*rise/run)
            b=pos(cx+side*(th/2+.006),run-.12,y1+h-.12*rise/run)
            own(bar('Otis panel fine lining',a,b,.007,'bronze',8),'photo-led panel trim; minor dimensions inferred')
        for j in range(1,int(run/1.35)+1):
            s=j*run/(int(run/1.35)+1);yy=y0+rise*s/run
            x=cx+side*(th/2+.008)
            own(bar('Otis wood panel stile',pos(x,s,yy+.17),pos(x,s,yy+.82),.014,'wood',8),'solid panel stile')

    # The photo shows a stone stair directly beside the machine. Coordinate the
    # separation with an actual low stone upstand; no unsupported slot is left.
    esc_right=ex+ew/2+.18
    stair_left=sx-sw/2
    if stair_left>esc_right:
        width=stair_left-esc_right
        rect('33rd Street shared stair/machine stone separator',(esc_right+stair_left)/2,
             -.04,run+.04,width,y0-.43,y1-.43,y0+.20,y1+.20,'stone','continuous shared side bearing')
    outer_x=sx+sw/2+.10
    rect('33rd Street outer stair stone cheek',outer_x,-.05,run+.05,.20,
         y0-.43,y1-.43,y0+.25,y1+.25,'stone','continuous grounded stair cheek')
    # One plain metal rail at the open outer side is visible in the original
    # paired installation. The rail does not occupy the2.4384m clear stair.
    rail_x=outer_x
    own(bar('33rd Street adjacent stair outer handrail',pos(rail_x,-.1,y0+.95),
            pos(rail_x,run+.1,y1+.95),.029,'bronze',16),'plain outer public stair rail')
    posts=max(2,math.ceil(run/1.25))
    for j in range(posts+1):
        s=run*j/posts;yy=y0+rise*s/run
        own(bar('33rd Street adjacent stair rail post',pos(rail_x,s,yy+.20),
                pos(rail_x,s,yy+.95),.018,'iron',10),'rail post seated in stone cheek')

    # Objects are returned as names so the parent can archive ownership without
    # serializing Blender references. Root owns common landings and apertures.
    clear_bounds=[sx-sw/2,sx+sw/2,min(z0,z1),max(z0,z1)]
    result={'owners':owners,'walkable':[{'label':'33rd Street photo-led public stair beside Otis escalator',
        'bounds':clear_bounds,'geometryBasedFloorRayRequired':True,
        'surface':'Actual44treads and shared landing receivers; no virtual floor.'}],
        'flights':[{'label':'33rd Street adjacent public stair','start':[sx,y0,z0],
        'end':[sx,y1,z1],'width':sw,'steps':n}],
        'components':[{'name':'Otis escalator and adjacent33rd Street public stair','start':[sx,y0,z0],
        'end':[sx,y1,z1],'escalatorCenterX':ex,'escalatorClearWidth':ew,'stairClearWidth':sw,
        'risers':n,'riser':rise/n,'going':run/n,'inclinationDegrees':math.degrees(math.atan2(rise,run)),
        'staticEscalator':True,'rootBuildsRealLowerAndUpperLandings':True}],
        'qualifications':['Original installed family and adjacent stone stair shown in Otis1910PennTerminal ad.',
        '4ftescalator width documented;44risers,adjacent stairwidth,fullrun/profiles/materialhues inferred.',
        'Working24.5ftscene rise differs from25fttable value by6in; no existing station datum moved.',
        'Static construction; no motor animation or verified complete1935hardware inventory.']}
    return result
