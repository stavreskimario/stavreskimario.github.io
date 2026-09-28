import type { FlightItinerary, FlightSegment } from "../types";
import { isBreak, segmentMiles } from "../search/distance";
import { findChart, lookup, type PriceResult } from "./charts";
function group(s: FlightSegment): string | null {
  switch (s.operatingAirline.code) {
    case "UA":
      return "united";
    case "SQ":
    case "QR":
      return "singapore-qatar";
    case "AC":
    case "NH":
      return "air-canada-ana";
    case "VA":
      if ([s.origin.iata, s.destination.iata].includes("DOH")) return null; // Special region-based VA/QR rules, never short-haul table.
      if (s.origin.country === "AU" && s.destination.country === "AU")
        return "va-domestic";
      // The bundled airport set only covers VA short-haul markets in AU, NZ and ID.
      if (
        [s.origin.country, s.destination.country].every((c) =>
          ["AU", "NZ", "ID"].includes(c),
        )
      )
        return "va-short";
      return null;
    default:
      return null;
  }
}
export function velocityPrice(
  itinerary: FlightItinerary,
  bookingDate: string,
): PriceResult {
  const noQuote = (note: string): PriceResult => ({
    minimum: null,
    maximum: null,
    versions: [],
    notes: [note],
  });
  for (const s of itinerary.segments) {
    if (s.operatingAirline.code !== s.marketingAirline.code)
      return noQuote(
        "Codeshare and Virgin Australia/Doha special pricing require a Velocity quote.",
      );
    if (s.cabin === "premium_economy" && s.operatingAirline.code !== "SQ")
      return noQuote(
        "The published Velocity premium-economy reward eligibility is limited to Singapore Airlines and Virgin Atlantic. No estimate is supplied for this carrier.",
      );
    if (
      s.operatingAirline.code === "SQ" &&
      (s.cabin === "first" ||
        [s.origin.country, s.destination.country].some(
          (c) => c === "CN" || c === "HK",
        ))
    )
      return noQuote(
        "Velocity currently excludes Singapore Airlines First rewards and Singapore Airlines flights to/from China and Hong Kong.",
      );
    if (!group(s))
      return noQuote(
        "This itinerary uses special reward rules that require a quote from Velocity.",
      );
  }
  const domestic = itinerary.segments.every(
    (s) => s.origin.country === "AU" && s.destination.country === "AU",
  );
  const groups: FlightSegment[][] = [];
  for (const segment of itinerary.segments) {
    const trip = groups.at(-1),
      previous = trip?.at(-1);
    if (
      !trip ||
      !previous ||
      isBreak(previous, segment, domestic) ||
      group(previous) !== group(segment) ||
      previous.cabin !== segment.cabin
    )
      groups.push([segment]);
    else trip.push(segment);
  }
  let minimum = 0,
    maximum = 0;
  const versions = new Set<string>();
  for (const trip of groups) {
    const chart = findChart("velocity", group(trip[0])!, bookingDate);
    if (!chart)
      return noQuote("No verified Velocity chart covers this booking date.");
    const price = lookup(chart, segmentMiles(trip), trip[0].cabin);
    if (!price)
      return noQuote(
        "Cabin or distance is outside the verified Velocity chart.",
      );
    versions.add(chart.id);
    minimum += price.minimum;
    maximum += price.maximum;
  }
  const notes = [
    "Velocity adds the flown miles for connections within the same table and cabin. Stopovers, table changes and cabin changes are priced separately.",
    `${groups.length} separately priced journey${groups.length === 1 ? "" : "s"}. Airline mileage and route eligibility must be confirmed at booking.`,
  ];
  if (maximum !== minimum)
    notes.push(
      "Virgin Australia domestic economy has variable reward pricing. Both ends of the published range are shown.",
    );
  return {
    minimum: minimum * itinerary.passengers,
    maximum: maximum * itinerary.passengers,
    versions: [...versions],
    notes,
  };
}
