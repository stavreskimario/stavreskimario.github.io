import type {
  Cabin,
  FlightItinerary,
  FlightSegment,
  SearchQuery,
  SearchResponse,
} from "../../types";
import { airlines, airlineByCode } from "../../loyalty/catalog";
import { airportByCode, today, validateQuery } from "../../search/query";
import { calculatedOptions } from "../awards/calculated";
import { matchesQuery } from "./types";
/** Illustrative routing seed, NOT a timetable or an assertion of current route service. */
const spokes: Record<string, Record<string, string[]>> = {
  QF: {
    MEL: [
      "SYD",
      "BNE",
      "PER",
      "ADL",
      "HBA",
      "CNS",
      "DRW",
      "LAX",
      "SIN",
      "HKG",
      "NRT",
      "AKL",
    ],
    SYD: [
      "BNE",
      "PER",
      "ADL",
      "CBR",
      "CNS",
      "LAX",
      "SFO",
      "DFW",
      "HNL",
      "SIN",
      "HKG",
      "HND",
      "AKL",
      "CHC",
    ],
    SIN: ["LHR"],
    PER: ["LHR", "FCO", "CDG"],
  },
  VA: {
    MEL: ["SYD", "BNE", "PER", "ADL", "HBA", "CNS", "OOL", "DPS"],
    SYD: ["BNE", "PER", "ADL", "CNS", "OOL", "DPS"],
    BNE: ["PER", "ADL", "CNS", "DPS"],
  },
  UA: {
    LAX: ["MEL", "SYD", "SFO", "EWR", "IAH"],
    SFO: ["MEL", "SYD", "BNE", "EWR", "LHR", "NRT"],
    IAH: ["SYD"],
  },
  EK: {
    DXB: [
      "MEL",
      "SYD",
      "BNE",
      "PER",
      "ADL",
      "LHR",
      "CDG",
      "FCO",
      "MXP",
      "AMS",
      "FRA",
      "ATH",
      "IST",
      "JFK",
      "LAX",
      "SIN",
      "BKK",
    ],
  },
  QR: {
    DOH: [
      "MEL",
      "SYD",
      "BNE",
      "PER",
      "ADL",
      "LHR",
      "CDG",
      "FCO",
      "MXP",
      "AMS",
      "FRA",
      "ATH",
      "IST",
      "JFK",
      "LAX",
      "BKK",
      "SIN",
    ],
  },
  SQ: {
    SIN: [
      "MEL",
      "SYD",
      "BNE",
      "PER",
      "ADL",
      "LHR",
      "CDG",
      "FCO",
      "MXP",
      "AMS",
      "FRA",
      "LAX",
      "SFO",
      "JFK",
      "BKK",
      "HKG",
      "NRT",
      "AKL",
      "DPS",
    ],
  },
  AC: {
    YVR: ["SYD", "BNE", "LAX", "SFO", "YYZ", "LHR", "NRT"],
    YYZ: ["LHR", "JFK", "CDG"],
  },
  NH: {
    HND: ["SYD", "LAX", "SFO", "JFK", "LHR", "SIN", "BKK"],
    NRT: ["PER", "LAX", "SFO"],
  },
  AA: { LAX: ["SYD", "JFK", "DFW", "LHR"], DFW: ["BNE", "JFK", "LHR"] },
  CX: {
    HKG: [
      "MEL",
      "SYD",
      "BNE",
      "PER",
      "ADL",
      "LHR",
      "CDG",
      "FCO",
      "MXP",
      "FRA",
      "LAX",
      "SFO",
      "JFK",
      "YVR",
      "BKK",
      "SIN",
      "NRT",
    ],
  },
  JL: {
    NRT: ["MEL", "LAX", "SFO", "SIN", "BKK"],
    HND: ["SYD", "LAX", "JFK", "LHR", "CDG"],
  },
  BA: {
    LHR: [
      "LAX",
      "SFO",
      "JFK",
      "SIN",
      "HKG",
      "HND",
      "CDG",
      "FCO",
      "MXP",
      "AMS",
      "ATH",
      "IST",
    ],
    SIN: ["SYD"],
  },
};
export interface PlannedLeg {
  origin: string;
  destination: string;
  airline: string;
  cabin: Cabin;
  stopover: boolean;
}
export function plannedItinerary(
  legs: PlannedLeg[],
  q: SearchQuery,
): FlightItinerary {
  if (!legs.length || legs.length > 3)
    throw new Error("Plan one to three flight segments.");
  if (legs[0].origin !== q.origin || legs.at(-1)!.destination !== q.destination)
    throw new Error(
      "Your custom route must match the search origin and destination.",
    );
  legs.forEach((s, i) => {
    if (
      !airportByCode[s.origin] ||
      !airportByCode[s.destination] ||
      s.origin === s.destination ||
      !airlineByCode[s.airline]?.cabins.includes(s.cabin) ||
      (i && s.origin !== legs[i - 1].destination)
    )
      throw new Error(
        "Check the airports, airlines and cabins in your custom route.",
      );
  });
  const toSegment = (
    l: PlannedLeg,
    slice: number,
    i: number,
  ): FlightSegment => ({
    origin: airportByCode[l.origin],
    destination: airportByCode[l.destination],
    operatingAirline: airlineByCode[l.airline],
    marketingAirline: airlineByCode[l.airline],
    cabin: l.cabin,
    slice,
    connectionBefore: i ? (l.stopover ? "stopover" : "connection") : undefined,
    departureTime: null,
    arrivalTime: null,
    durationMinutes: null,
    flightNumber: null,
    operatingFlightNumber: null,
    aircraft: null,
  });
  const segments = legs.map((l, i) => toSegment(l, 0, i));
  if (q.returnDate)
    [...legs]
      .reverse()
      .forEach((l, i) =>
        segments.push(
          toSegment(
            {
              ...l,
              origin: l.destination,
              destination: l.origin,
              stopover: false,
            },
            1,
            i,
          ),
        ),
      );
  const id = [
    "plan",
    q.departureDate,
    q.returnDate,
    q.passengers,
    ...segments.map(
      (s) =>
        `${s.slice}-${s.origin.iata}-${s.destination.iata}-${s.operatingAirline.code}-${s.cabin}-${s.connectionBefore}`,
    ),
  ].join("_");
  const itinerary: FlightItinerary = {
    id,
    origin: airportByCode[q.origin],
    destination: airportByCode[q.destination],
    segments,
    cabin: segments.every((s) => s.cabin === segments[0].cabin)
      ? segments[0].cabin
      : "mixed",
    passengers: q.passengers,
    departureDate: q.departureDate,
    returnDate: q.returnDate,
    durationMinutes: null,
    cashFare: null,
    kind: "planning",
    source: "Illustrative route · no flight schedule",
    redemptions: [],
  };
  itinerary.redemptions = calculatedOptions(itinerary, today());
  return itinerary;
}
export function searchPlanning(input: SearchQuery): SearchResponse {
  const q = validateQuery(input),
    itineraries: FlightItinerary[] = [];
  for (const airline of airlines) {
    if (!airline.cabins.includes(q.cabin)) continue;
    const graph = new Map<string, Set<string>>();
    for (const [hub, cities] of Object.entries(spokes[airline.code] ?? {}))
      for (const city of cities) {
        if (!graph.has(hub)) graph.set(hub, new Set());
        if (!graph.has(city)) graph.set(city, new Set());
        graph.get(hub)!.add(city);
        graph.get(city)!.add(hub);
      }
    const queue = [[q.origin]],
      paths: string[][] = [];
    while (queue.length && paths.length < 2) {
      const path = queue.shift()!;
      if (path.at(-1) === q.destination) {
        paths.push(path);
        continue;
      }
      if (path.length > (q.directOnly ? 0 : q.maxStops) + 1) continue;
      for (const next of graph.get(path.at(-1)!) ?? [])
        if (!path.includes(next)) queue.push([...path, next]);
    }
    for (const path of paths) {
      const itinerary = plannedItinerary(
        path
          .slice(1)
          .map((destination, i) => ({
            origin: path[i],
            destination,
            airline: airline.code,
            cabin: q.cabin,
            stopover: false,
          })),
        q,
      );
      if (matchesQuery(itinerary, q)) itineraries.push(itinerary);
    }
  }
  return {
    itineraries,
    searchedAt: new Date().toISOString(),
    mode: "planning",
    notices: [
      "Illustrative routes only. Flight operation, dates, cabins, connection times and reward seats have not been verified.",
      ...(q.flexDays
        ? [
            "In estimate mode, changing the travel date does not check availability. Flexible live searches shift both dates together by up to 3 days.",
          ]
        : []),
    ],
  };
}
