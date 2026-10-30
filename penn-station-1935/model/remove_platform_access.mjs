// Remove only reviewed old platform-access surfaces from material batches.
// Positions, UVs, normals and existing BIN/view payloads are never re-encoded.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {parseGlb, decodeView, MeshoptEncoder} from './meshopt_patch_io.mjs';
import {writeGlb} from '../asset_io.mjs';

const requireTools = createRequire(path.join(process.env.PENN_TOOLS || '/private/tmp/penn-station-tools', 'package.json'));
const {Matrix4, Quaternion, Vector3, BufferGeometry, BufferAttribute} = requireTools('three');
const {MeshBVH} = requireTools('three-mesh-bvh');
const allowed = new Set(['Travertine', 'PublicFloorMarble', 'AgedBronze', 'PaintedStructuralIron', 'ClockFace']);
const circulationAllowed = new Set(['BedfordLimestoneConcourse', 'PaintedStructuralIron']);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const sizes = {5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
const methods = {5120:'getInt8',5121:'getUint8',5122:'getInt16',5123:'getUint16',5125:'getUint32',5126:'getFloat32'};
const widths = {SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16};
function materialName(material, permitted=allowed) {
  if (material?.name?.startsWith('REMOVAL_')) {
    const original = material.extras?.original_material_name;
    assert(permitted.has(original) && material.name === `REMOVAL_${original}`, 'Removal material must declare its exact original name');
    return original;
  }
  return material?.name;
}

function readers(model) {
  const views = new Map(), access = new Map();
  return index => {
    if (access.has(index)) return access.get(index);
    const a = model.json.accessors[index];
    assert(a && !a.sparse, 'Sparse or absent accessors are outside the removal contract');
    const view = model.json.bufferViews[a.bufferView];
    assert(view, 'Accessor requires a buffer view');
    if (!views.has(a.bufferView)) {
      if (view.extensions?.EXT_meshopt_compression) views.set(a.bufferView, decodeView(model, a.bufferView));
      else {
        assert.equal(view.buffer ?? 0, 0, 'Raw accessor must use embedded BIN0');
        views.set(a.bufferView, model.binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength));
      }
    }
    const bytes = views.get(a.bufferView), data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const n = widths[a.type], size = sizes[a.componentType], method = methods[a.componentType];
    assert(n && size && method, 'Unsupported accessor layout');
    const stride = view.byteStride || n * size;
    const divisor = a.normalized ? ({5120:127,5121:255,5122:32767,5123:65535})[a.componentType] : 1;
    assert(divisor, 'Unsupported integer normalization');
    const read = i => {
      assert(Number.isInteger(i) && i >= 0 && i < a.count, 'Accessor index outside its range');
      return Array.from({length:n}, (_, k) => {
        const value = data[method]((a.byteOffset || 0) + i * stride + k * size, true) / divisor;
        return a.normalized && (a.componentType === 5120 || a.componentType === 5122) ? Math.max(-1, value) : value;
      });
    };
    access.set(index, read); return read;
  };
}

function activeNodes(json) {
  const nodes = [], seen = new Set();
  const roots = json.scenes?.[json.scene ?? 0]?.nodes;
  assert(roots, 'A declared active scene is required');
  function visit(index, parent) {
    assert(!seen.has(index), 'Active hierarchy must be acyclic with one parent');
    const node = json.nodes[index]; assert(node, 'Missing scene node'); seen.add(index);
    const local = node.matrix ? new Matrix4().fromArray(node.matrix) : new Matrix4().compose(
      new Vector3().fromArray(node.translation || [0,0,0]),
      new Quaternion().fromArray(node.rotation || [0,0,0,1]),
      new Vector3().fromArray(node.scale || [1,1,1]));
    const matrix = parent.clone().multiply(local);
    nodes.push({index, node, matrix});
    for (const child of node.children || []) visit(child, matrix);
  }
  for (const root of roots) visit(root, new Matrix4());
  return nodes;
}

