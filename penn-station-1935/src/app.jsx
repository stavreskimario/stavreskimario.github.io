import React, { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment } from '@react-three/drei/core/Environment.js';
import { useEnvironment } from '@react-three/drei/core/useEnvironment.js';
import { OrbitControls } from '@react-three/drei/core/OrbitControls.js';
import { Html } from '@react-three/drei/web/Html.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'meshoptimizer';
import { gunzipSync } from 'three/addons/libs/fflate.module.js';
import { computeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

THREE.Mesh.prototype.raycast = acceleratedRaycast;
const MAIN_FLOOR = -4.2672;

const assets = new URL('../assets/', import.meta.url);
// The bundled entry lives in dist/. Keep assets relative to the app on project Pages too.
const assetURL = name => {
  const url = new URL(name, assets);
  if (/^(model-|lighting-|scene-manifest)/.test(name)) url.searchParams.set('revision', '2');
  return url.href;
};
const $ = selector => document.querySelector(selector);
const views = {
  exterior: { title: 'Seventh Avenue', caption: 'The monumental eastern entrance · nominal 784 × 430 ft envelope', eye: [145, 8, 88], target: [108, 12, -5], walk: [124, 1.68, 0], look: [0, 1.68, 0] },
  waiting: { title: 'The main waiting room', caption: '277 × 103 ft clear hall · 14 ft below the street datum', eye: [8, 8 + MAIN_FLOOR, 37], target: [-2, 24 + MAIN_FLOOR, -17], walk: [0, 1.68 + MAIN_FLOOR, 31], look: [0, 10 + MAIN_FLOOR, -28] },
  concourse: { title: 'The train concourse', caption: 'Intersecting glass vaults · reconstructed from the original engineering account', eye: [-64, 8 + MAIN_FLOOR, 38], target: [-76, 20 + MAIN_FLOOR, -15], walk: [-67, 1.68 + MAIN_FLOOR, 33], look: [-75, 10 + MAIN_FLOOR, -25] },
};
const framing = {
  waiting: { eye: [-2, 1.7, 38], target: [0, 13, -20], fov: 56 },
  concourse: { eye: [-47, -2.4, -36], target: [-82, 12, 8], fov: 62 },
  hotel: { eye: [140, 6, 65], target: [183, 31, -24], title: 'Across Seventh Avenue', caption: 'Hotel Pennsylvania · four bedroom wings and three courts, informed by the 1919 plan' },
  farley: { eye: [-130, 8, 71], target: [-169, 18, -12], title: 'Across Eighth Avenue', caption: 'The General Post Office · twenty Corinthian columns and the monumental stair' },
  platform: { eye: [-14, -9.785625, 13], target: [-44, -10.2, 7.2662], title: 'A platform section', caption: 'Early GG1 and P70 interpretations · representative bay, not the complete track layout' },
};
let state = { view: 'exterior', framing: '', mode: 'orbit', light: 'afternoon', quality: matchMedia('(max-width: 700px)').matches ? 'low' : 'balanced', fov: 50, shadows: true, annotations: false, entered: false, tour: false, sound: false, loading: true, error: '', progress: 0, renderer: '', revision: 0, pose: 0, instant: false };
const listeners = new Set();
const update = patch => { state = { ...state, ...patch }; [...listeners].forEach(fn => fn()); syncUI(); };
const subscribe = fn => { listeners.add(fn); return () => listeners.delete(fn); };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
let debugCamera;
let debugRenderer;
let returnFocus;
let tourTimer;
let audio;
let soundNodes;
let preferWebGL = false;
let modelManifest = { obstacles: [] };
const modelCache = new Map();
const modelReports = new Map();
const irradianceCache = new Map();
THREE.Cache.enabled = true;

async function loadIrradiance(file, channel) {
  const key = `${file}:${channel}`;
  if (!irradianceCache.has(key)) {
    const pending = new THREE.TextureLoader().loadAsync(assetURL(file)).then(texture => {
      texture.flipY = false; texture.channel = channel;
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.mapping = THREE.UVMapping;
      texture.generateMipmaps = false;
      texture.minFilter = texture.magFilter = THREE.LinearFilter;
      return texture;
    }).catch(() => { irradianceCache.delete(key); throw new Error('The station lighting could not be loaded. Please check your connection and try again.'); });
    irradianceCache.set(key, pending);
  }
  return irradianceCache.get(key);
}

async function loadModel(view, quality, renderer, progress) {
  const file = `model-${view === 'waiting' ? 'waiting-room' : view}${quality === 'low' ? '-low' : ''}.glb`;
  if (modelCache.has(file)) { progress(100); return modelCache.get(file); }
  const pending = (async () => {
    if (!modelManifest.dimensions) {
      const metadata = await fetch(assetURL('scene-manifest.json'));
      if (!metadata.ok) throw new Error('The architectural navigation data could not be loaded. Please try again.');
      modelManifest = await metadata.json();
    }
    const response = await fetch(assetURL(file + '.gz'));
    if (!response.ok) throw new Error(`The ${(views[view]?.title || view).toLowerCase()} could not be loaded (${response.status}).`);
    const total = Number(response.headers.get('Content-Length'));
    const chunks = []; let count = 0;
    if (response.body && total) {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        chunks.push(value); count += value.length; progress(Math.min(92, count / total * 92));
      }
    } else { chunks.push(new Uint8Array(await response.arrayBuffer())); count = chunks[0].length; }
    progress(94);
    const bytes = new Uint8Array(count); let offset = 0;
    chunks.forEach(chunk => { bytes.set(chunk, offset); offset += chunk.length; });
    const decoded = bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes;
    const manager = new THREE.LoadingManager();
    const failedResources = [];
    manager.onError = url => failedResources.push(url);
    manager.onProgress = (_url, loaded, total) => progress(94 + 5 * loaded / total);
    const ktx = new KTX2Loader(manager).setTranscoderPath(assetURL('basis/')).detectSupport(renderer);
    const loader = new GLTFLoader(manager).setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx);
    let gltf;
    try { gltf = await loader.parseAsync(decoded.buffer.slice(decoded.byteOffset, decoded.byteOffset + decoded.byteLength), assets.href); } finally { ktx.dispose(); }
    if (failedResources.length) throw new Error('Some station materials could not be loaded. Please check your connection and try again.');
    const lightingTasks = []; const assigned = new Set();
    gltf.scene.traverse(object => {
      if (!object.isMesh) return;
      object.receiveShadow = true;
      // Double-sided thin glazing is authored in Blender. Preserve its PBR values.
      object.frustumCulled = true;
      if (!object.isInstancedMesh && !object.geometry.boundsTree) computeBoundsTree.call(object.geometry, { maxLeafTris: 12 });
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      // Transmission glass is not a dark, opaque blocker in the ordinary
      // shadow pass. Its reflection/refraction still uses the physical shader.
      object.castShadow = !materials.every(material => material.transmission > 0 || material.transparent);
      for (const material of materials) {
        if (assigned.has(material)) continue; assigned.add(material);
        if (material.aoMap) material.aoMapIntensity = .55;
        for (const slot of ['map', 'normalMap', 'roughnessMap']) if (material[slot]) material[slot].anisotropy = quality === 'low' ? 2 : 8;
        if (material.userData?.sky_illumination) {
          const file = quality === 'low' ? material.userData.sky_illumination.replace('-sky.webp', '-sky-low.webp') : material.userData.sky_illumination;
          // Texture optimisation may renumber unused UV sets. The exported AO
          // slot is the authoritative atlas channel, rather than a fixed UV1.
          const channel = material.aoMap?.channel ?? 1;
          lightingTasks.push(loadIrradiance(file, channel).then(texture => {
            material.lightMap = texture; material.lightMapIntensity = 1.0;
            material.needsUpdate = true;
          }));
        }
      }
    });
    await Promise.all(lightingTasks);
    modelReports.set(file, { file, materials: assigned.size, bakedMaterials: [...assigned].filter(material => material.lightMap).length, occlusionMaterials: [...assigned].filter(material => material.aoMap).length, atlasChannels: [...new Set([...assigned].filter(material => material.lightMap).map(material => material.lightMap.channel))] });
    // Keep the renderable scene, allowing the parser's raw buffers and temporary
    // dependency caches to be collected after decoding.
    progress(100); return { scene: gltf.scene };
  })();
  modelCache.set(file, pending);
  try { return await pending; } catch (error) { modelCache.delete(file); throw error; }
}

class ViewerBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error) { update({ error: 'The 3D renderer could not start. Your browser may have disabled graphics acceleration. The historical sources remain available.', loading: false }); console.error(error); }
  render() { return this.state.failed ? <div className="graphics-fallback">The historical exhibition is available through Sources & accuracy.</div> : this.props.children; }
}

async function makeRenderer(props) {
  let renderer;
  // WebGPU is optional. A canvas cannot change context type after acquisition,
  // so a failed WebGPU startup retires that Canvas before the WebGL retry.
  const requested = new URLSearchParams(location.search).get('renderer');
  if (requested === 'webgpu' && navigator.gpu && !preferWebGL) {
    try {
      const { WebGPURenderer } = await import('three/webgpu');
      renderer = new WebGPURenderer({ ...props, antialias: true, alpha: false });
      await renderer.init();
      renderer.pennBackend = renderer.backend?.isWebGPUBackend ? 'WebGPU · experimental' : 'WebGL 2 · compatibility';
    } catch {
      renderer?.dispose(); preferWebGL = true;
      renderer = new THREE.WebGLRenderer({ ...props, canvas: document.createElement('canvas'), antialias: true, alpha: false });
      queueMicrotask(() => update({ revision: state.revision + 1, loading: true, error: '', renderer: 'WebGL 2 · compatibility' }));
    }
  }
  if (!renderer) {
    renderer = new THREE.WebGLRenderer({ ...props, antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.pennBackend = 'WebGL 2';
  }
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  debugRenderer = renderer;
  return renderer;
}

function Building({ current, onModel }) {
  const [models, setModels] = useState([]);
  const group = useRef();
  const { invalidate, gl } = useThree();
  const selection = current.mode === 'walk' ? 'world' : current.view;
  useEffect(() => {
    let active = true; setModels([]);
    update({ loading: true, error: '', progress: 0 });
    const zones = selection === 'world' ? ['exterior', 'waiting', 'concourse', 'context', 'platform', 'trains'] : selection === 'exterior' ? ['exterior', 'context'] : selection === 'concourse' ? ['concourse', 'platform', 'trains'] : ['waiting'];
    const progress = new Map(zones.map(zone => [zone, 0]));
    Promise.all(zones.map(async zone => {
      const gltf = await loadModel(zone, current.quality, gl, percent => {
        progress.set(zone, percent);
        if (active) update({ progress: [...progress.values()].reduce((sum, value) => sum + value, 0) / zones.length });
      });
      return { zone, object: gltf.scene };
    })).then(loaded => {
      if (!active) return;
      setModels(loaded); invalidate();
    }).catch(error => { if (active) update({ loading: false, error: error.message }); });
    return () => { active = false; onModel(null); };
  }, [selection, current.quality === 'low', current.revision]);
  useLayoutEffect(() => {
    if (!models.length || !group.current) return;
    group.current.updateMatrixWorld(true); onModel(group.current);
    update({ loading: false, progress: 100 }); invalidate();
  }, [models]);
  // In walking mode the connected scene remains present through portals and
  // glazing. Individual mesh/instance bounds provide frustum culling; switching
  // the location label must never make the neighbouring architecture disappear.
  return <group ref={group}>{models.map(({ zone, object }) => <group key={zone} name={zone} position={[0, ['waiting', 'concourse', 'platform'].includes(zone) ? MAIN_FLOOR : zone === 'trains' ? MAIN_FLOOR - 8.886825 : 0, zone === 'trains' ? 7.2662 : 0]}><primitive object={object} /></group>)}</group>;
}

function Lighting({ current }) {
  const { gl, invalidate } = useThree();
  const presets = {
    morning: { position: [130, 65, 70], color: '#ffe4c4', sky: '#becbd2', intensity: 3.2, exposure: 1.06 },
    afternoon: { position: [95, 125, -65], color: '#fff4df', sky: '#c7d2d7', intensity: 3.8, exposure: 1.04 },
    evening: { position: [-130, 35, 80], color: '#ffd4a8', sky: '#b6b9c3', intensity: 2.3, exposure: 1.18 },
  };
  const p = presets[current.light];
  useEffect(() => { gl.toneMappingExposure = p.exposure; invalidate(); }, [p.exposure, gl]);
  const interior = current.view !== 'exterior';
  return <>
    <color attach="background" args={[p.sky]} />
    <fog attach="fog" args={[p.sky, 220, 620]} />
    <Environment files={assetURL('sky.hdr')} background={false} environmentIntensity={interior ? 0.22 : 0.75} />
    <hemisphereLight args={['#e5edf2', '#726a60', interior ? 0.18 : 1.25]} />
    <directionalLight position={p.position} color={p.color} intensity={p.intensity * (interior ? 0.65 : 1)} castShadow={current.shadows && current.quality !== 'low'} shadow-mapSize={[current.quality === 'high' ? 4096 : 2048, current.quality === 'high' ? 4096 : 2048]} shadow-camera-left={-160} shadow-camera-right={160} shadow-camera-top={110} shadow-camera-bottom={-110} shadow-camera-near={0.5} shadow-camera-far={400} shadow-normalBias={0.08} shadow-bias={-0.0001} />
    {interior && <directionalLight position={[0, 28, 0]} intensity={0.08} color="#f6e8d3" />}
    {[-90, -65, -40, -15].map(x => <pointLight key={x} position={[x, MAIN_FLOOR - 5.2, 11]} intensity={110} distance={24} decay={2} color="#ffe8c6" />)}
  </>;
}

function Navigation({ current, model }) {
  const { camera, gl, invalidate } = useThree();
  const orbit = useRef();
  const velocity = useRef(new THREE.Vector3());
  const stepTime = useRef(performance.now());
  const keys = useRef(new Set());
  const yaw = useRef(0); const pitch = useRef(0);
  const pointer = useRef(null);
  const ray = useRef(new THREE.Raycaster());
  const meshes = useRef([]);
  const feet = useRef(0);
  const appliedPose = useRef('');
  const config = { ...views[current.view], ...(framing[current.framing] || {}) };
  useEffect(() => {
    meshes.current = [];
    model?.traverse(object => {
      if (!object.isMesh) return;
      let zone = object;
      while (zone.parent && zone.parent !== model) zone = zone.parent;
      if (zone.name === 'context' || zone.name === 'trains') return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.every(material => material.transmission > 0 || material.transparent)) return;
      meshes.current.push(object);
    });
    ray.current.firstHitOnly = true;
  }, [model]);
  useLayoutEffect(() => {
    appliedPose.current = '';
    camera.position.fromArray(current.mode === 'walk' ? config.walk : config.eye);
    const look = new THREE.Vector3().fromArray(current.mode === 'walk' ? config.look : config.target);
    camera.lookAt(look); camera.fov = current.fov; camera.updateProjectionMatrix();
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); yaw.current = euler.y; pitch.current = euler.x;
    velocity.current.set(0, 0, 0); keys.current.clear();
    feet.current = camera.position.y - 1.68;
    if (orbit.current) { orbit.current.target.copy(look); orbit.current.update(); }
    debugCamera = camera; invalidate();
  }, [current.pose, current.mode, current.revision]);
  useEffect(() => { camera.fov = current.fov; camera.updateProjectionMatrix(); invalidate(); }, [current.fov]);
  useEffect(() => {
    const canvas = gl.domElement;
    canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Interactive architectural reconstruction. Drag to look; use the viewpoints for accessible navigation.');
    const isField = e => /INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName) || e.target.closest('dialog');
    const keydown = e => {
      const padButton = e.target.closest('button[data-move]');
      if (state.mode === 'walk' && padButton && ['Space', 'Enter'].includes(e.code)) { e.preventDefault(); keys.current.add(padButton.dataset.move); invalidate(); return; }
      if (state.mode !== 'walk' || isField(e) || e.altKey || e.ctrlKey || e.metaKey) return;
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        if (!e.repeat && velocity.current.lengthSq() < 0.0001) stepTime.current = performance.now();
        e.preventDefault(); keys.current.add(e.code); invalidate();
      }
    };
    const keyup = e => { const padButton = e.target.closest('button[data-move]'); if (padButton && ['Space', 'Enter'].includes(e.code)) keys.current.delete(padButton.dataset.move); keys.current.delete(e.code); invalidate(); };
    const stop = () => { keys.current.clear(); velocity.current.set(0, 0, 0); pointer.current = null; };
    const down = e => {
      if (state.mode !== 'walk' || e.button !== 0 || pointer.current) return;
      pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId); canvas.focus({ preventScroll: true });
    };
    const move = e => {
      const p = pointer.current; if (!p || p.id !== e.pointerId || state.mode !== 'walk') return;
      yaw.current -= (e.clientX - p.x) * 0.003; pitch.current = THREE.MathUtils.clamp(pitch.current - (e.clientY - p.y) * 0.003, -1.2, 1.2);
      p.x = e.clientX; p.y = e.clientY;
      camera.quaternion.setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ')); invalidate();
    };
    const up = e => { if (pointer.current?.id === e.pointerId) pointer.current = null; };
    const touchMove = e => {
      if (!e.target.closest('[data-move]')) return;
      if (velocity.current.lengthSq() < 0.0001) stepTime.current = performance.now();
      e.preventDefault(); keys.current.add(e.target.closest('[data-move]').dataset.move); invalidate();
    };
    const touchUp = () => { keys.current.clear(); invalidate(); };
    document.addEventListener('keydown', keydown); document.addEventListener('keyup', keyup);
    window.addEventListener('blur', stop); document.addEventListener('visibilitychange', stop);
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up); canvas.addEventListener('lostpointercapture', up);
    document.addEventListener('pointerdown', touchMove); document.addEventListener('pointerup', touchUp); document.addEventListener('pointercancel', touchUp);
    return () => {
      stop(); document.removeEventListener('keydown', keydown); document.removeEventListener('keyup', keyup); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop);
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', up); canvas.removeEventListener('lostpointercapture', up);
      document.removeEventListener('pointerdown', touchMove); document.removeEventListener('pointerup', touchUp); document.removeEventListener('pointercancel', touchUp);
    };
  }, [camera, gl]);
  useFrame((_, delta) => {
    // Drei updates its controls at priority -1. Reconcile a requested pose once
    // after that update, so pending orbit inertia cannot move a new viewpoint.
    const poseToken = `${state.pose}:${state.mode}:${state.revision}`;
    if (state.mode === 'orbit' && orbit.current && appliedPose.current !== poseToken) {
      const preset = { ...views[state.view], ...(framing[state.framing] || {}) };
      const controls = orbit.current;
      controls.enableDamping = false; controls.update();
      camera.position.fromArray(preset.eye); controls.target.fromArray(preset.target);
      controls.update(); controls.enableDamping = !reduced.matches;
      appliedPose.current = poseToken; debugCamera = camera; invalidate();
    }
    syncWalkingMap(camera);
    if (current.mode !== 'walk' || current.loading || document.hidden || document.querySelector('dialog[open]')) return;
    const now = performance.now();
    const k = keys.current; const dt = Math.min((now - stepTime.current) / 1000, 0.25); stepTime.current = now;
    const forward = Number(k.has('KeyW') || k.has('ArrowUp')) - Number(k.has('KeyS') || k.has('ArrowDown'));
    const sideways = Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft'));
    const desired = new THREE.Vector3(sideways, 0, -forward).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current).multiplyScalar(k.has('ShiftLeft') || k.has('ShiftRight') ? 5 : 2.6);
    velocity.current.lerp(desired, 1 - Math.exp(-dt * 10));
    if (velocity.current.lengthSq() < 0.0001 && !forward && !sideways) return;
    const movement = velocity.current.clone().multiplyScalar(dt);
    // Short sweeps prevent a slow frame from stepping through a wall or well.
    const steps = Math.max(1, Math.ceil(movement.length() / .12));
    movement.divideScalar(steps);
    const normalMatrix = new THREE.Matrix3();
    const down = new THREE.Vector3(0, -1, 0);
    const inRectangle = (point, bounds) => point.x >= bounds[0] && point.x <= bounds[1] && point.z >= bounds[2] && point.z <= bounds[3];
    const permitted = point => (modelManifest.walkable || []).some(area => inRectangle(point, area.bounds)) || inRectangle(point, [119.48, 159, -70, 70]);
    const groundAt = (point, floor = feet.current) => {
      const origin = point.clone(); origin.y = floor + .25;
      ray.current.set(origin, down); ray.current.near = 0; ray.current.far = .65;
      for (const hit of ray.current.intersectObjects(meshes.current, false)) {
        const normal = hit.face.normal.clone().applyNormalMatrix(normalMatrix.getNormalMatrix(hit.object.matrixWorld));
        // A real tread's rounded/chamfered edge remains a stepping surface.
        // Rise/drop limits below reject ledges; vertical walls still have y=0.
        if (normal.y > .5) return hit.point.y;
      }
      // The street surface belongs to the separately instanced neighbourhood.
      // Analytic navigation uses the same authored street/sidewalk datum.
      if (point.x >= 119.45 && point.x <= 159 && Math.abs(point.z) <= 70 && feet.current > -.5) return point.x <= 129 ? 0 : -.15;
      return null;
    };
    for (let step = 0; step < steps; step++) for (const axis of ['x', 'z']) {
      if (Math.abs(movement[axis]) < .00001) continue;
      const direction = new THREE.Vector3(); direction[axis] = Math.sign(movement[axis]);
      const candidate = camera.position.clone(); candidate[axis] += movement[axis];
      if (!permitted(candidate)) continue;
      let blocked = false;
      for (const height of [.35, .55, 1.0, 1.6]) {
        const origin = camera.position.clone(); origin.y = feet.current + height;
        ray.current.set(origin, direction); ray.current.near = 0; ray.current.far = Math.abs(movement[axis]) + .32;
        if (ray.current.intersectObjects(meshes.current, false).length) { blocked = true; break; }
      }
      if (blocked) continue;
      const ground = groundAt(candidate);
      if (ground === null || ground > feet.current + .24 || ground < feet.current - .35) continue;
      // Check the forward edge of a human footprint before entering a void.
      const leading = candidate.clone().addScaledVector(direction, .25);
      const ahead = groundAt(leading, ground);
      if (ahead === null || Math.abs(ahead - ground) > .35) continue;
      camera.position[axis] = candidate[axis]; feet.current = ground;
    }
    camera.position.y = THREE.MathUtils.damp(camera.position.y, feet.current + 1.68, 18, dt);
    const zone = camera.position.x > 18 ? 'exterior' : camera.position.x < -38 ? 'concourse' : 'waiting';
    if (zone !== state.view) update({ view: zone });
    invalidate();
  });
  return current.mode === 'orbit' ? <OrbitControls key={current.pose} ref={orbit} makeDefault target={config.target} enableDamping={!reduced.matches} dampingFactor={0.12} minDistance={2} maxDistance={460} maxPolarAngle={Math.PI * (current.view === 'exterior' ? 0.65 : 0.9)} keyEvents={false} /> : null;
}

