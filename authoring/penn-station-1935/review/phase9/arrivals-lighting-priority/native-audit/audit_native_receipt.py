"""Read-only CPU audit of the completed native arrivals receipt and its models."""
from pathlib import Path
import collections,datetime,gzip,hashlib,json,math,struct,urllib.parse
D=Path(__file__).resolve().parent;W=D.parent;R=Path('/Users/stavreskimario/Desktop/penn-station-reconstruction');P=W/'arrivals-browser-uv-priority-v1/report.json';H=lambda b:hashlib.sha256(b).hexdigest();j=json.loads(P.read_text());servedProof=json.loads((D/'served-rehash.json').read_text());physicalPath=W/'arrivals-encoded-physical-v2/SUMMARY.json';physical=json.loads(physicalPath.read_text());integrationPath=W/'arrivals-runtime-uv-priority-v1-integration.json';integration=json.loads(integrationPath.read_text());assert servedProof['reportSha256']==H(P.read_bytes())
assert len(servedProof['servedFiles'])==len(j['servedFiles'])==81 and all(x['match']for x in servedProof['servedFiles'])
assert j['status'].startswith('PASS:')and j['browserClosed']and j['closed']=='2026-11-02T03:03:32.295Z';assert not j['pageErrors']and not j['serverErrors']and'error'not in j
expectedBundle='5b9726ba469fa2904f36361a9fcec55ea3ad3947d9a27f05555b07b553a051dd';expectedFull='c74aa5be856e72689b8e62694fe0715a2edb736ab518dbd3c96e4e8fc2cb9673';assert j['productionBundle']['sha256']==expectedBundle and j['productionBundle']['modified']is False
served={Path(x['file']).name:x for x in j['servedFiles']};assert served['app.js']['sha256']==expectedBundle and served['model-concourse.glb.gz']['sha256']==expectedFull
models={x['file']:x for x in j['inputModels']};assert len(models)==12
for x in models.values():assert H(Path(x['path']).read_bytes())==x['sha256']
assert H(Path(j['manifest']['path']).read_bytes())==j['manifest']['sha256']=='4710619e32446dab107745ace51e6f8f1807687750f33439d80426be568231f7'
physicalPins=json.loads((W/'arrivals-encoded-physical-v2/input-and-helper-pins.json').read_text())['inputs'];assert next(v['sha256']for k,v in physicalPins.items()if k.endswith('/scene-manifest.json'))==j['manifest']['sha256']
for x in integration['unchangedOtherModels']:assert models[x['file']]['sha256']==x['sha256'];assert next(v['sha256']for k,v in physicalPins.items()if k.endswith('/'+x['file']))==x['sha256']
def glb(path):
 b=Path(path).read_bytes();b=gzip.decompress(b)if b[:2]==b'\x1f\x8b'else b;n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);size,kind=struct.unpack_from('<II',b,20+n);assert kind==0x004e4942;return g,b[28+n:28+n+size]
basePath=W.parent/'phase7-arrivals/packaging-v1/concourse-without-old-exit.glb.gz';bj,bb=glb(basePath);links=[]
for low,row in zip([False,True],integration['appendReports']):
 name='model-concourse'+('-low'if low else'')+'.glb';module=W/'arrivals-optimized-uv-priority-v2'/name;target=Path(models[name+'.gz']['path']);mj,mb=glb(module);tj,tb=glb(target);expectedModule=physical['testedLowModuleSha256'if low else'testedFullModuleSha256'];assert H(module.read_bytes())==row['moduleSha256']==expectedModule;assert H(target.read_bytes())==row['outputSha256']==models[name+'.gz']['sha256'];assert H(basePath.read_bytes())==row['inputSha256']==physical['retainedBaseSha256'];assert tb[:len(bb)]==bb and tb[len(bb):]==mb
 for key in ['bufferViews','accessors','images','textures','samplers','materials','meshes','nodes']:assert tj.get(key,[])[:len(bj.get(key,[]))]==bj.get(key,[]),key
 for i,node in enumerate(mj['nodes']):
  expected=dict(node)
  if'mesh'in expected:expected['mesh']+=len(bj['meshes'])
  if'children'in expected:expected['children']=[x+len(bj['nodes'])for x in expected['children']]
  attrs=expected.get('extensions',{}).get('EXT_mesh_gpu_instancing',{}).get('attributes')
  if attrs:expected['extensions']={'EXT_mesh_gpu_instancing':{'attributes':{k:v+len(bj['accessors'])for k,v in attrs.items()}}}
  assert expected==tj['nodes'][len(bj['nodes'])+i]
 assert tj['scenes'][tj.get('scene',0)]['nodes']==bj['scenes'][bj.get('scene',0)]['nodes']+[x+len(bj['nodes'])for x in mj['scenes'][mj.get('scene',0)]['nodes']]
 links.append({'variant':'low'if low else'full','physicalTestedModuleSha256':expectedModule,'browserPinnedAssemblySha256':models[name+'.gz']['sha256'],'retainedBinaryPrefixExact':True,'moduleBinarySuffixExact':True,'allRetainedJsonArrayPrefixesExact':True,'allModuleTransformsAndSceneMembershipExactAfterIndexRebase':True,'retainedBinaryPrefixBytes':len(bb),'moduleBinarySuffixBytes':len(mb),'nativeActuallyServed':name+'.gz'in served})
