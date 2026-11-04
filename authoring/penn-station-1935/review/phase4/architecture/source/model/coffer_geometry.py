"""Curved tessellation of the existing, source-qualified coffer profile.

The nominal module, octagonal outline and five relief depths come from the
architectural builder. This helper resolves that same profile on its curved
vault instead of handing metre-scale warped quads to an arbitrary triangulator.
It supplies normals within each moulding face while retaining sharp boundaries
between moulding bands. It introduces no new decorative motif.
"""
import math
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt

def tessellate_profile(parameter_vertices, faces, surface, max_edge=.45):
    vertices, triangles, normals = [], [], []
    def point(q):
        return Vector(surface(*q))
    def edge_length(a, b):
        samples = [point(tuple(a[k]*(1-t/8)+b[k]*t/8 for k in range(3))) for t in range(9)]
        return sum((b-a).length for a,b in zip(samples,samples[1:]))
    # Shared edges use one independent sampling count. Constrained face
    # triangulation includes those same samples even when opposite edges need
    # different densities, preventing curved T-junction cracks.
    edge_counts={}
    def edge_key(a,b):return tuple(sorted([tuple(round(v,12) for v in a),tuple(round(v,12) for v in b)]))
    for face in faces:
        for i,index in enumerate(face):
            a,b=parameter_vertices[index],parameter_vertices[face[(i+1)%len(face)]]
            key=edge_key(a,b)
            if key not in edge_counts:edge_counts[key]=max(1,min(32,math.ceil(edge_length(a,b)/max_edge)))
    for face in faces:
        controls = [parameter_vertices[i] for i in face]
        if len(controls) == 4:
            def parameter(u, v):
                return tuple((1-u)*(1-v)*controls[0][k]+u*(1-v)*controls[1][k]+u*v*controls[2][k]+(1-u)*v*controls[3][k] for k in range(3))
            count_u = max(1, min(32, math.ceil(max(edge_length(controls[0],controls[1]),edge_length(controls[3],controls[2]))/max_edge)))
            count_v = max(1, min(32, math.ceil(max(edge_length(controls[0],controls[3]),edge_length(controls[1],controls[2]))/max_edge)))
            corners=[(0,0),(1,0),(1,1),(0,1)]
            interior=[(i/count_u,j/count_v) for j in range(1,count_v) for i in range(1,count_u)]
            def normal_at(u,v):
                un,vn=.002+.996*u,.002+.996*v
                du=point(parameter(un+.001,vn))-point(parameter(un-.001,vn))
                dv=point(parameter(un,vn+.001))-point(parameter(un,vn-.001))
                return du.cross(dv)
        elif len(controls) == 3:
            def parameter(u,v):
                return tuple((1-u-v)*controls[0][k]+u*controls[1][k]+v*controls[2][k] for k in range(3))
            count=max(1,min(32,math.ceil(max(edge_length(controls[0],controls[1]),edge_length(controls[1],controls[2]),edge_length(controls[2],controls[0]))/max_edge)))
            corners=[(0,0),(1,0),(0,1)]
            interior=[(i/count,j/count) for j in range(1,count) for i in range(1,count-j)]
            def normal_at(u,v):
                un,vn=.002/3+.998*u,.002/3+.998*v;h=.0002
                du=point(parameter(un+h,vn))-point(parameter(un-h,vn))
                dv=point(parameter(un,vn+h))-point(parameter(un,vn-h))
                return du.cross(dv)
        else:
            raise ValueError("Coffer profiles contain triangles or quadrilaterals only")
        boundary=[]
        for i,corner in enumerate(corners):
            following=corners[(i+1)%len(corners)]
            count=edge_counts[edge_key(controls[i],controls[(i+1)%len(controls)])]
            boundary.extend((corner[0]+(following[0]-corner[0])*k/count,corner[1]+(following[1]-corner[1])*k/count) for k in range(count))
        coords=[Vector(p) for p in boundary+interior]
        edges=[(i,(i+1)%len(boundary)) for i in range(len(boundary))]
        result=delaunay_2d_cdt(coords,edges,[list(range(len(boundary)))],1,1e-8,False)
        offset=len(vertices)
        fallback=(point(controls[1])-point(controls[0])).cross(point(controls[-1])-point(controls[0]))
        for uv in result[0]:
            u,v=uv
            vertices.append(tuple(point(parameter(u,v))))
            normal=normal_at(u,v)
            normals.append(tuple((normal if normal.length>1e-10 else fallback).normalized()))
        for triangle in result[2]:
            if len(triangle)!=3:raise ValueError('Constrained coffer face did not triangulate')
            triangles.append(tuple(offset+i for i in triangle))
    return vertices,triangles,normals