const hotspots = {
  exterior: [{ position: [120, 20, 0], label: 'Doric colonnade', detail: 'The Seventh Avenue entrance uses classical Doric columns. Profiles and bay spacing are reconstructed from published elevations.' }, { position: [0, 45, 0], label: 'A Roman room', detail: 'Behind the avenue facade rises the main waiting room. Its clear dimensions are recorded as 277 by 103 feet.' }],
  waiting: [{ position: [12, 18, -14], label: 'Corinthian order', detail: 'Eight colossal columns frame three vaulted bays. The capitals are interpretive meshes, not surveyed copies.' }, { position: [-10, 32, -22], label: 'Daylight at scale', detail: 'Three great semicircular windows light each long side. The period account gives a radius of 33 feet 4 inches.' }],
  concourse: [{ position: [-71, 23, -5], label: 'Steel & glass', detail: 'The published concourse has intersecting arched vaults. This first phase studies the structural rhythm; engineering joints remain approximate.' }],
};
function Scene() {
  const current = useSyncExternalStore(subscribe, () => state);
  const [model, setModel] = useState(null);
  return <>
    <Lighting current={current} />
    <Building current={current} onModel={setModel} />
    <Navigation current={current} model={model} />
    {current.annotations && !current.loading && hotspots[current.view].map(h => <Html key={h.label} position={h.position} center distanceFactor={current.view === 'exterior' ? 120 : 35}><button className="hotspot" title={h.detail} onClick={() => showAnnotation(h)}>{h.label}<span aria-hidden="true"> +</span></button></Html>)}
  </>;
}