function* primitives(model, materialFilter, permitted=allowed) {
  const read = readers(model);
  for (const {index:nodeIndex, node, matrix} of activeNodes(model.json)) {
    if (node.mesh === undefined) continue;
    const mesh = model.json.meshes[node.mesh]; assert(mesh, 'Missing mesh');
    for (const [primitiveIndex, primitive] of mesh.primitives.entries()) {
      const material = materialName(model.json.materials?.[primitive.material],permitted);
      if (materialFilter && !materialFilter.has(material)) continue;
      assert(node.skin === undefined && !node.extensions?.EXT_mesh_gpu_instancing, 'Owned batches must not be skinned or instanced');
      assert.equal(primitive.mode ?? 4, 4, 'Owned surfaces must be triangle lists');
      assert(!primitive.targets && !primitive.extensions, 'Owned primitive morph/extensions require separate review');
      const position = read(primitive.attributes.POSITION), index = primitive.indices === undefined ? i => [i] : read(primitive.indices);
      const count = model.json.accessors[primitive.indices ?? primitive.attributes.POSITION].count;
      assert.equal(count % 3, 0, 'Incomplete triangle indices');
      const order = matrix.determinant() < 0 ? [0,2,1] : [0,1,2];
      yield {node:nodeIndex, mesh:node.mesh, primitive:primitiveIndex, descriptor:primitive, material, count,
        triangle: offset => order.map(k => new Vector3().fromArray(position(index(offset + k)[0])).applyMatrix4(matrix)),
        indices: offset => [index(offset)[0], index(offset+1)[0], index(offset+2)[0]]};
    }
  }
}

function normal(triangle) {
  return new Vector3().subVectors(triangle[1], triangle[0]).cross(new Vector3().subVectors(triangle[2], triangle[0])).normalize();
}
function samples(triangle) {
  const [a,b,c] = triangle;
  return [a,b,c,a.clone().add(b).multiplyScalar(.5),b.clone().add(c).multiplyScalar(.5),c.clone().add(a).multiplyScalar(.5),a.clone().add(b).add(c).multiplyScalar(1/3)];
}
function surface(triangles) {
  if (!triangles.length) return null;
  const positions = new Float32Array(triangles.length * 9);
  triangles.forEach((t, i) => t.forEach((p, k) => p.toArray(positions, i*9+k*3)));
  const geometry = new BufferGeometry(); geometry.setAttribute('position', new BufferAttribute(positions, 3));
  const bvh = new MeshBVH(geometry, {indirect:true, maxLeafTris:8});
  const normals = triangles.map(normal), target = {point:new Vector3()};
  return {
    bvh, geometry, count:triangles.length,
    nearest(point, tolerance, requiredNormal = null, normalCosine = -1) {
      const hit = bvh.closestPointToPoint(point, target, 0, tolerance);
      if (!hit || hit.distance > tolerance) return null;
      // closestPointToPoint uses shapecast(), whose triangle callback already
      // resolves indirect BVH indices back to the geometry's original faces.
      if (!requiredNormal || requiredNormal.dot(normals[hit.faceIndex]) >= normalCosine) return {distance:hit.distance, normal:normals[hit.faceIndex]};
      // At a quantized bevel edge the closest face can be its perpendicular
      // neighbour. Require an oriented face within the SAME tolerance rather
      // than widening the positional bound or discarding the normal control.
      let best = null; const near = new Vector3();
      bvh.shapecast({
        intersectsBounds:box => box.distanceToPoint(point) <= tolerance,
        intersectsTriangle:(triangle, index) => {
          if (requiredNormal.dot(normals[index]) < normalCosine) return false;
          triangle.closestPointToPoint(point, near); const distance = near.distanceTo(point);
          if (distance <= tolerance && (!best || distance < best.distance)) best = {distance,normal:normals[index]};
          return false;
        }
      });
      return best;
    }
  };
}
function groupedSurfaces(model, filter, offsetY = 0, permitted=allowed) {
  const groups = new Map();
  for (const p of primitives(model, filter,permitted)) {
    if (!groups.has(p.material)) groups.set(p.material, []);
    const list = groups.get(p.material);
    for (let i = 0; i < p.count; i += 3) list.push(p.triangle(i).map(v => v.add(new Vector3(0, offsetY, 0))));
  }
  return new Map([...groups].map(([name, triangles]) => [name, {triangles, surface:surface(triangles)}]));
}
function match(triangle, source, tolerance, normalCosine, detail = {}) {
  if (!source) return null;
  const points = samples(triangle), n = normal(triangle);
  let worst = 0;
  for (const [i, point] of points.entries()) {
    const hit = source.nearest(point, tolerance, i === 6 && n.lengthSq() ? n : null, normalCosine);
    if (!hit) {
      if (i === 6 && source.nearest(point, tolerance)) detail.orientationOnly = true;
      return null;
    }
    worst = Math.max(worst, hit.distance);
  }
  return worst;
}
function ranges(numbers) {
  const result = [];
  for (const n of numbers) {
    const last = result.at(-1);
    if (last && n === last[1]+1) last[1] = n;
    else result.push([n,n]);
  }
  return result;
}
function validateRaw(model, label, owned, permitted=allowed) {
  assert.equal(model.json.buffers.length, 1, `${label} must be raw embedded geometry`);
  for (const key of ['images','textures','skins','animations','cameras']) assert.equal(model.json[key]?.length || 0, 0, `${label} must not introduce ${key}`);
  assert(!model.json.extensionsUsed?.includes('EXT_meshopt_compression'), `${label} must be the original raw surface authority`);
  assert(!model.json.extensions, `${label} must not contain live lights/root extensions`);
  if (owned) for (const p of primitives(model,undefined,permitted)) assert(permitted.has(p.material), `Unreviewed old-access material: ${p.material}`);
}

