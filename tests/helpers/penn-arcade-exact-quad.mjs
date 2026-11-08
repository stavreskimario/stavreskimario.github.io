// Exact integer proof for alternate triangulation of a planar four-corner patch.
// A shared boundary alone is insufficient: exact coplanarity and triangle multiplicity are required.
const vertex=p=>p.join(',');
export const orientedTriangleKey=q=>{const k=q.map(vertex);return[k.join(';'),[k[1],k[2],k[0]].join(';'),[k[2],k[0],k[1]].join(';')].sort()[0];};
function boundary(triangles){const edges=new Map();for(const t of triangles)for(let i=0;i<3;i++){let a=vertex(t[i]),b=vertex(t[(i+1)%3]);if((edges.get(b+'>'+a)||0)>0)edges.set(b+'>'+a,edges.get(b+'>'+a)-1);else edges.set(a+'>'+b,(edges.get(a+'>'+b)||0)+1);}return[...edges].filter(([,n])=>n).sort(([a],[b])=>a.localeCompare(b));}
function planar(q){let a=q[1].map((v,i)=>BigInt(v-q[0][i])),b=q[2].map((v,i)=>BigInt(v-q[0][i])),c=q[3].map((v,i)=>BigInt(v-q[0][i]));return(a[1]*b[2]-a[2]*b[1])*c[0]+(a[2]*b[0]-a[0]*b[2])*c[1]+(a[0]*b[1]-a[1]*b[0])*c[2]===0n;}
export function reconcileQuadPair(a,b,actual){
 const q=[...new Map([...a,...b].map(p=>[vertex(p),p])).values()];if(q.length!==4||!planar(q))return null;
 const sourceBoundary=boundary([a,b]);if(sourceBoundary.length!==4||sourceBoundary.some(([,n])=>n!==1))return null;
 const candidates=[];for(const i of[[0,1,2],[0,1,3],[0,2,3],[1,2,3]])for(const order of[i,[i[0],i[2],i[1]]]){const t=order.map(j=>q[j]);if(actual.has(orientedTriangleKey(t)))candidates.push(t);}
 for(let i=0;i<candidates.length;i++)for(let j=i+1;j<candidates.length;j++){const pair=[candidates[i],candidates[j]],keys=pair.map(orientedTriangleKey);if(keys[0]===keys[1])continue;if(JSON.stringify(boundary(pair))===JSON.stringify(sourceBoundary))return{actualKeys:keys,sourceBoundary,exactPlanar:true,sourceTriangleKeys:[orientedTriangleKey(a),orientedTriangleKey(b)]};}return null;
}
