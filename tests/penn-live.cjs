/* Live Pages smoke check. Set PENN_LIVE_REPORT to retain deployment evidence.
 * Exercises the published bundle and every full-quality zone, with external
 * services blocked. Software rendering is not a physical-device benchmark.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PENN_LIVE_URL || 'https://stavreskimario.github.io/penn-station-1935/';
const destination = process.env.PENN_LIVE_REPORT || '/private/tmp/penn-live-validation.json';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: [`--use-angle=${process.env.PENN_ANGLE || 'metal'}`, ...(process.env.PENN_ANGLE === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : [])],
  });
  const report = { url: base, checkedAt: new Date().toISOString(), commit: process.env.PENN_COMMIT || null,
    browser: browser.version(), scope: 'Published Pages site; installed desktop Chrome, external services blocked. Driver recorded explicitly.',
    errors: [], failures: [], resources: [], views: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(90000);
    const site = new URL(base).origin;
    const expectedBundle = createHash('sha256').update(await fs.readFile(path.resolve(__dirname, '../penn-station-1935/dist/app.js'))).digest('hex');
    const assetRoot = path.resolve(__dirname, '../penn-station-1935/assets');
    const expectedModels = new Map();
    const loadedModels = new Map();
    const decodedHash = bytes => createHash('sha256').update(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).digest('hex');
    for (const zone of ['exterior', 'waiting-room', 'concourse', 'context', 'platform', 'trains']) {
      const file = `model-${zone}.glb.gz`;
      expectedModels.set(file, decodedHash(await fs.readFile(path.join(assetRoot, file))));
    }
    let loadedBundle;
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => {
      if (!response.url().startsWith(base)) return;
      const item = { path: new URL(response.url()).pathname, status: response.status() };
      report.resources.push(item);
      if (item.path.endsWith('/dist/app.js')) loadedBundle = response.body().then(bytes => createHash('sha256').update(bytes).digest('hex'));
      const model = path.basename(item.path);
      if (expectedModels.has(model)) loadedModels.set(model, response.body().then(decodedHash));
      if (item.status >= 400) report.failures.push(item);
    });
    await page.route('**/*', route => route.request().url().startsWith(site + '/') || /^(blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
    const url = new URL(base); url.searchParams.set('preview', process.env.PENN_COMMIT || 'phase3');
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 90000 });
    assert.match(await page.locator('.phase-label').textContent(), new RegExp(`phase ${process.env.PENN_EXPECTED_PHASE || '4'}`, 'i'));
    let world;
    for (const view of ['exterior', 'waiting', 'concourse']) {
      const previousFrame = await page.evaluate(() => window.pennStation?.getMetrics()?.renderFrame ?? -1);
      if (view !== 'exterior') {
        await page.locator(`.viewpoints [data-value="${view}"]`).click();
      }
      await page.waitForFunction(({ wanted, previousFrame }) => {
        if (!window.pennStation) return false;
        const state = window.pennStation.getState(), metrics = window.pennStation.getMetrics();
        return state.view === wanted && !state.loading && !state.error && metrics?.triangles > 1000 && metrics.calls > 0 && metrics.renderFrame > previousFrame;
      }, { wanted: view, previousFrame });
      const snapshot = await page.evaluate(() => ({ state: window.pennStation.getState(), metrics: window.pennStation.getMetrics(), scene:window.pennStation.getScene() }));
      if (!world) world = snapshot.scene;
      else assert.deepEqual(snapshot.scene,world,'Published viewpoints retain the same complete scene');
      report.views.push(snapshot);
      console.log('Live view rendered:', view, snapshot.metrics.triangles);
    }
    report.assets = await page.evaluate(() => window.pennStation.getAssets());
    for (const zone of ['exterior', 'waiting-room', 'concourse', 'context', 'platform', 'trains']) {
      const asset = report.assets.find(asset => asset.file === `model-${zone}.glb`);
      assert(asset, `${zone}: published geometry decoded`);
      if (['exterior', 'waiting-room', 'concourse'].includes(zone)) assert(asset.bakedMaterials > 0 && asset.occlusionMaterials > 0, `${zone}: illumination and AO loaded`);
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(report.failures, []);
    report.runtimeBundleSha256 = await loadedBundle;
    assert.equal(report.runtimeBundleSha256, expectedBundle, 'The actual loaded live bundle matches the tested local artifact');
    report.models = [];
    for (const [file, expectedSha256] of expectedModels) {
      assert(loadedModels.has(file), `${file}: actual published response was observed`);
      const decodedSha256 = await loadedModels.get(file);
      assert.equal(decodedSha256, expectedSha256, `${file}: published decoded geometry matches the tested local asset`);
      report.models.push({ file, decodedSha256 });
    }
    report.driver = await page.evaluate(() => {
      const gl = document.querySelector('#scene-root canvas').getContext('webgl2');
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return gl.getParameter(ext?.UNMASKED_RENDERER_WEBGL || gl.RENDERER);
    });
    report.passed = true;
    console.log('PASS published bundle hash, persistent station and local compressed assets');
  } catch (error) { report.passed = false; report.error = String(error); throw error; }
  finally { await fs.writeFile(destination, JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
