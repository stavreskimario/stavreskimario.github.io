// Prepared only. Root grants a quiet browser window and supplies final commit pins.
// The published app, camera controls and collision system remain unmodified.
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { gunzipSync } = require('node:zlib');
const { chromium } = require('/Users/stavreskimario/Desktop/penn-station-work/tools/node_modules/playwright');
const { Euler, Quaternion } = require('/Users/stavreskimario/Desktop/penn-station-work/tools/node_modules/three');
const {expectedArrivals,checkMaterialMaps,inspectMountedArrivals,checkMountedPbr,comparison}=require('./arrivals-runtime-inspection.cjs');

const options = {};
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, '');
  assert(process.argv[i].startsWith('--'), 'Use explicit named options');
  if (key === 'run-after-freeze') options[key] = true;
  else { assert(process.argv[i + 1] && !process.argv[i + 1].startsWith('--')); options[key] = process.argv[++i]; }
}
assert(options['run-after-freeze'], 'Prepared only: requires --run-after-freeze after root grants a quiet browser window');
assert.match(options.commit || '', /^[a-f0-9]{40}$/, 'Pin the exact published commit');
for (const key of ['expect-bundle', 'expect-concourse', 'expect-arrivals-ao', 'expect-arrivals-gi']) assert.match(options[key] || '', /^[a-f0-9]{64}$/, key);
assert(options.out, 'Choose a new external output directory');
const root = '/Users/stavreskimario/Desktop/penn-station-reconstruction/penn-station-1935';
const out = path.resolve(options.out);
assert(!out.startsWith(root + '/'), 'Review outputs remain outside the repository');
const revision = options.revision || '9-p5-arrivals-finish-1';
assert.match(revision, /^[a-z0-9-]+$/);
const base = new URL(options.url || 'https://stavreskimario.github.io/penn-station-1935/');
assert.equal(base.origin, 'https://stavreskimario.github.io');
assert.equal(base.pathname, '/penn-station-1935/');
const sha = b => createHash('sha256').update(b).digest('hex');
const stamp = () => new Date().toISOString();
const report = {
  schema: 1, created: stamp(), commit: options.commit, revision,
  scope: 'Actual published Pages responses and native arrivals gallery→west stair→platform→gallery walking. Root separately retains the full34-leg local roundtrip and full/low physical acceptance. No camera injection, geometry changes, new performance benchmark, physical mobile test or complete historical-accuracy claim.',
  bodies: [], successfulResponses: [], bodyReadFailures: [], bodyMismatches: [],
  pageErrors: [], console: [], requestFailures: [], intentionalBlocks: [], httpFailures: [],
  phases: [], inputActions: [], frozenInputs: [], extraFrozenInputs: [],
};
let browser, page;
const responseTasks = [];
const expected = new Map();
const snapshot = () => page.evaluate(() => ({ state: window.pennStation.getState(), scene: window.pennStation.getScene(), camera: window.pennStation.getCamera(), navigation: window.pennStation.getNavigation(), metrics: window.pennStation.getMetrics() }));
const wrap = x => Math.atan2(Math.sin(x), Math.cos(x));
function checkScene(s, ids) {
  assert.equal(s.state.mode, 'walk'); assert.equal(s.state.view, 'concourse');
  assert.equal(s.scene.zones.length, 6); assert(s.scene.zones.every(z => z.visible && z.meshes > 0));
  assert.deepEqual(s.scene.zones.map(z => z.id), ids, 'All original six zones stay mounted');
}
async function release() { for (const key of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft']) await page.keyboard.up(key); }
async function turn(yaw, pitch = -.13) {
  for (let i = 0; i < 6; i++) {
    const s = await snapshot(), e = new Euler().setFromQuaternion(new Quaternion(...s.camera.quaternion), 'YXZ');
    const dx = wrap(yaw - e.y), dy = pitch - e.x;
    if (Math.abs(dx) < .004 && Math.abs(dy) < .004) return;
    const px = Math.max(-300, Math.min(300, -dx / .003)), py = Math.max(-180, Math.min(180, -dy / .003));
    await page.mouse.move(700, 500); await page.mouse.down(); await page.mouse.move(700 + px, 500 + py); await page.mouse.up();
    report.inputActions.push({ at: stamp(), kind: 'pointer-drag', dx: px, dy: py });
  }
  const s = await snapshot(), e = new Euler().setFromQuaternion(new Quaternion(...s.camera.quaternion), 'YXZ');
  assert(Math.abs(wrap(yaw - e.y)) < .025 && Math.abs(pitch - e.x) < .025, 'Actual pointer look reaches requested direction');
}
async function moveTo(ids, goal) {
  const phase = { label: goal.id, target: goal.xz, started: stamp(), status: 'RUNNING', trace: [] };
  report.phases.push(phase); const start = performance.now(); let previous, stale = 0;
  await page.locator('#scene-root canvas').focus();
  while (performance.now() - start < 45000) {
    const s = await snapshot(); checkScene(s, ids);
    const p = s.camera.position, dx = goal.xz[0] - p[0], dz = goal.xz[1] - p[2], distance = Math.hypot(dx, dz);
    phase.trace.push({ elapsed: performance.now() - start, ...s });
    if (distance < (goal.arrivalTolerance ?? .08)) {
      await release(); await page.waitForTimeout(350); phase.end = await snapshot(); checkScene(phase.end, ids);
      if (goal.floorMain !== undefined) assert(Math.abs(phase.end.camera.position[1] - (goal.floorMain - 4.2672 + 1.68)) < .12, 'Terminal floor plus natural eye height');
      phase.status = 'PASS'; phase.closed = stamp(); return;
    }
    await turn(Math.atan2(-dx, -dz));
    const pulse = distance > .6 ? 120 : distance < .2 && (goal.arrivalTolerance ?? .08) < .08 ? 5 : 25;
    await page.keyboard.down('KeyW'); report.inputActions.push({ at: stamp(), kind: 'keyboard', key: 'KeyW', milliseconds: pulse, label: goal.id });
    await page.waitForTimeout(pulse); await page.keyboard.up('KeyW'); await page.waitForTimeout(distance > .6 ? 20 : 170);
    const next = await snapshot();
    if (previous) stale = Math.hypot(next.camera.position[0] - previous[0], next.camera.position[2] - previous[2]) < .003 ? stale + 1 : 0;
    previous = next.camera.position; assert(stale < 10, 'Native walking stalled at ' + goal.id);
  }
  phase.status = 'TIMEOUT'; phase.end = await snapshot(); throw new Error('Bounded45-second movement timeout: ' + goal.id);
}
async function capture(name) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(out, name + '.png') });
  await page.locator('#scene-root canvas').screenshot({ path: path.join(out, name + '-canvas.png') });
}
async function pin(file) {
  const bytes = await fs.readFile(path.join(root, file)); expected.set(file, bytes);
  report.frozenInputs.push({ file, bytes: bytes.length, sha256: sha(bytes) }); return bytes;
}
function materialImageUris(j, materials) {
  const uris = new Set();
  for (const m of materials) for (const item of [m.normalTexture, m.occlusionTexture, m.emissiveTexture, m.pbrMetallicRoughness?.baseColorTexture, m.pbrMetallicRoughness?.metallicRoughnessTexture]) {
    if (!item) continue;
    const texture = j.textures[item.index], source = texture.extensions?.KHR_texture_basisu?.source ?? texture.source;
    const uri = j.images[source]?.uri; assert(uri && /^textures\/[a-f0-9]+\.ktx2$/.test(uri)); uris.add(uri);
  }
  return [...uris].sort();
}