function Viewer() {
  const current = useSyncExternalStore(subscribe, () => state);
  const graphicsAvailable = useMemo(() => {
    try {
      const probeCanvas = document.createElement('canvas'); probeCanvas.width = 1; probeCanvas.height = 1;
      return Boolean(probeCanvas.getContext('webgl2'));
    } catch { return false; }
  }, [current.revision]);
  useEffect(() => { if (!graphicsAvailable) update({ error: '3D graphics are unavailable. Enable browser graphics acceleration and try again. Sources & accuracy remains available.', loading: false }); }, [graphicsAvailable, current.revision]);
  if (!graphicsAvailable) return <p className="graphics-fallback">3D graphics are unavailable. Historical sources remain available.</p>;
  return <ViewerBoundary key={current.revision}><Canvas frameloop="demand" shadows={current.shadows && current.quality !== 'low'} dpr={current.quality === 'low' ? 1 : current.quality === 'high' ? [1, 2] : [1, 1.5]} camera={{ position: views.exterior.eye, fov: 50, near: 0.15, far: 1000 }} gl={makeRenderer} onCreated={({ gl }) => update({ renderer: gl.pennBackend || 'WebGL 2' })} fallback={<p>3D graphics are unavailable. Open Sources & accuracy to explore the research.</p>}><React.Suspense fallback={null}><Scene /></React.Suspense></Canvas></ViewerBoundary>;
}

