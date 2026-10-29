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

const assets = new URL('../assets/', import.meta.url);
// The bundled entry lives in dist/. Keep assets relative to the app on project Pages too.
const assetURL = name => new URL(name, assets).href;
const $ = selector => document.querySelector(selector);
const views = {
  exterior: { title: 'Seventh Avenue', caption: 'The monumental eastern entrance · nominal 784 × 430 ft envelope', eye: [145, 8, 88], target: [108, 12, -5], walk: [125, 1.68, 30], look: [118, 8, 0], bounds: [120, 140, -69, 69] },
  waiting: { title: 'The main waiting room', caption: '277 × 103 ft clear hall · three Roman-inspired vaulted bays', eye: [8, 8, 37], target: [-2, 24, -17], walk: [0, 1.68, 31], look: [0, 16, -28], bounds: [-12.4, 12.4, -40, 40] },
  concourse: { title: 'The train concourse', caption: 'Steel, glass and daylight · structural reconstruction in progress', eye: [-64, 8, 38], target: [-76, 20, -15], walk: [-67, 1.68, 33], look: [-75, 16, -25], bounds: [-97, -41, -44, 44] },
};
let state = { view: 'exterior', mode: 'orbit', light: 'afternoon', quality: matchMedia('(max-width: 700px)').matches ? 'low' : 'balanced', fov: 50, shadows: true, annotations: false, entered: false, tour: false, sound: false, loading: true, error: '', progress: 0, renderer: '', revision: 0, instant: false };
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

async function loadModel(view, quality, renderer, progress) {
  const file = `model-${view === 'waiting' ? 'waiting-room' : view}${quality === 'low' ? '-low' : ''}.glb`;
  if (modelCache.has(file)) { progress(100); return modelCache.get(file); }
  const pending = (async () => {
    if (!modelManifest.dimensions) {
      const metadata = await fetch(assetURL('scene-manifest.json'));
      if (!metadata.ok) throw new Error('The architectural navigation data could not be loaded. Please try again.');
      modelManifest = await metadata.json();
    }
    const response = await fetch(assetURL(file));
    if (!response.ok) throw new Error(`The ${views[view].title.toLowerCase()} could not be loaded (${response.status}).`);
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
    const ktx = new KTX2Loader().setTranscoderPath(assetURL('basis/')).detectSupport(renderer);
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx);
    let gltf;
    try { gltf = await loader.parseAsync(bytes.buffer, assets.href); } finally { ktx.dispose(); }
    gltf.scene.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = true; object.receiveShadow = true;
      // Double-sided thin glazing is authored in Blender. Preserve its PBR values.
      object.frustumCulled = true;
    });
    progress(100); return gltf;
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
  const [model, setModel] = useState(null);
  const { invalidate, gl } = useThree();
  useEffect(() => {
    let active = true; setModel(null);
    update({ loading: true, error: '', progress: 0 });
    loadModel(current.view, current.quality, gl, progress => { if (active) update({ progress }); }).then(gltf => {
      if (!active) return;
      setModel(gltf.scene); onModel(gltf.scene); invalidate();
    }).catch(error => { if (active) update({ loading: false, error: error.message }); });
    return () => { active = false; onModel(null); };
  }, [current.view, current.quality === 'low', current.revision]);
  useLayoutEffect(() => { if (model) { update({ loading: false, progress: 100 }); invalidate(); } }, [model]);
  return model ? <primitive object={model} /> : null;
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
    <Environment files={assetURL('sky.hdr')} background={false} environmentIntensity={interior ? 0.52 : 0.75} />
    <hemisphereLight args={['#e5edf2', '#726a60', interior ? 1.0 : 1.25]} />
    <directionalLight position={p.position} color={p.color} intensity={p.intensity * (interior ? 0.65 : 1)} castShadow={current.shadows && current.quality !== 'low'} shadow-mapSize={[current.quality === 'high' ? 4096 : 2048, current.quality === 'high' ? 4096 : 2048]} shadow-camera-left={-160} shadow-camera-right={160} shadow-camera-top={110} shadow-camera-bottom={-110} shadow-camera-near={0.5} shadow-camera-far={400} shadow-normalBias={0.08} shadow-bias={-0.0001} />
    {interior && <directionalLight position={[0, 28, 0]} intensity={0.45} color="#f6e8d3" />}
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
  const config = views[current.view];
  useEffect(() => {
    meshes.current = [];
    model?.traverse(object => { if (object.isMesh) meshes.current.push(object); });
  }, [model]);
  useLayoutEffect(() => {
    camera.position.fromArray(current.mode === 'walk' ? config.walk : config.eye);
    const look = new THREE.Vector3().fromArray(current.mode === 'walk' ? config.look : config.target);
    camera.lookAt(look); camera.fov = current.fov; camera.updateProjectionMatrix();
    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ'); yaw.current = euler.y; pitch.current = euler.x;
    velocity.current.set(0, 0, 0); keys.current.clear();
    if (orbit.current) { orbit.current.target.copy(look); orbit.current.update(); }
    debugCamera = camera; invalidate();
  }, [current.view, current.mode, current.revision]);
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
    if (current.mode !== 'walk' || current.loading || document.hidden || document.querySelector('dialog[open]')) return;
    const now = performance.now();
    const k = keys.current; const dt = Math.min((now - stepTime.current) / 1000, 0.25); stepTime.current = now;
    const forward = Number(k.has('KeyW') || k.has('ArrowUp')) - Number(k.has('KeyS') || k.has('ArrowDown'));
    const sideways = Number(k.has('KeyD') || k.has('ArrowRight')) - Number(k.has('KeyA') || k.has('ArrowLeft'));
    const desired = new THREE.Vector3(sideways, 0, -forward).normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw.current).multiplyScalar(k.has('ShiftLeft') || k.has('ShiftRight') ? 5 : 2.6);
    velocity.current.lerp(desired, 1 - Math.exp(-dt * 10));
    if (velocity.current.lengthSq() < 0.0001 && !forward && !sideways) return;
    const movement = velocity.current.clone().multiplyScalar(dt);
    // Slide along walls using separate X/Z sweeps, tested at torso and eye height.
    for (const axis of ['x', 'z']) {
      if (Math.abs(movement[axis]) < 0.00001) continue;
      const direction = new THREE.Vector3(); direction[axis] = Math.sign(movement[axis]);
      let blocked = false;
      const candidate = camera.position.clone(); candidate[axis] += movement[axis];
      for (const obstacle of modelManifest.obstacles) {
        const [left, right, front, back] = obstacle.bounds;
        if (candidate.x > left && candidate.x < right && candidate.z > front && candidate.z < back) { blocked = true; break; }
      }
      for (const height of [0.7, 1.6]) {
        const origin = camera.position.clone(); origin.y = height;
        ray.current.set(origin, direction); ray.current.near = 0; ray.current.far = Math.abs(movement[axis]) + 0.4;
        if (ray.current.intersectObjects(meshes.current, false).length) { blocked = true; break; }
      }
      if (!blocked) camera.position[axis] += movement[axis];
    }
    const [xmin, xmax, zmin, zmax] = config.bounds;
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, xmin, xmax);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, zmin, zmax);
    camera.position.y = 1.68;
    invalidate();
  });
  return current.mode === 'orbit' ? <OrbitControls ref={orbit} makeDefault target={config.target} enableDamping={!reduced.matches} dampingFactor={0.12} minDistance={2} maxDistance={460} maxPolarAngle={Math.PI * (current.view === 'exterior' ? 0.65 : 0.9)} keyEvents={false} /> : null;
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
  update({ view, entered: true, instant, mode: 'orbit' });
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

