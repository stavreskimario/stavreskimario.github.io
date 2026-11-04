// Finite contact across a numerical floor joint, after the central ray missed.
// Probe only 0.1 mm each way; actual surfaces on both sides must agree. This
// never supplies a fallback plane or extends support into a real void/edge.
export function findFloorJointSupport(point, floor, probe) {
  if (!Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite) || !Number.isFinite(floor)) return null;
  const offset = .0001;
  const validHits = position => (probe(position) || []).filter(hit =>
    Number.isFinite(hit.height) && Number.isFinite(hit.normalY) &&
    hit.normalY > .98 && hit.height <= floor + .24 && hit.height >= floor - .35);
  for (const axis of [0, 2]) {
    const before = [point[0], floor, point[2]], after = [...before];
    before[axis] -= offset; after[axis] += offset;
    const left = validHits(before), right = validHits(after);
    for (const a of left) for (const b of right) {
      if (Math.abs(a.height - b.height) > .002) continue;
      // Return a sampled surface, never an average/interpolated height.
      const actual = Math.abs(a.height - floor) <= Math.abs(b.height - floor) ? a : b;
      return { height: actual.height, axis: axis === 0 ? 'x' : 'z', offset,
        samples: [{ position: before, height: a.height, normalY: a.normalY },
          { position: after, height: b.height, normalY: b.normalY }] };
    }
  }
  return null;
}
