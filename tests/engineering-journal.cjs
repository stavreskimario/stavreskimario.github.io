/* Run: NODE_PATH=/path/to/playwright/node_modules node tests/engineering-journal.cjs
 * Uses Playwright 1.51.1 + Chromium headless shell, an ephemeral local server and
 * synthetic metadata. It never polls publishers or touches the live site. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname,'..');
const key = 'mario-engineering-journal-v1';
const sources = [
  {id:'uber',name:'Uber',mark:'U',homepage:'https://www.uber.com/us/en/blog/engineering/',hosts:['www.uber.com'],description:'Engineering systems',method:'html',status:'ok'},
  {id:'openai',name:'OpenAI',mark:'O',homepage:'https://openai.com/news/engineering/',hosts:['openai.com'],description:'AI engineering',method:'html',status:'error'}
];
const articles = Array.from({length:36},(_,i)=>({id:(i+1).toString(16).padStart(24,'0'),sourceId:i%2?'openai':'uber',title:`${i%2?'Agent':'Storage'} engineering story ${i+1}`,url:i%2?`https://openai.com/index/story-${i}/`:`https://www.uber.com/us/en/blog/story-${i}/`,publishedAt:new Date(Date.now()-i*86400000).toISOString(),excerpt:'A short, verified publisher excerpt.',type:i%2?'research':'case-study',topics:i%2?['ai']:['architecture']}));
const data = {version:1,seed:false,lastPollAt:new Date(Date.now()-48*3600000).toISOString(),sources,articles};
const types = {'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg'};
const server=http.createServer(async(req,res)=>{
  try {
    let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname.endsWith('/'))pathname+='index.html';
    const file=path.resolve(root,'.'+pathname);
    if(!file.startsWith(root+path.sep))throw new Error('outside root');
    res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));
  } catch {res.statusCode=404;res.end('Not found');}
});
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:900},acceptDownloads:true});
  await context.route('**/data/catalogue.json',r=>r.fulfill({json:data}));
  await context.route(/https:\/\/fonts\./,r=>r.abort());
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const ready=async p=>{await p.goto(base+'/engineering-journal/');await p.waitForSelector('.article');};
  const count=()=>page.locator('.article').count();
  await ready(page);
  assert.equal(await count(),30);assert.match(await page.locator('#freshness').innerText(),/overdue.*source unavailable/);
  await page.locator('#load-more').click();assert.equal(await count(),36);
  assert.equal(await page.evaluate(()=>document.activeElement.closest('article').dataset.id),articles[30].id);
  await page.locator('#company-options input[value=uber]').check();assert.equal(await count(),18);
  await page.locator('[data-topic=ai]').click();assert.equal(await count(),0);
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();assert.equal(await count(),30);
  await page.locator('#search').fill('story 36');assert.equal(await count(),1);
  await page.locator('#reset-filters').click();
  await page.locator('#date-range').selectOption('7');assert.equal(await count(),7);
  await page.locator('#reset-filters').click();
  await page.locator('#article-type').selectOption('research');assert.equal(await count(),18);
  await page.locator('#reset-filters').click();
  // Icons and text inside a delegated button both activate it.
  await page.locator('[data-action=save] svg').first().click();
  await page.locator('[data-action=read]').first().click();
  await page.locator('#unread-only').check();assert.equal(await page.locator('#result-count').innerText(),'35 articles');
  await page.locator('#reset-filters').click();
  await page.locator('[data-view=saved]').click();assert.equal(await count(),1);
  await page.reload();await page.waitForSelector('.article');assert.equal(await count(),1);
  assert.equal(await page.locator('[data-action=read]').getAttribute('aria-pressed'),'true');
  await page.locator('.backup-tools summary').click();
  const downloadEvent=page.waitForEvent('download');await page.locator('#export-saved').click();
  const backup=JSON.parse(await fs.readFile(await (await downloadEvent).path(),'utf8'));
  assert.equal(Object.values(backup.entries).filter(e=>e.saved).length,1);
  const imported={version:1,entries:{[articles[1].id]:{article:articles[1],saved:true,read:false,changedAt:Date.now()}}};
  await page.locator('#import-saved').setInputFiles({name:'list.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
  await page.locator('#cancel-import').click();assert.equal(await count(),1);
  await page.locator('#import-saved').setInputFiles({name:'list.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});
  await page.locator('#confirm-import').click();assert.equal(await count(),2);
  const unsafe=structuredClone(imported);unsafe.entries[articles[1].id].article.url='javascript:alert(1)';
  await page.locator('#import-saved').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(unsafe))});
  await page.waitForFunction(()=>document.getElementById('storage-notice').textContent.includes('Could not import'));
  assert.equal(await count(),2);
  const second=await context.newPage();await ready(second);
  await second.locator('[data-action=save]').nth(2).click();
  await page.waitForFunction(()=>document.querySelectorAll('.article').length===3);
  await second.close();
  // Keyboard activation is immediate, retains focus after rerender and supports unsave.
  const save=page.locator('[data-action=save]').first();await save.focus();await page.keyboard.press('Enter');
  assert.equal(await count(),2);
  assert.equal(await page.evaluate(()=>document.activeElement.tagName),'BUTTON');
  assert.equal(await page.evaluate(()=>getComputedStyle(document.activeElement).transform),'none');
  await page.locator('[data-view=sources]').click();assert.equal(await page.locator('.source-card').count(),2);
  await page.getByRole('button',{name:'Browse articles'}).first().click();assert.equal(await count(),18);
  assert.match(page.url(),/companies=uber/);await page.goBack();assert.equal(await page.locator('#sources-view').isVisible(),true);
  await page.goto(base+'/engineering-journal/?companies=openai&topic=ai&type=research');await page.waitForSelector('.article');assert.equal(await count(),18);
  // Malicious titles are plain text; the application never builds catalogue HTML.
  const hostile=structuredClone(data);hostile.articles[0].title='<img src=x onerror=alert(1)>';
  await page.route('**/data/catalogue.json',r=>r.fulfill({json:hostile}));await ready(page);
  assert.equal(await page.locator('.article-title img').count(),0);
  await page.unroute('**/data/catalogue.json');
  for(const width of [390,320]) {
    await page.setViewportSize({width,height:844});await ready(page);
    assert.equal(await page.locator('#filter-details').getAttribute('open'),null);
    await page.locator('#filter-details summary').click();
    await page.locator('#company-options input[value=uber]').check();assert.equal(await count(),18);
    await page.addStyleTag({content:'html {font-size:200%}'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`No horizontal scroll at ${width}px / 200% text`);
  }
  await page.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});await ready(page);
  await page.locator('[data-topic=ai]').click();assert.equal(await count(),18);
  assert.equal(await page.locator('[data-topic=ai]').evaluate(el=>getComputedStyle(el).transform),'none');
  const blocked=await browser.newContext();await blocked.route('**/data/catalogue.json',r=>r.fulfill({json:data}));
  await blocked.route(/https:\/\/fonts\./,r=>r.abort());
  await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked');}}));
  const bp=await blocked.newPage();await ready(bp);await bp.locator('[data-action=save]').first().click();
  await bp.locator('[data-view=saved]').click();assert.equal(await bp.locator('.article').count(),1);
  assert.match(await bp.locator('#storage-notice').innerText(),/this visit/);
  const failed=await context.newPage();
  await failed.route('**/data/catalogue.json',r=>r.fulfill({status:503,body:'Unavailable'}));
  await failed.goto(base+'/engineering-journal/');
  await failed.waitForSelector('.empty-state');
  assert.match(await failed.locator('#freshness').innerText(),/could not be loaded/);
  assert.equal(await failed.getByRole('link',{name:'Uber Engineering',exact:true}).count(),1);
  const loading=await context.newPage();let release;
  const gate=new Promise(r=>release=r);
  await loading.route('**/data/catalogue.json',async r=>{await gate;await r.fulfill({json:data});});
  const loadingErrors=[];loading.on('pageerror',e=>loadingErrors.push(e.message));
  await loading.goto(base+'/engineering-journal/',{waitUntil:'domcontentloaded'});
  await loading.locator('#search').fill('story 36');release();
  await loading.waitForSelector('.article');
  assert.equal(await loading.locator('.article').count(),1);
  assert.deepEqual(loadingErrors,[]);
  await loading.close();await failed.close();
  // Real checked-in catalogue + collection manifest still load without a fixture.
  await context.unroute('**/data/catalogue.json');await page.emulateMedia({forcedColors:'none'});
  await page.setViewportSize({width:1280,height:900});await ready(page);
  assert.equal(Number(await page.locator('#latest-count').innerText()),JSON.parse(await fs.readFile(path.join(root,'engineering-journal/data/catalogue.json'))).articles.length);
  await page.goto(base+'/');await page.waitForSelector('a[href="./engineering-journal/"]');
  assert.deepEqual(errors,[]);
  console.log('PASS: filters, paging, save/read/reload, export/import/cancel/invalid import, cross-tab updates, keyboard focus, sources/history, safe text, 320/390px with 200% text, reduced motion, forced colours, blocked storage, real catalogue and collection link.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.close();});
