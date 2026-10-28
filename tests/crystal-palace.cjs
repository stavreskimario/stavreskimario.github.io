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
  await page.route('**/cdn.jsdelivr.net/**',route=>route.abort());
  await page.goto(base+'/apps/crystal-palace/');
  await page.waitForFunction(()=>document.getElementById('model-status')?.textContent.includes('view'),{timeout:15000});
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
  assert.match((await download).suggestedFilename(),/crystal-palace-1851.*png/);
  await page.setViewportSize({width:375,height:812});
  assert.equal(await page.locator('#palace-canvas').isVisible(),true);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.locator('#zoom-in').click();
  assert.equal(await page.locator('#palace-canvas').isVisible(),true);
  console.log('PASS canonical app cards, legacy redirects, shared links, offline CAD fallback, views, layers, keyboard, PNG export, mobile layout and reduced motion.');
  await page.close();
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>server.close());