export function removePlatformAccess(base, components, protectedModel, {tolerance=.004, normalCosine=.90, sourceOffsetY=0, minimumCoverage=.98, scope='departure-access'} = {}) {
  assert(['departure-access','concourse-circulation'].includes(scope),'Unreviewed component removal scope');
  const permitted=scope==='concourse-circulation'?circulationAllowed:allowed;
  assert(tolerance > 0 && tolerance <= .006, 'Removal tolerance must be positive and at most6mm');
  assert(normalCosine >= .85 && normalCosine <= 1, 'Normals must preserve oriented surface agreement');
  assert(minimumCoverage >= .98 && minimumCoverage <= 1, 'Owned-surface coverage may not be weakened below98%');
  assert(Number.isFinite(sourceOffsetY), 'Source height offset must be finite');
  assert(base.json.extensionsUsed?.includes('EXT_meshopt_compression') && base.json.extensionsRequired?.includes('EXT_meshopt_compression'), 'Input must already require Meshopt decoding');
  validateRaw(components, 'Owned component export', true,permitted);
  validateRaw(protectedModel, 'Retained-neighbour export', false,permitted);
  const owned = groupedSurfaces(components, permitted, sourceOffsetY,permitted);
  assert(owned.size, 'No owned surfaces were exported');
  // Other materials cannot be selected for removal at all. Avoid expanding
  // millions of linked glass-prism instances into an irrelevant protection BVH.
  const protectedSurfaces = groupedSurfaces(protectedModel, new Set(owned.keys()), sourceOffsetY,permitted);
  const json = structuredClone(base.json), plans = new Map(), meshReferenceCounts = new Map();
  for (const node of base.json.nodes) if (node.mesh !== undefined) meshReferenceCounts.set(node.mesh, (meshReferenceCounts.get(node.mesh)||0)+1);
  const materials = Object.fromEntries([...owned].map(([name, value]) => [name, {sourceTriangles:value.triangles.length, examined:0, removed:0, protectedAmbiguous:0, quantizedSliversRemoved:0, quantizedSliverArea:0, maximumSliverAltitude:0, orientationOnlyRetained:0, orientationOnlyArea:0, maximumOrientationOnlyAltitude:0, maximumRemovalResidual:0, sourceCentroidsCovered:0, sourceCentroidsProtected:0}]));
  const removedGeometry = new Map(), protectedKept = new Map();
  for (const p of primitives(base, new Set(owned.keys()),permitted)) {
    assert.equal(meshReferenceCounts.get(p.mesh), 1, 'Shared meshes need per-instance ownership review, including inactive nodes');
    const keep = [], removed = [], ambiguous = [], stats = materials[p.material];
    for (let offset = 0; offset < p.count; offset += 3) {
      stats.examined++;
      const triangle = p.triangle(offset), detail = {};
      let residual = match(triangle, owned.get(p.material).surface, tolerance, normalCosine, detail), sliver = null;
      if (residual === null && detail.orientationOnly) {
        const twiceArea = new Vector3().subVectors(triangle[1],triangle[0]).cross(new Vector3().subVectors(triangle[2],triangle[0])).length();
        const longest = Math.max(triangle[0].distanceTo(triangle[1]),triangle[1].distanceTo(triangle[2]),triangle[2].distanceTo(triangle[0]));
        const altitude = longest ? twiceArea/longest : 0, bound = Math.min(tolerance,.004);
        // A face thinner than position quantization has no reliable geometric
        // normal. Every corner/edge/centroid must STILL match within4mm; the
        // protected competitor below vetoes removal regardless of orientation.
        if (altitude <= bound) {
          const positional = match(triangle,owned.get(p.material).surface,bound,-1);
          if (positional !== null) { residual = positional; sliver = {area:twiceArea/2,altitude}; }
        }
      }
      if (residual === null) {
        keep.push(...p.indices(offset));
        if (detail.orientationOnly) {
          stats.orientationOnlyRetained++;
          const twiceArea = new Vector3().subVectors(triangle[1],triangle[0]).cross(new Vector3().subVectors(triangle[2],triangle[0])).length();
          const longest = Math.max(triangle[0].distanceTo(triangle[1]),triangle[1].distanceTo(triangle[2]),triangle[2].distanceTo(triangle[0]));
          stats.orientationOnlyArea += twiceArea/2;
          stats.maximumOrientationOnlyAltitude = Math.max(stats.maximumOrientationOnlyAltitude,longest ? twiceArea/longest : 0);
        }
        continue;
      }
      const protection = match(triangle, protectedSurfaces.get(p.material)?.surface, tolerance, sliver ? -1 : normalCosine);
      if (protection !== null) {
        keep.push(...p.indices(offset)); ambiguous.push(offset/3); stats.protectedAmbiguous++;
        if (!protectedKept.has(p.material)) protectedKept.set(p.material, []);
        protectedKept.get(p.material).push(triangle); continue;
      }
      removed.push(offset/3); stats.removed++; stats.maximumRemovalResidual = Math.max(stats.maximumRemovalResidual, residual);
      if (sliver) { stats.quantizedSliversRemoved++; stats.quantizedSliverArea += sliver.area; stats.maximumSliverAltitude = Math.max(stats.maximumSliverAltitude,sliver.altitude); }
      if (!removedGeometry.has(p.material)) removedGeometry.set(p.material, []);
      removedGeometry.get(p.material).push(triangle);
    }
    if (removed.length) plans.set(`${p.mesh}:${p.primitive}`, {...p, keep, removed, ambiguous});
  }
  assert(plans.size, 'No current geometry matches the owned component export');
  for (const [name, group] of owned) {
    const stats = materials[name]; assert(stats.removed > 0, `No owned ${name} surfaces removed`);
    const removed = surface(removedGeometry.get(name)||[]), protectedSource = surface(protectedKept.get(name)||[]);
    for (const triangle of group.triangles) {
      const centre = samples(triangle)[6];
      if (removed?.nearest(centre, tolerance)) stats.sourceCentroidsCovered++;
      else if (protectedSource?.nearest(centre, tolerance)) stats.sourceCentroidsProtected++;
    }
    stats.sourceCentroidCoverage = (stats.sourceCentroidsCovered+stats.sourceCentroidsProtected)/stats.sourceTriangles;
    assert(stats.sourceCentroidCoverage >= minimumCoverage, `Unexplained old ${name} surfaces: ${JSON.stringify(stats)}`);
    assert.equal(stats.orientationOnlyRetained,0,`Unresolved oriented old ${name} surfaces remain`);
  }
  const chunks = [base.binary], changes = [], detachedNodes = [];
  const oldBufferCount = json.buffers.length;
  let fallbackBuffer = null, size = base.binary.length, decodedIndexBytes = 0;
  function appendIndices(values) {
    if (fallbackBuffer === null) {
      fallbackBuffer = json.buffers.length;
      json.buffers.push({byteLength:0,extensions:{EXT_meshopt_compression:{fallback:true}}});
    }
    const max = values.reduce((a,b) => Math.max(a,b), 0), componentType = max <= 65535 ? 5123 : 5125, width = componentType === 5123 ? 2 : 4;
    const bytes = Buffer.alloc(values.length*width); values.forEach((v,i) => width === 2 ? bytes.writeUInt16LE(v,i*2) : bytes.writeUInt32LE(v,i*4));
    const encoded = Buffer.from(MeshoptEncoder.encodeGltfBuffer(bytes,values.length,width,'INDICES'));
    const bufferView = json.bufferViews.length, byteOffset = size; chunks.push(encoded); size += encoded.length;
    const padding = (4-size%4)%4; if (padding) { chunks.push(Buffer.alloc(padding)); size += padding; }
    json.bufferViews.push({buffer:fallbackBuffer,byteOffset:decodedIndexBytes,byteLength:bytes.length,target:34963,
      extensions:{EXT_meshopt_compression:{buffer:0,byteOffset,byteLength:encoded.length,count:values.length,byteStride:width,mode:'INDICES'}}});
    decodedIndexBytes += bytes.length; decodedIndexBytes += (4-decodedIndexBytes%4)%4;
    const accessor = json.accessors.length;
    json.accessors.push({bufferView,componentType,count:values.length,type:'SCALAR'});
    return accessor;
  }
  for (const [meshIndex, mesh] of json.meshes.entries()) {
    const kept = [];
    for (const [primitiveIndex, primitive] of mesh.primitives.entries()) {
      const plan = plans.get(`${meshIndex}:${primitiveIndex}`);
      if (!plan) { kept.push(primitive); continue; }
      if (plan.keep.length) kept.push({...primitive,indices:appendIndices(plan.keep)});
      changes.push({mesh:meshIndex,primitive:primitiveIndex,node:plan.node,material:plan.material,beforeTriangles:plan.count/3,removedTriangles:plan.removed.length,remainingTriangles:plan.keep.length/3,removedTriangleRanges:ranges(plan.removed),protectedAmbiguousTriangleRanges:ranges(plan.ambiguous)});
    }
    if (kept.length) mesh.primitives = kept;
    else {
      // Leave the original now-unused mesh valid and keep every other mesh
      // index stable. Only bindings to fully owned old geometry are detached.
      for (const [index,node] of json.nodes.entries()) if (node.mesh === meshIndex) { delete node.mesh; detachedNodes.push({node:index,mesh:meshIndex}); }
    }
  }
  json.buffers[0].byteLength = size;
  if (fallbackBuffer !== null) json.buffers[fallbackBuffer].byteLength = decodedIndexBytes;
  const binary = Buffer.concat(chunks); assert(binary.subarray(0,base.binary.length).equals(base.binary));
  for (const key of ['materials','images','textures','samplers','scenes','extensionsUsed','extensionsRequired']) assert.deepEqual(json[key],base.json[key], `Unrelated ${key} must remain exact`);
  assert.deepEqual(json.buffers.slice(1,oldBufferCount),base.json.buffers.slice(1),'Existing fallback buffers must stay exact');
  assert.deepEqual(json.bufferViews.slice(0,base.json.bufferViews.length),base.json.bufferViews,'Existing view payloads must stay exact');
  assert.deepEqual(json.accessors.slice(0,base.json.accessors.length),base.json.accessors,'Existing accessors must stay exact');
  for (let i=0;i<json.nodes.length;i++) {
    const expected=structuredClone(base.json.nodes[i]); if(detachedNodes.some(n=>n.node===i)) delete expected.mesh;
    assert.deepEqual(json.nodes[i],expected,'Unrelated node payloads must stay exact');
  }
  const report = {scope:'Owned reviewed-component surfaces only; protected coincident faces retained. Original attributes, materials, transforms and BIN prefix preserved.',removalScope:scope,toleranceMetres:tolerance,normalCosine,minimumCoverage,sourceOffsetY,materials,changes,detachedNodes,unchangedBinaryPrefixBytes:base.binary.length,unchangedBinaryPrefixSha256:sha(base.binary),removedTriangles:changes.reduce((n,c)=>n+c.removedTriangles,0),protectedAmbiguousTriangles:Object.values(materials).reduce((n,s)=>n+s.protectedAmbiguous,0),indexEncoding:'EXT_meshopt_compression INDICES (sequence-preserving)',appendedVirtualBuffer:fallbackBuffer,decodedIndexBytes,appendedIndexBytes:size-base.binary.length};
  return {json,binary,report};
}