(D/'runtime-link.json').write_text(json.dumps({'schema':1,'status':'PASS','physicalSummarySha256':H(physicalPath.read_bytes()),'integrationReceiptSha256':H(integrationPath.read_bytes()),'links':links},indent=2)+'\n')
planPath=Path(j['walkPlan']['path']);assert H(planPath.read_bytes())==j['walkPlan']['sha256'];plan=json.loads(planPath.read_text());assert len(plan['goals'])==len(j['phases'])==34
states=[j[k]for k in ['arrivalsPreset','arrivalsOrbit','arrivalsWalkRestored','begin','end']];phases=[]
for goal,p in zip(plan['goals'],j['phases']):
 assert p['label']==goal['id']and p['target']==goal['xz']and p['status']=='PASS';end=p['end'];distance=math.hypot(end['camera']['position'][0]-p['target'][0],end['camera']['position'][2]-p['target'][1]);assert distance<.08
 if'floorMain'in goal:assert abs(end['camera']['position'][1]-(goal['floorMain']-4.2672+1.68))<.12
 assert all(s['state']['mode']=='walk'for s in p['trace']+[end]);states+=p['trace']+[end];phases.append({'label':p['label'],'traceSnapshots':len(p['trace']),'terminalDistanceM':distance,'pass':True})
reference=j['begin']['scene'];expectedNames=['exterior','waiting','concourse','context','platform','trains'];assert[zone['name']for zone in reference['zones']]==expectedNames
for s in states:
 assert s['scene']['id']==reference['id']and len(s['scene']['zones'])==6
 assert[(z['name'],z['id'])for z in s['scene']['zones']]==[(z['name'],z['id'])for z in reference['zones']]
 assert all(z['visible']and z['meshes']>0 for z in s['scene']['zones'])
 assert s['state']['error']==''and not s['state']['loading']and s['state']['progress']==100 and s['state']['renderer']=='WebGL 2'
 assert all(math.isfinite(v)for v in s['camera']['position']+s['camera']['quaternion'])
for s in [j['arrivalsPreset'],j['arrivalsWalkRestored'],j['begin'],j['end']]:assert s['state']['mode']=='walk'
assert j['arrivalsOrbit']['state']['mode']=='orbit';restoreDelta=[a-b for a,b in zip(j['arrivalsWalkRestored']['camera']['position'],j['arrivalsPreset']['camera']['position'])];assert math.hypot(restoreDelta[0],restoreDelta[2])<.05
assert all(x['kind']in ['keyboard','pointer-drag']for x in j['inputActions']);keys=[x for x in j['inputActions']if x['kind']=='keyboard'];assert all(x['key']=='KeyW'and x['milliseconds']in [25,120]for x in keys)
assert len(j['actualPracticalLights'])==len(j['expectedPracticalOrigins'])==4
for expected in j['expectedPracticalOrigins']:assert any(math.dist(expected,x['world'])<1e-5 for x in j['actualPracticalLights'])
arrivals={m['name']:m for m in j['arrivalsMaterials']};assert len(arrivals)==4
fullJ,_=glb(Path(models['model-concourse.glb.gz']['path']));materials={m['name']:m for m in fullJ['materials']};live=[]
for name,m in arrivals.items():
 encoded=materials[name];channel=encoded['occlusionTexture'].get('texCoord',0);assert m['ao']['channel']==m['lightmap']['channel']==channel;assert m['ao']['width']==m['ao']['height']==2048;assert m['lightmap']['width']==m['lightmap']['height']==4096;assert not m['ao']['flipY']and not m['lightmap']['flipY'];assert m['skyScale']==encoded['extras']['sky_illumination_scale']==2 and m['skyFile']=='lighting-concourse-arrivals-sky.webp';assert m['lightmap']['colorSpace']=='srgb'and m['ao']['colorSpace']==''
 live.append({'material':name,'actualEncodedAndLiveAtlasChannel':channel,'aoDimensions':[2048,2048],'lightDimensions':[4096,4096],'actualSkyScale':2,'flipY':False})
loaded={x['file']for x in j['end']['assets']};assert loaded=={'model-'+z+'.glb'for z in ['exterior','waiting-room','concourse','context','platform','trains']};refs=collections.defaultdict(list)
for model in models.values():
 if model['file'].replace('.gz','')not in loaded:continue
 g,_=glb(model['path']);textures=g.get('textures',[]);images=g.get('images',[])
 def scan(v,material,trail=()):
  if isinstance(v,dict):
   for k,x in v.items():
    if k.endswith('Texture')and isinstance(x,dict)and'index'in x:
     t=textures[x['index']];src=t.get('source',t.get('extensions',{}).get('KHR_texture_basisu',{}).get('source'));image=images[src];refs[Path(image.get('uri','')).name].append({'zoneModel':model['file'],'material':material,'role':'.'.join((*trail,k)),'texCoord':x.get('texCoord',0)})
    else:scan(x,material,(*trail,k))
  elif isinstance(v,list):
   for x in v:scan(x,material,trail)
 for m in g['materials']:scan(m,m['name'])