(async () => {
  await fs.mkdir(out, { recursive: false });
  for(const file of [__filename,path.join(__dirname,'arrivals-runtime-inspection.cjs'),comparison.sourceReport]){const b=await fs.readFile(file);if(file===comparison.sourceReport)assert.equal(sha(b),comparison.sourceReportSha256,'Retained comparison source');report.extraFrozenInputs.push({file,sha256:sha(b),bytes:b.length});}
  const modelBytes = await fs.readFile(root + '/assets/model-concourse.glb.gz');
  assert.equal(sha(modelBytes), options['expect-concourse'], 'Final root concourse pin');
  const raw = gunzipSync(modelBytes), j = JSON.parse(raw.subarray(20, 20 + raw.readUInt32LE(12)));
  const runtimeExpected=expectedArrivals(j);report.arrivalsSourcePbr=runtimeExpected.sourcePbr;report.platformComparisonTarget=comparison;
  const arrivals = j.materials.filter(m => /Arrivals/.test(m.name || ''));
  assert.equal(arrivals.length, 7); const litNames = arrivals.filter(m => m.extras?.sky_illumination === 'lighting-concourse-arrivals-sky.webp').map(m => m.name).sort(); assert.equal(litNames.length, 4);
  report.expectedMaterials = arrivals.map(m => ({ name: m.name, normalStrength: m.normalTexture?.scale ?? null, sourceAtlasUv: m.extras?.lighting_atlas_uv ?? null }));
  for (const file of ['index.html', 'styles.css', 'dist/app.js', 'assets/scene-manifest.json', ...['exterior', 'waiting-room', 'concourse', 'context', 'platform', 'trains'].map(z => 'assets/model-' + z + '.glb.gz'), 'assets/lighting-concourse-arrivals-sky.webp', 'assets/reflection-concourse.hdr.gz', ...materialImageUris(j, arrivals).map(u => 'assets/' + u)]) await pin(file);
  assert.equal(sha(expected.get('dist/app.js')), options['expect-bundle'], 'Final root bundle pin');
  assert(expected.get('index.html').includes(Buffer.from('v=' + revision)), 'Final HTML revision');
  assert(expected.get('dist/app.js').includes(Buffer.from(revision)), 'Final compiled asset revision');
  assert.equal(expected.size,19,'Same19-body natural public acceptance scope');
  assert.equal(sha(expected.get('assets/'+runtimeExpected.aoUri)),options['expect-arrivals-ao'],'Accepted new full ARR AO');
  assert.equal(sha(expected.get('assets/lighting-concourse-arrivals-sky.webp')),options['expect-arrivals-gi'],'Accepted new full ARR GI');
  browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--use-angle=metal', '--enable-webgl', '--ignore-gpu-blocklist'] });
  report.browser = browser.version(); const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' }); page = await context.newPage();
  await page.route('**/*', route => {
    const url = route.request().url(); if (/^(blob:|data:)/.test(url) || new URL(url).origin === base.origin) return route.continue();
    report.intentionalBlocks.push({ at: stamp(), url }); return route.abort('blockedbyclient');
  });
  page.on('pageerror', e => report.pageErrors.push({ at: stamp(), message: e.message }));
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) report.console.push({ at: stamp(), type: m.type(), message: m.text() }); });
  page.on('requestfailed', r => report.requestFailures.push({ at: stamp(), url: r.url(), error: r.failure()?.errorText }));
  page.on('response', response => {
    const url = new URL(response.url()); if (response.status() >= 400) report.httpFailures.push({ at: stamp(), url: url.href, status: response.status() });
    if (response.ok()) report.successfulResponses.push({ at: stamp(), url: url.href, status: response.status() });
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
    const file = url.pathname.slice(base.pathname.length) || 'index.html'; if (!expected.has(file) || !response.ok()) return;
    responseTasks.push((async () => {
      try {
        const body = await response.body();
        if (!body.equals(expected.get(file))) report.bodyMismatches.push({ at: stamp(), file, url: url.href, sha256: sha(body), expectedSha256: sha(expected.get(file)) });
        else report.bodies.push({ at: stamp(), file, url: url.href, bytes: body.length, sha256: sha(body) });
      } catch (e) { report.bodyReadFailures.push({ at: stamp(), file, url: url.href, error: e.message }); }
    })());
  });
  base.searchParams.set('preview', options.commit.slice(0, 12)); base.searchParams.set('renderer', 'webgl'); report.url = base.href;
  await page.goto(base.href, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.pennStation && !window.pennStation.getState().loading && !window.pennStation.getState().error, null, { timeout: 180000 });
  report.initial = await snapshot(); assert.equal(report.initial.state.mode, 'walk'); assert.equal(report.initial.scene.zones.length, 6);
  assert(report.initial.scene.zones.every(z => z.visible && z.meshes > 0)); const ids = report.initial.scene.zones.map(z => z.id);
  report.materials = await page.evaluate(() => window.pennStation.getMaterialReport().filter(m => /Arrivals/.test(m.name || '')));
  assert.deepEqual(report.materials.map(m => m.name).sort(), arrivals.map(m => m.name).sort());
  checkMaterialMaps(report.materials,runtimeExpected);report.mountedArrivals=await inspectMountedArrivals(page);checkMountedPbr(report.mountedArrivals,runtimeExpected);
  const lit = report.materials.filter(m => m.skyFile === 'lighting-concourse-arrivals-sky.webp'); assert.deepEqual(lit.map(m => m.name).sort(), litNames);
  for (const m of lit) { assert.deepEqual([m.lightmap?.width, m.lightmap?.height], [4096, 4096]); assert.deepEqual([m.ao?.width, m.ao?.height], [2048, 2048]); assert.equal(m.ao.channel, m.lightmap.channel); assert.equal(m.skyScale, 2); assert(Math.abs(m.lightIntensity - 2 * Math.PI) < 1e-9); }
  await page.locator('[data-command="enter"]').click();
  if (await page.locator('#map-control').getAttribute('open') === null) await page.locator('#map-control > summary').click();
  await page.locator('[data-command="focus"][data-value="arrivals"]').click();
  if (await page.locator('#map-control').getAttribute('open') !== null) await page.locator('#map-control > summary').click();
  await page.waitForFunction(() => { const s = window.pennStation.getState(), c = window.pennStation.getCamera(); return s.mode === 'walk' && s.framing === 'arrivals' && c && Math.hypot(c.position[0] + 70, c.position[2] - 28) < .05; }, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  report.arrivals = await snapshot(); checkScene(report.arrivals, ids);
  assert(Math.abs(report.arrivals.camera.position[1] + 5.7876) < .02, 'Settled arrivals preset has natural1.68m eye height over the documented model gallery floor');
  await capture('public-arrivals-gallery');
  if (await page.locator('#settings').getAttribute('open') === null) await page.locator('#settings > summary').click();
  await page.locator('[data-command="mode"][data-value="orbit"]').click();
  await page.waitForFunction(() => { const s = window.pennStation.getState(), c = window.pennStation.getCamera(); return s.mode === 'orbit' && s.framing === 'arrivals' && c && Math.hypot(c.position[0] + 70, c.position[2] - 28) < .05 && Math.abs(c.position[1] + 5.6676) < .02; }, null, { timeout: 15000 });
  report.arrivalsOrbit = await snapshot();
  await page.locator('[data-command="mode"][data-value="walk"]').click();
  await page.waitForFunction(() => { const s = window.pennStation.getState(), c = window.pennStation.getCamera(); return s.mode === 'walk' && s.framing === 'arrivals' && c && Math.hypot(c.position[0] + 70, c.position[2] - 28) < .05 && Math.abs(c.position[1] + 5.7876) < .02; }, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  report.arrivalsWalkRestoredSettled = await snapshot(); checkScene(report.arrivalsWalkRestoredSettled, ids);
  assert(Math.abs(report.arrivalsWalkRestoredSettled.camera.position[1] + 5.7876) < .02, 'Settled Orbit→Walk return has the same natural gallery eye height');
  if (await page.locator('#settings').getAttribute('open') !== null) await page.locator('#settings > summary').click();
  const goals = [
    { id: 'west-aisle-alignment', xz: [-69, 28], floorMain: -3.2004 },
    { id: 'west-aisle-clear-lift', xz: [-69, 9], floorMain: -3.2004 },
    { id: 'west-arrival-head', xz: [-69, 12.667632121365035], floorMain: -3.2004 },
    { id: 'west-arrival-midflight', xz: [-75, 12.667632121365035], capture: 'down-stair' },
    { id: 'west-arrival-platform', xz: [comparison.position[0],comparison.position[2]], arrivalTolerance:.025, floorMain: -7.718425, capture: 'up-stair' },
    { id: 'west-arrival-return-gallery', xz: [-69, 12.667632121365035], floorMain: -3.2004 },
    { id: 'west-aisle-return-clear-lift', xz: [-69, 9], floorMain: -3.2004 },
    { id: 'west-aisle-return-preset-row', xz: [-69, 28], floorMain: -3.2004 },
  ];
  report.walkPlan = goals;
  for (const goal of goals) {
    await moveTo(ids, goal);
    if (goal.capture === 'down-stair') { await turn(Math.PI / 2, -.6); report.midflightCloseView = await snapshot(); assert(report.midflightCloseView.camera.position[1] > -10.1 && report.midflightCloseView.camera.position[1] < -6, 'Actual collision-supported position lies on arrival stair flight'); await capture('public-arrival-stair-midflight'); }
    if (goal.capture === 'up-stair') { await turn(comparison.yaw,comparison.pitch);await page.waitForTimeout(300);report.platformCloseView=await snapshot();const p=report.platformCloseView.camera.position,e=new Euler().setFromQuaternion(new Quaternion(...report.platformCloseView.camera.quaternion),'YXZ');report.platformComparisonDelta={position:p.map((v,i)=>v-comparison.position[i]),yaw:wrap(e.y-comparison.yaw),pitch:e.x-comparison.pitch,fov:report.platformCloseView.camera.fov-comparison.fov};assert(Math.hypot(...report.platformComparisonDelta.position)<comparison.nativePositionToleranceM,'Native comparison camera position');assert(Math.abs(report.platformComparisonDelta.yaw)<.015&&Math.abs(report.platformComparisonDelta.pitch)<.015,'Actual pointer-look comparison angles');assert.equal(report.platformCloseView.camera.fov,50);await capture('public-arrival-stair-from-platform');report.platformVisualSamples=await page.evaluate(()=>window.pennStation.sampleVisuals([{label:'centre',x:720,y:500},{label:'left-lower',x:520,y:650},{label:'right-lower',x:920,y:650},{label:'upper',x:720,y:350}],{zone:'concourse'})); }
  }
  report.end = await snapshot(); checkScene(report.end, ids); assert.equal(await page.locator('.location-card').count(), 0);
  await release(); await Promise.allSettled(responseTasks);
  for (const file of expected.keys()) assert(report.bodies.some(b => b.file === file), 'Observed exact naturally-loaded public response: ' + file);
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.httpFailures, []); assert.deepEqual(report.bodyMismatches, []);
  report.status = 'PASS';
})().catch(e => { report.status = 'FAIL'; report.error = { message: e.message, stack: e.stack }; process.exitCode = 1; }).finally(async () => {
  if (page) { await release().catch(() => {}); if (report.status === 'FAIL') await page.screenshot({ path: path.join(out, 'failed.png') }).catch(() => {}); }
  if (browser) await browser.close(); report.browserClosed = true;
  await Promise.allSettled(responseTasks);
  report.requestFailureClassification = report.requestFailures.map(f => ({ ...f, classification: report.intentionalBlocks.some(b => b.url === f.url) ? 'intentional-external-block' : f.error === 'net::ERR_ABORTED' && report.bodies.some(b => b.url === f.url) ? 'aborted-request-with-an-exact-successful-public-response' : 'unexplained' }));
  report.unexplainedFailures = report.requestFailureClassification.filter(f => f.classification === 'unexplained');
  report.unresolvedBodyReadFailures = report.bodyReadFailures.filter(f => !report.bodies.some(b => b.file === f.file && b.url === f.url));
  report.unexpectedExternalBlocks = report.intentionalBlocks.filter(b => !['fonts.googleapis.com', 'fonts.gstatic.com'].includes(new URL(b.url).hostname));
  report.unexplainedConsoleErrors = report.console.filter(c => c.type === 'error' && !(c.message.includes('ERR_BLOCKED_BY_CLIENT') && report.intentionalBlocks.length > 0));
  report.postRunFreeze = [];
  for (const row of report.frozenInputs) { try { const actual = sha(await fs.readFile(path.join(root, row.file))); report.postRunFreeze.push({ file: row.file, sha256: actual, matches: actual === row.sha256 }); } catch (e) { report.postRunFreeze.push({ file: row.file, matches: false, error: e.message }); } }
  for(const row of report.extraFrozenInputs){try{const actual=sha(await fs.readFile(row.file));report.postRunFreeze.push({file:row.file,sha256:actual,matches:actual===row.sha256});}catch(e){report.postRunFreeze.push({file:row.file,matches:false,error:e.message});}}
  if (report.unexplainedFailures.length || report.unresolvedBodyReadFailures.length || report.unexpectedExternalBlocks.length || report.unexplainedConsoleErrors.length || report.postRunFreeze.some(r => !r.matches)) { report.status = 'FAIL'; report.finalAcceptanceFailure = 'Inspect retained network/console or post-run freeze records'; process.exitCode = 1; }
  report.closed = stamp();
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, bodies: report.bodies.length, phases: report.phases.length, requestFailures: report.requestFailures.length, unexplainedFailures: report.unexplainedFailures.length, error: report.error }));
});
