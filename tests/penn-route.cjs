/*
 * Reproducible walking route through the Pennsylvania Station exhibition.
 * Run after rebuilding the app and installing all current assets:
 * PLAYWRIGHT_MODULE=/private/tmp/penn-station-tools/node_modules/playwright \
 * node tests/penn-route.cjs
 *
 * CHROME_PATH overrides the installed Chrome executable. PENN_ROUTE_OUTPUT
 * changes the output directory; PENN_ROUTE_RETURN=0 skips the return journey.
 * PENN_ROUTE_RENDER_WIDTH=320 PENN_ROUTE_RENDER_HEIGHT=240 reduces only the
 * scene container after entering Walk for slow software-rendered route checks.
 * Uses real keyboard input, real collision geometry and read-only diagnostics.
 * SwiftShader scheduling is not a hardware frame-rate measurement.
 * PENN_ANGLE=metal requests the local Mac driver and records its actual name.
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.PENN_ROUTE_OUTPUT || '/private/tmp');
const reportPath = path.join(output, 'penn-route-validation.json');
const prefix = '/exhibition/';
const HUMAN_EYE = 1.68;
const angle = process.env.PENN_ANGLE || 'swiftshader';
assert(['swiftshader', 'metal'].includes(angle), 'PENN_ANGLE must be swiftshader or metal');
const report = {
  started: new Date().toISOString(),
  scope: 'Installed headless Chrome, 640×480 viewport, low quality, real keyboard input and collision surfaces. No camera mutation or mocked 3D.',
  requestedAngle: angle,
  rendererNote: `ANGLE/${angle} requested; the observed renderer is recorded after startup. Elapsed movement and render counts are not a general hardware frame-rate claim.`,
  deploymentPrefix: prefix,
  checks: [], legs: [], errors: [], consoleErrors: [], requests: [], blockedExternal: [],
};
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gz': 'application/octet-stream', '.hdr': 'application/octet-stream',
  '.wasm': 'application/wasm', '.ktx2': 'image/ktx2',
};

async function bounded(promise, milliseconds, description) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${description} exceeded ${milliseconds}ms`)), milliseconds);
      }),
    ]);
  } finally { clearTimeout(timer); }
}

async function finishCli(code) {
  await Promise.all([process.stdout, process.stderr].map(stream => new Promise(resolve => stream.write('', resolve))));
  process.exit(code);
}

(async () => {
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  const server = http.createServer(async (req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400).end(); return; }
    if (!pathname.startsWith(prefix)) { res.writeHead(404).end('Project prefix required'); return; }
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
  let browser, page;
  let pose;
  const heldKeys = new Set();
  const persist = () => fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(root, 'penn-station-1935/assets/scene-manifest.json'), 'utf8'));
    const mainFloor = manifest.levels.mainWorld;
    const mainStair = manifest.mainStair;
    assert(Number.isFinite(mainFloor) && mainStair?.bounds?.length === 4, 'Final manifest supplies actual hall/stair navigation datums');
    report.manifestRevision = manifest.revision;
    report.runtimeBundleSha256 = createHash('sha256').update(await fs.readFile(path.join(root, 'penn-station-1935/dist/app.js'))).digest('hex');
    console.log(`ROUTE launch: installed Chrome, ANGLE/${angle}, 640×480 low-quality world`);
    browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: true,
      args: [`--use-angle=${angle}`, ...(angle === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : []), '--enable-webgl', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
    });
    report.browser = browser.version();
    const context = await browser.newContext({ viewport: { width: 640, height: 480 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    page = await context.newPage();
    page.setDefaultTimeout(60000);
    page.setDefaultNavigationTimeout(60000);
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    page.on('response', response => {
      if (response.url().startsWith(origin + '/')) report.requests.push({ path: new URL(response.url()).pathname, status: response.status() });
    });
    await page.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(origin + '/') || /^(data:|blob:)/.test(url)) return route.continue();
      report.blockedExternal.push(url);
      return route.abort();
    });
    await page.goto(origin + prefix + 'penn-station-1935/', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => Boolean(window.pennStation), null, { timeout: 60000 });

    async function sample() {
      return bounded(page.evaluate(() => ({
        state: window.pennStation.getState(), camera: window.pennStation.getCamera(),
        metrics: window.pennStation.getMetrics(), assets: window.pennStation.getAssets?.(),
        scene: window.pennStation.getScene?.(), navigation: window.pennStation.getNavigation?.(),
      })), 10000, 'Camera/state diagnostic');
    }
    async function ready(label) {
      const deadline = Date.now() + 180000;
      let last;
      while (Date.now() < deadline) {
        last = await sample();
        if (last.state.error) throw new Error(`${label}: ${last.state.error}`);
        if (!last.state.loading && last.metrics?.calls > 0 && last.metrics?.triangles > 1000) return last;
        await page.waitForTimeout(2000);
      }
      report.readyTimeout = { label, last };
      throw new Error(`${label}: geometry did not become ready within 180 seconds`);
    }
    await ready('Exterior introduction');
    report.driver = await page.evaluate(() => {
      const context = document.querySelector('#scene-root canvas').getContext('webgl2');
      if (!context) return { unavailable: true };
      const extension = context.getExtension('WEBGL_debug_renderer_info');
      return { vendor: context.getParameter(extension?.UNMASKED_VENDOR_WEBGL || context.VENDOR), renderer: context.getParameter(extension?.UNMASKED_RENDERER_WEBGL || context.RENDERER), version: context.getParameter(context.VERSION) };
    });
    if (angle === 'metal') assert.match(report.driver.renderer, /Metal/i, 'Requested Metal route actually uses the observed Metal driver');
    console.log(`ROUTE driver: ${JSON.stringify(report.driver)}`);
    await page.locator('[data-command="enter"]').click();
    await page.locator('#settings > summary').click();
    await page.waitForFunction(() => document.querySelector('#settings').open);
    await page.locator('[data-command="mode"][data-value="walk"]').click();
    await page.locator('#settings > summary').click();
    let initial = await ready('Connected walking world');
    // Wait for the actual human-height exterior pose, rather than counting its
    // preset reset as the first successful movement.
    await page.waitForFunction(() => {
      const s = window.pennStation.getState();
      const c = window.pennStation.getCamera();
      return s.mode === 'walk' && !s.loading && c && Math.abs(c.position[0] - 124) < .05 && Math.abs(c.position[1] - 1.68) < .03 && Math.abs(c.position[2]) < .03;
    }, null, { timeout: 60000 });
    initial = await sample();
    assert(initial.scene, 'Read-only scene diagnostics expose the complete persistent world');
    for (const zone of ['exterior', 'waiting', 'concourse', 'context', 'platform', 'trains']) {
      const present = initial.scene.zones.find(item => item.name === zone);
      assert(present?.visible && present.meshes > 0, `Walking route starts with actual visible ${zone} geometry`);
    }
    pose = initial.state.pose;
    report.initial = initial;
    const renderWidth = Number(process.env.PENN_ROUTE_RENDER_WIDTH || 0);
    const renderHeight = Number(process.env.PENN_ROUTE_RENDER_HEIGHT || 0);
    if (renderWidth || renderHeight) {
      assert(Number.isInteger(renderWidth) && renderWidth >= 160 && renderWidth <= 640, 'Functional render width is within160–640px');
      assert(Number.isInteger(renderHeight) && renderHeight >= 120 && renderHeight <= 480, 'Functional render height is within120–480px');
      await page.addStyleTag({ content: `#scene-root { right:auto; bottom:auto; width:${renderWidth}px; height:${renderHeight}px; }` });
      await page.waitForFunction(({ width, height }) => {
        const canvas = document.querySelector('#scene-root canvas');
        return canvas && canvas.width === width && canvas.height === height;
      }, { width: renderWidth, height: renderHeight });
      report.functionalRenderOverride = 'Scene-container CSS size only; all connected-world geometry, collision surfaces and real keyboard input remain active. Layout and performance claims belong to the separate UI suite.';
    }
    report.renderDimensions = await page.locator('#scene-root canvas').evaluate(canvas => ({ drawingBuffer: [canvas.width, canvas.height], css: [canvas.clientWidth, canvas.clientHeight], viewport: [innerWidth, innerHeight] }));
    assert.equal(initial.state.quality, 'low', '640px viewport selects low quality');
    assert.equal(initial.state.view, 'exterior', 'Route starts at the exterior');
    if (initial.assets) for (const zone of ['exterior', 'waiting-room', 'concourse', 'platform', 'context', 'trains']) {
      assert(initial.assets.some(asset => asset.file === `model-${zone}-low.glb`), `Connected world has decoded ${zone} at low quality`);
    }
    await page.screenshot({ path: path.join(output, 'penn-route-exterior.png'), animations: 'disabled' });
    report.checks.push('Actual exterior walking spawn, complete low-quality connected world, relative project-prefix asset loading');

    async function release() {
      for (const key of heldKeys) await page.keyboard.up(key);
      heldKeys.clear();
    }
    async function drive(label, keys, axis, sign, reached, options = {}) {
      await release();
      const start = await sample();
      const leg = { label, keys, start, samples: [] };
      report.legs.push(leg);
      console.log(`ROUTE leg: ${label}`);
      const startTime = Date.now();
      const deadline = startTime + Math.min(options.timeout || 300000, 300000);
      let previous = start, previousTime = startTime, stalled = 0;
      try {
        await page.locator('#scene-root canvas').focus();
        for (const key of keys) { await page.keyboard.down(key); heldKeys.add(key); }
        while (Date.now() < deadline) {
          await page.waitForTimeout(2000);
          const current = await sample();
          const now = Date.now();
          const position = current.camera?.position;
          assert(position && position.every(Number.isFinite), `${label}: finite camera position`);
          const progress = sign * (position[axis] - previous.camera.position[axis]);
          const elapsed = (now - previousTime) / 1000;
          const horizontalDistance = Math.hypot(position[0] - previous.camera.position[0], position[2] - previous.camera.position[2]);
          leg.samples.push({ elapsedSeconds: (now - startTime) / 1000, position, view: current.state.view, mode: current.state.mode, pose: current.state.pose, progress, metrics: current.metrics, navigation: current.navigation });
          await persist();
          console.log(`ROUTE ${label}: ${position.map(value => value.toFixed(2)).join(', ')} · ${current.state.view}`);
          assert.equal(current.state.mode, 'walk', `${label}: walking mode persists`);
          assert.equal(current.state.pose, pose, `${label}: automatic room updates do not reset the camera pose`);
          assert.equal(current.state.error, '', `${label}: no loading/render error`);
          assert(!current.state.loading, `${label}: movement does not unexpectedly replace the world`);
          assert.deepEqual(current.scene, initial.scene, `${label}: every architectural zone remains the same visible world`);
          assert(current.navigation?.maximumCandidates < 512, `${label}: short collision rays stay local rather than traversing the railway fitting population`);
          assert(horizontalDistance <= 5.25 * elapsed + .35, `${label}: movement stays within running speed; no preset teleport`);
          if (options.mainStair) {
            const stairFraction = Math.max(0, Math.min(1, (position[0] - mainStair.bounds[0]) / (mainStair.bounds[1] - mainStair.bounds[0])));
            const expectedEye = mainStair.startFloorWorld + stairFraction * (mainStair.endFloorWorld - mainStair.startFloorWorld) + HUMAN_EYE;
            assert(Math.abs(position[1] - expectedEye) < .5, `${label}: eye height follows the actual stair/floor profile`);
          } else if (options.flatFloor) {
            assert(Math.abs(position[1] - (mainFloor + HUMAN_EYE)) < .15, `${label}: main-level human eye height remains stable`);
          }
          if (reached(position)) { leg.end = current; leg.elapsedSeconds = (now - startTime) / 1000; return current; }
          stalled = progress < .12 ? stalled + 1 : 0;
          assert(stalled < 3, `${label}: stalled for three successive two-second samples; likely collision/navigation gap`);
          previous = current; previousTime = now;
        }
        throw new Error(`${label}: route deadline exceeded`);
      } catch (error) {
        leg.failureKeys = [...heldKeys];
        throw error;
      } finally { await release(); }
    }

    const hall = await drive('Seventh Avenue through arcade and down grand stair', ['ShiftLeft', 'KeyW'], 0, -1, p => p[0] <= 5, { mainStair: true });
    assert.equal(hall.state.view, 'waiting', 'Walking into the hall automatically changes the location label');
    assert(Math.abs(hall.camera.position[1] - (mainFloor + HUMAN_EYE)) < .15, 'Hall eye is 1.68m above the lower main floor');
    report.checks.push('Continuous exterior-to-hall route,28-riser descent and automatic waiting-room label without teleporting');

    // The source model places benches near X−10.7,Z5. Keep the clear central
    // hall path before moving sideways in the axial passage. Z4 then bypasses
    // the central concourse stair opening without walking through furniture.
    await drive('Clear hall centre to axial passage', ['ShiftLeft', 'KeyW'], 0, -1, p => p[0] <= -25, { flatFloor: true });
    const offset = await drive('Passage sidestep around central stair opening', ['KeyA'], 2, 1, p => p[2] >= 3.5, { flatFloor: true, timeout: 30000 });
    assert(offset.camera.position[2] < 7, 'Sidestep remains within the clear passage and grand-stair width');
    const concourse = await drive('Axial passage into glass concourse', ['ShiftLeft', 'KeyW'], 0, -1, p => p[0] <= -68, { flatFloor: true });
    assert.equal(concourse.state.view, 'concourse', 'Concourse label changes automatically during continuous walking');
    assert.equal(concourse.state.pose, pose, 'Complete outward route uses the original walking pose');
    await page.screenshot({ path: path.join(output, 'penn-route-concourse.png'), animations: 'disabled' });
    report.concourse = concourse;
    report.checks.push('Hall-to-concourse passage, real sidestep, stair-well bypass and automatic concourse label without a pose reset or world replacement; local collision candidate counts remain bounded');

    if (process.env.PENN_ROUTE_RETURN !== '0') {
      await drive('Return across concourse to axial passage', ['ShiftLeft', 'KeyS'], 0, 1, p => p[0] >= -28, { flatFloor: true });
      const centred = await drive('Rejoin the clear central hall route', ['KeyD'], 2, -1, p => p[2] <= 1, { flatFloor: true, timeout: 30000 });
      assert(Math.abs(centred.camera.position[2]) < 3, 'Return path avoids the hall benches');
      const returned = await drive('Return through hall and climb grand stair', ['ShiftLeft', 'KeyS'], 0, 1, p => p[0] >= 28, { mainStair: true });
      assert(Math.abs(returned.camera.position[1] - HUMAN_EYE) < .15, 'Return reaches street-level eye height');
      assert.equal(returned.state.view, 'exterior', 'Return updates the exterior label automatically');
      report.returned = returned;
      report.checks.push('Continuous return journey and upward grand-stair traversal to street-level eye height');
    }
    assert.deepEqual(report.errors, [], 'No uncaught browser errors');
    assert.deepEqual(report.consoleErrors.filter(message => !/net::ERR_FAILED/.test(message)), [], 'No meaningful browser console errors');
    assert.deepEqual(report.requests.filter(request => request.status >= 400), [], 'All required local assets load under the project prefix');
    report.passed = true;
    console.log('ROUTE PASS: complete collision-checked walking journey');
  } catch (error) {
    report.passed = false; report.failure = error.stack || String(error);
    if (page) {
      try { report.failureState = await bounded(page.evaluate(() => ({ state: window.pennStation?.getState(), camera: window.pennStation?.getCamera(), metrics: window.pennStation?.getMetrics() })), 3000, 'Failure diagnostic'); } catch {}
      try {
        await bounded(page.screenshot({ path: path.join(output, 'penn-route-failure.png'), animations: 'disabled', timeout: 10000 }), 12000, 'Failure screenshot');
        report.failureScreenshot = { path: path.join(output, 'penn-route-failure.png'), captured: new Date().toISOString() };
      } catch (screenshotError) { report.failureScreenshotError = screenshotError.message; }
    }
    console.error(report.failure);
    process.exitCode = 1;
  } finally {
    report.finished = new Date().toISOString();
    await persist();
    if (page) for (const key of heldKeys) { try { await bounded(page.keyboard.up(key), 2000, 'Release key'); } catch {} }
    if (browser) { try { await bounded(browser.close(), 12000, 'Close browser'); } catch {} }
    server.closeAllConnections?.();
    await new Promise(resolve => server.close(resolve));
    console.log(`ROUTE report: ${reportPath}`);
  }
})().then(
  () => finishCli(process.exitCode || 0),
  error => { console.error(error.stack || error); return finishCli(1); },
);
