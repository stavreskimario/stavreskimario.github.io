import ast,copy,hashlib,json
from pathlib import Path
review=Path(__file__).resolve().parent
base=review/'source/model'
def extract(path):
    text=path.read_text();tree=ast.parse(text)
    loop=next(node for node in tree.body if isinstance(node,ast.For) and any(isinstance(n,ast.Constant) and n.value=='Monel roof transverse gabled bay' for n in ast.walk(node)))
    loop=copy.deepcopy(loop)
    loop.body=[node for node in loop.body if isinstance(node,ast.Assign) or isinstance(node,ast.Expr) and isinstance(node.value,ast.Call) and isinstance(node.value.func,ast.Name) and node.value.func.id=='mesh']
    records=[]
    def mesh(name,vertices,faces,material):records.append({'name':name,'vertices':vertices,'faces':faces})
    ns={'HALL_L':277*.3048,'HALL_SHELL_L':325*.3048,'HALL_SHELL_W':119*.3048,'FT':.3048,'MONEL':None,'mesh':mesh}
    exec(compile(ast.Module(body=[loop],type_ignores=[]),str(path),'exec'),ns)
    overlaps=[max(v[1] for v in a['vertices'])-min(v[1] for v in b['vertices']) for a,b in zip(records,records[1:])]
    return {'source':path.name,'sourceSha256':hashlib.sha256(text.encode()).hexdigest(),'bays':records,'adjacentYOverlapMetres':overlaps,'roofCrownMain':max(v[2] for r in records for v in r['vertices'])}
old=extract(review/'source/controls/build_station-before-roof.py');new=extract(base/'build_station.py')
assert all(abs(overlap)<1e-10 for overlap in new['adjacentYOverlapMetres'])
assert old['roofCrownMain']==new['roofCrownMain']==167*.3048
report={'old':old,'corrected':new,'scope':'Same roof crown, shell ends and three-gable arrangement; rounded overlapping bay boundaries replaced with common hall datums'}
(review/'rerun-roof-valleys.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'oldOverlap':old['adjacentYOverlapMetres'],'correctedOverlap':new['adjacentYOverlapMetres'],'crownMain':new['roofCrownMain']}))
