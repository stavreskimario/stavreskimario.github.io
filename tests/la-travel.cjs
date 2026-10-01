// Browser integration checks. Use the PLAYWRIGHT_MODULE/BROWSERS_PATH setup from la-scroll.cjs.
const assert=require('node:assert/strict');
const http=require('node:http');
const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const server=http.createServer(async(req,res)=>{let pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/project\//,'/');let file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(pathname.endsWith('/'))file=path.join(file,'index.html');try{res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(await fs.readFile(file));}catch{res.writeHead(404).end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin=`http://127.0.0.1:${server.address().port}`;
 let browser;const errors=[];
 try{
  browser=await chromium.launch();
  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
  const go=async tool=>{await page.locator('.main-nav [data-view="tools"]').click();await page.locator(`[data-tool="${tool}"]`).click();};
  const save=async()=>{await page.locator('#travel-save').click();await page.waitForFunction(()=>!document.querySelector('#travel-dialog').open);};
  const snap=()=>page.evaluate(()=>tripEditor.snapshot());
  await page.goto(origin+'/la-trip/');
  assert(await page.locator('#trip-now').isVisible());
  const original=await snap();
  await go('ideas');await page.getByRole('button',{name:'Save an idea',exact:true}).click();
  await page.locator('#travel-title').fill('<img src=x onerror=alert(1)> café');await page.locator('#travel-query').fill('Los Angeles');await page.locator('#travel-source').fill('https://example.com/');await save();
  assert.equal((await snap()).companion.ideas.length,1);assert.equal(await page.locator('#tool-content img').count(),0);
  await page.getByRole('button',{name:'Add to a day',exact:true}).click();await page.locator('#travel-day').selectOption('24');await save();
  let s=await snap();assert.equal(s.companion.ideas.length,0);assert(s.days.find(d=>d.date===24).events.some(e=>e.title.includes('<img')));
  await page.locator('#tools [data-undo-trip]').click();s=await snap();assert.equal(s.companion.ideas.length,1);assert.equal(await page.evaluate(()=>document.activeElement.closest('[hidden]')!==null),false);
  await page.getByRole('button',{name:'Add a planning task',exact:true}).click();await page.locator('#travel-title').fill('Check tour tickets');await save();await page.locator('[data-task-id]').check();assert.equal((await snap()).companion.tasks[0].done,true);
  console.log('PASS ideas add/move/undo, safe rendering, planning tasks');

  await go('expenses');await page.getByRole('button',{name:'Budget & rate',exact:true}).click();await page.locator('#travel-budget').fill('5000');await page.locator('#travel-rate').fill('1.5');await save();
  await page.getByRole('button',{name:'Add expense',exact:true}).click();await page.locator('#travel-title').fill('Test tickets');await page.locator('#travel-amount').fill('10.01');await page.locator('#travel-state').selectOption('paid');await save();
  assert((await page.locator('.expense-balance').innerText()).replace(/\u00a0/g,' ').includes('Andreas owes Mario AUD 7.51'));
  await page.getByRole('button',{name:'Record repayment',exact:true}).click();await page.locator('#travel-from').selectOption('Andreas');await page.locator('#travel-amount').fill('7.51');await save();assert((await page.locator('.expense-balance').innerText()).replace(/\u00a0/g,' ').includes('square'));
  await page.getByRole('button',{name:'Edit expense',exact:true}).click();await page.locator('#travel-actualAud').fill('14');await save();assert((await page.locator('.expense-stats').innerText()).replace(/\u00a0/g,' ').includes('AUD 14.00'));
  await page.reload();await go('expenses');assert((await page.locator('.expense-stats').innerText()).replace(/\u00a0/g,' ').includes('AUD 14.00'));assert.equal((await snap()).version,3);
  console.log('PASS expenses, rate, cent rounding, repayment, actual AUD override, reload');

  await page.locator('.main-nav [data-view="itinerary"]').click();
  await page.locator('#timeline [data-edit-event="day-20-event-1"]').click();await page.locator('#timing-details summary').click();
  await page.locator('#timing-start').fill('2026-12-20T10:00');await page.locator('#timing-end').fill('2026-12-20T06:00');await page.locator('#save-event').click();
  await page.waitForFunction(()=>!document.querySelector('#itinerary-editor').open);
  s=await snap();assert.equal(s.days[0].events[0].schedule.zone,'Australia/Melbourne');assert.equal(s.days[0].events[0].schedule.endZone,'America/Los_Angeles');
  await go('calendar');const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:'Export whole trip',exact:true}).click();const ics=await fs.readFile(await (await downloaded).path(),'utf8');assert(ics.includes('DTSTART:20261219T230000Z'));assert(ics.includes('DTEND:20261220T140000Z'));assert(ics.includes('VALUE=DATE'));
  await page.getByRole('button',{name:'Select none',exact:true}).click();await page.getByRole('button',{name:'Export selected',exact:true}).click();assert((await page.locator('#tools-feedback').innerText()).replace(/\u00a0/g,' ').includes('Select at least one'));
  console.log('PASS structured flight edit and timezone-safe ICS export');

  await go('import');await page.locator('#paste-plans').fill('A café | 24 Dec | Afternoon | Los Angeles | https://example.com\nAn idea for later');await page.getByRole('button',{name:'Review import',exact:true}).click();
  assert.equal(await page.locator('.import-review fieldset').count(),2);await page.locator('.import-review fieldset').first().locator('[data-import-field="title"]').fill('Reviewed café');await page.getByRole('button',{name:'Add reviewed items',exact:true}).click();
  s=await snap();assert(s.days.find(d=>d.date===24).events.some(e=>e.title==='Reviewed café'&&e.status==='proposed'));assert(s.companion.ideas.some(e=>e.title==='An idea for later'));
  console.log('PASS reviewed text import into ideas and itinerary');

  await go('documents');await page.getByRole('button',{name:'Add document',exact:true}).click();await page.locator('#travel-event').selectOption('day-20-event-1');await page.locator('#travel-file').setInputFiles({name:'ticket.txt',mimeType:'text/plain',buffer:Buffer.from('A test ticket only')});await save();
  assert(await page.getByRole('heading',{name:'ticket.txt',exact:true}).isVisible());
  await page.reload();await go('documents');await page.waitForSelector('text=ticket.txt');
  await page.getByRole('button',{name:'Remove',exact:true}).click();await page.waitForSelector('text=Undo document removal');await page.getByRole('button',{name:'Undo document removal',exact:true}).click();await page.waitForSelector('text=ticket.txt');
  await go('travel');const backupDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download complete backup',exact:true}).click();const backup=JSON.parse(await fs.readFile(await (await backupDownload).path(),'utf8'));
  assert.equal(backup.documents.length,1);assert.equal(backup.plan.companion.expenses.length,1);assert.equal(backup.packing.length,22);assert.equal(backup.plan.days.length,9);
  const beforeBad=await snap();await page.locator('#complete-backup-input').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...backup,documents:[{...backup.documents[0],type:'text/html'}]}))});await page.waitForFunction(()=>document.querySelector('#tools-feedback').textContent.includes('has not changed'));assert.deepEqual(await snap(),beforeBad);
  // Restore a complete backup in a second browser context; no implicit cloud sync.
  const restoreContext=await browser.newContext();await restoreContext.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const restored=await restoreContext.newPage();restored.on('pageerror',e=>errors.push(e.message));await restored.goto(origin+'/la-trip/#tools');await restored.locator('[data-tool="travel"]').click();await restored.locator('#complete-backup-input').setInputFiles({name:'complete.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await restored.locator('#travel-save').click();await restored.waitForFunction(()=>!document.querySelector('#travel-dialog').open);assert.equal(await restored.evaluate(()=>tripEditor.snapshot().companion.expenses.length),1);assert.equal(await restored.evaluate(async()=>(await TripDocuments.all()).length),1);
  // Reimport deduplicates identical files, preserving existing documents.
  await restored.locator('#complete-backup-input').setInputFiles({name:'complete.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});await restored.locator('#travel-save').click();await restored.waitForFunction(()=>!document.querySelector('#travel-dialog').open);assert.equal(await restored.evaluate(async()=>(await TripDocuments.all()).length),1);
  console.log('PASS IndexedDB documents, undo, full backup, cross-device restore and invalid-file rejection');

  // Version 2 local edits retain their title, fields, and empty collections through upgrade.
  const legacy={...original,version:2};delete legacy.companion;legacy.days[0].title='Legacy edited title';legacy.days[0].events[0].time='My flexible flight time';legacy.days.forEach(d=>d.events.forEach(e=>delete e.schedule));
  await restored.evaluate(data=>localStorage.setItem('mario-la-dec2026-itinerary-v1',JSON.stringify(data)),legacy);await restored.reload();assert.equal(await restored.locator('#day-title').innerText(),'Legacy edited title');assert.equal(await restored.evaluate(()=>tripEditor.snapshot().days[0].events[0].time),'My flexible flight time');
  // Another tab cannot overwrite a newer saved revision, even while a modal is open.
  const other=await restoreContext.newPage();await other.goto(origin+'/la-trip/');await restored.evaluate(()=>tripEditor.update(s=>s.companion.tasks.push({id:'newer',title:'Newer tab change',done:false}),'Updated'));
  const conflict=await other.evaluate(()=>{try{tripEditor.update(s=>s.days[0].title='Stale overwrite','Updated');return '';}catch(e){return e.message;}});assert(conflict.includes('another tab'));assert((await other.evaluate(()=>localStorage.getItem('mario-la-dec2026-itinerary-v1'))).includes('Newer tab change'));
  await restoreContext.close();console.log('PASS legacy migration and cross-tab conflict protection');

  await page.locator('.main-nav [data-view="itinerary"]').click();await page.locator('#next-day').click();assert(await page.locator('.day-stop-rail').isVisible());assert((await page.locator('.day-routes a').first().getAttribute('href')).startsWith('https://www.google.com/maps/dir/?api=1'));
  const stopCount=await page.locator('[data-event-travel] .small-note').count();await page.locator('button[data-map-provider="apple"]').first().click();await page.locator('button[data-map-provider="google"]').first().click();assert.equal(await page.locator('[data-event-travel] .small-note').count(),stopCount,'rerender must not duplicate travel details');
  // All tool panels and forms fit narrow and enlarged layouts.
  for(const width of [320,390,740,1280]){await page.setViewportSize({width,height:900});for(const name of ['ideas','expenses','documents','import','calendar','travel']){await go(name);assert(await page.evaluate(width=>document.documentElement.scrollWidth<=width+1,width),`${name} overflow at ${width}`);}}
  await page.setViewportSize({width:390,height:844});await page.addStyleTag({content:'html{font-size:200% !important}'});await go('expenses');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=391),'200% text overflow');
  console.log('PASS day routes, repeated map changes, narrow layouts and 200% text');
  await context.close();

  // A project Pages prefix must work offline without controlling sibling apps.
  const offlineContext=await browser.newContext();const offline=await offlineContext.newPage();offline.on('pageerror',e=>errors.push(e.message));
  await offline.goto(origin+'/project/la-trip/#tools');await offline.locator('[data-tool="travel"]').click();await offline.getByRole('button',{name:'Save / update offline copy',exact:true}).click();
  await offline.waitForFunction(()=>document.querySelector('#tools-feedback').textContent.includes('saved for offline use'),{timeout:20000});
  const scope=await offline.evaluate(async()=>(await navigator.serviceWorker.getRegistration()).scope);assert.equal(scope,origin+'/project/la-trip/');
  await offline.reload();await offline.waitForFunction(()=>!!navigator.serviceWorker.controller);await offlineContext.setOffline(true);await offline.reload();await offline.waitForSelector('#tools-title');
  await offline.locator('.main-nav [data-view="tools"]').click();await offline.locator('[data-tool="ideas"]').click();await offline.getByRole('button',{name:'Save an idea',exact:true}).click();await offline.locator('#travel-title').fill('Saved while offline');await offline.locator('#travel-save').click();await offline.waitForFunction(()=>!document.querySelector('#travel-dialog').open);assert.equal(await offline.evaluate(()=>tripEditor.snapshot().companion.ideas[0].title),'Saved while offline');
  assert(await offline.evaluate(async()=>{const names=await caches.keys();const cache=await caches.open(names.find(n=>n.startsWith('la-trip-')));return (await cache.keys()).every(r=>new URL(r.url).pathname.startsWith('/project/la-trip/'));}));
  await offlineContext.close();console.log('PASS offline reload/editing and project-relative service-worker scope');

  // Forecast requests are real API-shaped calls, only inside the trip's forecast window.
  const weatherContext=await browser.newContext();await weatherContext.addInitScript(()=>{const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-12-20T18:00:00Z']));}static now(){return new NativeDate('2026-12-20T18:00:00Z').getTime();}};});
  let weatherCalls=0;
  await weatherContext.route('**/*',r=>{if(r.request().url().startsWith(origin))return r.continue();if(r.request().url().startsWith('https://api.open-meteo.com/v1/forecast?')){weatherCalls++;const params=new URL(r.request().url()).searchParams;assert.equal(params.get('forecast_days'),'16');assert.equal(params.get('timezone'),'America/Los_Angeles');return r.fulfill({contentType:'application/json',body:JSON.stringify({daily:{time:['2026-12-20','2026-12-21'],temperature_2m_max:[20,21],temperature_2m_min:[10,11],precipitation_probability_max:[5,10]}})});}return r.abort();});
  const wp=await weatherContext.newPage();wp.on('pageerror',e=>errors.push(e.message));await wp.goto(origin+'/la-trip/#tools');await wp.locator('[data-tool="travel"]').click();await wp.getByRole('button',{name:'Los Angeles forecast',exact:true}).click();await wp.waitForSelector('text=2026-12-20: 10–20 °C');assert.equal(weatherCalls,1);await weatherContext.close();
  const blockedContext=await browser.newContext();await blockedContext.addInitScript(()=>{Storage.prototype.setItem=()=>{throw new DOMException('Unavailable','QuotaExceededError');};});await blockedContext.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());const blocked=await blockedContext.newPage();blocked.on('pageerror',e=>errors.push(e.message));await blocked.goto(origin+'/la-trip/');await blocked.evaluate(()=>tripEditor.update(s=>s.companion.ideas.push({id:'temporary',title:'Visit-only idea',query:'',note:'',source:''}),'Added'));assert((await blocked.locator('#itinerary-storage').innerText()).includes('visit only'));assert.equal(await blocked.evaluate(()=>tripEditor.snapshot().companion.ideas[0].title),'Visit-only idea');await blockedContext.close();
  console.log('PASS forecast contract and blocked-storage feedback');
  assert.deepEqual(errors,[]);console.log('All travel companion browser checks passed.');
 }catch(e){console.error('Page errors:',errors);throw e;}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