async function main() {
  const args = {};
  for (let i=2;i<process.argv.length;i+=2) {
    assert(['--input','--components','--protected','--out','--report','--tolerance','--source-y','--minimum-coverage','--scope'].includes(process.argv[i]) && process.argv[i+1], 'Expected named removal arguments');
    args[process.argv[i].slice(2)] = process.argv[i+1];
  }
  for (const key of ['input','components','protected','out','report']) assert(args[key], `Missing${key}`);
  for (const key of ['input','components','protected']) assert.notEqual(path.resolve(args[key]),path.resolve(args.out),'Keep immutable inputs');
  for (const key of ['input','components','protected','out']) assert.notEqual(path.resolve(args[key]),path.resolve(args.report),'Report must not overwrite geometry inputs or output');
  const [input,components,protectedBytes] = await Promise.all([readFile(args.input),readFile(args.components),readFile(args.protected)]);
  const result = removePlatformAccess(parseGlb(input),parseGlb(components),parseGlb(protectedBytes),{
    tolerance:Number(args.tolerance ?? .004),sourceOffsetY:Number(args['source-y'] ?? 0),minimumCoverage:Number(args['minimum-coverage'] ?? .98),scope:args.scope??'departure-access'});
  const bytes = writeGlb(result.json,result.binary), output = args.out.endsWith('.gz') ? gzipSync(bytes,{level:9}) : bytes;
  const report = {...result.report,inputSha256:sha(input),componentsSha256:sha(components),protectedSha256:sha(protectedBytes),decodedOutputSha256:sha(bytes),outputSha256:sha(output)};
  await mkdir(path.dirname(path.resolve(args.out)),{recursive:true}); await mkdir(path.dirname(path.resolve(args.report)),{recursive:true});
  await writeFile(args.out,output); await writeFile(args.report,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({removedTriangles:report.removedTriangles,protectedAmbiguousTriangles:report.protectedAmbiguousTriangles,materials:report.materials,report:args.report}));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
