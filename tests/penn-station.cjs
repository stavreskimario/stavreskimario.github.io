/*
 * Browser integration checks for the Pennsylvania Station exhibition.
 * Run from the repository with:
 * PLAYWRIGHT_MODULE=/private/tmp/penn-station-tools/node_modules/playwright \
 * node tests/penn-station.cjs
 *
 * CHROME_PATH overrides the installed browser executable. PENN_SCREENSHOTS
 * selects the artifact directory. The server deliberately mounts the whole
 * repository under /exhibition/ to catch root-relative GitHub Pages paths.
 * These are desktop and mobile-emulation checks, not measurements on a phone.
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.PENN_SCREENSHOTS || '/private/tmp/penn-validation');
const prefix = '/exhibition/';
const appPath = prefix + 'penn-station-1935/';
const timeout = Number(process.env.PENN_TIMEOUT_MS) || 90000;
const MAIN_FLOOR = -4.2672;
const HUMAN_EYE = 1.68;
const WAITING_EYE = MAIN_FLOOR + HUMAN_EYE;
const section = process.env.PENN_SECTION || 'full';
assert(['full', 'mobile-recovery'].includes(section), 'PENN_SECTION must be full or mobile-recovery');
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary', '.gz': 'application/octet-stream', '.hdr': 'application/octet-stream',
  '.wasm': 'application/wasm', '.ktx2': 'image/ktx2',
};

const report = {
  created: new Date().toISOString(), deploymentPrefix: prefix,
  section,
  scope: 'Installed Chrome, headless desktop and 390 px touch/mobile emulation. Not real mobile hardware or a production CDN.',
  rendererNote: 'Software ANGLE/SwiftShader is requested for deterministic availability. Frame intervals describe browser scheduling, not a hardware performance claim.',
  checks: [], contexts: [],
};
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

(async () => {
  await fs.mkdir(output, { recursive: true });
  const server = http.createServer(async (req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end(); return; }
    if (!pathname.startsWith(prefix)) { res.writeHead(404).end('Mount prefix required'); return; }
    let file = path.resolve(root, pathname.slice(prefix.length));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if (pathname.endsWith('/')) file = path.join(file, 'index.html');
    try {
      const bytes = await fs.readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'Content-Length': bytes.length, 'Cache-Control': 'no-store',
      });
      res.end(bytes);
    } catch { res.writeHead(404).end('Not found'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const contexts = [];
  try {
    console.log('START installed Chrome; local project-prefix server is ready');
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
    });
    report.browser = browser.version();
    console.log(`BROWSER ${report.browser}`);

    async function open(label, options = {}) {
      console.log(`OPEN ${label}`);
      const context = await browser.newContext({
        viewport: { width: options.mobile ? 390 : 1440, height: options.mobile ? 844 : 1000 },
        deviceScaleFactor: 1, isMobile: Boolean(options.mobile), hasTouch: Boolean(options.mobile),
        reducedMotion: options.reducedMotion || 'no-preference',
      });
      contexts.push(context);
      const record = { label, errors: [], consoleErrors: [], requests: [], blockedExternal: [] };
      report.contexts.push(record);
      const page = await context.newPage();
      page.setDefaultTimeout(timeout);
      page.setDefaultNavigationTimeout(timeout);
      page.on('pageerror', error => record.errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') record.consoleErrors.push(message.text()); });
      page.on('response', response => {
        if (response.url().startsWith(origin)) record.requests.push({ path: new URL(response.url()).pathname, status: response.status() });
      });
      await page.route('**/*', route => {
        const url = route.request().url();
        if (url.startsWith(origin + '/') || /^(data:|blob:)/.test(url)) return route.continue();
        record.blockedExternal.push(url);
        return route.abort();
      });
      if (options.noRenderer) await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type, ...args) {
          return /webgl/i.test(type) ? null : original.call(this, type, ...args);
        };
      });
      if (options.failModel) {
        let failed = false;
        await page.route(/\/model-exterior\.glb\.gz(?:\?.*)?$/, route => {
          if (!failed) { failed = true; return route.fulfill({ status: 503, body: 'Intentional recovery test' }); }
          return route.continue();
        });
      }
      if (options.failHDR) {
        let failed = false;
        await page.route('**/sky.hdr', route => {
          if (!failed) { failed = true; return route.fulfill({ status: 503, body: 'Intentional environment recovery test' }); }
          return route.continue();
        });
      }
      await page.goto(origin + appPath + (options.renderer ? '?renderer=' + encodeURIComponent(options.renderer) : ''), { waitUntil: 'domcontentloaded' });
      console.log(`DOCUMENT ${label}; waiting for app bootstrap`);
      await page.waitForFunction(() => Boolean(window.pennStation), null, { timeout });
      console.log(`BOOTSTRAP ${label}`);
      return { page, context, record };
    }

    async function ready(page, view) {
      console.log(`READY waiting: ${view || 'current view'}`);
      try {
        await page.waitForFunction(wanted => {
          const s = window.pennStation?.getState();
          return s && !s.loading && !s.error && (!wanted || s.view === wanted);
        }, view, { timeout });
      } catch (error) {
        try {
          const diagnostic = await Promise.race([
            page.evaluate(() => ({
              state: window.pennStation?.getState(), camera: window.pennStation?.getCamera(),
              metrics: window.pennStation?.getMetrics(), error: document.querySelector('#load-error')?.textContent,
            })),
            new Promise(resolve => setTimeout(() => resolve({ diagnosticUnavailable: 'Browser main thread did not answer within 3 seconds' }), 3000)),
          ]);
          console.error('READY state diagnostic:', JSON.stringify(diagnostic));
        } catch {}
        throw error;
      }
      await page.waitForFunction(() => {
        const m = window.pennStation?.getMetrics();
        return m && m.calls > 0 && m.triangles > 1000 && m.geometries > 0;
      }, null, { timeout });
      assert(await page.locator('#loading').isHidden(), 'Loading cover clears after actual geometry is available');
      assert(await page.locator('#load-error').isHidden(), 'Successful geometry has no error alert');
      const canvas = page.locator('#scene-root canvas');
      assert(await canvas.isVisible(), 'WebGL canvas visible');
      const box = await canvas.boundingBox();
      assert(box && box.width > 300 && box.height > 300, 'Viewport has usable dimensions');
      console.log(`READY rendered: ${view || 'current view'}`);
    }

    async function choose(page, view, expectFetch = false) {
      const suffix = view === 'waiting' ? 'waiting-room' : view;
      const loaded = expectFetch ? page.waitForResponse(response => new URL(response.url()).pathname.includes(`/model-${suffix}`) && response.status() === 200) : null;
      await page.locator(`.viewpoints [data-command="view"][data-value="${view}"]`).click();
      if (loaded) await loaded;
      // Let the React effect replace the previous room before checking its state.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await ready(page, view);
    }

    async function settings(page, open = true) {
      if (await page.locator('#settings').evaluate(el => el.open) !== open) await page.locator('#settings > summary').click();
    }

    async function snapshot(page, name, record) {
      const values = await page.evaluate(() => ({
        state: window.pennStation.getState(), camera: window.pennStation.getCamera(),
        metrics: window.pennStation.getMetrics(), assets: window.pennStation.getAssets(),
      }));
      record.snapshots ||= {};
      record.snapshots[name] = values;
      await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true, animations: 'disabled' });
      return values;
    }

    async function bakedLighting(page, suffix = '') {
      const assets = await page.evaluate(() => window.pennStation.getAssets());
      for (const zone of ['exterior', 'waiting-room', 'concourse']) {
        const filename = `model-${zone}${suffix}.glb`;
        const asset = assets.find(item => item.file === filename);
        assert(asset, `${filename}: decoded architectural asset is reported`);
        assert(asset.bakedMaterials > 0, `${filename}: actual materials carry a decoded illumination light map`);
        assert(asset.occlusionMaterials > 0, `${filename}: actual materials carry a baked occlusion map`);
        assert(asset.atlasChannels.length > 0 && asset.atlasChannels.every(channel => Number.isInteger(channel) && channel >= 0 && channel <= 3), `${filename}: light maps retain valid exported atlas UV channels`);
      }
      return assets;
    }

    async function walkingReady(page) {
      // Walk loads the complete connected world. A mode state change alone does
      // not mean the new geometry, light maps and collision surfaces are ready.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await ready(page, 'waiting');
      await page.waitForFunction(expected => {
        const state = window.pennStation.getState();
        const camera = window.pennStation.getCamera();
        return state.mode === 'walk' && !state.loading && camera && Math.abs(camera.position[1] - expected) < .03;
      }, WAITING_EYE);
      const assets = await page.evaluate(() => window.pennStation.getAssets());
      const low = await page.evaluate(() => window.pennStation.getState().quality === 'low');
      for (const zone of ['exterior', 'waiting-room', 'concourse', 'context', 'platform', 'trains']) {
        assert(assets.some(asset => asset.file === `model-${zone}${low ? '-low' : ''}.glb`), `Walking world has decoded ${zone} geometry at the selected quality`);
      }
    }

    async function frameSample(page) {
      return page.evaluate(() => new Promise(resolve => {
        const samples = []; let previous;
        function frame(t) {
          if (previous !== undefined) samples.push(t - previous);
          previous = t;
          if (samples.length < 45) requestAnimationFrame(frame);
          else {
            samples.sort((a, b) => a - b);
            resolve({ samples: samples.length, medianFrameIntervalMs: samples[22], p95FrameIntervalMs: samples[42], maximumFrameIntervalMs: samples[44] });
          }
        }
        requestAnimationFrame(frame);
      }));
    }

    function clean(record, { expectedFailure = false, rendererFailure = false } = {}) {
      if (!rendererFailure) assert.deepEqual(record.errors, [], `${record.label}: no uncaught browser errors`);
      const unexpected = record.consoleErrors.filter(text => !/net::ERR_FAILED/.test(text) && !(expectedFailure && /503|Failed to load resource/.test(text)) && !(rendererFailure && /WebGL|renderer|context|React|error occurred/i.test(text)));
      assert.deepEqual(unexpected, [], `${record.label}: no meaningful console errors`);
      const failures = record.requests.filter(request => request.status >= 400 && !(expectedFailure && /\/(model-exterior\.glb\.gz|sky\.hdr)$/.test(request.path) && request.status === 503));
      assert.deepEqual(failures, [], `${record.label}: every required local resource loads under project prefix`);
    }

    if (section === 'full') {
    const desktop = await open('desktop', { renderer: process.env.PENN_RENDERER });
    const p = desktop.page;
    await ready(p, 'exterior');
    const initial = await snapshot(p, 'desktop-intro', desktop.record);
    if (process.env.PENN_SMOKE === '1') {
      clean(desktop.record);
      report.checks.push('Current installed browser starts, decodes and renders the authored exterior with requested renderer/fallback');
      report.passed = true;
      console.log('PASS rendering smoke check:', initial.state.renderer);
      return;
    }
    assert.equal(initial.state.entered, false);
    assert(initial.state.renderer.includes('WebGL') || initial.state.renderer.includes('WebGPU'));
    assert(desktop.record.requests.some(r => r.path.endsWith('/sky.hdr') && r.status === 200), 'Local HDR environment loads');
    assert(desktop.record.requests.some(r => r.path.endsWith('/model-exterior.glb.gz') && r.status === 200), 'Desktop authored GLB loads through lossless GZip transport');
    assert(desktop.record.requests.some(r => r.path.endsWith('/model-context.glb.gz') && r.status === 200), 'The authored hotel, post office and street context loads with the exterior');
    await p.locator('[data-command="enter"]').click();
    assert.equal(await p.evaluate(() => window.pennStation.getState().entered), true);
    assert(await p.locator('#intro').isHidden());
    assert(await p.locator('#scene-root canvas').evaluate(el => el === document.activeElement), 'Enter Station focuses the interactive canvas');
    report.checks.push('Desktop authored geometry, local HDR, meaningful progress completion, Enter Station and prefixed asset paths');

    for (const view of ['waiting', 'concourse']) {
      await choose(p, view, true);
      await snapshot(p, `desktop-${view}`, desktop.record);
    }
    desktop.record.bakedLighting = await bakedLighting(p);
    assert(desktop.record.requests.some(r => /\/lighting-[^/]+-sky\.webp$/.test(r.path) && r.status === 200), 'Local architectural illumination WebP atlases load in addition to the HDR environment');
    assert(desktop.record.requests.some(r => r.path.endsWith('/model-platform.glb.gz') && r.status === 200), 'The separate representative platform geometry loads with the concourse');
    assert(desktop.record.requests.some(r => r.path.endsWith('/model-trains.glb.gz') && r.status === 200), 'The authored electric locomotive and passenger coaches load with the concourse');
    const platformAsset = desktop.record.bakedLighting.find(asset => asset.file === 'model-platform.glb');
    assert(platformAsset && platformAsset.bakedMaterials === 0, 'The separate platform uses unbaked PBR materials');
    report.checks.push('Core materials retain baked WebP illumination, ambient occlusion and exported atlas channels; context, unbaked platform and period rolling stock decode locally');
    await choose(p, 'exterior');
    const orbitBefore = await p.evaluate(() => window.pennStation.getCamera().position);
    const canvasBounds = await p.locator('#scene-root canvas').boundingBox();
    await p.mouse.move(canvasBounds.x + canvasBounds.width * 0.52, canvasBounds.y + canvasBounds.height * 0.48);
    await p.mouse.down();
    await p.mouse.move(canvasBounds.x + canvasBounds.width * 0.66, canvasBounds.y + canvasBounds.height * 0.54, { steps: 12 });
    await p.mouse.up();
    await p.waitForFunction(before => Math.hypot(...window.pennStation.getCamera().position.map((v, i) => v - before[i])) > 1, orbitBefore);
    report.checks.push('Exterior, waiting-room and concourse viewpoints render; drag orbit changes camera position');

    await p.locator('#map-control > summary').click();
    for (const neighbour of ['hotel', 'farley']) {
      const before = await p.evaluate(() => window.pennStation.getCamera().position);
      await p.locator(`.map-body button[data-command="focus"][data-value="${neighbour}"]`).click();
      await ready(p, 'exterior');
      await p.waitForFunction(({ name, expected }) => {
        const camera = window.pennStation.getCamera();
        return window.pennStation.getState().framing === name && camera && Math.hypot(...camera.position.map((value, index) => value - expected[index])) < .1;
      }, { name: neighbour, expected: neighbour === 'hotel' ? [140, 6, 65] : [-130, 8, 71] });
      const after = await p.evaluate(() => window.pennStation.getCamera().position);
      assert(distance(before, after) > 1, `${neighbour}: the neighbourhood control changes the actual camera`);
      assert(neighbour === 'hotel' ? after[0] > 119 : after[0] < -119, `${neighbour}: viewpoint lies across the correct avenue`);
      assert.match(await p.locator('#location-title').textContent(), neighbour === 'hotel' ? /Seventh/ : /Eighth/);
      await snapshot(p, `desktop-${neighbour}`, desktop.record);
    }
    await p.locator('#map-control > summary').click();
    report.checks.push('Hotel Pennsylvania and General Post Office controls reach distinct, correctly oriented neighbourhood viewpoints');

    await choose(p, 'waiting');
    await settings(p);
    await p.locator('[data-command="mode"][data-value="walk"]').click();
    assert(await p.locator('#scene-root canvas').evaluate(el => el === document.activeElement), 'Choosing Walk makes the documented WASD controls immediately available');
    await walkingReady(p);
    const walkBefore = await p.evaluate(() => window.pennStation.getCamera().position);
    await p.keyboard.down('KeyW');
    try {
      await p.waitForFunction(before => Math.hypot(...window.pennStation.getCamera().position.map((value, index) => value - before[index])) > .25, walkBefore, { timeout: 20000 });
    } finally { await p.keyboard.up('KeyW'); }
    await p.waitForTimeout(250);
    const walked = await p.evaluate(() => window.pennStation.getCamera().position);
    assert(distance(walkBefore, walked) > 0.2, 'W actually moves the human-height camera');
    await p.locator('#map-control > summary').click();
    await p.waitForFunction(() => document.querySelector('#map-position').getAttribute('visibility') === 'visible');
    const locator = await p.evaluate(() => ({ position: window.pennStation.getCamera().position, x: Number(document.querySelector('#map-position').getAttribute('cx')), z: Number(document.querySelector('#map-position').getAttribute('cy')) }));
    assert(Math.abs(locator.x - (34 + (locator.position[0] + 119.4816) / 238.9632 * 212)) < 2, 'Walking dot projects actual east/west location');
    assert(Math.abs(locator.z - (28 + (locator.position[2] + 65.532) / 131.064 * 112)) < 2, 'Walking dot projects actual north/south location');
    await p.locator('#map-control > summary').click();
    await p.locator('#scene-root canvas').focus();
    assert(Math.abs(walked[1] - WAITING_EYE) < .03, 'Walking keeps human eye height above the waiting-room floor 14 ft below the street');
    // Walk backwards toward the nearest chamber boundary. Record the actual stop;
    // this verifies the room envelope, not every staircase or obstacle in the site.
    await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyS');
    const stops = [];
    try {
      await p.waitForFunction(() => window.pennStation.getCamera().position[2] > 41.4, null, { timeout: 90000 });
      for (let i = 0; i < 4; i++) {
        await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        stops.push(await p.evaluate(() => window.pennStation.getCamera().position));
      }
    } finally { await p.keyboard.up('KeyS'); await p.keyboard.up('ShiftLeft'); }
    const atWall = stops.at(-1);
    desktop.record.walking = { before: walkBefore, afterForward: walked, boundarySamples: stops };
    assert(atWall[0] >= -14.401 && atWall[0] <= 14.401 && atWall[2] >= -42.201 && atWall[2] <= 42.201, 'Walking stays inside the waiting-room chamber bounds');
    assert(atWall[2] > 41.4, 'The stop occurs at the actual south chamber boundary');
    assert(stops.length >= 2 && distance(stops.at(-2), atWall) < 0.08, 'Movement settles against a wall or chamber boundary');
    report.checks.push('WASD movement, fixed eye height and measured stop at waiting-room wall/envelope');

    await settings(p);
    await p.locator('[data-command="mode"][data-value="orbit"]').click();
    for (const light of ['morning', 'afternoon', 'evening']) {
      await p.locator(`[data-command="light"][data-value="${light}"]`).click();
      assert.equal(await p.evaluate(() => window.pennStation.getState().light), light);
      assert.equal(await p.locator(`[data-command="light"][data-value="${light}"]`).getAttribute('aria-pressed'), 'true');
    }
    await p.locator('#fov').focus(); await p.keyboard.press('Home');
    for (let i = 0; i < 5; i++) await p.keyboard.press('ArrowRight');
    await p.waitForFunction(() => window.pennStation.getCamera().fov === 40);
    await p.locator('#shadows').uncheck();
    assert.equal(await p.evaluate(() => window.pennStation.getState().shadows), false);
    const lowLoad = p.waitForResponse(response => new URL(response.url()).pathname.endsWith('/model-waiting-room-low.glb.gz') && response.status() === 200);
    await p.locator('#quality').selectOption('low'); await lowLoad; await ready(p, 'waiting');
    assert.equal(await p.evaluate(() => window.pennStation.getState().quality), 'low');
    const cachedResources = await p.evaluate(() => window.pennStation.getMetrics());
    for (const quality of ['balanced', 'low', 'high', 'low', 'balanced', 'low']) {
      await p.locator('#quality').selectOption(quality);
      await p.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await ready(p, 'waiting');
    }
    const afterQualityCycles = await p.evaluate(() => window.pennStation.getMetrics());
    assert(afterQualityCycles.geometries <= cachedResources.geometries + 2, 'Repeated full/low switches reuse the geometry cache without accumulating GPU geometry');
    desktop.record.qualityCycles = { before: cachedResources, after: afterQualityCycles };
    await p.locator('[data-command="annotations"]').click();
    await settings(p, false);
    const hotspot = p.locator('.hotspot').first();
    await hotspot.click();
    assert(await p.locator('#annotation-dialog').evaluate(el => el.open));
    assert((await p.locator('#annotation-text').textContent()).length > 40);
    await p.keyboard.press('Escape');
    assert.equal(await p.locator('#annotation-dialog').evaluate(el => el.open), false);
    assert(await hotspot.evaluate(el => el === document.activeElement), 'Annotation returns focus to its trigger');
    report.checks.push('Morning/afternoon/evening, keyboard FOV, shadow toggle, mobile GLB quality asset and historical hotspot dialog');

    await p.locator('.utility-buttons [data-command="compare"]').click();
    await p.locator('#reference-photo').evaluate(img => img.decode());
    assert(await p.locator('#reference-photo').evaluate(img => img.complete && img.naturalWidth > 500), 'Comparison photo actually decodes');
    assert((await p.locator('#reference-photo').getAttribute('src')).includes('/reference-waiting.jpg'));
    const beforeFraming = await p.evaluate(() => window.pennStation.getCamera());
    await p.locator('#reference-framing').click();
    await p.waitForFunction(previous => {
      const current = window.pennStation.getCamera();
      return window.pennStation.getState().framing === 'waiting' && window.pennStation.getState().mode === 'orbit' && current && (Math.hypot(...current.position.map((value, index) => value - previous.position[index])) > .1 || Math.abs(current.fov - previous.fov) > .1);
    }, beforeFraming);
    const afterFraming = await p.evaluate(() => window.pennStation.getCamera());
    assert(distance(beforeFraming.position, afterFraming.position) > .1 || Math.abs(beforeFraming.fov - afterFraming.fov) > .1, 'Approximate archival framing changes the camera pose or lens');
    assert.match(await p.locator('#reference-framing').textContent(), /approximate/i, 'The historical camera control does not claim calibrated matching');
    assert.match(await p.locator('#reference-photo').getAttribute('alt'), /not.*precisely matched/i);
    await snapshot(p, 'desktop-archive-comparison', desktop.record);
    await p.locator('#comparison [data-command="compare"]').click();
    const sources = p.locator('.header-actions [data-command="sources"]');
    await sources.click();
    assert(await p.locator('#sources-dialog').evaluate(el => el.open));
    assert(await p.evaluate(() => document.activeElement.closest('#sources-dialog') !== null), 'Sources modal receives focus');
    for (let i = 0; i < 8; i++) {
      await p.keyboard.press('Tab');
      assert(await p.evaluate(() => document.activeElement.closest('#sources-dialog') !== null), 'Native modal keeps tab focus inside');
    }
    await p.keyboard.press('Escape');
    assert(await sources.evaluate(el => el === document.activeElement), 'Escape returns focus to Sources trigger');
    await p.locator('.utility-buttons [data-command="tour"]').click();
    assert.equal(await p.evaluate(() => window.pennStation.getState().tour), true);
    await p.keyboard.press('Escape');
    assert.equal(await p.evaluate(() => window.pennStation.getState().tour), false);
    desktop.record.frameScheduling = await frameSample(p);
    clean(desktop.record);
    report.checks.push('Decoded historical comparison and explicitly approximate framing, native modal focus/Tab/Escape and guided tour start/cancel');
    }

    const mobile = await open('mobile emulation 390 × 844, touch, reduced motion', { mobile: true, reducedMotion: 'reduce' });
    const m = mobile.page;
    await ready(m, 'exterior');
    assert.equal(await m.evaluate(() => window.pennStation.getState().quality), 'low');
    assert(mobile.record.requests.some(r => r.path.endsWith('/model-exterior-low.glb.gz') && r.status === 200));
    assert(mobile.record.requests.some(r => r.path.endsWith('/model-context-low.glb.gz') && r.status === 200), 'Mobile loads the lower-detail neighbourhood asset');
    await snapshot(m, 'mobile-intro', mobile.record);
    await m.locator('[data-command="enter"]').tap();
    const waitButton = m.locator('.viewpoints [data-value="waiting"]');
    const mobileWaitingLoad = m.waitForResponse(response => new URL(response.url()).pathname.endsWith('/model-waiting-room-low.glb.gz') && response.status() === 200);
    await waitButton.focus(); await m.keyboard.press('Enter');
    await mobileWaitingLoad;
    await ready(m, 'waiting');
    assert.equal(await m.evaluate(() => window.pennStation.getState().instant), true, 'Reduced-motion/keyboard view changes are immediate');
    await m.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== 'running'));
    await choose(m, 'concourse', true);
    mobile.record.bakedLighting = await bakedLighting(m, '-low');
    assert(mobile.record.requests.some(r => r.path.endsWith('/model-platform-low.glb.gz') && r.status === 200), 'Mobile concourse loads the lighter separate platform asset');
    assert(mobile.record.requests.some(r => r.path.endsWith('/model-trains-low.glb.gz') && r.status === 200), 'Mobile concourse loads the lighter rolling-stock asset');
    await snapshot(m, 'mobile-concourse', mobile.record);
    await choose(m, 'waiting');
    await settings(m);
    await m.locator('[data-command="mode"][data-value="walk"]').tap();
    await settings(m, false);
    const forwardTouch = m.locator('.walk-pad button[data-move="KeyW"]');
    assert(await forwardTouch.isVisible(), 'Touch walking control is visible');
    await walkingReady(m);
    const touchBefore = await m.evaluate(() => window.pennStation.getCamera().position);
    const touchBox = await forwardTouch.boundingBox();
    const touchSession = await mobile.context.newCDPSession(m);
    try {
      await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchBox.x + touchBox.width / 2, y: touchBox.y + touchBox.height / 2 }] });
      await m.waitForFunction(before => Math.hypot(...window.pennStation.getCamera().position.map((value, index) => value - before[index])) > .18, touchBefore, { timeout: 20000 });
      await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    } finally { await touchSession.detach(); }
    const touchAfter = await m.evaluate(() => window.pennStation.getCamera().position);
    assert(distance(touchBefore, touchAfter) > 0.15, 'Labelled on-screen button moves camera');
    assert(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '390 px layout has no horizontal overflow');
    await snapshot(m, 'mobile-walking', mobile.record);
    // Text enlargement, rather than a screenshot-only viewport resize, exercises
    // the scrollable modal's content and reachable close control.
    await m.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    await m.locator('.header-actions [data-command="sources"]').tap();
    assert(await m.locator('#sources-dialog').isVisible());
    const textLayout = await m.locator('#sources-dialog').evaluate(el => ({
      client: el.clientWidth, scroll: el.scrollWidth,
      bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
    }));
    mobile.record.textLayout = textLayout;
    await snapshot(m, 'mobile-sources-200-percent-text', mobile.record);
    assert(textLayout.scroll <= textLayout.client + 1 && textLayout.bodyOverflow <= 1, `Sources panel remains readable without horizontal overflow at 200% text: ${JSON.stringify(textLayout)}`);
    const close = m.locator('#sources-dialog button[aria-label="Close sources and accuracy"]');
    await close.scrollIntoViewIfNeeded();
    const closeBox = await close.boundingBox();
    assert(closeBox && closeBox.x >= -1 && closeBox.x + closeBox.width <= 391, 'Enlarged sources close control remains reachable');
    await m.keyboard.press('Escape');
    mobile.record.frameScheduling = await frameSample(m);
    clean(mobile.record);
    report.checks.push('390 px touch layout, low GLB, on-screen movement, reduced-motion keyboard and 200% text sources panel');

    const recovery = await open('intentional model failure and retry', { failModel: true });
    const r = recovery.page;
    await r.waitForFunction(() => Boolean(window.pennStation.getState().error));
    assert(await r.locator('#load-error').isVisible(), 'Missing model surfaces a useful error');
    assert(await r.locator('#loading').isHidden(), 'Failure replaces the loading cover');
    await r.locator('#load-error [data-command="sources"]').click();
    assert(await r.locator('#sources-dialog').evaluate(el => el.open), 'Research remains available after asset failure');
    await r.keyboard.press('Escape');
    await r.locator('[data-command="retry"]').click();
    await ready(r, 'exterior');
    assert.equal(await r.evaluate(() => window.pennStation.getState().revision), 1);
    await snapshot(r, 'recovered-after-model-failure', recovery.record);
    clean(recovery.record, { expectedFailure: true });
    report.checks.push('A model 503 replaces loading with an alert, keeps sources available and recovers with Try again');

    const environmentRecovery = await open('intentional HDR environment failure and retry', { failHDR: true });
    const e = environmentRecovery.page;
    await e.waitForFunction(() => Boolean(window.pennStation.getState().error));
    assert(await e.locator('#load-error').isVisible(), 'Missing environment has a visible error');
    assert(await e.locator('#loading').isHidden(), 'Environment failure ends the loading cover');
    await e.locator('[data-command="retry"]').click();
    await ready(e, 'exterior');
    await snapshot(e, 'recovered-after-environment-failure', environmentRecovery.record);
    clean(environmentRecovery.record, { expectedFailure: true, rendererFailure: true });
    report.checks.push('A transient sky.hdr failure recovers with Try again rather than retaining a failed loader cache');

    const fallback = await open('forced unavailable WebGL context', { noRenderer: true });
    const f = fallback.page;
    await f.locator('#scene-root').getByText(/graphics are unavailable|historical exhibition is available|renderer could not start/i).waitFor({ state: 'visible' });
    assert(await f.locator('#loading').isHidden(), 'Unavailable renderer does not leave an endless loading cover');
    await f.locator('.header-actions [data-command="sources"]').click();
    assert(await f.locator('#sources-dialog').evaluate(el => el.open), 'Sources remain usable without graphics');
    await snapshot(f, 'graphics-unavailable-fallback', fallback.record);
    clean(fallback.record, { rendererFailure: true });
    report.checks.push('Forced unavailable graphics provides a visible fallback and usable source information');

    report.passed = true;
    console.log(`PASS ${report.checks.length} integration groups; screenshots and measured rendering statistics: ${output}`);
  } catch (error) {
    report.passed = false; report.failure = error.stack || String(error);
    console.error(error.stack || error);
    process.exitCode = 1;
  } finally {
    await fs.writeFile(path.join(output, 'validation.json'), JSON.stringify(report, null, 2) + '\n');
    await Promise.allSettled(contexts.map(context => context.close()));
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})();