function openDialog(id, trigger) {
  const dialog = $(id); if (!dialog) return;
  returnFocus = trigger || document.activeElement;
  if (!dialog.open) dialog.showModal();
}
function trapDialogFocus(event) {
  if (event.key !== 'Tab') return;
  const dialog = event.currentTarget;
  const targets = [...dialog.querySelectorAll('a[href], button:not([disabled]), input, select, summary, [tabindex="0"]')].filter(element => element.getClientRects().length);
  const first = targets[0]; const last = targets.at(-1);
  if (!first) { event.preventDefault(); return; }
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}
function showAnnotation(h) {
  let dialog = $('#annotation-dialog');
  if (!dialog) {
    dialog = document.createElement('dialog'); dialog.id = 'annotation-dialog';
    const title = document.createElement('h2'); title.id = 'annotation-title';
    const text = document.createElement('p'); text.id = 'annotation-text';
    const form = document.createElement('form'); form.method = 'dialog';
    const close = document.createElement('button'); close.textContent = 'Close'; close.className = 'button'; form.append(close);
    dialog.append(title, text, form); dialog.setAttribute('aria-labelledby', title.id); document.body.append(dialog);
    dialog.addEventListener('close', () => returnFocus?.focus());
    dialog.addEventListener('keydown', trapDialogFocus);
  }
  $('#annotation-title').textContent = h.label; $('#annotation-text').textContent = h.detail; openDialog('#annotation-dialog');
}

