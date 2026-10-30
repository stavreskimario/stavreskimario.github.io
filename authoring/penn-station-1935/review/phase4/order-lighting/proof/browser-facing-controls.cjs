const http=require('node:http');const fs=require('node:fs/promises');const path=require('node:path');const assert=require('node:assert/strict');const {createHash}=require('node:crypto');
const repo=process.env.PENN_REPO||path.resolve(__dirname,'../../../../../..');
const work=process.env.PENN_WORK||path.join(path.dirname(repo),'penn-station-work');
const tools=process.env.PENN_TOOLS||path.join(work,'tools');
const {build}=require(path.join(tools,'node_modules/esbuild'));const {chromium}=require(path.join(tools,'node_modules/playwright'));

const out=path.join(work,'waiting-material-diagnostics-facing');const hash=b=>createHash('sha256').update(b).digest('hex');
const hook=String.raw`
let diagnosticScene=null,diagnosticInvalidate=()=>{};
const diagnosticMaterials=new Map(),diagnosticObjects=new Map(),diagnosticLights=new Map();
window.__pennLightingDiagnostics={
 set(options={}){
  if(!debugBuilding||!diagnosticScene)throw new Error('Scene not ready');
  debugBuilding.traverse(object=>{
   if(!object.isMesh)return;
   if(!diagnosticObjects.has(object))diagnosticObjects.set(object,{castShadow:object.castShadow,receiveShadow:object.receiveShadow});
   const original=diagnosticObjects.get(object);object.castShadow=original.castShadow;object.receiveShadow=original.receiveShadow;
   for(const material of Array.isArray(object.material)?object.material:[object.material]){
    if(!diagnosticMaterials.has(material))diagnosticMaterials.set(material,{aoMap:material.aoMap,aoMapIntensity:material.aoMapIntensity,lightMap:material.lightMap,lightMapIntensity:material.lightMapIntensity,envMap:material.envMap,envMapIntensity:material.envMapIntensity,map:material.map,normalMap:material.normalMap,roughnessMap:material.roughnessMap,metalnessMap:material.metalnessMap,color:material.color?.clone(),normalScale:material.normalScale?.clone(),roughness:material.roughness,metalness:material.metalness,side:material.side});
    const saved=diagnosticMaterials.get(material);
    for(const key of ['aoMap','aoMapIntensity','lightMap','lightMapIntensity','envMap','envMapIntensity','map','normalMap','roughnessMap','metalnessMap','roughness','metalness','side'])material[key]=saved[key];
    if(material.color&&saved.color)material.color.copy(saved.color);if(material.normalScale&&saved.normalScale)material.normalScale.copy(saved.normalScale);
    if(options.doubleSided)material.side=THREE.DoubleSide;
    if(options.ao===false)material.aoMapIntensity=0;
    if(options.lightmap===false)material.lightMapIntensity=0;
    if(options.ibl===false)material.envMapIntensity=0;
    if(options.normal===false&&material.normalScale)material.normalScale.set(0,0);
    if(options.mode&&saved.lightMap){
     material.map=null;material.normalMap=null;material.roughnessMap=null;material.metalnessMap=null;material.color.setRGB(1,1,1);material.roughness=1;material.metalness=0;
     material.envMapIntensity=0;
     material.aoMapIntensity=options.mode==='ao-only'?1:0;
     material.lightMapIntensity=options.mode==='lightmap-only'?saved.lightMapIntensity:0;
    }
    material.needsUpdate=true;
   }
  });
  diagnosticScene.traverse(light=>{
   if(!light.isLight)return;
   if(!diagnosticLights.has(light))diagnosticLights.set(light,{intensity:light.intensity,castShadow:light.castShadow,color:light.color.clone(),groundColor:light.groundColor?.clone(),normalBias:light.shadow?.normalBias,bias:light.shadow?.bias});
   const saved=diagnosticLights.get(light);light.intensity=saved.intensity;light.castShadow=saved.castShadow;light.color.copy(saved.color);if(light.groundColor&&saved.groundColor)light.groundColor.copy(saved.groundColor);
   if(light.shadow){light.shadow.normalBias=saved.normalBias;light.shadow.bias=saved.bias;}
   if(light.isDirectionalLight){if(options.sun===false||options.mode)light.intensity=0;if(options.sunShadows===false)light.castShadow=false;}
   if(light.isHemisphereLight){if(options.hemisphere===false||options.mode)light.intensity=0;if(options.mode==='ao-only'){light.intensity=1;light.color.setRGB(1,1,1);light.groundColor.setRGB(1,1,1);}}
   if(options.mode&&light.isSpotLight)light.intensity=0;
  });
  diagnosticScene.overrideMaterial=options.facing?new THREE.ShaderMaterial({side:THREE.DoubleSide,vertexShader:'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'void main(){gl_FragColor=gl_FrontFacing?vec4(.9,.9,.9,1.):vec4(1.,0.,0.,1.);}'}):null;
  window.__pennDiagFreezeExposure=true;
  diagnosticInvalidate();
  return {options,materials:diagnosticMaterials.size,exposure:debugRenderer.toneMappingExposure,lights:[...diagnosticLights.keys()].map(light=>({type:light.type,intensity:light.intensity,castShadow:light.castShadow,normalBias:light.shadow?.normalBias,bias:light.shadow?.bias}))};
 }
};
`;
(async()=>{
 await fs.mkdir(path.join(out,'src'),{recursive:true});
 const original=await fs.readFile(path.join(repo,'penn-station-1935/src/app.jsx'),'utf8');
 let source=original.replace('function Scene() {','function Scene() {\n  const diagnosticContext=useThree();diagnosticScene=diagnosticContext.scene;diagnosticInvalidate=diagnosticContext.invalidate;');
 source=source.replace('useFrame((_, delta) => {\n    const interval =','useFrame((_, delta) => {\n    if(window.__pennDiagFreezeExposure)return;\n    const interval =');
 assert.notEqual(source,original);source+='\n'+hook;
 await fs.writeFile(path.join(out,'src/app.jsx'),source);
 for(const name of ['lighting.mjs','stair-contact.mjs'])await fs.copyFile(path.join(repo,'penn-station-1935/src',name),path.join(out,'src',name));
 await build({entryPoints:[path.join(out,'src/app.jsx')],bundle:true,splitting:true,format:'esm',target:['es2022'],minify:true,outdir:path.join(out,'dist'),entryNames:'app',chunkNames:'chunks/[name]-[hash]',nodePaths:[path.join(tools,'node_modules')],legalComments:'linked',define:{'process.env.NODE_ENV':'"production"'}});
 const report={scope:'Scratch-only actual browser same-camera lighting isolation. No geometry or runtime mutations; candidate phase4-runtime-final data, preliminary old probes.',sourceAppSha256:hash(Buffer.from(original)),diagnosticBundleSha256:hash(await fs.readFile(path.join(out,'dist/app.js'))),variants:[],requests:[],pageErrors:[]};
 const mime={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.ktx2':'image/ktx2','.wasm':'application/wasm'};const cache=new Map();
 const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');if(!url.pathname.startsWith('/diag/')){res.writeHead(404).end();return;}let relative=decodeURIComponent(url.pathname.slice(6));if(relative.includes('..')){res.writeHead(403).end();return;}if(relative.endsWith('/'))relative+='index.html';let file=path.join(repo,relative);if(relative.startsWith('penn-station-1935/assets/'))file=path.join(process.env.PENN_DIAG_ASSETS||path.join(work,'phase4-runtime-final'),relative.slice('penn-station-1935/assets/'.length));if(relative.startsWith('penn-station-1935/dist/'))file=path.join(out,'dist',relative.slice('penn-station-1935/dist/'.length));if(!cache.has(file)){const bytes=await fs.readFile(file);cache.set(file,bytes);report.requests.push({file,bytes:bytes.length,sha256:hash(bytes)});}res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(cache.get(file));}catch(e){res.writeHead(404).end();report.pageErrors.push('Server '+req.url+': '+e.message);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;let browser;
 try{
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage']});
  report.browser=browser.version();const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});const page=await context.newPage();
  await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort('blockedbyclient'));
  page.on('pageerror',e=>report.pageErrors.push(e.message));await page.goto(origin+'/diag/penn-station-1935/');
  await page.waitForFunction(()=>window.pennStation&&!window.pennStation.getState().loading&&!window.pennStation.getState().error,null,{timeout:180000});
  await page.locator('[data-command="enter"]').click();await page.locator('.viewpoints [data-command="view"][data-value="waiting"]').click();
  await page.waitForFunction(()=>window.pennStation.getState().view==='waiting'&&!window.pennStation.getState().loading,null,{timeout:180000});
  await page.waitForTimeout(5000);const camera=await page.evaluate(()=>window.pennStation.getCamera());report.camera=camera;
  for(const [name,options] of [['baseline',{}],['double-sided',{doubleSided:true}],['front-back-faces',{facing:true}],['ao-double-sided',{mode:'ao-only',doubleSided:true}]]){
   const settings=await page.evaluate(options=>window.__pennLightingDiagnostics.set(options),options);
   await page.waitForTimeout(900);const current=await page.evaluate(()=>({camera:window.pennStation.getCamera(),metrics:window.pennStation.getMetrics()}));assert.deepEqual(current.camera,camera);
   await page.screenshot({path:path.join(out,name+'.png')});report.variants.push({name,...settings,...current});console.log(name,settings.exposure);
  }
  assert.equal(report.pageErrors.length,0);await context.close();
 }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));await fs.writeFile(path.join(out,'diagnostic-report.json'),JSON.stringify(report,null,2)+'\n');}
})().catch(e=>{console.error(e);process.exitCode=1;});
