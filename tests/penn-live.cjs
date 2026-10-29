/* Live Pages smoke check. Set PENN_LIVE_REPORT to retain deployment evidence.
 * Exercises the published bundle and every full-quality zone, with external
 * services blocked. Software rendering is not a physical-device benchmark.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.PENN_LIVE_URL || 'https://stavreskimario.github.io/penn-station-1935/';
const destination = process.env.PENN_LIVE_REPORT || '/private/tmp/penn-live-validation.json';

(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const report = { url: base, checkedAt: new Date().toISOString(), commit: process.env.PENN_COMMIT || null,
    browser: browser.version(), scope: 'Published Pages site; desktop software rendering, external services blocked.',
    errors: [], failures: [], resources: [], views: [] };
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(90000);
    const site = new URL(base).origin;
    page.on('pageerror', error => report.errors.push(error.message));
    page.on('response', response => {
      if (!response.url().startsWith(base)) return;
      const item = { path: new URL(response.url()).pathname, status: response.status() };
      report.resources.push(item);
      if (item.status >= 400) report.failures.push(item);
    });
    await page.route('**/*', route => route.request().url().startsWith(site + '/') || /^(blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
    const url = new URL(base); url.searchParams.set('preview', process.env.PENN_COMMIT || 'phase3');
    await page.goto(url.href, { waitUntil: 'domcontentloaded', timeout: 90000 });
    assert.match(await page.locator('.phase-label').textContent(), /phase 3/i);
    let world;
    for (const view of ['exterior', 'waiting', 'concourse']) {
      if (view !== 'exterior') {
        await page.locator(`.viewpoints [data-value="${view}"]`).click();
      }
      await page.waitForFunction(wanted => {
        if (!window.pennStation) return false;
        const state = window.pennStation.getState(), metrics = window.pennStation.getMetrics();
        return state.view === wanted && !state.loading && !state.error && metrics?.triangles > 1000 && metrics.calls > 0;
      }, view);
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
    report.passed = true;
    console.log('PASS published Phase 3 bundle, persistent station and local compressed assets');
  } catch (error) { report.passed = false; report.error = String(error); throw error; }
  finally { await fs.writeFile(destination, JSON.stringify(report, null, 2) + '\n'); await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
