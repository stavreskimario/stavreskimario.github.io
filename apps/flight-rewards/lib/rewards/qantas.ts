import type { FlightItinerary, FlightSegment } from "../types";
import { cabins } from "../types";
import { isBreak, segmentMiles } from "../search/distance";
import { findChart, lookup, type PriceResult } from "./charts";
function group(s: FlightSegment, date: string): string {
  const airline = s.operatingAirline.code;
  if (airline === "EK")
    return date >= "2026-03-31"
      ? "emirates"
      : date >= "2025-08-05"
        ? "qantas"
        : "partner";
  return ["QF", "AA"].includes(airline) ? "qantas" : "partner";
}
/** Qantas Trips break on partner airline changes, stopovers and return boundaries. */
export function qantasPrice(
  itinerary: FlightItinerary,
  bookingDate: string,
): PriceResult {
  const notes = [
    "Qantas uses flown segment miles within each Trip, with separate pricing at stopovers and partner-airline changes.",
  ];
  const versions = new Set<string>();
  if (
    itinerary.segments.some(
      (s) => s.operatingAirline.code !== s.marketingAirline.code,
    )
  ) {
    return {
      minimum: null,
      maximum: null,
      versions: [],
      notes: [
        "Codeshare eligibility and applicable reward table need a Qantas quote.",
      ],
    };
  }
  const domestic = itinerary.segments.every(
    (s) => s.origin.country === "AU" && s.destination.country === "AU",
  );
  const groups: FlightSegment[][] = [];
  for (const segment of itinerary.segments) {
    const trip = groups.at(-1),
      previous = trip?.at(-1);
    const g = group(segment, bookingDate),
      prevG = previous && group(previous, bookingDate);
    const changedPartner =
      previous &&
      previous.operatingAirline.code !== segment.operatingAirline.code &&
      (g !== "qantas" || prevG !== "qantas");
    if (
      !trip ||
      !previous ||
      isBreak(previous, segment, domestic) ||
      g !== prevG ||
      changedPartner ||
      segmentMiles([...trip, segment]) > 15000
    )
      groups.push([segment]);
    else trip.push(segment);
  }
  let total = 0;
  for (const trip of groups) {
    const chart = findChart("qantas", group(trip[0], bookingDate), bookingDate);
    if (!chart)
      return {
        minimum: null,
        maximum: null,
        versions: [...versions],
        notes: ["No verified chart covers this booking date."],
      };
    versions.add(chart.id);
    const highest = trip.reduce(
      (best, s) =>
        cabins.indexOf(s.cabin) > cabins.indexOf(best) ? s.cabin : best,
      trip[0].cabin,
    );
    const through = lookup(chart, segmentMiles(trip), highest);
    // Clause 14.3.3: lower of highest cabin for the Trip or splitting at cabin changes.
    const byCabin: FlightSegment[][] = [];
    for (const s of trip) {
      if (byCabin.at(-1)?.[0].cabin === s.cabin) byCabin.at(-1)!.push(s);
      else byCabin.push([s]);
    }
    const split = byCabin.map((g) =>
      lookup(chart, segmentMiles(g), g[0].cabin),
    );
    if (!through || split.some((x) => !x))
      return {
        minimum: null,
        maximum: null,
        versions: [...versions],
        notes: ["Cabin or distance is outside the verified chart."],
      };
    total += Math.min(
      through.minimum,
      split.reduce((sum, x) => sum + x!.minimum, 0),
    );
  }
  if (itinerary.cabin === "mixed")
    notes.push(
      "Mixed cabins use the lower of highest-cabin Trip pricing and the sum at cabin changes.",
    );
  if (
    itinerary.segments.some(
      (s) => s.operatingAirline.code === "EK" && s.cabin === "first",
    )
  )
    notes.push(
      "Emirates First rewards require Qantas Silver or higher and passengers aged 9+. Eligibility is not checked here.",
    );
  notes.push(
    `${groups.length} separately priced Trip${groups.length === 1 ? "" : "s"}. Great-circle distances may differ from airline mileage; confirm the quote before booking.`,
  );
  return {
    minimum: total * itinerary.passengers,
    maximum: total * itinerary.passengers,
    versions: [...versions],
    notes,
  };
}
