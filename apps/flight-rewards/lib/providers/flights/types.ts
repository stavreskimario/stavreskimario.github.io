import type { FlightItinerary, SearchQuery } from "../../types";
export interface FlightProvider {
  search(
    query: SearchQuery,
  ): Promise<{ itineraries: FlightItinerary[]; notices: string[] }>;
}
export function physicalKey(itinerary: FlightItinerary): string {
  return itinerary.segments
    .map((s) =>
      [
        s.slice,
        s.origin.iata,
        s.destination.iata,
        s.operatingAirline.code,
        s.operatingFlightNumber ?? s.flightNumber,
        s.departureTime,
        s.cabin,
      ].join(":"),
    )
    .join("|");
}
export function matchesQuery(
  itinerary: FlightItinerary,
  q: SearchQuery,
): boolean {
  const slices = [...new Set(itinerary.segments.map((s) => s.slice))];
  return (
    slices.every(
      (slice) =>
        itinerary.segments.filter((s) => s.slice === slice).length - 1 <=
        (q.directOnly ? 0 : q.maxStops),
    ) &&
    itinerary.segments.every(
      (s) => !q.excludedAirlines.includes(s.operatingAirline.code),
    ) &&
    (!q.preferredAirlines.length ||
      itinerary.segments.every((s) =>
        q.preferredAirlines.includes(s.operatingAirline.code),
      ))
  );
}
