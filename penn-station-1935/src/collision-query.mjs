// Cell size is shared by the static index builder and finite ray queries.
export const COLLISION_CELL = 6;

// The grid supplies a conservative neighbourhood. Reject neighbours whose
// world bounds cannot meet the short ray's axis-aligned envelope before BVH
// raycasting them. The 1 mm allowance retains the existing vertical tolerance
// and cushions numerical joints; this never adds a floor or changes geometry.
// Diagonal rays may retain extra boxes, which is safe for the final raycast.
export function nearbyCollisionObjects(index, origin, direction, distance) {
  if (!index) return [];
  const endX = origin.x + direction.x * distance;
  const endY = origin.y + direction.y * distance;
  const endZ = origin.z + direction.z * distance;
  const startX = Math.min(origin.x, endX), stopX = Math.max(origin.x, endX);
  const startZ = Math.min(origin.z, endZ), stopZ = Math.max(origin.z, endZ);
  const minX = startX - .001, maxX = stopX + .001;
  const minY = Math.min(origin.y, endY) - .001;
  const maxY = Math.max(origin.y, endY) + .001;
  const minZ = startZ - .001, maxZ = stopZ + .001;
  const found = new Set();
  for (let x = Math.floor(startX / COLLISION_CELL); x <= Math.floor(stopX / COLLISION_CELL); x++) {
    for (let z = Math.floor(startZ / COLLISION_CELL); z <= Math.floor(stopZ / COLLISION_CELL); z++) {
      for (const record of index.cells.get(`${x}:${z}`) || []) {
        const bounds = record.bounds;
        if (bounds.max.y >= minY && bounds.min.y <= maxY &&
            bounds.max.x >= minX && bounds.min.x <= maxX &&
            bounds.max.z >= minZ && bounds.min.z <= maxZ) found.add(record.object);
      }
    }
  }
  index.stats.queries++;
  index.stats.lastCandidates = found.size;
  index.stats.maximumCandidates = Math.max(index.stats.maximumCandidates, found.size);
  return [...found];
}
