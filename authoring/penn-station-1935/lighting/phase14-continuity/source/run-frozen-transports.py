from pathlib import Path
import os,json,subprocess,hashlib,concurrent.futures,time
O=Path(__file__).parent;uv=['uv','run','--offline','--no-project','--python','3.11','--with','bpy==4.3.0','--with','numpy==1.26.4','--with','pillow==13.0.0','python'];env=dict(os.environ,UV_CACHE_DIR='/Users/stavreskimario/Desktop/penn-station-work/uv-cache',PENN_TOOLS='/Users/stavreskimario/Desktop/penn-station-work/tools',CYCLES_METAL_DISABLE_BINARY_ARCHIVES='1');H=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();pins={'structure':'776c090f95b161720f5c545fa0edd380205af18ab9d8d072402ba04bcee096f2','floor':'62f3a92ecef08865dcdffd8f430e5723de856002b221816781246389cfc38a17'};started=time.time()
def post(B):
 with(B/'postprocess.log').open('w')as log:subprocess.run(['python3',str(O/'postprocess-receiver.py'),'--run',str(B)],env=env,check=True,stdout=log,stderr=subprocess.STDOUT)
 return json.load(open(B/'actual-postprocess-completion.json'))
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:
 jobs=[]
 for kind in ['structure','floor']:
  B=O/(kind+'-bake-v1');p=B/'packet.json';assert H(p)==pins[kind];d=json.load(open(p));assert not Path(d['out']).exists();print('GPU START',kind,time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),flush=True)
  with(B/'actual-metal-bake.log').open('w')as log:subprocess.run(uv+[str(O/'bake-prepared-receiver.py'),'--packet',str(p)],env=env,check=True,stdout=log,stderr=subprocess.STDOUT)
  print('GPU DONE',kind,time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),flush=True);jobs.append(pool.submit(post,B))
 # Both accepted lighting transports are closed before the physical reflection GPU render.
 scene=O/'floor-uv-v1/independent-floor-prebake-scene.blend';out=O/'reflection-v1';argv=[str(O/'capture-local-reflection.py'),'--scene',str(scene),'--scene-sha',H(scene),'--control',str(O/'prepared-current-control.json'),'--out',str(out),'--width','2048','--samples','64','--device','METAL','--probe=-136,-10.1,11.3'];packet={'argv':argv,'sceneSha256':H(scene),'controlSha256':H(O/'prepared-current-control.json'),'scriptSha256':H(O/'capture-local-reflection.py'),'sourceSha256':json.load(open(O/'structure-bake-v1/packet.json'))['sourceSha256'],'environment':{'CYCLES_METAL_DISABLE_BINARY_ARCHIVES':'1'}};(O/'reflection-packet.json').write_text(json.dumps(packet,indent=2)+'\n');print('GPU START probe',flush=True)
 with(O/'actual-reflection.log').open('w')as log:subprocess.run(uv+argv,env=env,check=True,stdout=log,stderr=subprocess.STDOUT)
 print('GPU DONE probe',flush=True);results=[j.result()for j in jobs]
r={'status':'PASS two separate frozen4K128 lighting transports+linear controls/packages and physical probe; assembly/native acceptance separate','seconds':time.time()-started,'packets':pins,'postprocess':results};(O/'actual-transport-pair-completion.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps({'status':r['status'],'seconds':r['seconds']}),flush=True)