function syncUI() {
  const config = views[state.view];
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
  if ($('#movement-help')) $('#movement-help').textContent = state.mode === 'walk' ? 'Drag to look · WASD / arrows to walk · 1.68 m eye height · use viewpoints to change spaces' : 'Drag to orbit · scroll to approach · right-drag / two fingers to pan';
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
}

document.addEventListener('click', async event => {
  const button = event.target.closest('button[data-command]'); if (!button) return;
  const { command, value } = button.dataset; const instant = event.detail === 0 || reduced.matches;
  if (['enter', 'view', 'mode', 'reset'].includes(command)) stopTour();
  if (command === 'enter') { update({ entered: true }); $('#scene-root canvas')?.focus({ preventScroll: true }); }
  if (command === 'view') go(value, instant);
  if (command === 'mode' && ['walk', 'orbit'].includes(value)) { update({ mode: value, entered: true, instant }); $('#scene-root canvas')?.focus({ preventScroll: true }); }
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
$('#quality')?.addEventListener('change', event => { if (['low', 'balanced', 'high'].includes(event.target.value)) update({ quality: event.target.value }); });
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
window.pennStation = Object.freeze({ getState: () => ({ ...state }), getCamera: () => debugCamera ? { position: debugCamera.position.toArray(), fov: debugCamera.fov } : null, getMetrics: () => debugRenderer ? { calls: debugRenderer.info.render.calls, triangles: debugRenderer.info.render.triangles, geometries: debugRenderer.info.memory.geometries, textures: debugRenderer.info.memory.textures } : null });
syncUI(); createRoot($('#scene-root')).render(<Viewer />);
