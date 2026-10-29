/* Real-input navigation regressions. Run after build.mjs, from the repository:
 * PLAYWRIGHT_MODULE=/path/to/tools/node_modules/playwright PENN_ANGLE=metal node tests/penn-navigation.cjs
 * PENN_NAV_SECTION=flight|train|all (default all); sign captures the repaired office lettering. Outputs are outside the public app.
 * PENN_TRAIN_VARIANT=full|low|both (default full); low remains an optional geometry check.
 * No camera setters, teleports, platform shortcut or synthetic frame deltas are used.
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const output = process.env.PENN_SCREENSHOTS || path.join(root, '../penn-station-work/navigation-review');
const section = process.env.PENN_NAV_SECTION || 'all';
assert(['all', 'flight', 'train', 'sign'].includes(section));
const prefix = '/exhibition/';
const report = { created: new Date().toISOString(), section, checks: [], contexts: [], scope: 'Installed desktop Chrome and 390 px touch emulation; no physical-phone certification.' };
const length = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.wasm':'application/wasm', '.ktx2':'image/ktx2', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml', '.webp':'image/webp' };
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!url.pathname.startsWith(prefix)) return res.writeHead(404).end();
  let file = path.resolve(root, decodeURIComponent(url.pathname.slice(prefix.length)));
  if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
  if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
  try { const data = await fs.readFile(file); res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' }); res.end(data); }
  catch { res.writeHead(404).end(); }
});
(async () => {
  await fs.mkdir(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    report.runtimeBundleSha256 = createHash('sha256').update(await fs.readFile(path.join(root, 'penn-station-1935/dist/app.js'))).digest('hex');
    report.modelSha256 = {};
    for (const filename of ['model-waiting-room.glb.gz', 'model-waiting-room-low.glb.gz', 'model-concourse.glb.gz', 'model-concourse-low.glb.gz', 'scene-manifest.json']) report.modelSha256[filename] = createHash('sha256').update(await fs.readFile(path.join(root, 'penn-station-1935/assets', filename))).digest('hex');
    const angle = process.env.PENN_ANGLE || 'metal'; report.requestedAngle = angle;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: [`--use-angle=${angle}`, '--enable-webgl', '--ignore-gpu-blocklist', ...(angle === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : [])] });
    report.browser = browser.version();
    async function open(label, mobile = false) {
      console.log(`OPEN ${label}`);
      const context = await browser.newContext({ viewport: { width: mobile ? 390 : 1440, height: mobile ? 844 : 1000 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      const page = await context.newPage();
      page.setDefaultTimeout(120000);
      const record = { label, errors: [], requestsFailed: [] }; report.contexts.push(record);
      page.on('pageerror', e => record.errors.push(e.message));
      page.on('response', r => { if (r.url().startsWith(origin) && r.status() >= 400) record.requestsFailed.push({ url: r.url(), status: r.status() }); });
      await page.route('**/*', route => /^(data:|blob:)/.test(route.request().url()) || route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
      await page.goto(`${origin}${prefix}penn-station-1935/`);
      await page.waitForFunction(() => window.pennStation && !window.pennStation.getState().loading && !window.pennStation.getState().error);
      record.renderer = await page.evaluate(() => { const gl = document.querySelector('#scene-root canvas').getContext('webgl2'); const ext = gl?.getExtension('WEBGL_debug_renderer_info'); return gl ? { renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER), vendor: gl.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : gl.VENDOR) } : null; });
      await page.locator('[data-command="enter"]').click();
      return { page, context, record };
    }
    const pose = page => page.evaluate(() => window.pennStation.getCamera());
    const state = page => page.evaluate(() => window.pennStation.getState());
    async function settle(page, ms = 650) { await page.waitForTimeout(ms); }
    async function hold(page, key, ms = 650) { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await settle(page); }
    async function settings(page, open) {
      const control = page.locator('.settings');
      if (await control.evaluate(e => e.open) !== open) await control.locator(':scope > summary').click();
    }
    async function flight() {
      const { page, context, record } = await open('desktop flight');
      await page.locator('.viewpoints [data-command="view"][data-value="exterior"]').click();
      assert(await page.locator('#scene-root canvas').evaluate(e => e === document.activeElement), 'Pointer-selected viewpoint makes WASD immediately available');
      const initialWorld = await page.evaluate(() => window.pennStation.getScene());
      const initial = await pose(page); record.initial = initial; record.initialState = await state(page);
      assert.equal(await page.locator('.walk-pad').isVisible(), false, 'Large fine-pointer Orbit keeps movement pad hidden');
      await hold(page, 'KeyW'); const after = await pose(page); record.after = after; record.afterState = await state(page);
      assert(length(initial.position, after.position) > 2.5, 'W flies forward in Orbit');
      assert(length(initial.quaternion, after.quaternion) < .00001, 'Translation preserves viewing direction by moving the orbit target too');
      const stopped = await pose(page); await settle(page, 350); const resting = await pose(page);
      assert(length(stopped.position, resting.position) < .05, 'Released flight comes to rest');
      await hold(page, 'KeyE'); const raised = await pose(page);
      assert(raised.position[1] > resting.position[1] + 2, 'E raises the free camera');
      assert(Math.abs(raised.position[0] - resting.position[0]) < .1, 'Vertical flight does not drift horizontally');
      await hold(page, 'KeyQ'); const lowered = await pose(page);
      assert(lowered.position[1] < raised.position[1] - 2, 'Q lowers the free camera');
      const slow = await pose(page); await hold(page, 'KeyD', 400); const slowAfter = await pose(page);
      await page.keyboard.down('ShiftLeft'); const fast = await pose(page); await hold(page, 'KeyD', 400); await page.keyboard.up('ShiftLeft'); const fastAfter = await pose(page);
      assert(length(fast.position, fastAfter.position) > length(slow.position, slowAfter.position) * 1.8, 'Shift accelerates flight');
      // Native fields must keep their normal keyboard behavior.
      await settings(page, true); await page.locator('#fov').focus();
      const fieldBefore = await pose(page); await hold(page, 'KeyW', 250); const fieldAfter = await pose(page);
      assert(length(fieldBefore.position, fieldAfter.position) < .01, 'Native settings field does not fly the scene');
      const oldFov = Number(await page.locator('#fov').inputValue()); await page.keyboard.press('ArrowRight');
      assert.equal(Number(await page.locator('#fov').inputValue()), oldFov + 1, 'Native arrow key still adjusts the focused field');
      assert(length(fieldBefore.position, (await pose(page)).position) < .01, 'Native field arrow does not also strafe the camera');
      await settings(page, false);
      await page.locator('.viewport-actions [data-command="help"]').click(); const dialogBefore = await pose(page); await hold(page, 'KeyW', 250); const dialogAfter = await pose(page);
      assert(length(dialogBefore.position, dialogAfter.position) < .01, 'Open dialog blocks camera input');
      await page.keyboard.press('Escape');
      await page.locator('#scene-root canvas').focus(); await page.keyboard.down('KeyW'); await page.waitForTimeout(150);
      await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await settle(page, 100);
      const blurred = await pose(page); await settle(page, 300); const blurredAfter = await pose(page); await page.keyboard.up('KeyW');
      assert(length(blurred.position, blurredAfter.position) < .01, 'Blur clears held navigation and velocity');
      assert.deepEqual(await page.evaluate(() => window.pennStation.getScene()), initialWorld, 'Flight keeps all six zone IDs unchanged');
      record.flight = { initial, after, raised, lowered, fastAfter, final: blurredAfter };
      await page.screenshot({ path: path.join(output, 'desktop-flight.png') });
      assert.deepEqual(record.errors, []); assert.deepEqual(record.requestsFailed, []);
      report.checks.push('Desktop WASD flight, camera/target coherence, QE height, Shift, deceleration, native-field/dialog and blur guards, persistent world');
      await context.close();
      const mobile = await open('390 px touch flight', true);
      await mobile.page.locator('#scene-root canvas').focus();
      const before = await pose(mobile.page); const button = mobile.page.locator('.walk-pad button[data-move="KeyW"]');
      assert(await button.isVisible(), 'Narrow touch Orbit shows the direction pad');
      const box = await button.boundingBox();
      const padBox = await mobile.page.locator('.walk-pad').boundingBox(), cardBox = await mobile.page.locator('.location-card').boundingBox();
      assert(padBox.y + padBox.height <= cardBox.y - 4, 'Touch movement pad clears the location caption');
      assert(await mobile.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '390 px view has no horizontal overflow');
      const session = await mobile.context.newCDPSession(mobile.page);
      try {
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
        await mobile.page.waitForTimeout(600);
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      } finally { await session.detach(); }
      await settle(mobile.page);
      const touchAfter = await pose(mobile.page);
      assert(length(before.position, touchAfter.position) > 2, 'Held on-screen button flies the camera');
      await settle(mobile.page, 350); assert(length(touchAfter.position, (await pose(mobile.page)).position) < .05, 'Touch release settles rather than sticking');
      await mobile.page.locator('.walk-pad button[data-move="KeyE"]').focus(); const keyBefore = await pose(mobile.page); await hold(mobile.page, 'Space', 400); const keyAfter = await pose(mobile.page);
      assert(keyAfter.position[1] > keyBefore.position[1] + 1, 'Native movement button supports held Space as well as touch');
      await mobile.page.screenshot({ path: path.join(output, 'mobile-flight.png') });
      assert.deepEqual(mobile.record.errors, []); assert.deepEqual(mobile.record.requestsFailed, []);
      mobile.record.flight = { before, after: touchAfter };
      report.checks.push('390 px held-button flight with all six labelled movement buttons');
      await mobile.context.close();
    }
    async function train(low = false) {
      const { page, context, record } = await open(`continuous waiting-room to Platform 5 route · ${low ? 'mobile geometry' : 'full geometry'}`);
      record.geometryVariant = low ? 'low' : 'full';
      if (low) { await settings(page, true); await page.locator('#quality').selectOption('low'); await settings(page, false); await page.waitForFunction(() => !window.pennStation.getState().loading && !window.pennStation.getState().error); }
      await page.locator('.viewpoints [data-command="view"][data-value="waiting"]').click();
      await settings(page, true); await page.locator('[data-command="mode"][data-value="walk"]').click(); await settings(page, false);
      await page.waitForFunction(() => window.pennStation.getState().mode === 'walk' && !window.pennStation.getState().loading);
      const initialState = await state(page), world = await page.evaluate(() => window.pennStation.getScene());
      record.legs = [];
      await page.evaluate(() => {
        window.__trainSamples = []; window.__samplingTrain = true;
        function sample() { if (!window.__samplingTrain) return; const p = window.pennStation.getCamera().position; if (window.__trainSamples.length < 10000) window.__trainSamples.push({ p, pose: window.pennStation.getState().pose }); requestAnimationFrame(sample); }
        requestAnimationFrame(sample);
      });
      async function heading(x, z) {
        const camera = await pose(page); const [qx, qy, qz, qw] = camera.quaternion;
        const forward = [-2 * (qx * qz + qw * qy), -2 * (qy * qz - qw * qx), -(1 - 2 * (qx * qx + qy * qy))];
        const yaw = Math.atan2(-forward[0], -forward[2]), pitch = Math.asin(Math.max(-1, Math.min(1, forward[1])));
        const desired = Math.atan2(-x, -z), dyaw = Math.atan2(Math.sin(yaw - desired), Math.cos(yaw - desired));
        const canvas = await page.locator('#scene-root canvas').boundingBox(); const cx = canvas.x + canvas.width / 2, cy = canvas.y + canvas.height / 2;
        await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + dyaw / .003, cy + pitch / .003, { steps: 5 }); await page.mouse.up();
        await settle(page, 50);
      }
      async function leg(label, target, tolerance = .38) {
        const before = await pose(page), dx = target[0] - before.position[0], dz = target[1] - before.position[2], run = Math.hypot(dx, dz);
        await heading(dx / run, dz / run); await page.locator('#scene-root canvas').focus();
        console.log(`LEG ${label} from ${before.position} to ${target}`);
        const item = { label, before, target }; record.legs.push(item);
        await page.keyboard.down('KeyW');
        try { await page.waitForFunction(({start, dx, dz, run}) => { const p = window.pennStation.getCamera().position; return ((p[0] - start[0]) * dx + (p[2] - start[2]) * dz) / run >= run - .22; }, {start:before.position, dx, dz, run}, {timeout:30000}); }
        finally { await page.keyboard.up('KeyW'); await settle(page); item.after = await pose(page); item.navigation = await page.evaluate(() => window.pennStation.getNavigation()); }
        assert(Math.hypot(item.after.position[0] - target[0], item.after.position[2] - target[1]) < tolerance, `${label}: actual walking reaches the intended landing/aisle`);
        assert.equal((await state(page)).pose, initialState.pose, `${label}: route does not teleport`);
      }
      try {
        const z = 13.32787;
        for (const [label, point] of [
          ['waiting-room centre', [0, 0]], ['axial passage west', [-41.88, 0]],
          ['east concourse aisle', [-41.88, z]], ['main flight to exit landing', [-48.5, z]],
          ['upper dogleg alignment', [-48.5, z + .83]], ['first lower flight to turning landing', [-53.9563, z + .83]],
          ['turning landing', [-53.9563, z - .83]], ['return flight to platform landing', [-48.5063, z - .83]],
          ['Platform 5', [-48.5063, z]],
        ]) await leg(label, point);
        const platform = await pose(page);
        assert(Math.abs(platform.position[1] - (-11.985625 + 1.68)) < .08, 'Reached real platform height through both stair flights');
        await page.screenshot({ path: path.join(output, `platform-stair-arrival${low ? '-low' : ''}.png`) });
        for (const [label, point] of [
          ['platform return alignment', [-48.5063, z - .83]], ['return flight ascent', [-53.9563, z - .83]],
          ['turning landing return', [-53.9563, z + .83]], ['first flight ascent', [-48.5, z + .83]],
          ['exit landing return', [-48.5, z]], ['main stair ascent', [-41.88, z]],
          ['concourse aisle return', [-41.88, 0]], ['waiting-room return', [0, 0]],
        ]) await leg(label, point);
        const returned = await pose(page); assert(Math.abs(returned.position[1] - (-4.2672 + 1.68)) < .08, 'Returns to waiting-room eye height');
        assert.deepEqual(await page.evaluate(() => window.pennStation.getScene()), world, 'Complete station remains loaded throughout train route');
        report.checks.push(`Continuous real-keyboard waiting-room–concourse–exit–both dogleg flights–Platform5 route and reverse in ${low ? 'mobile' : 'full'} geometry, with no platform shortcut or pose reset`);
      } finally {
        record.samples = await page.evaluate(() => { window.__samplingTrain = false; return window.__trainSamples; });
        record.final = await pose(page); record.navigation = await page.evaluate(() => window.pennStation.getNavigation());
        await page.screenshot({ path: path.join(output, `train-route-final${low ? '-low' : ''}.png`) });
      }
      assert.deepEqual(record.errors, []); assert.deepEqual(record.requestsFailed, []);
      await context.close();
    }
    async function sign() {
      const { page, context, record } = await open('west telephone sign passenger view');
      await page.locator('.viewpoints [data-command="view"][data-value="waiting"]').click();
      await settings(page, true); await page.locator('[data-command="mode"][data-value="walk"]').click(); await settings(page, false);
      await page.waitForFunction(() => window.pennStation.getState().mode === 'walk' && !window.pennStation.getState().loading);
      await page.locator('#scene-root canvas').focus();
      for (const [key, axis, limit, positive] of [['KeyS', 2, 27.95, true], ['KeyA', 0, -8.8, false]]) {
        await page.keyboard.down(key);
        try { await page.waitForFunction(({ axis, limit, positive }) => positive ? window.pennStation.getCamera().position[axis] > limit : window.pennStation.getCamera().position[axis] < limit, { axis, limit, positive }, { timeout:15000 }); }
        finally { await page.keyboard.up(key); await settle(page); }
      }
      const camera = await pose(page), [qx, qy, qz, qw] = camera.quaternion;
      const forward = [-2 * (qx * qz + qw * qy), -2 * (qy * qz - qw * qx), -(1 - 2 * (qx * qx + qy * qy))];
      const yaw = Math.atan2(-forward[0], -forward[2]), pitch = Math.asin(forward[1]);
      const aim = [-15.51, -.5872, 28.144];
      const desiredYaw = Math.atan2(camera.position[0] - aim[0], camera.position[2] - aim[2]);
      const desiredPitch = Math.atan2(aim[1] - camera.position[1], Math.hypot(aim[0] - camera.position[0], aim[2] - camera.position[2]));
      const delta = Math.atan2(Math.sin(yaw - desiredYaw), Math.cos(yaw - desiredYaw));
      const box = await page.locator('#scene-root canvas').boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + delta / .003, y + (pitch - desiredPitch) / .003, { steps:5 }); await page.mouse.up(); await settle(page);
      record.camera = await pose(page); record.navigation = await page.evaluate(() => window.pennStation.getNavigation());
      await page.screenshot({ path: path.join(output, 'telephone-sign-passenger-view.png') });
      assert.deepEqual(record.errors, []); assert.deepEqual(record.requestsFailed, []);
      report.checks.push('Telephone sign screenshot captured from the passenger side using real walking and drag inputs; legibility requires visual review');
      await context.close();
    }
    if (section === 'all' || section === 'flight') await flight();
    if (section === 'all' || section === 'train') {
      const variant = process.env.PENN_TRAIN_VARIANT || 'full'; assert(['full', 'low', 'both'].includes(variant));
      if (variant !== 'low') await train(false);
      if (variant !== 'full') await train(true);
    }
    if (section === 'sign') await sign();
    report.status = 'passed'; console.log(`PASS ${report.checks.length} navigation groups`);
  } catch (error) { report.status = 'failed'; report.error = error.stack; console.error(error); process.exitCode = 1; }
  finally { await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})();