errors=collections.Counter(x['error']for x in j['requestFailures']);assert errors=={'net::ERR_ABORTED':22,'net::ERR_BLOCKED_BY_CLIENT.Inspector':1};assert j['consoleErrors']==['Failed to load resource: net::ERR_BLOCKED_BY_CLIENT.Inspector'];aborted=[]
for failure in j['requestFailures']:
 if failure['error']!='net::ERR_ABORTED':assert failure['url']in j['externalBlocked'];continue
 name=Path(urllib.parse.urlparse(failure['url']).path).name;assert name in served
 if name.endswith('.ktx2'):assert refs[name]
 aborted.append({'url':failure['url'],'filename':name,'independentServedSha256':served[name]['sha256'],'serverServedPinnedBytes':True,'loadedModelMaterialBindings':refs[name],'directLiveBindingProven':name=='5ac4f28aafa1a2c0c811.ktx2','qualification':'Server byte receipt and loaded model references do not independently prove eventual completion of each specific aborted browser request; request timestamps/retry completion events are absent.'})
harness=Path('/Users/stavreskimario/Desktop/penn-station-work/phase7-arrivals/native-arrivals-browser.cjs');source=harness.read_text();assert 'cache.set(file,b)'in source and '.end(cache.get(file))'in source
result={'schema':1,'status':'PASS: bounded native arrivals navigation and tested-asset identity; network caveat retained','auditedReportSha256':H(P.read_bytes()),'servedFileIndependentRehashSha256':H((D/'served-rehash.json').read_bytes()),'servedFileIndependentRehashTimeUtc':servedProof['checkedAtUtc'],'servedFileCount':81,'all12InputModelsPinned':True,'productionBundleSha256':expectedBundle,'fullConcourseSha256':expectedFull,'nativeRenderer':'WebGL 2 / Chrome '+j['browser'],'nativeLegsPassed':34,'routeTraceAndEndSnapshots':sum(len(p['trace'])+1for p in j['phases']),'allPresetRouteSnapshotsInspected':len(states),'sixZonesRemainVisibleWithSameSceneAndZoneIds':True,'inputActions':dict(collections.Counter(x['kind']for x in j['inputActions'])),'arrivalsOrbitWalkModeAndXzRestorePassed':True,'immediatePostToggleCameraDeltaFromWalkPresetM':restoreDelta,'settledArrivalEyeHeightAfterModeToggleProven':False,'actualPracticalLightsMatchedToGlowers':4,'actualLiveArrivalsAtlasMaterials':live,'phases':phases,'roundtripTerminalDistanceM':math.hypot(j['end']['camera']['position'][0]+67,j['end']['camera']['position'][2]-33),'pageErrors':0,'serverErrors':0,'consoleFontBlockedErrors':1,'intentionallyBlockedFontRequests':1,'localAbortedRequests':22,'allAbortedLocalResourcesServedPinnedBytes':True,'all21AbortedTexturesBindLoadedFullModelMaterials':True,'abortedLocalResources':aborted,'runtimePhysicalLinkSha256':H((D/'runtime-link.json').read_bytes()),'physicalSummarySha256':H(physicalPath.read_bytes()),'harnessSourceSha256':H(harness.read_bytes()),'browserClosedAtUtc':j['closed'],'browserClosed':True,'limits':['Independent after-close source-file rehash is separate from the harness, which cached first-served bytes and did not rehashatclose.','This audit inspected existing native-input evidence and read-only scene-light inspection; it did not launch a browser/GPU or write root.','The22localERR_ABORTED events remain qualified: all expected bytes were served and their textures are referenced by loaded models, but per-request retry completion and timing were not recorded. Only the freshARRAO has explicit live dimensions/channel evidence in this report.','The immediate Orbit→Walk snapshot restoresX/Zbut has+0.12mY, matching the orbit/walk preset height difference. The driver did not wait for settled arrivalYbefore selectingMain; exact arrival eye-height restoration is not proven by this receipt.','No new zero-network-failure, FPS, performance, physical-device/mobile, complete1935inventory, full historical accuracy or completed-arrivals claim.','Native balanced quality actually served the full six models; fallback variants are linked to prior decoded physical acceptance, not separately browsed in this run.'],'generatorSha256':H(Path(__file__).read_bytes())};out=D/'acceptance.json';assert not out.exists();out.write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({k:result[k]for k in ['status','auditedReportSha256','servedFileCount','nativeLegsPassed','routeTraceAndEndSnapshots','allPresetRouteSnapshotsInspected','inputActions','roundtripTerminalDistanceM','pageErrors','serverErrors','localAbortedRequests']},indent=2));print('acceptanceSha256',H(out.read_bytes()))