function stopTour() { clearTimeout(tourTimer); if (state.tour) update({ tour: false }); }
function go(view, instant = true) {
  if (!views[view]) return;
  update({ view, framing: '', entered: true, instant, mode: 'orbit', pose: state.pose + 1, loading: view !== state.view || state.mode === 'walk' ? true : state.loading });
  if ($('#comparison')) $('#comparison').hidden = true;
  document.querySelectorAll('button[data-command="compare"]').forEach(button => button.setAttribute('aria-pressed', 'false'));
}
function startTour() {
  update({ tour: true, entered: true, mode: 'orbit' });
  const order = ['exterior', 'waiting', 'concourse']; let index = 0;
  const step = () => {
    if (!state.tour) return;
    if (state.loading || document.hidden || document.querySelector('dialog[open]')) { tourTimer = setTimeout(step, 1500); return; }
    if (index === order.length) { update({ tour: false }); return; }
    go(order[index++], reduced.matches); tourTimer = setTimeout(step, 12000);
  };
  step();
}
async function toggleSound() {
  if (state.sound) { await audio?.suspend(); update({ sound: false }); return; }
  try {
    audio ||= new AudioContext();
    if (!soundNodes) {
      // Original synthesized room tone. No historic recording or engine sample is implied.
      const buffer = audio.createBuffer(1, audio.sampleRate * 4, audio.sampleRate);
      const data = buffer.getChannelData(0); let previous = 0;
      for (let i = 0; i < data.length; i++) { previous = (previous + (Math.random() * 2 - 1) * 0.02) / 1.02; data[i] = previous * 3.5; }
      const noise = audio.createBufferSource(); noise.buffer = buffer; noise.loop = true;
      const filter = audio.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 250;
      const gain = audio.createGain(); gain.gain.value = 0.065;
      noise.connect(filter).connect(gain).connect(audio.destination); noise.start(); soundNodes = { noise, filter, gain };
    }
    await audio.resume(); update({ sound: true });
  } catch { $('#movement-help').textContent = 'Sound is unavailable in this browser.'; }
}

