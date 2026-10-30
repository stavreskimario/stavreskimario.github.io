/* Real-input navigation regressions. Run after build.mjs, from the repository:
 * PLAYWRIGHT_MODULE=/path/to/tools/node_modules/playwright PENN_ANGLE=metal node tests/penn-navigation.cjs
 * PENN_NAV_SECTION=default|flight|train|prisms|all (default all); sign captures office lettering.
 * PENN_PRISM_NEGATIVE=1 with section prisms checks a local disabled-glass control. Outputs are outside the public app.
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
const bundleDirectory = process.env.PENN_NAV_BUNDLE_DIR || path.join(root, 'penn-station-1935/dist');
const output = process.env.PENN_SCREENSHOTS || path.join(root, '../penn-station-work/navigation-review');
const section = process.env.PENN_NAV_SECTION || 'all';
assert(['all', 'default', 'flight', 'train', 'sign', 'prisms'].includes(section));
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
  const dist = path.join(root, 'penn-station-1935/dist');
  if (file.startsWith(dist + path.sep)) file = path.join(bundleDirectory, path.relative(dist, file));
  try { const data = await fs.readFile(file); res.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' }); res.end(data); }
  catch { res.writeHead(404).end(); }
});
(async () => {
  await fs.mkdir(output, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    report.runtimeBundleSha256 = createHash('sha256').update(await fs.readFile(path.join(bundleDirectory, 'app.js'))).digest('hex');
    report.modelSha256 = {};
    const modelFiles = ['exterior', 'waiting-room', 'concourse', 'context', 'platform', 'trains'].flatMap(zone => [`model-${zone}.glb.gz`, `model-${zone}-low.glb.gz`]);
    for (const filename of [...modelFiles, 'scene-manifest.json']) report.modelSha256[filename] = createHash('sha256').update(await fs.readFile(path.join(root, 'penn-station-1935/assets', filename))).digest('hex');
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
      if (section === 'prisms' && process.env.PENN_PRISM_NEGATIVE === '1') await page.route(/\/penn-station-1935\/dist\/app\.js(?:\?.*)?$/, async route => {
        const original = await fs.readFile(path.join(bundleDirectory, 'app.js'), 'utf8');
        assert.equal(original.split('SquareVaultLightGlass').length - 1, 1, 'Negative control targets only the exact load-bearing-glass rule');
        const disabled = original.replace('SquareVaultLightGlass', 'SquareVaultLightGlass_DISABLED_CONTROL');
        record.localNegativeControl = { description:'Load-bearing-glass recognition disabled only in the local response', modifiedBundleSha256:createHash('sha256').update(disabled).digest('hex') };
        await route.fulfill({ status:200, contentType:'text/javascript', body:disabled });
      });
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
    async function defaultWalking() {
      const { page, context, record } = await open('fresh default walking');
      await page.waitForFunction(() => {
        const s = window.pennStation.getState(), c = window.pennStation.getCamera(), n = window.pennStation.getNavigation();
        return s.mode === 'walk' && !s.loading && n?.colliders > 0 && Math.hypot(c.position[0] - 124, c.position[1] - 1.68, c.position[2]) < .001;
      });
      const initial = await pose(page), world = await page.evaluate(() => window.pennStation.getScene());
      record.initial = { camera: initial, state: await state(page), navigation: await page.evaluate(() => window.pennStation.getNavigation()) };
      assert.equal(await page.locator('[data-command="mode"][data-value="walk"]').getAttribute('aria-pressed'),'true','Default Walk control is selected');
      assert.equal(await page.locator('[data-command="mode"][data-value="orbit"]').getAttribute('aria-pressed'),'false','Orbit starts unselected');
      assert.match(await page.locator('#movement-help').textContent(),/to walk/,'Default help describes walking');
      assert.equal(record.initial.navigation.floorWorld, 0, 'Fresh Walk spawn uses the existing street floor');
      assert(world.zones.length === 6 && world.zones.every(z => z.visible && z.meshes > 0), 'Fresh Walk has all six collision/render zones loaded');
      assert(await page.locator('#scene-root canvas').evaluate(e => e === document.activeElement), 'Enter Station focuses default walking input');
      await hold(page, 'KeyW', 450); const moved = await pose(page), support = await page.evaluate(() => window.pennStation.getNavigation());
      assert(length(initial.position, moved.position) > .4 && length(initial.position, moved.position) < 2.5, 'Fresh W performs human-speed walking, without selecting a mode');
      assert(Math.abs(moved.position[1] - 1.68) < .03 && Math.abs(support.floorWorld) < .03, 'Actual walking stays 1.68m above the authored street support');
      assert(support.queries > record.initial.navigation.queries, 'Walking queries loaded physical collision/support geometry');
      await hold(page, 'KeyE', 200); assert(length(moved.position, (await pose(page)).position) < .02, 'Default Walk does not accept flight-only height keys');
      const box = await page.locator('#scene-root canvas').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, {steps:5}); await page.mouse.up();
      const looked = await pose(page); assert(length(moved.quaternion, looked.quaternion) > .02, 'Default Walk supports drag-to-look');
      assert(length(moved.position, looked.position) < .02, 'Walking look does not orbit away from the human position');
      await page.screenshot({path:path.join(output,'default-walking.png')});
      for (const [view, eye] of [['waiting', [0, -2.5872, 25]], ['concourse', [-67, -2.5872, 33]], ['exterior', [124, 1.68, 0]]]) {
        await page.locator(`.viewpoints [data-command="view"][data-value="${view}"]`).click();
        await page.waitForFunction(({view,eye}) => {const s=window.pennStation.getState(), c=window.pennStation.getCamera(); return s.view===view && s.mode==='walk' && !s.loading && Math.hypot(...c.position.map((x,i)=>x-eye[i]))<.001;}, {view,eye});
      }
      await settings(page,true); await page.locator('[data-command="mode"][data-value="orbit"]').click(); await settings(page,false);
      for (const view of ['waiting','concourse','exterior']) {
        await page.locator(`.viewpoints [data-command="view"][data-value="${view}"]`).click();
        await page.waitForFunction(view => {const s=window.pennStation.getState();return s.view===view&&s.mode==='orbit'&&!s.loading;},view);
      }
      assert.deepEqual(await page.evaluate(() => window.pennStation.getScene()),world,'Ordinary Walk/Orbit viewpoints retain all six zone IDs');
      await page.locator('.viewpoints [data-command="view"][data-value="waiting"]').click();
      const revision = (await state(page)).revision;
      await settings(page,true); await page.locator('[data-command="reset"]').click(); await settings(page,false);
      await page.waitForFunction(revision => {const s=window.pennStation.getState(),c=window.pennStation.getCamera(),n=window.pennStation.getNavigation();return s.mode==='walk'&&s.revision===revision+1&&!s.loading&&n?.colliders>0&&Math.abs(c.position[1]+2.5872)<.03;},revision);
      record.reset = {state:await state(page),camera:await pose(page),navigation:await page.evaluate(()=>window.pennStation.getNavigation())};
      await page.locator('#map-control > summary').click();
      await page.locator('.map-places [data-command="focus"][data-value="hotel"]').click();
      await page.locator('#map-control > summary').click();
      await page.waitForFunction(()=>window.pennStation.getState().framing==='hotel'&&window.pennStation.getState().mode==='orbit');
      await settings(page,true); await page.locator('[data-command="reset"]').click(); await settings(page,false);
      await page.waitForFunction(()=>{const s=window.pennStation.getState(),c=window.pennStation.getCamera();return s.mode==='walk'&&s.framing===''&&!s.loading&&Math.hypot(c.position[0]-124,c.position[1]-1.68,c.position[2])<.001;});
      record.resetFromNeighbour = {state:await state(page),camera:await pose(page)};
      await page.locator('.utility-buttons [data-command="tour"]').click();
      await page.waitForFunction(()=>window.pennStation.getState().tour&&window.pennStation.getState().mode==='orbit');
      await page.keyboard.press('Escape');
      assert.equal((await state(page)).tour,false,'Escape stops the cinematic tour');
      assert.equal((await state(page)).mode,'orbit','Stopping the tour does not unexpectedly change its explicit cinematic mode');
      record.afterTour = await state(page);
      assert.deepEqual(record.errors,[]); assert.deepEqual(record.requestsFailed,[]);
      report.checks.push('Fresh default Walk, street support/eye height, actual WASD and drag, preserved viewpoint mode, Walk reset and explicit cinematic tour');
      await context.close();
    }
    async function flight() {
      const { page, context, record } = await open('desktop flight');
      await settings(page, true); await page.locator('[data-command="mode"][data-value="orbit"]').click(); await settings(page, false);
      const beforeViewFrame = await page.evaluate(() => window.pennStation.getMetrics().renderFrame);
      await page.locator('.viewpoints [data-command="view"][data-value="exterior"]').click();
      assert(await page.locator('#scene-root canvas').evaluate(e => e === document.activeElement), 'Pointer-selected viewpoint makes WASD immediately available');
      // Let the requested pose commit before holding a key: that effect clears
      // movement inherited from the previous camera pose.
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await page.waitForFunction(frame => {
        const camera = window.pennStation.getCamera();
        return window.pennStation.getMetrics().renderFrame > frame && Math.hypot(camera.position[0] - 145, camera.position[1] - 8, camera.position[2] - 88) < .001;
      }, beforeViewFrame);
      record.viewCommitFrames = { before: beforeViewFrame, after: await page.evaluate(() => window.pennStation.getMetrics().renderFrame) };
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
      await settings(mobile.page, true); await mobile.page.locator('[data-command="mode"][data-value="orbit"]').click(); await settings(mobile.page, false);
      await mobile.page.waitForFunction(() => window.pennStation.getState().mode === 'orbit' && Math.abs(window.pennStation.getCamera().position[0] - 145) < .001);
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
    async function walkingHeading(page, x, z, targetPitch = 0) {
      const camera = await pose(page); const [qx, qy, qz, qw] = camera.quaternion;
      const forward = [-2 * (qx * qz + qw * qy), -2 * (qy * qz - qw * qx), -(1 - 2 * (qx * qx + qy * qy))];
      const yaw = Math.atan2(-forward[0], -forward[2]), pitch = Math.asin(Math.max(-1, Math.min(1, forward[1])));
      const desired = Math.atan2(-x, -z), dyaw = Math.atan2(Math.sin(yaw - desired), Math.cos(yaw - desired));
      const canvas = await page.locator('#scene-root canvas').boundingBox(); const cx = canvas.x + canvas.width / 2, cy = canvas.y + canvas.height / 2;
      await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + dyaw / .003, cy + (pitch - targetPitch) / .003, { steps: 5 }); await page.mouse.up();
      await settle(page, 50);
    }
    async function walkingLeg(page, record, initialPose, label, target, tolerance = .38) {
      const before = await pose(page), dx = target[0] - before.position[0], dz = target[1] - before.position[2], run = Math.hypot(dx, dz);
      await walkingHeading(page, dx / run, dz / run); await page.locator('#scene-root canvas').focus();
      console.log(`LEG ${label} from ${before.position} to ${target}`);
      const item = { label, before, target }; record.legs.push(item);
      await page.keyboard.down('KeyW');
      try { await page.waitForFunction(({start, dx, dz, run}) => { const p = window.pennStation.getCamera().position; return ((p[0] - start[0]) * dx + (p[2] - start[2]) * dz) / run >= run - .22; }, {start:before.position, dx, dz, run}, {timeout:30000}); }
      finally { await page.keyboard.up('KeyW'); await settle(page); item.after = await pose(page); item.navigation = await page.evaluate(() => window.pennStation.getNavigation()); }
      // Browser input delivery can overshoot a long leg under rendering load.
      // Correct only a small arrival error with bounded real walking inputs;
      // a route blocked farther away still fails the original landing test.
      for (let attempt = 0; attempt < 3; attempt++) {
        const distance = Math.hypot(item.after.position[0] - target[0], item.after.position[2] - target[1]);
        if (distance < tolerance || distance > 1.25) break;
        await walkingHeading(page, target[0] - item.after.position[0], target[1] - item.after.position[2]);
        await page.locator('#scene-root canvas').focus();
        const correction = { before: item.after, milliseconds: Math.max(60, Math.min(250, (distance - .15) / 2.6 * 1000)) };
        await page.keyboard.down('KeyW');
        try { await page.waitForTimeout(correction.milliseconds); }
        finally { await page.keyboard.up('KeyW'); await settle(page); }
        item.after = await pose(page); item.navigation = await page.evaluate(() => window.pennStation.getNavigation());
        correction.after = item.after; (item.settlingCorrections ||= []).push(correction);
      }
      assert(Math.hypot(item.after.position[0] - target[0], item.after.position[2] - target[1]) < tolerance, `${label}: actual walking reaches the intended landing/aisle`);
      assert.equal((await state(page)).pose, initialPose, `${label}: route does not teleport`);
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
      const leg = (label, target, tolerance) => walkingLeg(page, record, initialState.pose, label, target, tolerance);
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
    async function prisms() {
      const manifest = JSON.parse(await fs.readFile(path.join(root, 'penn-station-1935/assets/scene-manifest.json'), 'utf8'));
      const fields = manifest.concourseDetails?.vaultLights?.fieldsWorldXZ;
      assert(fields?.length > 0, 'Delivered manifest registers the authored prism court');
      const area = fields.reduce((sum,bounds)=>sum+(bounds[1]-bounds[0])*(bounds[3]-bounds[2]),0);
      const minimumArea = Number(process.env.PENN_PRISM_MIN_AREA || 3000);
      assert(area >= minimumArea, `Prism coverage ${area}m² meets the ${minimumArea}m² acceptance threshold`);
      const envelope = [Math.min(...fields.map(b=>b[0])),Math.max(...fields.map(b=>b[1])),Math.min(...fields.map(b=>b[2])),Math.max(...fields.map(b=>b[3]))];
      const southField = fields.find(bounds=>bounds[2]>0), northField = fields.find(bounds=>bounds[3]<0);
      const southZ = southField ? (southField[2]+southField[3])/2 : envelope[3]*.7;
      const northZ = northField ? (northField[2]+northField[3])/2 : envelope[2]*.7;
      assert(southZ > 0 && northZ < 0, 'North and south court crossings are available');
      const { page, context, record } = await open('desktop walking across the prism court');
      await page.locator('.viewpoints [data-command="view"][data-value="concourse"]').click();
      await settings(page, true); await page.locator('[data-command="mode"][data-value="walk"]').click(); await settings(page, false);
      await page.waitForFunction(() => window.pennStation.getState().mode === 'walk' && !window.pennStation.getState().loading);
      const initial = await state(page), world = await page.evaluate(() => window.pennStation.getScene()), before = await page.evaluate(() => window.pennStation.getNavigation());
      const negative = process.env.PENN_PRISM_NEGATIVE === '1';
      record.coverage = manifest.concourseDetails.vaultLights.coverage || null; record.fields = fields; record.grossFieldArea = area; record.minimumAcceptedArea = minimumArea; record.before = before; record.legs = [];
      assert(negative ? before.vaultLightColliders === 0 : before.vaultLightColliders > 0, 'Collision selection recognizes only the intended structural glass');
      assert(before.ignoredGlazingMaterials.includes('ConcourseRecessedWindowGlass'), 'Vertical transmitting window glass remains ignored');
      const midX = (envelope[0] + envelope[1]) / 2;
      const east = envelope[1] + .6, west = envelope[0] - 1.8;
      const leg = (label, target) => walkingLeg(page, record, initial.pose, label, target);
      try {
        const spawn = (await pose(page)).position;
        const insideField = point => fields.some(b=>point[0]>=b[0]&&point[0]<=b[1]&&point[2]>=b[2]&&point[2]<=b[3]);
        if (!negative || !insideField(spawn)) await leg('south field approach', [east, southZ + .66]);
        if (negative) {
          const position = (await pose(page)).position;
          let target = [midX, southZ + .06];
          if (insideField(position)) {
            const pitch = manifest.concourseDetails.vaultLights.prismPitch, width = manifest.concourseDetails.vaultLights.prismWidth;
            const gap = (pitch - width) / 2, phase = (value, origin) => ((value - origin) % pitch + pitch) % pitch;
            const px = phase(position[0], envelope[0]), pz = phase(position[2], envelope[2]);
            const aperture = value => value > gap + .005 && value < pitch - gap - .005;
            assert(aperture(px) || aperture(pz), 'Negative control starts opposite an actual aperture');
            // Walk perpendicular to one concrete strip. A diagonal can follow
            // genuine intersecting webs even when every pane is disabled.
            target = aperture(px) ? [position[0], position[2] - 3] : [position[0] - 3, position[2]];
            record.negativeApertureRegistration = { pitch, width, phaseX: px, phaseZ: pz, target };
          }
          const dx = target[0] - position[0], dz = target[1] - position[2];
          await walkingHeading(page, dx, dz); await page.locator('#scene-root canvas').focus(); await page.keyboard.down('KeyW');
          let heldBefore, heldAfter;
          try { await page.waitForTimeout(3500); heldBefore = await pose(page); await page.waitForTimeout(400); heldAfter = await pose(page); }
          finally { await page.keyboard.up('KeyW'); await settle(page); }
          const stopped = await pose(page), nav = await page.evaluate(() => window.pennStation.getNavigation());
          const heldProgress = ((heldAfter.position[0]-heldBefore.position[0])*dx+(heldAfter.position[2]-heldBefore.position[2])*dz)/Math.hypot(dx,dz);
          record.disabledGlassHeldSamples = { before:heldBefore, after:heldAfter, projectedProgress:heldProgress };
          assert(Math.abs(heldProgress) < .3, 'Without glass, projected travel stays blocked while W remains held');
          assert.equal(nav.vaultLightSupports, 0, 'No glass support or fallback plane was invented');
          assert(nav.lastSupportMiss && insideField(nav.lastSupportMiss.point), 'A real ray over the field is unsupported in the negative control');
          report.checks.push('Negative control: disabling only structural-glass recognition blocks projected travel over actual pane voids');
        } else {
          await page.evaluate(() => { window.__prismSamples=[]; window.__samplingPrisms=true; function sample(){if(!window.__samplingPrisms)return;const nav=window.pennStation.getNavigation();window.__prismSamples.push({position:window.pennStation.getCamera().position,pose:window.pennStation.getState().pose,floor:nav.floorWorld,glassSupports:nav.vaultLightSupports});requestAnimationFrame(sample);}requestAnimationFrame(sample); });
          await leg('south glass field centre', [midX, southZ + .06]);
          await walkingHeading(page, -1, 0, -.6); await page.screenshot({path:path.join(output,'south-prism-floor.png')});
          await leg('south glass field west edge', [west, southZ - .78]);
          const afterSouth = await page.evaluate(() => window.pennStation.getNavigation());
          assert(afterSouth.vaultLightSupports > before.vaultLightSupports + 10, 'Actual upward prism faces support the southern crossing');
          await leg('north field approach', [west, northZ - .66]);
          const beforeNorth = await page.evaluate(() => window.pennStation.getNavigation());
          await leg('north glass field centre', [midX, northZ - .06]);
          await walkingHeading(page, 1, 0, -.6); await page.screenshot({path:path.join(output,'north-prism-floor.png')});
          await leg('north glass field east edge', [east, northZ + .78]);
          const afterNorth = await page.evaluate(() => window.pennStation.getNavigation());
          assert(afterNorth.vaultLightSupports > beforeNorth.vaultLightSupports + 10, 'Actual upward prism faces support the northern crossing');
          record.samples = await page.evaluate(() => {window.__samplingPrisms=false;return window.__prismSamples;});
          assert(record.samples.length > 20, 'Rendered samples cover real walking over both fields');
          for(const sample of record.samples){assert.equal(sample.pose,initial.pose,'Prism route does not reset the pose');assert(Math.abs(sample.position[1]-(-4.2672+1.68))<.06,'Eye stays at human height over actual glass/concrete');}
          assert.deepEqual(await page.evaluate(() => window.pennStation.getScene()),world,'Prism walking retains the same complete station');
          report.checks.push('Real desktop keyboard walking across the north and south prism/concrete court with upward glass support, ignored window glazing and unchanged human floor height');
        }
      } finally {
        await page.evaluate(() => {window.__samplingPrisms=false;});
        record.final = await pose(page); record.navigation = await page.evaluate(() => window.pennStation.getNavigation());
        await page.screenshot({path:path.join(output,negative?'prism-negative-stop.png':'prism-route-final.png')});
      }
      assert.deepEqual(record.errors,[]);assert.deepEqual(record.requestsFailed,[]);await context.close();
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
    if (section === 'all' || section === 'default') await defaultWalking();
    if (section === 'all' || section === 'flight') await flight();
    if (section === 'all' || section === 'train') {
      const variant = process.env.PENN_TRAIN_VARIANT || 'full'; assert(['full', 'low', 'both'].includes(variant));
      if (variant !== 'low') await train(false);
      if (variant !== 'full') await train(true);
    }
    if (section === 'sign') await sign();
    if (section === 'all' || section === 'prisms') await prisms();
    report.status = 'passed'; console.log(`PASS ${report.checks.length} navigation groups`);
  } catch (error) { report.status = 'failed'; report.error = error.stack; console.error(error); process.exitCode = 1; }
  finally { await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})();
