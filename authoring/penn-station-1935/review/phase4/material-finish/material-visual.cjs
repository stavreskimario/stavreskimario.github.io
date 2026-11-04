const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { chromium } = require('/Users/stavreskimario/Desktop/penn-station-work/tools/node_modules/playwright');
const root = '/Users/stavreskimario/Desktop/penn-station-reconstruction';
const work = '/Users/stavreskimario/Desktop/penn-station-work';
const output = path.join(work, 'material-visual');
const mimes = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ktx2':'image/ktx2','.wasm':'application/wasm'};
(async()=>{
 await fs.mkdir(output,{recursive:true});
 const report = { scope:'Isolated before/after material review with frozen Phase3 production bundle/assets. The after mount overrides only the six reviewed GLBs and derived colour maps. It is not final integrated Phase4 QA.', records:[] };
 report.bundleSha256 = createHash('sha256').update(await fs.readFile(path.join(work,'material-baseline-dist/app.js'))).digest('hex');
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');
   const match=url.pathname.match(/^\/(before|after)\/(.*)$/); if(!match){res.writeHead(404).end();return;}
   let relative=decodeURIComponent(match[2]);if(relative.includes('..')){res.writeHead(403).end();return;}
   if(relative.endsWith('/'))relative+='index.html';
   let file=path.join(root,relative);
   if(relative.startsWith('penn-station-1935/assets/')){
    const asset=relative.slice('penn-station-1935/assets/'.length);
    file=path.join(work,'material-baseline-assets',asset);
    if(match[1]==='after')try{const candidate=path.join(work,'material-finish-preview',asset);await fs.access(candidate);file=candidate;}catch{}
   } else if(relative.startsWith('penn-station-1935/dist/'))file=path.join(work,'material-baseline-dist',relative.slice('penn-station-1935/dist/'.length));
   const bytes=await fs.readFile(file);res.writeHead(200,{'Content-Type':mimes[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'}).end(bytes);
  }catch{res.writeHead(404).end();}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin='http://127.0.0.1:'+server.address().port;
 let browser;
 try{
  browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal','--enable-webgl','--ignore-gpu-blocklist','--disable-dev-shm-usage']});
  report.browser=browser.version();
  for(const mount of ['before','after']){
   const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
   const page=await context.newPage();const record={mount,pageErrors:[],consoleErrors:[],failedRequired:[],views:[]};report.records.push(record);
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort('blockedbyclient'));
   page.on('pageerror',error=>record.pageErrors.push(error.message));
   page.on('console',message=>{if(message.type()==='error'&&!message.text().includes('ERR_BLOCKED_BY_CLIENT'))record.consoleErrors.push(message.text());});
   page.on('response',response=>{if(response.url().startsWith(origin)&&response.status()>=400)record.failedRequired.push({url:response.url(),status:response.status()});});
   await page.goto(`${origin}/${mount}/penn-station-1935/`);
   await page.waitForFunction(()=>window.pennStation&&!window.pennStation.getState().loading&&!window.pennStation.getState().error,null,{timeout:120000});
   await page.locator('[data-command="enter"]').click();
   for(const view of ['exterior','waiting','concourse']){
    await page.locator(`.viewpoints [data-command="view"][data-value="${view}"]`).click();
    await page.waitForFunction(v=>{const s=window.pennStation.getState();return s.view===v&&!s.loading&&!s.error;},view,{timeout:120000});
    let previous=-1,stable=0;
    for(let i=0;i<18;i++){await page.waitForTimeout(500);const exposure=await page.evaluate(()=>window.pennStation.getMetrics().exposure);if(Math.abs(exposure-previous)<.00015)stable++;else stable=0;previous=exposure;if(stable>=2)break;}
    const details=await page.evaluate(()=>{const canvas=document.querySelector('#scene-root canvas');const gl=canvas.getContext('webgl2');const ext=gl.getExtension('WEBGL_debug_renderer_info');return{state:window.pennStation.getState(),camera:window.pennStation.getCamera(),metrics:window.pennStation.getMetrics(),scene:window.pennStation.getScene(),driver:gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL||gl.RENDERER)};});
    assert.match(details.driver,/Metal/);
    await page.screenshot({path:path.join(output,`${mount}-${view}.png`)});
    record.views.push({view,...details});
    console.log(mount,view,details.metrics.exposure,details.metrics.textures);
   }
   assert.equal(record.pageErrors.length,0);assert.equal(record.failedRequired.length,0);
   await context.close();
  }
  report.passed=true;
 }finally{
  if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));
  await fs.writeFile(path.join(output,'material-review.json'),JSON.stringify(report,null,2)+'\n');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