let mapPosition = { visible: false, x: '', z: '' };
function syncWalkingMap(camera = debugCamera) {
  if (!$('#map-control')?.open) return;
  const dot = $('#map-position'); if (!dot) return;
  const visible = state.mode === 'walk' && !state.loading && !state.error && Boolean(camera);
  if (visible !== mapPosition.visible) {
    dot.setAttribute('visibility', visible ? 'visible' : 'hidden');
    mapPosition.visible = visible;
  }
  if (!visible) return;
  // Project the actual world X/Z into the nominal station envelope; no camera
  // movement or React state updates are needed for this orientation marker.
  const x = (34 + (camera.position.x + 119.4816) / 238.9632 * 212).toFixed(2);
  const z = (28 + (camera.position.z + 65.532) / 131.064 * 112).toFixed(2);
  if (x !== mapPosition.x) { dot.setAttribute('cx', x); mapPosition.x = x; }
  if (z !== mapPosition.z) { dot.setAttribute('cy', z); mapPosition.z = z; }
}

function syncUI() {
  const config = { ...views[state.view], ...(framing[state.framing] || {}) };
  document.body.dataset.mode = state.mode; document.body.dataset.entered = String(state.entered);
  if ($('#intro')) $('#intro').hidden = state.entered;
  if ($('#loading')) $('#loading').hidden = !state.loading || Boolean(state.error);
  if ($('#load-error')) { $('#load-error').hidden = !state.error; const p = $('#load-error p'); if (p) p.textContent = state.error; }
  if ($('#load-progress')) $('#load-progress').value = state.progress;
  if ($('#load-status')) $('#load-status').textContent = `${state.progress >= 94 ? 'Preparing materials' : 'Loading architecture'} · ${Math.round(state.progress)}%`;
  if ($('#location-title')) $('#location-title').textContent = config.title;
  if ($('#location-index')) $('#location-index').textContent = { exterior: '01', waiting: '02', concourse: '03' }[state.view];
  if ($('#location-caption')) $('#location-caption').textContent = config.caption;
  if ($('#renderer-status')) $('#renderer-status').textContent = `${state.renderer || 'Starting renderer'} · ${state.quality === 'low' ? 'Mobile' : state.quality} quality`;
  if ($('#movement-help')) $('#movement-help').textContent = state.mode === 'walk' ? 'Drag to look · WASD / arrows to walk · follow the central arcade and stairs into the station' : 'Drag to orbit · scroll to approach · right-drag / two fingers to pan';
  document.querySelectorAll('button[data-command]').forEach(button => {
    const { command, value } = button.dataset;
    if (['view', 'mode', 'light'].includes(command)) button.setAttribute('aria-pressed', String(state[command] === value));
    if (['tour', 'annotations', 'sound'].includes(command)) button.setAttribute('aria-pressed', String(state[command]));
    if (command === 'enter') button.disabled = state.loading || Boolean(state.error);
  });
  if ($('#quality')) $('#quality').value = state.quality;
  if ($('#fov')) $('#fov').value = state.fov;
  if ($('#fov-value')) $('#fov-value').textContent = `${state.fov}°`;
  if ($('#shadows')) $('#shadows').checked = state.shadows;
  if ($('#reference-framing')) $('#reference-framing').hidden = !framing[state.view];
  syncWalkingMap();
}

