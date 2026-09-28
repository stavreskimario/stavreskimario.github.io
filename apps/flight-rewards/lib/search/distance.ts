import type { Airport, FlightSegment } from "../types";
/** Mean Earth radius expressed in statute miles; retain precision until a chart lookup. */
export function milesBetween(a: Airport, b: Airport): number {
  const rad = Math.PI / 180;
  const dlat = (b.latitude - a.latitude) * rad,
    dlon = (b.longitude - a.longitude) * rad;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(a.latitude * rad) *
      Math.cos(b.latitude * rad) *
      Math.sin(dlon / 2) ** 2;
  return 3958.7613 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}
export const segmentMiles = (segments: FlightSegment[]) =>
  segments.reduce((sum, s) => sum + milesBetween(s.origin, s.destination), 0);
/** Provider local timestamps deliberately remain local in the canonical model. */
export function localToEpoch(value: string, timezone: string): number {
  if (/[zZ]$|[+-]\d\d:\d\d$/.test(value)) return Date.parse(value);
  const target = Date.parse(value + "Z");
  if (!Number.isFinite(target)) return NaN;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let result = target;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(
      fmt.formatToParts(new Date(result)).map((x) => [x.type, x.value]),
    );
    const represented = Date.parse(
      `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`,
    );
    result += target - represented;
  }
  return result;
}
export function isBreak(
  previous: FlightSegment,
  next: FlightSegment,
  domestic: boolean,
): boolean {
  if (
    previous.slice !== next.slice ||
    previous.destination.iata !== next.origin.iata
  )
    return true;
  if (next.connectionBefore) return next.connectionBefore === "stopover";
  if (!previous.arrivalTime || !next.departureTime) return true; // unknown connection: conservatively price separately
  if (domestic)
    return (
      previous.arrivalTime.slice(0, 10) !== next.departureTime.slice(0, 10)
    );
  const hours =
    (localToEpoch(next.departureTime, next.origin.timezone) -
      localToEpoch(previous.arrivalTime, previous.destination.timezone)) /
    3600000;
  return !Number.isFinite(hours) || hours < 0 || hours > 24;
}
