const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const{chromium}=require('/Users/stavreskimario/Desktop/penn-station-work/tools/node_modules/playwright');
const root='/Users/stavreskimario/Desktop/penn-station-reconstruction',out=__dirname+'/'+(process.argv[2]||'native-v1');
const sha=b=>createHash('sha256').update(b).digest('hex');
const report={scope:'Paired fixed-camera render timings, static images and CPU collision inventory; no WASD/walking. Both served bundles append a read-only getter probe for the renderer/camera/scene; original source bodies and observer suffixes are separately hashed.',started:new Date().toISOString(),variants:[]};
let browser,server;const cache=new Map(),bundles={};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.wasm':'application/wasm','.ktx2':'image/ktx2'};
(async()=>{await fs.mkdir(out,{recursive:false});
 for(const mode of['baseline','candidate']){
  const original=await fs.readFile(mode==='baseline'?__dirname+'/baseline-app.js':root+'/penn-station-1935/dist/app.js');const text=original.toString();
  const renderer=text.match(/getMetrics:\(\)=>([\w$]+)\?\{calls:/)[1],camera=text.match(/getCamera:\(\)=>([\w$]+)\?\{position:/)[1],building=text.match(/getMaterialReport:\(\)=>[\w$]+\(([\w$]+)\)/)[1];
  const suffix=`\nwindow.__pennFrameProbe={get renderer(){return ${renderer}},get camera(){return ${camera}},get building(){return ${building}}};\n`;
  bundles[mode]={body:Buffer.concat([original,Buffer.from(suffix)]),originalSha256:sha(original),probeSha256:sha(suffix)};
 }
 server=http.createServer(async(req,res)=>{try{const u=new URL(req.url,'http://localhost'),parts=u.pathname.split('/').filter(Boolean),mode=parts.shift();assert(bundles[mode]);let rel=decodeURIComponent(parts.join('/'));assert(!rel.includes('..'));if(u.pathname.endsWith('/'))rel+='/index.html';const p=path.join(root,rel);let body;if(rel==='penn-station-1935/dist/app.js')body=bundles[mode].body;else{if(!cache.has(p))cache.set(p,await fs.readFile(p));body=cache.get(p);}res.writeHead(200,{'Content-Type':mime[path.extname(p)]||'application/octet-stream','Content-Length':body.length,'Cache-Control':'no-store'}).end(body);}catch(e){res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist']});
 for(const mode of['baseline','candidate']){
  const result={mode,originalBundleSha256:bundles[mode].originalSha256,probeSha256:bundles[mode].probeSha256,pageErrors:[],httpErrors:[],console:[],views:[]};report.variants.push(result);
  const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:1,reducedMotion:'reduce'});
  await context.route('**/*',route=>{const u=route.request().url();return /^(blob:|data:)/.test(u)||new URL(u).origin===origin?route.continue():route.abort('blockedbyclient');});
  const page=await context.newPage();page.on('pageerror',e=>result.pageErrors.push(e.message));page.on('response',r=>{if(r.status()>=400)result.httpErrors.push({url:r.url(),status:r.status()});});page.on('console',m=>{if(['error','warning'].includes(m.type()))result.console.push({type:m.type(),message:m.text()});});
  await page.goto(origin+'/'+mode+'/penn-station-1935/?renderer=webgl',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.pennStation&&!window.pennStation.getState().loading&&!window.pennStation.getState().error,null,{timeout:80000});
  await page.locator('[data-command="enter"]').click();
  for(const focus of['waiting','concourse','arrivals']){
   if(focus==='arrivals'){
    if(await page.locator('#map-control').getAttribute('open')===null)await page.locator('#map-control>summary').click();
    await page.locator('[data-command="focus"][data-value="arrivals"]').click();
    if(await page.locator('#map-control').getAttribute('open')!==null)await page.locator('#map-control>summary').click();
   }else await page.locator('[data-command="view"][data-value="'+focus+'"]:visible').first().click();
   await page.waitForTimeout(1000);
   const sample=await page.evaluate(async(focus)=>{
    const{renderer,camera,building}=window.__pennFrameProbe,scene=building.parent,gl=renderer.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');renderer.toneMappingExposure=focus==='waiting'?4.16:1.56;
    for(let i=0;i<8;i++)renderer.render(scene,camera);gl.finish();
    const timings=[];
    for(let i=0;i<24;i++){
     const q=ext?gl.createQuery():null;if(q)gl.beginQuery(ext.TIME_ELAPSED_EXT,q);
     const start=performance.now();renderer.render(scene,camera);if(q)gl.endQuery(ext.TIME_ELAPSED_EXT);gl.finish();const synchronousMilliseconds=performance.now()-start;
     let gpuMilliseconds=null;if(q){for(let n=0;n<100&&!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE);n++)await new Promise(r=>requestAnimationFrame(r));if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)&&!gl.getParameter(ext.GPU_DISJOINT_EXT))gpuMilliseconds=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gl.deleteQuery(q);}
     timings.push({synchronousMilliseconds,gpuMilliseconds});await new Promise(r=>requestAnimationFrame(r));
    }
    return{camera:window.pennStation.getCamera(),metrics:window.pennStation.getMetrics(),navigation:window.pennStation.getNavigation(),scene:window.pennStation.getScene(),prisms:window.pennStation.getPrismVisibility?.()??null,timings,timerExtension:Boolean(ext)};
   },focus);
   assert.equal(sample.scene.zones.length,6);assert(sample.scene.zones.every(z=>z.visible));
   sample.focus=focus;sample.screenshot=path.join(out,mode+'-'+focus+'.png');await page.screenshot({path:sample.screenshot});result.views.push(sample);
  }
  assert.equal(result.pageErrors.length,0);assert.equal(result.httpErrors.length,0);await context.close();
 }
 for(const before of report.variants[0].views){const after=report.variants[1].views.find(v=>v.focus===before.focus);assert.deepEqual(after.camera,before.camera,'Compared views have exact camera matrices');assert.equal(after.navigation.colliders,before.navigation.colliders,'Culled panels remain real walking supports');assert.equal(after.navigation.vaultLightColliders,before.navigation.vaultLightColliders);}
 report.status='PASS_PAIRED_TIMINGS_CAMERAS_AND_COLLISION_INVENTORY';
})().catch(e=>{report.status='FAIL';report.error=e.stack;process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)await new Promise(r=>server.close(r));report.closed=new Date().toISOString();report.browserClosed=true;await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');const median=a=>a.slice().sort((x,y)=>x-y)[Math.floor(a.length/2)];console.log(JSON.stringify({status:report.status,error:report.error,views:report.variants.flatMap(v=>v.views.map(x=>({mode:v.mode,focus:x.focus,triangles:x.metrics.triangles,calls:x.metrics.calls,prisms:x.prisms,medianSyncMs:median(x.timings.map(t=>t.synchronousMilliseconds)),medianGpuMs:median(x.timings.map(t=>t.gpuMilliseconds).filter(x=>x!==null))})))}));});