document.addEventListener('click', async event => {
  const button = event.target.closest('button[data-command]'); if (!button) return;
  const { command, value } = button.dataset; const instant = event.detail === 0 || reduced.matches;
  if (['enter', 'view', 'mode', 'reset'].includes(command)) stopTour();
  if (command === 'enter') { update({ entered: true }); $('#scene-root canvas')?.focus({ preventScroll: true }); }
  if (command === 'view') go(value, instant);
  if (command === 'focus' && ['hotel', 'farley', 'platform'].includes(value)) { stopTour(); const view = value === 'platform' ? 'concourse' : 'exterior'; update({ view, framing: value, entered: true, mode: 'orbit', pose: state.pose + 1, loading: view !== state.view || state.mode === 'walk' ? true : state.loading }); }
  if (command === 'reference' && framing[state.view]) update({ framing: state.view, mode: 'orbit', fov: framing[state.view].fov, pose: state.pose + 1 });
  if (command === 'mode' && ['walk', 'orbit'].includes(value)) { update({ mode: value, framing: '', entered: true, instant, loading: value !== state.mode ? true : state.loading }); $('#scene-root canvas')?.focus({ preventScroll: true }); }
  if (command === 'light' && ['morning', 'afternoon', 'evening'].includes(value)) update({ light: value });
  if (command === 'annotations') update({ annotations: !state.annotations });
  if (command === 'tour') state.tour ? stopTour() : startTour();
  if (command === 'sound') await toggleSound();
  if (command === 'sources') openDialog('#sources-dialog', button);
  if (command === 'help') openDialog('#help-dialog', button);
  if (command === 'retry') { useEnvironment.clear({ files: assetURL('sky.hdr') }); update({ revision: state.revision + 1, loading: true, error: '' }); }
  if (command === 'reset') update({ mode: 'orbit', revision: state.revision + 1, fov: 50, annotations: false });
  if (command === 'fullscreen') {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { $('#movement-help').textContent = 'Fullscreen is unavailable. The viewer still fills this window.'; }
  }
  if (command === 'compare') {
    const panel = $('#comparison'); if (!panel) return;
    panel.hidden = !panel.hidden;
    document.querySelectorAll('button[data-command="compare"]').forEach(button => button.setAttribute('aria-pressed', String(!panel.hidden)));
    const reference = state.view === 'waiting' ? 'waiting' : state.view === 'concourse' ? 'concourse' : 'exterior';
    if ($('#reference-photo')) { $('#reference-photo').loading = 'eager'; $('#reference-photo').src = assetURL(`reference-${reference}.jpg`); $('#reference-photo').alt = `Opening-era ${reference} photograph from the architects’ published monograph; its camera has not been precisely matched.`; }
    if ($('#reference-link')) $('#reference-link').href = 'https://archive.org/details/gri_33125006526038';
  }
});
$('#map-control')?.addEventListener('toggle', () => syncWalkingMap());
$('#quality')?.addEventListener('change', event => { if (['low', 'balanced', 'high'].includes(event.target.value)) update({ quality: event.target.value, loading: (event.target.value === 'low') !== (state.quality === 'low') ? true : state.loading }); });
$('#fov')?.addEventListener('input', event => update({ fov: Math.max(35, Math.min(75, Number(event.target.value))) }));
$('#shadows')?.addEventListener('change', event => update({ shadows: event.target.checked }));
document.querySelectorAll('dialog').forEach(dialog => { dialog.addEventListener('close', () => returnFocus?.focus()); dialog.addEventListener('keydown', trapDialogFocus); });
document.addEventListener('visibilitychange', () => { if (document.hidden && state.sound) { audio?.suspend(); update({ sound: false }); } });
document.addEventListener('keydown', event => { if (event.key === 'Escape') stopTour(); });

// Touch movement has native, labelled button alternatives to a gesture-only joystick.
const pad = document.createElement('div'); pad.className = 'walk-pad'; pad.setAttribute('role', 'group'); pad.setAttribute('aria-label', 'Walking controls');
[['KeyW', '↑', 'Walk forward'], ['KeyA', '←', 'Walk left'], ['KeyS', '↓', 'Walk backward'], ['KeyD', '→', 'Walk right']].forEach(([move, symbol, label]) => {
  const button = document.createElement('button'); button.dataset.move = move; button.textContent = symbol; button.setAttribute('aria-label', label); button.type = 'button'; pad.append(button);
});
$('#viewport')?.append(pad);
const neighbourhood = document.createElement('div'); neighbourhood.className = 'map-places';
[['hotel', 'Across Seventh · Hotel Pennsylvania'], ['farley', 'Across Eighth · General Post Office'], ['platform', 'Below the concourse · Platform section']].forEach(([value, text]) => {
  const button = document.createElement('button'); button.type = 'button'; button.dataset.command = 'focus'; button.dataset.value = value; button.textContent = text; neighbourhood.append(button);
});
$('.map-body')?.append(neighbourhood);
window.pennStation = Object.freeze({ getState: () => ({ ...state }), getCamera: () => debugCamera ? { position: debugCamera.position.toArray(), quaternion: debugCamera.quaternion.toArray(), fov: debugCamera.fov } : null, getMetrics: () => debugRenderer ? { calls: debugRenderer.info.render.calls, triangles: debugRenderer.info.render.triangles, geometries: debugRenderer.info.memory.geometries, textures: debugRenderer.info.memory.textures } : null, getAssets: () => [...modelReports.values()].map(report => ({ ...report, atlasChannels: [...report.atlasChannels] })) });
syncUI(); createRoot($('#scene-root')).render(<Viewer />);
