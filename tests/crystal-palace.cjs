/* Browser smoke tests for canonical routes, legacy redirects and the WebGL fallback.
 * Run: NODE_PATH=/path/to/playwright/node_modules node tests/crystal-palace.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png'};
const server=http.createServer(async(req,res)=>{
 try{
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname.endsWith('/'))pathname+='index.html';
  const target=path.resolve(root,'.'+pathname);
  if(!target.startsWith(root+path.sep))throw Error('Outside root');
  const buffer=await fs.readFile(target);res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.end(buffer);
 }catch{res.writeHead(404);res.end('Not found')}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:850},acceptDownloads:true});
  await page.goto(base+'/');
  for(const slug of ['la-trip','hello-world','engineering-journal','crystal-palace'])
   assert.equal(await page.locator('a[href="./apps/'+slug+'/"]').count(),1,'Manifest card '+slug);
  await page.goto(base+'/hello-world/?via=old#main');
  await page.waitForURL(url=>url.pathname==='/apps/hello-world/'&&url.searchParams.get('via')==='old'&&url.hash==='#main');
  assert.equal(await page.locator('a[href="../../"]').count()>0,true,'All apps link corrected');

  // The realistic engine needs an external CDN. Fallback should remain usable offline.
  // Verify the real WebGL scene before deliberately blocking the CDN for fallback.
  const real=await browser.newPage({viewport:{width:1360,height:900},acceptDownloads:true});
  const threeErrors=[];real.on('pageerror',err=>threeErrors.push(err.message));
  // Serve exact version-pinned npm copies, avoiding flaky third-party CDN in CI.
  const threeBuild=path.join(path.dirname(require.resolve('three')),'three.module.js');
  const orbitModule=path.resolve(path.dirname(require.resolve('three')),'../examples/jsm/controls/OrbitControls.js');
  await real.route('**/cdn.jsdelivr.net/**',async route=>{
   const moduleFile=route.request().url().includes('OrbitControls.js')?orbitModule:threeBuild;
   await route.fulfill({body:await fs.readFile(moduleFile),contentType:'text/javascript',headers:{'Access-Control-Allow-Origin':'*'}});
  });
  await real.goto(base+'/apps/crystal-palace/',{waitUntil:'domcontentloaded'});
  try{
   await real.waitForFunction(()=>document.querySelector('#model-status')?.textContent.includes('Sydenham model ready.'),null,{timeout:45000});
  }catch(error){
   throw new Error('Sydenham WebGL scene failed: '+(await real.locator('#model-status').innerText())+'; errors: '+threeErrors.join('; ')+'; '+error.message);
  }
  const webgl=await real.locator('#palace-canvas').evaluate(el=>Boolean(el.getContext('webgl2')));
  assert.equal(webgl,true,'WebGL2 rendered the Sydenham model');
  await real.locator('button[data-preset="transept"]').click();
  assert.equal(await real.locator('button[data-preset="transept"]').getAttribute('aria-pressed'),'true');
  await real.locator('button[data-mode="blueprint"]').click();
  await real.locator('button[data-mode="reconstruction"]').click();
  if(process.env.PALACE_RENDER_SCREENSHOT)await real.locator('#model-stage').screenshot({path:process.env.PALACE_RENDER_SCREENSHOT});
  console.log('PASS true 3D WebGL model, transept camera and render modes.');
  await real.close();

  await page.route('**/cdn.jsdelivr.net/**',route=>route.abort());
  await page.goto(base+'/apps/crystal-palace/');
  await page.waitForFunction(()=>document.getElementById('model-status')?.textContent.includes('view'),{timeout:15000});
  assert.match(await page.locator('#model-status').innerText(),/Sydenham/i);
  const size=await page.locator('#palace-canvas').evaluate(canvas=>[canvas.width,canvas.height]);
  assert(size[0]>200&&size[1]>200,'Canvas rendered by fallback');
  await page.locator('button[data-preset="plan"]').click();
  assert.equal(await page.locator('button[data-preset="plan"]').getAttribute('aria-pressed'),'true');
  await page.locator('button[data-mode="blueprint"]').click();
  assert.equal(await page.locator('button[data-mode="blueprint"]').getAttribute('aria-pressed'),'true');
  await page.locator('input[data-layer="roof"]').uncheck();
  assert.equal(await page.locator('input[data-layer="roof"]').isChecked(),false);
  await page.locator('#palace-canvas').focus();
  await page.keyboard.press('0');
  assert.equal(await page.locator('button[data-preset="isometric"]').getAttribute('aria-pressed'),'true');
  const download=page.waitForEvent('download');
  await page.locator('#export-view').click();
  assert.match((await download).suggestedFilename(),/crystal-palace-sydenham.*png/);
  await page.setViewportSize({width:375,height:812});
  assert.equal(await page.locator('#palace-canvas').isVisible(),true);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#zoom-in').click();
  assert.equal(await page.locator('#palace-canvas').isVisible(),true);
  console.log('PASS canonical app cards, legacy redirects, shared links, offline Sydenham elevation, views, layers, keyboard, PNG export, mobile layout and reduced motion.');
  await page.close();
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>server.close());
