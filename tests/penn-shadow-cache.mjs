// CPU controls for the static shadow cache's target lifecycle; no GPU required.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { enableStaticShadowCache, refreshStaticShadows } from '../penn-station-1935/src/shadow-cache.mjs';
const requireTools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
const THREE = requireTools('three');
const renderer = { isWebGLRenderer: true, capabilities: { maxTextureSize: 4096 }, shadowMap: { autoUpdate: true, needsUpdate: false } };
assert.equal(enableStaticShadowCache(renderer), true); assert.equal(renderer.shadowMap.autoUpdate, false);
const scene = new THREE.Scene(), sun = new THREE.DirectionalLight(), practical = new THREE.SpotLight();
sun.castShadow = practical.castShadow = true; sun.shadow.mapSize.set(2048, 2048); practical.shadow.mapSize.set(1024, 1024); scene.add(sun, practical);
const oldSun = sun.shadow.map = new THREE.WebGLRenderTarget(2048, 2048), oldPractical = practical.shadow.map = new THREE.WebGLRenderTarget(1024, 1024);
let sunDisposals = 0, practicalDisposals = 0; oldSun.addEventListener('dispose', () => sunDisposals++); oldPractical.addEventListener('dispose', () => practicalDisposals++);
const oldProjection = sun.shadow.camera.projectionMatrix.clone();
sun.shadow.camera.left = -160; sun.shadow.camera.right = 160; sun.shadow.camera.top = 110; sun.shadow.camera.bottom = -110; sun.shadow.camera.near = .5; sun.shadow.camera.far = 400;
refreshStaticShadows(renderer, scene);
assert(!sun.shadow.camera.projectionMatrix.equals(oldProjection), 'Changed camera bounds rebuild the shadow projection');
assert.equal(sun.shadow.camera.projectionMatrix.elements[0], 2 / 320); assert.equal(sun.shadow.camera.projectionMatrix.elements[5], 2 / 220);
assert.equal(sun.shadow.map, oldSun); assert.equal(practical.shadow.map, oldPractical); assert.equal(sunDisposals, 0); assert.equal(practicalDisposals, 0);
assert.equal(renderer.shadowMap.needsUpdate, true); assert.equal(sun.shadow.needsUpdate, true);
// Consuming a frame and moving only the camera must not request another map.
renderer.shadowMap.needsUpdate = sun.shadow.needsUpdate = practical.shadow.needsUpdate = false;
const camera = new THREE.PerspectiveCamera(); camera.position.set(12, 4, -8); camera.updateMatrixWorld();
assert.equal(renderer.shadowMap.needsUpdate, false); assert.equal(sun.shadow.map, oldSun);
sun.shadow.mapSize.set(4096, 4096); refreshStaticShadows(renderer, scene);
assert.equal(sunDisposals, 1); assert.equal(sun.shadow.map, null); assert.equal(practical.shadow.map, oldPractical); assert.equal(practicalDisposals, 0);
const highSun = sun.shadow.map = new THREE.WebGLRenderTarget(4096, 4096); let highDisposals = 0; highSun.addEventListener('dispose', () => highDisposals++);
sun.shadow.mapSize.set(2048, 2048); refreshStaticShadows(renderer, scene); assert.equal(highDisposals, 1); assert.equal(sun.shadow.map, null);
// A request exceeding hardware limits must retain an already-correct target.
sun.shadow.map = new THREE.WebGLRenderTarget(2048, 2048); sun.shadow.mapSize.set(4096, 4096); renderer.capabilities.maxTextureSize = 2048;
const clamped = sun.shadow.map; refreshStaticShadows(renderer, scene); assert.equal(sun.shadow.map, clamped);
const point = new THREE.PointLight(); point.castShadow = true; point.shadow.mapSize.set(1024, 1024); scene.add(point);
const extent = point.shadow.getFrameExtents(); point.shadow.map = new THREE.WebGLRenderTarget(Math.min(1024, Math.floor(2048 / extent.x)) * extent.x, Math.min(1024, Math.floor(2048 / extent.y)) * extent.y);
const pointTarget = point.shadow.map; refreshStaticShadows(renderer, scene); assert.equal(point.shadow.map, pointTarget, 'Point-light atlas extents match r180 clamping');
const experimental = { isWebGPURenderer: true, shadowMap: { autoUpdate: true, needsUpdate: false } };
assert.equal(enableStaticShadowCache(experimental), false); assert.equal(refreshStaticShadows(experimental, scene), false); assert.deepEqual(experimental.shadowMap, { autoUpdate: true, needsUpdate: false });
console.log('PASS WebGL static flags, unchanged targets, both resize directions, hardware/atlas clamps and untouched experimental renderer');
