/* Browser regression checks for the offline/keyless Victorian electorate atlas.
 * Run: NODE_PATH=/path/to/playwright/node_modules node tests/victorian-election-odds.cjs */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.geojson':'application/geo+json','.json':'application/json'};
const server=http.createServer(async(req,res)=>{
 try{
  let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(pathname.endsWith('/'))pathname+='index.html';
  const file=path.resolve(root,'.'+pathname);
  if(!file.startsWith(root+path.sep))throw Error('Invalid path');
  res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');
  res.end(await fs.readFile(file));
 }catch{res.statusCode=404;res.end('Not found');}
});
let browser;
(async()=>{
 try{
  const geo=JSON.parse(await fs.readFile(path.join(root,'victorian-election-odds/electorates.geojson'),'utf8'));
  const odds=JSON.parse(await fs.readFile(path.join(root,'victorian-election-odds/odds.json'),'utf8'));
  const manifest=JSON.parse(await fs.readFile(path.join(root,'apps.json'),'utf8'));
  assert.deepEqual(manifest.apps.map(a=>a.id),['victorian-election-odds','hello-world']);
  assert.equal(geo.features.length,88);
  assert.equal(odds.markets.length,88);
  const normal=s=>s.toLowerCase().replace(/[^a-z0-9]/g,'');
  const names=new Set(geo.features.map(f=>normal(f.properties.name)));
  assert.equal(names.size,88);
  for(const m of odds.markets)assert(names.has(normal(m.name)),'Missing electorate '+m.name);
  assert(names.has('narracan'),'Narracan must be present');
  assert.equal(odds.markets.reduce((n,m)=>n+m.odds.length,0),386);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true});
  const errors=[],requests=[];
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>requests.push(r.url()));
  await page.route('**/*',route=>{
   if(route.request().url().startsWith(origin))return route.continue();
   return route.abort();
  });
  await page.goto(origin+'/');
  await page.waitForFunction(()=>document.querySelectorAll('#apps .project').length===2);
  assert.equal(await page.locator('a.project[href="./la-trip/"]').count(),0);
  assert.equal(await page.locator('a.project[href="./victorian-election-odds/"]').count(),1);
  await page.goto(origin+'/victorian-election-odds/');
  await page.locator('.atlas-shape').first().waitFor();
  assert.equal(await page.locator('.atlas-shape').count(),88);
  assert.equal(await page.locator('.atlas-shape[data-seat="Narracan"]').count(),1);
  assert.equal(await page.locator('.district-button').count(),88);
  assert.equal(await page.locator('#map-loading').isHidden(),true);
  const allView=await page.locator('svg.atlas-svg').getAttribute('viewBox');
  await page.locator('#seat-search').fill('Ivanhoe');
  assert.equal(await page.locator('.district-button').count(),1);
  await page.locator('.district-button').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#seat-title').innerText(),'Ivanhoe');
  assert((await page.locator('#seat-offers .offer').count())>=3);
  const chosenView=await page.locator('svg.atlas-svg').getAttribute('viewBox');
  assert.notEqual(allView,chosenView,'Selecting a district should zoom the map');
  await page.locator('#clear-search').click();
  await page.locator('#party-filter').selectOption('Greens');
  const greens=await page.locator('.district-button').count();
  assert(greens>0&&greens<88,'Filter should change the list');
  await page.locator('#party-filter').selectOption('All');
  assert.equal(await page.locator('.district-button').count(),88);
  await page.locator('.map-controls button[data-zoom="metro"]').click();
  const metroView=await page.locator('svg.atlas-svg').getAttribute('viewBox');
  assert.notEqual(metroView,chosenView);
  await page.locator('#zoom-in').click();
  const zoomed=await page.locator('svg.atlas-svg').getAttribute('viewBox');
  assert.notEqual(metroView,zoomed,'Zoom button must change view');
  await page.locator('.map-controls button[data-zoom="state"]').click();
  assert.equal(await page.locator('.map-controls button[data-zoom="state"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual(errors,[],'No client JavaScript errors on desktop');

  const phone=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const mobile=await phone.newPage();
  mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await mobile.goto(origin+'/victorian-election-odds/');
  await mobile.locator('.atlas-shape').first().waitFor();
  await mobile.locator('#seat-search').fill('Narracan');
  await mobile.locator('button[data-seat="Narracan"]').tap();
  assert.equal(await mobile.locator('#seat-title').innerText(),'Narracan');
  await mobile.locator('#zoom-in').tap();
  assert.equal(await mobile.locator('.atlas-shape').count(),88);
  const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+3);
  assert.equal(overflow,false,'No horizontal page overflow at phone width');
  assert.deepEqual(errors,[],'No client JavaScript errors on mobile/reduced motion');
  assert.equal(requests.filter(url=>!url.startsWith(origin)&&!/fonts.googleapis.com|fonts.gstatic.com/.test(url)).length,0,'No third-party map requests');
  await phone.close();await context.close();
  console.log('Election map checks passed: 88 local shapes, markets, filters, directory keyboard, map zoom, mobile and no map API.');
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(err=>{console.error(err);process.exitCode=1;});