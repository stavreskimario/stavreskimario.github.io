/* NODE_PATH=/path/to/node_modules node tests/animations.cjs
 * Playwright 1.51.1 / Chromium. Local fixtures; no publisher requests or live writes.
 * See docs/ANIMATION_RECIPES.md for installation and physical-device limitations. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require('playwright');
const root = path.resolve(__dirname, '..');
const key = 'mario-engineering-journal-v1';
const articles = [1,2,3].map(n=>({id:n.toString(16).padStart(24,'0'),sourceId:'uber',title:`Engineering example ${n}`,url:`https://www.uber.com/us/en/blog/example-${n}/`,excerpt:'A short engineering example.',topics:['architecture'],type:'case-study',publishedAt:`2026-09-0${4-n}T00:00:00Z`}));
const catalogue = {version:1,seed:true,articles,sources:[{id:'uber',name:'Uber Engineering',mark:'U',homepage:'https://www.uber.com/us/en/blog/engineering/',hosts:['www.uber.com'],description:'Engineering systems',method:'html',status:'ok'}]};
const backup = {name:'reading-list.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,entries:{[articles[0].id]:{article:articles[0],saved:true,read:false,changedAt:1}}}))};
const server = http.createServer(async(req,res)=>{
  try {
    let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(name.endsWith('/'))name+='index.html';
    const file=path.resolve(root,'.'+name);
    if(!file.startsWith(root+path.sep))throw new Error('Outside root');
    res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.jpg':'image/jpeg','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
    res.end(await fs.readFile(file));
  } catch {res.writeHead(404).end();}
});
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;
  browser=await chromium.launch();
  const errors=[];
  async function open(app,{width=1280,touch=false,motion=true,reducedMotion='no-preference'}={}) {
    const context=await browser.newContext({viewport:{width,height:900},hasTouch:touch,isMobile:touch,reducedMotion});
    await context.route('**/*',r=>r.request().url().startsWith(origin)&&(motion||!r.request().url().includes('/shared/motion.css'))?r.continue():r.abort());
    await context.route('**/data/catalogue.json',r=>r.fulfill({json:catalogue}));
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/'+app+'/');
    if(app==='engineering-journal')await page.waitForSelector('.article');
    return {page,context};
  }
  async function keyClick(page,selector,keyName='Enter') {
    await page.locator(selector).first().focus();await page.keyboard.press(keyName);
  }
  async function finish(locator) {
    await locator.evaluate(el=>el.getAnimations({subtree:true}).forEach(a=>a.finish()));
  }
  async function midpoint(locator,property) {
    return locator.evaluate(async(el,property)=>{
      // Native details updates its internal content box at the rendering boundary.
      await new Promise(requestAnimationFrame);
      const animations=el.getAnimations({subtree:true});
      const a=animations.find(a=>a.transitionProperty===property);
      if(!a)return null;
      for(const animation of animations){animation.pause();animation.currentTime=animation.effect.getTiming().duration/2;}
      const style=getComputedStyle(el);
      return {opacity:Number(style.opacity),matrix:[...new DOMMatrixReadOnly(style.transform).toFloat64Array()],height:parseFloat(getComputedStyle(el,'::details-content').height)};
    },property);
  }
  async function noTransition(locator) {
    assert.equal(await locator.evaluate(el=>el.getAnimations({subtree:true}).length),0,'Immediate feedback has no CSS transitions');
  }
  async function disclosureFrames(locator,action) {
    // Chromium's UA-shadow ::details-content transitions are not returned by
    // Element.getAnimations(). Observe the rendered height on real frames instead.
    await locator.evaluate(el=>{
      window.disclosureSamples=new Promise(resolve=>{
        const heights=[el.getBoundingClientRect().height];let start;
        function sample(now){start??=now;heights.push(el.getBoundingClientRect().height);if(now-start<320)requestAnimationFrame(sample);else resolve(heights);}
        requestAnimationFrame(sample);
      });
    });
    await action();
    return locator.evaluate(()=>window.disclosureSamples);
  }
  function hasIntermediate(heights) {
    const low=Math.min(...heights),high=Math.max(...heights);
    return heights.some(h=>h>low+.5&&h<high-.5);
  }
  async function aligned(page) {
    assert(await page.evaluate(()=>{
      const selected=document.querySelector('.view-buttons [aria-pressed=true]'),indicator=document.querySelector('.view-indicator');
      const a=selected.getBoundingClientRect(),b=indicator.getBoundingClientRect();
      return Math.abs(a.left-b.left)<1&&Math.abs(a.width-b.width)<1;
    }),'Underline matches the selected button after layout');
  }
  // Retarget a real transition. Data, focus and content must already be committed.
  const journal=await open('engineering-journal'),p=journal.page;
  const save=p.locator('[data-action=save]').first(),fill=save.locator('.bookmark-fill');
  const original=await save.elementHandle();
  await save.click();
  assert(await save.evaluate((el,original)=>el===original,original),'Saving retains the button DOM');
  assert.equal(await save.getAttribute('aria-pressed'),'true');
  assert.equal(await p.evaluate(key=>Object.values(JSON.parse(localStorage.getItem(key)).entries)[0].saved,key),true,'Storage commits before feedback completes');
  const savedMid=await midpoint(fill,'opacity');
  assert(savedMid&&savedMid.opacity>0&&savedMid.opacity<1,'Bookmark has an actual intermediate fill');
  await save.click();
  const reversed=await midpoint(fill,'opacity');
  assert(reversed&&reversed.opacity<savedMid.opacity,'An interrupted bookmark fill reverses');
  assert.equal(await save.getAttribute('aria-pressed'),'false');
  await finish(fill);
  assert.equal(await fill.evaluate(el=>getComputedStyle(el).opacity),'0');
  await keyClick(p,'[data-action=save]');
  assert.equal(await save.getAttribute('aria-pressed'),'true');await noTransition(fill);
  assert(await save.evaluate(el=>el===document.activeElement),'Keyboard save preserves focus');

  const indicator=p.locator('.view-indicator');
  await p.locator('[data-view=saved]').click();
  assert.equal(await p.locator('.article').count(),1,'Selected content is immediate');
  const viewMid=await midpoint(indicator,'transform');
  const target=await p.locator('[data-view=saved]').evaluate(el=>el.offsetLeft);
  assert(viewMid&&viewMid.matrix[12]>0&&viewMid.matrix[12]<target,'Underline travels between views');
  await p.locator('[data-view=latest]').click();
  assert.equal(await p.locator('.article').count(),3);
  const viewReverse=await midpoint(indicator,'transform');
  assert(viewReverse&&viewReverse.matrix[12]<viewMid.matrix[12],'Underline reverses from its current presentation');
  await finish(indicator);await aligned(p);
  await p.locator('[data-view=sources]').click();
  await keyClick(p,'[data-view=latest]');await noTransition(indicator);await aligned(p);
  await p.locator('[data-view=saved]').evaluate(el=>el.click());
  await noTransition(indicator);await aligned(p);
  // Native import: a pointer-opened dialog animates, closes immediately and can reopen.
  await p.locator('.backup-tools summary').click();
  await p.locator('#import-saved').setInputFiles(backup);
  const dialog=p.locator('#import-dialog');
  const dialogMid=await midpoint(dialog,'opacity');
  assert(dialogMid&&dialogMid.opacity>0&&dialogMid.opacity<1&&dialogMid.matrix[0]>=.97&&dialogMid.matrix[0]<1);
  assert(await p.locator('#confirm-import').evaluate(el=>el===document.activeElement));
  await finish(dialog);
  await p.locator('#cancel-import').click();
  assert.equal(await dialog.evaluate(el=>el.open),false);
  assert.equal(await dialog.evaluate(el=>getComputedStyle(el).pointerEvents),'none');
  await p.waitForFunction(()=>document.activeElement.id==='export-saved');
  await p.locator('#import-saved').setInputFiles(backup);
  assert(await dialog.evaluate(el=>el.open),'Reopen is not locked by exit');
  await p.keyboard.press('Escape');await noTransition(dialog);
  await p.waitForFunction(()=>document.activeElement.id==='export-saved');
  console.log('PASS Journal bookmark continuity, immediate persistence/focus, view retargeting and native import dialog');

  // Native details animate actual intrinsic height in both directions where supported.
  const mobile=await open('engineering-journal',{width:390,touch:true}),m=mobile.page;
  const details=m.locator('#filter-details');
  assert(await m.evaluate(()=>CSS.supports('interpolate-size','allow-keywords')),'Test browser covers intrinsic-size enhancement');
  const expanded=await disclosureFrames(details,()=>m.locator('#filter-details summary').tap());
  assert(hasIntermediate(expanded)&&expanded.at(-1)>expanded[0],'First touch opens through intermediate heights');
  const collapsed=await disclosureFrames(details,()=>m.locator('#filter-details summary').tap());
  assert(hasIntermediate(collapsed)&&collapsed.at(-1)<collapsed[0],'Collapse preserves content while shrinking');
  const keyed=await disclosureFrames(details,()=>keyClick(m,'#filter-details summary'));
  assert(!hasIntermediate(keyed),'Keyboard opens details instantly');
  assert(await details.evaluate(el=>el.open));
  await m.locator('#filter-details summary').tap();
  await m.keyboard.press('Tab');
  assert(await details.evaluate(el=>Math.abs(el.getBoundingClientRect().height-el.querySelector('summary').getBoundingClientRect().height)<1),'Keyboard input settles a pointer collapse');
  await keyClick(m,'#filter-details summary');
  await m.locator('#company-options input').check();
  assert.equal(await m.locator('.article').count(),3);
  await m.addStyleTag({content:'html{font-size:200%}'});
  await m.setViewportSize({width:320,height:900});
  await m.waitForFunction(()=>{
    const a=document.querySelector('.view-buttons [aria-pressed=true]').getBoundingClientRect(),b=document.querySelector('.view-indicator').getBoundingClientRect();
    return Math.abs(a.left-b.left)<1&&Math.abs(a.width-b.width)<1;
  });
  await aligned(m);
  assert(await m.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'320px / 200% text has no horizontal page overflow');
  await mobile.context.close();
  console.log('PASS touch disclosures open/close, keyboard interruption and enlarged-text underline layout');

  const trip=await open('la-trip'),t=trip.page;
  await keyClick(t,'.main-nav [data-view=packing]');
  const item=t.locator('#packing-groups input').first(),meter=t.locator('#packing-fill');
  const packId=await item.getAttribute('data-pack-id');
  await item.click();
  const progress=await t.getByRole('progressbar',{name:'Packing progress'}).evaluate(el=>({value:el.value,max:el.max}));
  assert.equal(progress.value,1,'Native progress changes immediately');
  assert(await t.evaluate(id=>JSON.parse(localStorage.getItem('mario-la-dec2026-packing-v1')).checked[id],packId));
  const packingMid=await midpoint(meter,'transform');
  assert(packingMid&&packingMid.matrix[0]>0&&packingMid.matrix[0]<1/progress.max);
  await item.click();
  const packingReverse=await midpoint(meter,'transform');
  assert(packingReverse&&packingReverse.matrix[0]<packingMid.matrix[0]);
  await finish(meter);
  await keyClick(t,'#packing-groups input',' ');await noTransition(meter);
  assert.equal(await t.locator('#packing-progress').evaluate(el=>el.value),1);
  await t.reload();await keyClick(t,'.main-nav [data-view=packing]');
  assert(await item.isChecked(),'Packing persists after reload');
  await t.setViewportSize({width:320,height:900});
  const largeText=await t.addStyleTag({content:'html{font-size:200%}'});
  await t.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const packingLayout=await t.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>el.id||el.className||el.tagName).slice(0,12)}));
  if(packingLayout.scroll>packingLayout.width+1)console.log(await t.evaluate(()=>{
    const text=[],walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
    while(node=walker.nextNode()){const range=document.createRange();range.selectNodeContents(node);const rect=range.getBoundingClientRect();if(rect.right>innerWidth+1)text.push({text:node.textContent.slice(0,80),right:rect.right,parent:node.parentElement.className});}
    return {text,boxes:[...document.querySelectorAll('body *')].filter(el=>el.scrollWidth>el.clientWidth+5&&el.clientWidth>0).map(el=>({tag:el.id||el.className||el.tagName,scroll:el.scrollWidth,client:el.clientWidth})).slice(0,20)};
  }));
  assert(packingLayout.scroll<=packingLayout.width+1,'Packing progress and counts fit 320px / 200% text: '+JSON.stringify(packingLayout));
  await largeText.evaluate(el=>el.remove());await t.setViewportSize({width:1280,height:900});
  await keyClick(t,'.main-nav [data-view=reservations]');
  const booking=t.locator('.reservation').first();
  // Published bookings may start open: establish a closed baseline via keyboard.
  if(await booking.evaluate(el=>el.open)) {await booking.locator('summary').focus();await t.keyboard.press('Enter');}
  const bookingFrames=await disclosureFrames(booking,()=>booking.locator('summary').click());
  assert(hasIntermediate(bookingFrames),'LA booking uses the native disclosure recipe');
  await t.keyboard.press('Tab');await noTransition(booking);
  await trip.context.close();
  console.log('PASS LA packing intermediate/reversed progress, immediate native value/storage, reload and booking disclosure');

  // Preference changes and the visibility handler settle an in-flight transition.
  await keyClick(p,'[data-view=latest]');
  await p.locator('[data-view=sources]').click();
  assert(await midpoint(indicator,'transform'));
  await p.emulateMedia({reducedMotion:'reduce',forcedColors:'active'});
  await noTransition(indicator);await aligned(p);
  await p.locator('[data-view=latest]').click();await noTransition(indicator);
  await p.locator('[data-action=save]').first().click();await noTransition(p.locator('.bookmark-fill').first());
  assert.notEqual(await indicator.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
  await p.emulateMedia({reducedMotion:'no-preference',forcedColors:'none'});
  await p.locator('[data-view=sources]').click();
  assert(await midpoint(indicator,'transform'));
  // Synthetic visibility boundary exercises app cleanup, not physical background throttling.
  await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await noTransition(indicator);await aligned(p);
  await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
  await noTransition(indicator);
  await journal.context.close();
  for(const app of ['la-trip','engineering-journal']) {
    const reduced=await open(app,{width:390,touch:true,reducedMotion:'reduce'}),r=reduced.page;
    if(app==='la-trip'){
      await r.locator('.main-nav [data-view=packing]').tap();await r.locator('#packing-groups input').first().tap();await noTransition(r.locator('#packing-fill'));
      await r.locator('.main-nav [data-view=reservations]').tap();
      const frames=await disclosureFrames(r.locator('.reservation').first(),()=>r.locator('.reservation summary').first().tap());assert(!hasIntermediate(frames),'Reduced-motion booking is instant');
    } else {
      const frames=await disclosureFrames(r.locator('#filter-details'),()=>r.locator('#filter-details summary').tap());assert(!hasIntermediate(frames),'Reduced-motion filters are instant');
      await r.locator('[data-action=save]').first().tap();await noTransition(r.locator('.bookmark-fill').first());
    }
    await reduced.context.close();
  }
  console.log('PASS live reduced-motion change, static touch feedback, forced colours and visibility cleanup');

  // Missing optional CSS preserves native interactions; root/starter remain usable.
  for(const app of ['la-trip','engineering-journal']) {
    const fallback=await open(app,{width:390,motion:false}),f=fallback.page;
    if(app==='la-trip'){
      await f.locator('#add-event').click();assert(await f.locator('#itinerary-editor').evaluate(el=>el.open));await f.keyboard.press('Escape');
      await f.locator('.main-nav [data-view=packing]').click();await f.locator('#packing-groups input').first().check();
      assert.equal(await f.locator('#packing-progress').evaluate(el=>el.value),1);
    } else {
      await f.locator('#filter-details summary').click();assert(await f.locator('#filter-details').evaluate(el=>el.open));
      await f.locator('[data-action=save]').first().click();await f.locator('[data-view=saved]').click();assert.equal(await f.locator('.article').count(),1);
      await f.locator('.backup-tools summary').click();await f.locator('#import-saved').setInputFiles(backup);assert(await f.locator('#import-dialog').evaluate(el=>el.open));await f.keyboard.press('Escape');
    }
    await fallback.context.close();
  }
  const starter=await open('hello-world'),s=starter.page;
  await s.locator('#name').fill('Mario');await s.getByRole('button',{name:'Say hello'}).click();
  assert.equal(await s.locator('#greeting-title').innerText(),'Hello, Mario.');
  await keyClick(s,'[data-style=warm]');assert.equal(await s.locator('#greeting-title').innerText(),'Hello, Mario!');
  await s.locator('#reset').click();assert.equal(await s.locator('#greeting-title').innerText(),'Hello, world.');
  await s.goto(origin+'/');await s.waitForSelector('a[href="./engineering-journal/"]');
  for(const app of ['la-trip','hello-world','engineering-journal'])assert(await s.locator(`a[href="./${app}/"]`).count());
  await starter.context.close();
  assert.deepEqual(errors,[]);
  console.log('PASS optional-stylesheet fallback, collection/Hello World smoke checks and no uncaught app errors');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
});
