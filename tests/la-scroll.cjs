// Install outside the buildless site so the static validator does not scan dependencies:
// npm install --prefix /tmp/la-scroll-tools playwright@1.51.1
// /tmp/la-scroll-tools/node_modules/.bin/playwright install chromium --only-shell
// PLAYWRIGHT_MODULE=/tmp/la-scroll-tools/node_modules/playwright node tests/la-scroll.cjs
// An existing Playwright installation can also be supplied through PLAYWRIGHT_MODULE.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const errors = [];

async function main() {
 const server = http.createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  if (pathname.endsWith('/')) file = path.join(file, 'index.html');
  try {
   const data = await fs.readFile(file);
   res.setHeader('Content-Type', ({'.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.svg':'image/svg+xml', '.jpg':'image/jpeg'})[path.extname(file)] || 'application/octet-stream');
   res.end(data);
  } catch { res.writeHead(404).end(); }
 });
 await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
 let browser;
 try {
  browser = await chromium.launch({headless:true});
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function open(width, reducedMotion = 'no-preference') {
   const context = await browser.newContext({viewport:{width,height:844}, isMobile:width <= 740, hasTouch:true, reducedMotion});
   const page = await context.newPage();
   page.on('pageerror', error => errors.push(error.message));
   // Keep the regression independent of third-party maps, fonts and photo servers.
   await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
   await page.goto(origin + '/la-trip/');
   return {page, context, cdp:await context.newCDPSession(page)};
  }
  async function touch(cdp, type, x, y) {
   await cdp.send('Input.dispatchTouchEvent', {type, touchPoints:type === 'touchEnd' || type === 'touchCancel' ? [] : [{x,y}]});
  }
  const offset = page => page.locator('.date-rail').evaluate(el => -new DOMMatrixReadOnly(getComputedStyle(el).transform).m41);
  async function settle(page) {
   await page.waitForFunction(() => !document.querySelector('.date-rail').style.willChange);
  }
  async function noPageOverflow(page) {
   assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Horizontal overflow must stay inside the rail');
  }

  for (const width of [320,390,430,740,1024,1440]) {
   const {page,context,cdp} = await open(width);
   await page.locator('.main-nav [data-view="maps"]').click();
   await noPageOverflow(page);
   const metrics = await page.locator('#place-list').evaluate(el => ({width:el.clientWidth, content:el.scrollWidth, cards:[...el.children].map(c => ({width:c.getBoundingClientRect().width, x:c.offsetLeft, y:c.offsetTop}))}));
   if (width <= 740) {
    assert(metrics.cards.every(c => c.width >= 169), `${width}px: readable map card widths`);
    assert(metrics.content > metrics.width + 100, `${width}px: map rail must overflow horizontally`);
    assert(metrics.cards.every(c => c.y === metrics.cards[0].y), 'Cards stay in one row');
    await page.locator('#place-list').scrollIntoViewIfNeeded();
    const box = await page.locator('#place-list').boundingBox();
    const y = box.y + 35, start = Math.min(box.x + box.width - 20, width - 25);
    await touch(cdp,'touchStart',start,y);
    for (let dx = 30; dx <= 180; dx += 30) await touch(cdp,'touchMove',start-dx,y);
    await touch(cdp,'touchEnd');
    await page.waitForFunction(() => document.querySelector('#place-list').scrollLeft > 80);
   } else {
    assert(metrics.cards[1].y > metrics.cards[0].y, 'Desktop locations stay vertically stacked');
    assert(metrics.content <= metrics.width + 1, 'Desktop list fits its column');
   }
   console.log(`PASS maps layout/native swipe: ${width}px`);
   await context.close();
  }

  for (const reducedMotion of ['no-preference','reduce']) {
   const {page,context,cdp} = await open(390,reducedMotion);
   await page.locator('#date-strip').scrollIntoViewIfNeeded();
   const box = await page.locator('#date-strip').boundingBox();
   const y = box.y + box.height / 2;
   const initialDay = await page.locator('#day-number').textContent();
   await touch(cdp,'touchStart',300,y);
   for (const x of [280,240,200,160,120]) {
    await touch(cdp,'touchMove',x,y);
    assert(Math.abs(await offset(page) - (300-x)) < 2, 'Day rail tracks every move after implicit capture transfers');
    assert(await page.locator('#date-strip').evaluate(el => el.classList.contains('is-dragging')), 'Capture handoff must not cancel a drag');
   }
   // Reverse while the finger is still down; content must follow immediately.
   await touch(cdp,'touchMove',160,y);
   assert(Math.abs(await offset(page) - 140) < 2, 'Reversal follows the finger');
   await touch(cdp,'touchEnd');
   await settle(page);
   assert.equal(await page.locator('#day-number').textContent(), initialDay, 'Swiping must not select a day');
   assert(!(await page.locator('#date-strip').evaluate(el => el.classList.contains('is-dragging'))));

   // A real loss of capture on the strip still cleans up correctly.
   await page.locator('#date-strip').evaluate(el => el.addEventListener('pointerdown', e => el.dataset.testPointerId = e.pointerId, {once:true}));
   await touch(cdp,'touchStart',300,y);
   await touch(cdp,'touchMove',270,y);
   await touch(cdp,'touchMove',240,y);
   assert(await page.locator('#date-strip').evaluate(el => {
    const id = Number(el.dataset.testPointerId);
    const captured = el.hasPointerCapture(id);
    if (captured) el.releasePointerCapture(id);
    delete el.dataset.testPointerId;
    return captured;
   }), 'Strip owns capture before the cancellation check');
   await touch(cdp,'touchMove',220,y);
   assert(!(await page.locator('#date-strip').evaluate(el => el.classList.contains('is-dragging'))), 'Actual capture loss cancels the drag');
   await touch(cdp,'touchCancel');
   await settle(page);

   // Keyboard selection, a tap after a drag, and the existing arrows all work.
   await page.locator('[data-day="0"]').focus();
   await page.keyboard.press('End');
   await settle(page);
   assert.equal(await page.locator('[data-day="8"]').getAttribute('aria-pressed'),'true');
   await page.keyboard.press('Home');
   await settle(page);
   await page.locator('[data-day="1"] .day-label').tap();
   await settle(page);
   assert.equal(await page.locator('[data-day="1"]').getAttribute('aria-pressed'),'true');
   await page.locator('#next-day').click();
   await settle(page);
   assert.equal(await page.locator('[data-day="2"]').getAttribute('aria-pressed'),'true');

   // Browsing the rail by horizontal wheel must also remain available.
   await page.locator('#date-strip').scrollIntoViewIfNeeded();
   const wheelBox = await page.locator('#date-strip').boundingBox();
   await page.mouse.move(wheelBox.x + 100,wheelBox.y + 40);
   const before = await offset(page);
   await page.mouse.wheel(100,0);
   await page.waitForFunction(value => -new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.date-rail')).transform).m41 > value + 50, before);
   await noPageOverflow(page);
   console.log(`PASS continuous touch, reversal, capture loss, tap, keyboard, arrows, wheel: ${reducedMotion}`);
   await context.close();
  }

  const {page,context,cdp} = await open(390);
  // Starting vertically on the day rail should scroll the page, not trap it.
  await page.locator('#date-strip').scrollIntoViewIfNeeded();
  const box = await page.locator('#date-strip').boundingBox();
  const beforeY = await page.evaluate(() => scrollY);
  await touch(cdp,'touchStart',200,box.y+60);
  for (const dy of [20,50,90,140]) await touch(cdp,'touchMove',200,box.y+60-dy);
  await touch(cdp,'touchEnd');
  await page.waitForFunction(y => scrollY > y + 50,beforeY);
  assert(!(await page.locator('#date-strip').evaluate(el => el.classList.contains('is-dragging'))));
  await page.locator('.main-nav [data-view="maps"]').click();
  await page.locator('[data-place="hotel"]').click();
  assert.match(await page.locator('#map-title').textContent(),/Westin/);
  await page.locator('[data-edit-location="hotel"]').click();
  await page.locator('#location-name').fill('My hotel');
  await page.locator('#save-event').click();
  await page.waitForFunction(() => !document.querySelector('#itinerary-editor').open);
  assert.equal(await page.locator('[data-place="hotel"] strong').textContent(),'My hotel');
  await page.reload();
  await page.locator('.main-nav [data-view="maps"]').click();
  assert.equal(await page.locator('[data-place="hotel"] strong').textContent(),'My hotel', 'Edits survive reload');
  assert(await page.locator('.location-record').first().evaluate(el => el.getBoundingClientRect().width >= 169), 'Rerender preserves card width');
  // Larger text scales cards without creating page-wide horizontal overflow.
  await page.evaluate(() => document.documentElement.style.fontSize = '200%');
  await noPageOverflow(page);
  assert(await page.locator('.location-record').first().evaluate(el => el.getBoundingClientRect().width >= 339));
  await page.evaluate(() => document.documentElement.style.fontSize = '');
  if (process.env.SCROLL_SCREENSHOT) await page.screenshot({path:process.env.SCROLL_SCREENSHOT,fullPage:true});
  console.log('PASS vertical scrolling, location selection/edit/persistence, larger text');
  await context.close();
  assert.deepEqual(errors, [], 'No uncaught application errors');
 } finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
 }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
