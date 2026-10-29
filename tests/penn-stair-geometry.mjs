// Actual decoded triangle support across all nine train-stair heads. A negative
// control directory can point at the released Phase3 assets to reproduce gaps.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseGlb, decodeView } from '../penn-station-1935/model/meshopt_patch_io.mjs';
const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const root = process.env.PENN_GEOMETRY_ASSETS || path.join(repo, 'penn-station-1935/assets');
const reportPath = process.env.PENN_STAIR_GEOMETRY_REPORT;
const head = -42.2563;
const centres = [68.764528, 54.791453, 40.818378, 27.149065, 13.327870, -.341443, -13.555112, -27.224425, -40.321460];
const report = { created: new Date().toISOString(), input: root, variants: [], limitation: 'Scoped main-floor-to-first-tread support check. Complete multi-level walking and collision checks are separate.' };
async function modelFor(name) {
  try { return parseGlb(await readFile(path.join(root, name))); }
  catch (e) { if (e.code !== 'ENOENT') throw e; return parseGlb(await readFile(path.join(root, name + '.gz'))); }
}
function triangleSupport(triangles, x, z) {
  let height = -Infinity;
  for (const [a, b, c] of triangles) {
    const denom = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]);
    if (Math.abs(denom) < 1e-10) continue;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / denom;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / denom;
    if (u >= -1e-6 && v >= -1e-6 && u + v <= 1.000001) height = Math.max(height, u * a[1] + v * b[1] + (1 - u - v) * c[1]);
  }
  return height;
}
for (const suffix of ['', '-low']) {
  const name = `model-concourse${suffix}.glb`; const model = await modelFor(name);
  const cache = new Map();
  const accessor = index => {
    const a = model.json.accessors[index]; const view = model.json.bufferViews[a.bufferView];
    if (!cache.has(a.bufferView)) cache.set(a.bufferView, decodeView(model, a.bufferView));
    const bytes = cache.get(a.bufferView); const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const sizes = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
    const components = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const get = { 5120: 'getInt8', 5121: 'getUint8', 5122: 'getInt16', 5123: 'getUint16', 5125: 'getUint32', 5126: 'getFloat32' }[a.componentType];
    const normalizer = a.normalized ? { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 }[a.componentType] : 1;
    const stride = view.byteStride || components * sizes[a.componentType];
    return i => Array.from({ length: components }, (_, j) => data[get]((a.byteOffset || 0) + i * stride + j * sizes[a.componentType], true) / normalizer);
  };
  const triangles = [];
  for (const node of model.json.nodes) {
    if (node.mesh === undefined || node.rotation || node.matrix) continue;
    const scale = node.scale || [1, 1, 1]; const translation = node.translation || [0, 0, 0];
    for (const p of model.json.meshes[node.mesh].primitives) {
      const material = model.json.materials[p.material]?.name;
      if (!['PublicFloorMarble', 'Travertine'].includes(material)) continue;
      const pos = accessor(p.attributes.POSITION); const index = accessor(p.indices);
      for (let i = 0; i < model.json.accessors[p.indices].count; i += 3) {
        const triangle = [0, 1, 2].map(j => pos(index(i + j)[0]).map((v, k) => v * scale[k] + translation[k]));
        if (triangle.some(v => v[1] < -.08 || v[1] > .03)) continue;
        if (Math.max(...triangle.map(v => v[0])) < head - .1 || Math.min(...triangle.map(v => v[0])) > head + .2) continue;
        const [a, b, c] = triangle;
        const up = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
        if (up <= 1e-9) continue;
        triangles.push(triangle);
      }
    }
  }
  const variant = { name, sampledTriangles: triangles.length, tested: 0, unsupported: [], minimumSupportedHeight: Infinity, stairs: [] };
  for (const z of centres) {
    let checks = 0; let failures = 0;
    for (const lane of [-.8, 0, .8]) for (let i = 0; i <= 50; i++) {
      const x = head - .05 + i * .005;
      const height = triangleSupport(triangles, x, z + lane);
      variant.tested++; checks++;
      if (!Number.isFinite(height) || height < -.05) {
        failures++; variant.unsupported.push({ x, z: z + lane, height: Number.isFinite(height) ? height : null });
      } else variant.minimumSupportedHeight = Math.min(variant.minimumSupportedHeight, height);
    }
    variant.stairs.push({ centreZ: z, checks, unsupported: failures });
  }
  report.variants.push(variant);
}
if (reportPath) { await mkdir(path.dirname(path.resolve(reportPath)), { recursive: true }); await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'); }
for (const variant of report.variants) assert.equal(variant.unsupported.length, 0, `${variant.name}: ${variant.unsupported.length}/${variant.tested} unsupported points at the stair heads`);
console.log(`PASS ${report.variants.reduce((n, item) => n + item.tested, 0)} triangle-support samples across nine stair heads, desktop and mobile.`);
