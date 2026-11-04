// A foot spans a centimetre-scale rounded tread nose. Quantized nosing faces
// can be steeper than the tread even when its flat is only millimetres away.
// This samples real neighbouring tread geometry; it never supplies a plane.
export function insideStairFlight(point, flight) {
  const dx = flight.end[0] - flight.start[0], dz = flight.end[2] - flight.start[2];
  const lengthSquared = dx * dx + dz * dz;
  if (!lengthSquared || !(flight.width > 0)) return false;
  const px = point[0] - flight.start[0], pz = point[2] - flight.start[2];
  const along = (px * dx + pz * dz) / lengthSquared;
  const across = Math.abs(px * dz - pz * dx) / Math.sqrt(lengthSquared);
  return along >= 0 && along <= 1 && across <= flight.width / 2;
}

export function findStairBevelSupport(point, floor, centralHits, flights, probe) {
  const flight = flights.find(item => insideStairFlight(point, item));
  if (!flight) return null;
  const dx = flight.end[0] - flight.start[0], dz = flight.end[2] - flight.start[2];
  const run = Math.hypot(dx, dz);
  const along = ((point[0] - flight.start[0]) * dx + (point[2] - flight.start[2]) * dz) / (run * run);
  const expectedHeight = flight.start[1] + along * (flight.end[1] - flight.start[1]);
  if (!Number.isFinite(expectedHeight)) return null;
  for (const central of centralHits) {
    const normal = central.normalY;
    if (!(normal > .05 && normal <= .5) || central.height > floor + .24 || central.height < floor - .35 || Math.abs(central.height - expectedHeight) > .20) continue;
    for (const offset of [.01, -.01, .02, -.02]) {
      const neighbour = [point[0] + offset * dx / run, point[1], point[2] + offset * dz / run];
      if (!insideStairFlight(neighbour, flight)) continue;
      for (const support of probe(neighbour)) {
        if (support.normalY < .98 || Math.abs(support.height - central.height) > .025 || support.height > floor + .24 || support.height < floor - .35) continue;
        return { height: support.height, offset, sample: [neighbour[0], support.height, neighbour[2]], flight: flight.label };
      }
    }
  }
  return null;
}
