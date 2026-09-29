// npm install --prefix /tmp/la-scroll-tools playwright@1.51.1
// /tmp/la-scroll-tools/node_modules/.bin/playwright install chromium --only-shell
// PLAYWRIGHT_MODULE=/tmp/la-scroll-tools/node_modules/playwright node tests/la-craft.cjs
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');

(async () => {
 const server = http.createServer(async (req,res) => {
  const pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (pathname.endsWith('/')) file = path.join(file,'index.html');
  try {
   const data = await fs.readFile(file);
   res.setHeader('Content-Type', ({'.html':'text/html','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg','.svg':'image/svg+xml'})[path.extname(file)] || 'application/octet-stream');
   res.end(data);
  } catch { res.writeHead(404).end(); }
 });
 await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
 let browser;
 const errors = [];
 try {
  browser = await chromium.launch();
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function open({touch=false,reducedMotion='no-preference',fluid=true}={}) {
   const context = await browser.newContext({viewport:{width:touch?390:1280,height:844},isMobile:touch,hasTouch:touch,reducedMotion});
   const page = await context.newPage();
   page.on('pageerror', e => errors.push(e.message));
   await page.route('**/*', route => route.request().url().startsWith(origin) && (fluid || !route.request().url().includes('/fluid.js')) ? route.continue() : route.abort());
   await page.goto(origin + '/la-trip/');
   return {page,context};
  }
  async function keyClick(page, selector, key='Enter') {
   await page.locator(selector).focus();
   await page.keyboard.press(key);
  }
  async function noMotion(page) {
   assert.equal(await page.evaluate(() => document.documentElement.dataset.input),'keyboard');
   assert.equal(await page.locator('.date-rail').evaluate(el => el.style.willChange),'');
   assert(await page.locator('.selection-pill').evaluateAll(els => els.every(el => !el.style.willChange)));
   assert.equal(await page.evaluate(() => document.getAnimations().length),0);
   assert.equal(await page.locator('#timeline').evaluate(el => getComputedStyle(el).opacity),'1');
  }
  const {page,context} = await open({touch:true});
  await page.locator('[data-day="0"]').focus();
  await page.keyboard.press('End');
  assert.equal(await page.locator('[data-day="8"]').getAttribute('aria-pressed'),'true');
  assert(await page.locator('#date-strip').evaluate(el => {
   const last=el.querySelector('[data-day="8"]'), rail=el.querySelector('.date-rail');
   const expected=last.offsetLeft+last.offsetWidth-el.clientWidth;
   return Math.abs(new DOMMatrixReadOnly(getComputedStyle(rail).transform).m41+expected)<1;
  }), 'Keyboard End reaches its final rail position immediately');
  await noMotion(page);
  await page.keyboard.press('Home');
  await noMotion(page);
  await keyClick(page,'#next-day',' ');
  assert.equal(await page.locator('[data-day="1"]').getAttribute('aria-pressed'),'true');
  await noMotion(page);
  await keyClick(page,'#strip-next');
  await noMotion(page);
  await keyClick(page,'.main-nav [data-view="maps"]');
  await noMotion(page);
  await keyClick(page,'#maps [data-map-provider="apple"]',' ');
  assert.match(await page.locator('#map-open').getAttribute('href'),/maps\.apple\.com/);
  await noMotion(page);
  await page.locator('#maps [data-map-provider="google"]').evaluate(el => el.click());
  await noMotion(page); // Zero-detail activation used by programmatic/AT controls.
  await keyClick(page,'#add-location');
  assert(await page.locator('#itinerary-editor').evaluate(el => el.open));
  assert.equal(await page.locator('#location-name').evaluate(el => el === document.activeElement),true);
  await noMotion(page);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#add-location').evaluate(el => el === document.activeElement),true);
  await noMotion(page);
  // Entering pointer mode again must restore purposeful press/dialog feedback.
  await page.locator('#add-location').tap();
  assert.equal(await page.evaluate(() => document.documentElement.dataset.input),'pointer');
  assert(await page.locator('#itinerary-editor').evaluate(el => getComputedStyle(el).transitionDuration.includes('0.18')));
  await page.locator('#location-name').fill('Craft test location');
  await keyClick(page,'#save-event');
  assert(await page.locator('#itinerary-editor').evaluate(el => el.open), 'Required destination validation stays in the editor');
  assert(await page.locator('#location-query').evaluate(el => el === document.activeElement));
  await page.locator('#location-query').fill('Los Angeles');
  await keyClick(page,'#save-event');
  assert.equal(await page.locator('#itinerary-editor').evaluate(el => el.open),false);
  assert(await page.locator('.place-button').filter({hasText:'Craft test location'}).count());
  await noMotion(page);
  await page.reload();
  await keyClick(page,'.main-nav [data-view="maps"]');
  assert(await page.locator('.place-button').filter({hasText:'Craft test location'}).count(), 'Saving remains device-local and survives reload');
  // Keyboard backup navigation must not request a smooth scroll.
  await page.evaluate(() => {
   window.scrollRequests=[];
   const original=Element.prototype.scrollIntoView;
   Element.prototype.scrollIntoView=function(options){scrollRequests.push(options?.behavior);return original.call(this,options);};
  });
  await keyClick(page,'#maps [data-open-backup]');
  assert(await page.evaluate(() => scrollRequests.includes('instant') && !scrollRequests.includes('smooth')));
  console.log('PASS keyboard/AT navigation, no motion, provider choice, dialog focus/escape, save/reload, instant backup scrolling');
  await context.close();

  const desktop = await open();
  const p = desktop.page;
  await p.locator('#add-event').click();
  // Inspect an actual transition mid-flight, not just its CSS declaration.
  assert(await p.locator('#itinerary-editor').evaluate(el => el.getAnimations().length > 0), 'Pointer dialog has a short entrance');
  await p.evaluate(() => {
   for (const a of document.querySelector('#itinerary-editor').getAnimations()) { a.pause(); a.currentTime=90; }
  });
  const mid = await p.locator('#itinerary-editor').evaluate(el => ({opacity:Number(getComputedStyle(el).opacity),scale:new DOMMatrixReadOnly(getComputedStyle(el).transform).a, origin:getComputedStyle(el).transformOrigin,w:el.clientWidth}));
  assert(mid.opacity > 0 && mid.opacity < 1 && mid.scale >= .97 && mid.scale < 1, 'Centered, subtle scale + opacity halfway through entrance');
  if (process.env.CRAFT_SCREENSHOT) await p.screenshot({path:process.env.CRAFT_SCREENSHOT});
  await p.evaluate(() => document.querySelector('#itinerary-editor').getAnimations().forEach(a=>a.play()));
  // Closing commits immediately; the decorative exit must not block a reopen.
  await p.locator('#cancel-editor').click();
  assert.equal(await p.locator('#itinerary-editor').evaluate(el => el.open),false);
  await p.locator('#add-event').click({timeout:1000});
  assert(await p.locator('#itinerary-editor').evaluate(el => el.open));
  await p.keyboard.press('Escape');
  await noMotion(p);
  // Pointer day changes should not fade frequent content updates.
  await p.locator('#next-day').click();
  assert.equal(await p.locator('#timeline').evaluate(el => getComputedStyle(el).opacity),'1');
  await p.locator('#add-event').hover();
  await p.mouse.down();
  assert(await p.locator('#add-event').evaluate(el => el.classList.contains('is-pressed')));
  await p.waitForFunction(() => Number(getComputedStyle(document.querySelector('#add-event')).scale) < .999);
  assert.equal(await p.locator('#add-event').evaluate(el => el.style.getPropertyValue('--press-scale')),'');
  await p.mouse.move(5,5);
  await p.mouse.up();
  assert.equal(await p.locator('#itinerary-editor').evaluate(el => el.open),false,'Dragging away cancels activation');
  // Enabling reduced motion during a press settles it and avoids positional dialog motion.
  await p.emulateMedia({reducedMotion:'reduce'});
  await p.locator('#add-event').click();
  assert.equal(await p.locator('#itinerary-editor').evaluate(el => getComputedStyle(el).transform),'none');
  assert.equal(await p.evaluate(() => document.getAnimations().length),0);
  await p.keyboard.press('Escape');
  console.log('PASS pointer/modal transition mid-frame, interruption/reopen, immediate day content, press cancellation, reduced motion');
  await desktop.context.close();

  const fallback = await open({fluid:false});
  await keyClick(fallback.page,'#strip-next');
  assert.equal(await fallback.page.evaluate(() => tripScrollBehavior()),'instant');
  assert(await fallback.page.locator('#date-strip').evaluate(el => el.scrollLeft > 0));
  await keyClick(fallback.page,'#add-event');
  assert.equal(await fallback.page.evaluate(() => document.getAnimations().length),0);
  await fallback.page.keyboard.press('Escape');
  await fallback.context.close();
  // Recursively inspect CSSOM so no unguarded hover selector can slip back in.
  const mobile = await open({touch:true});
  const violations = await mobile.page.evaluate(() => {
   const bad=[];
   function walk(rules,guarded=false){for(const rule of rules){
    const hoverGuard=guarded || (rule.conditionText?.includes('hover: hover') && rule.conditionText?.includes('pointer: fine'));
    if(rule.selectorText?.includes(':hover')&&!hoverGuard)bad.push(rule.selectorText);
    if(rule.cssRules)walk(rule.cssRules,hoverGuard);
   }}
   for(const sheet of document.styleSheets){try{walk(sheet.cssRules);}catch{}}
   return bad;
  });
  assert.deepEqual(violations,[],'All hover styles require a hover-capable fine pointer');
  assert.equal(await mobile.page.evaluate(() => matchMedia('(hover: hover) and (pointer: fine)').matches),false);
  await mobile.context.close();
  assert.deepEqual(errors,[]);
  console.log('PASS progressive enhancement and touch-hover guards; no uncaught application errors');
 } finally {
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
