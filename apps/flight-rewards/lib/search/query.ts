import airportData from "../../data/airports.json";
import { airlines } from "../loyalty/catalog";
import { cabins, type Airport, type SearchQuery } from "../types";
export const airports = airportData as Airport[];
export const airportByCode: Record<string, Airport> = Object.fromEntries(
  airports.map((a) => [a.iata, a]),
);
export function today(): string {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Australia/Melbourne",
  });
}
export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function validDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function validateQuery(input: unknown): SearchQuery {
  if (!input || typeof input !== "object")
    throw new Error("Enter your route and travel dates.");
  const q = input as SearchQuery;
  if (!airportByCode[q.origin] || !airportByCode[q.destination])
    throw new Error(
      "Choose an airport from the list, using its three-letter code.",
    );
  if (q.origin === q.destination)
    throw new Error("Choose different departure and destination airports.");
  if (
    !validDate(q.departureDate) ||
    q.departureDate < today() ||
    q.departureDate > shiftDate(today(), 365)
  )
    throw new Error("Choose a departure date within the next 365 days.");
  if (
    q.returnDate !== null &&
    (!validDate(q.returnDate) ||
      q.returnDate < q.departureDate ||
      q.returnDate > shiftDate(today(), 365))
  )
    throw new Error(
      "Return must be on or after departure and within the next 365 days.",
    );
  if (!Number.isInteger(q.passengers) || q.passengers < 1 || q.passengers > 9)
    throw new Error("Choose between 1 and 9 adult travellers.");
  if (
    !cabins.includes(q.cabin) ||
    !Number.isInteger(q.maxStops) ||
    q.maxStops < 0 ||
    q.maxStops > 2 ||
    ![0, 3].includes(q.flexDays) ||
    typeof q.directOnly !== "boolean"
  )
    throw new Error("Check your cabin, stops and flexible-date settings.");
  for (const list of [q.preferredAirlines, q.excludedAirlines])
    if (
      !Array.isArray(list) ||
      list.length > 12 ||
      list.some((c) => !airlines.some((a) => a.code === c))
    )
      throw new Error("Choose supported airlines from the list.");
  if (q.preferredAirlines.some((c) => q.excludedAirlines.includes(c)))
    throw new Error("An airline cannot be both preferred and excluded.");
  return {
    origin: q.origin,
    destination: q.destination,
    departureDate: q.departureDate,
    returnDate: q.returnDate,
    passengers: q.passengers,
    cabin: q.cabin,
    directOnly: q.directOnly,
    maxStops: q.maxStops,
    flexDays: q.flexDays,
    preferredAirlines: [...new Set(q.preferredAirlines)].sort(),
    excludedAirlines: [...new Set(q.excludedAirlines)].sort(),
  };
}
export function flexibleQueries(q: SearchQuery): SearchQuery[] {
  const offsets = q.flexDays ? [-3, -2, -1, 0, 1, 2, 3] : [0];
  // Return dates move together: a constant trip length, clearly labelled in the UI.
  return offsets
    .map((n) => ({
      ...q,
      flexDays: 0 as const,
      departureDate: shiftDate(q.departureDate, n),
      returnDate: q.returnDate ? shiftDate(q.returnDate, n) : null,
    }))
    .filter(
      (x) =>
        x.departureDate >= today() &&
        (x.returnDate ?? x.departureDate) <= shiftDate(today(), 365),
    );
}
