import type {
  Airline,
  Airport,
  Cabin,
  FlightItinerary,
  FlightSegment,
  Money,
  SearchQuery,
} from "../../types";
import { cabins } from "../../types";
import { airlineByCode } from "../../loyalty/catalog";
import { airportByCode } from "../../search/query";
import { localToEpoch } from "../../search/distance";
import { matchesQuery, physicalKey, type FlightProvider } from "./types";
type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Provider object missing.");
  return value as RecordValue;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Provider list missing.");
  return value;
}
function str(value: unknown): string {
  if (typeof value !== "string" || !value.length)
    throw new Error("Provider text missing.");
  return value;
}
function money(amount: unknown, currency: unknown): Money | null {
  if (amount === null || amount === undefined || amount === "") return null;
  const n = Number(amount);
  return Number.isFinite(n) &&
    n >= 0 &&
    typeof currency === "string" &&
    /^[A-Z]{3}$/.test(currency)
    ? { amount: n, currency }
    : null;
}
function airport(value: unknown): Airport {
  const a = record(value),
    code = str(a.iata_code);
  if (airportByCode[code]) return airportByCode[code];
  if (
    typeof a.latitude !== "number" ||
    typeof a.longitude !== "number" ||
    Math.abs(a.latitude) > 90 ||
    Math.abs(a.longitude) > 180
  )
    throw new Error("Airport coordinates missing.");
  return {
    iata: code,
    icao: typeof a.icao_code === "string" ? a.icao_code : null,
    city: str(a.city_name ?? a.name),
    country: str(a.iata_country_code),
    latitude: a.latitude,
    longitude: a.longitude,
    timezone: str(a.time_zone),
  };
}
function airline(value: unknown): Airline {
  const a = record(value),
    code = str(a.iata_code);
  return {
    code,
    name: str(a.name),
    website: airlineByCode[code]?.website ?? "",
    cabins: [...cabins],
  };
}
function duration(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const p = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  return p
    ? Number(p[1] ?? 0) * 1440 +
        Number(p[2] ?? 0) * 60 +
        Number(p[3] ?? 0) +
        Number(p[4] ?? 0) / 60
    : null;
}
export function normalizeDuffel(
  payload: unknown,
  query: SearchQuery,
  checkedAt = new Date().toISOString(),
) {
  const data = record(record(payload).data),
    offers = list(data.offers),
    grouped = new Map<string, FlightItinerary>();
  let skipped = 0;
  for (const value of offers) {
    try {
      const offer = record(value),
        slices = list(offer.slices);
      if (slices.length !== (query.returnDate ? 2 : 1))
        throw new Error("Unexpected slices.");
      const segments: FlightSegment[] = [],
        sliceDurations: (number | null)[] = [];
      slices.forEach((sliceValue, index) => {
        const slice = record(sliceValue),
          rawSegments = list(slice.segments);
        if (!rawSegments.length) throw new Error("Empty slice.");
        sliceDurations.push(duration(slice.duration));
        rawSegments.forEach((segmentValue) => {
          const s = record(segmentValue),
            operating = airline(s.operating_carrier),
            marketing = airline(s.marketing_carrier);
          const cabin = record(list(s.passengers)[0]).cabin_class;
          if (!cabins.includes(cabin as Cabin))
            throw new Error("Missing cabin.");
          const dep = str(s.departing_at),
            arr = str(s.arriving_at);
          if (
            !/^\d{4}-\d{2}-\d{2}T/.test(dep) ||
            !/^\d{4}-\d{2}-\d{2}T/.test(arr)
          )
            throw new Error("Missing schedule.");
          const origin = airport(s.origin),
            destination = airport(s.destination);
          if (
            !Number.isFinite(localToEpoch(dep, origin.timezone)) ||
            !Number.isFinite(localToEpoch(arr, destination.timezone))
          )
            throw new Error("Invalid times.");
          const operatingNumber =
            typeof s.operating_carrier_flight_number === "string"
              ? operating.code + s.operating_carrier_flight_number
              : null;
          const marketingNumber =
            typeof s.marketing_carrier_flight_number === "string"
              ? marketing.code + s.marketing_carrier_flight_number
              : null;
          segments.push({
            origin,
            destination,
            operatingAirline: operating,
            marketingAirline: marketing,
            flightNumber: marketingNumber,
            operatingFlightNumber:
              operatingNumber ??
              (operating.code === marketing.code ? marketingNumber : null),
            departureTime: dep,
            arrivalTime: arr,
            durationMinutes: duration(s.duration),
            aircraft:
              s.aircraft && typeof record(s.aircraft).name === "string"
                ? (record(s.aircraft).name as string)
                : null,
            cabin: cabin as Cabin,
            slice: index,
          });
        });
      });
      const total = money(offer.total_amount, offer.total_currency);
      if (!total) throw new Error("Missing fare.");
      const outbound = segments.filter((s) => s.slice === 0),
        inbound = segments.filter((s) => s.slice === 1);
      if (
        outbound[0].origin.iata !== query.origin ||
        outbound.at(-1)!.destination.iata !== query.destination ||
        outbound[0].departureTime!.slice(0, 10) !== query.departureDate
      )
        throw new Error("Unexpected route.");
      if (
        query.returnDate &&
        (inbound[0].origin.iata !== query.destination ||
          inbound.at(-1)!.destination.iata !== query.origin ||
          inbound[0].departureTime!.slice(0, 10) !== query.returnDate)
      )
        throw new Error("Unexpected return.");
      const itinerary: FlightItinerary = {
        id: "",
        origin: outbound[0].origin,
        destination: outbound.at(-1)!.destination,
        segments,
        cabin: segments.every((s) => s.cabin === segments[0].cabin)
          ? segments[0].cabin
          : "mixed",
        passengers: query.passengers,
        departureDate: query.departureDate,
        returnDate: query.returnDate,
        durationMinutes: sliceDurations.every((d) => d !== null)
          ? sliceDurations.reduce<number>((sum, d) => sum + d!, 0)
          : null,
        cashFare: {
          total,
          taxes: money(offer.tax_amount, offer.tax_currency),
          source: "Duffel",
          checkedAt,
          expiresAt:
            typeof offer.expires_at === "string" ? offer.expires_at : null,
          isTest: offer.live_mode !== true || data.live_mode !== true,
        },
        kind: "scheduled",
        source: "Duffel",
        redemptions: [],
      };
      itinerary.id = physicalKey(itinerary);
      if (!matchesQuery(itinerary, query)) continue;
      const previous = grouped.get(itinerary.id);
      if (
        !previous ||
        (total.currency === previous.cashFare!.total.currency &&
          total.amount < previous.cashFare!.total.amount) ||
        (total.currency === "AUD" &&
          previous.cashFare!.total.currency !== "AUD")
      )
        grouped.set(itinerary.id, itinerary);
    } catch {
      skipped++;
    }
  }
  return {
    itineraries: [...grouped.values()].slice(0, 80),
    notices: [
      ...(skipped
        ? [
            `${skipped} provider offers were omitted because required route, cabin or fare data was incomplete.`,
          ]
        : []),
      "Cash fares cover all selected travellers and both directions when returning. Fare conditions may differ from reward tickets.",
    ],
  };
}
export class DuffelProvider implements FlightProvider {
  constructor(
    private token: string,
    private request: typeof fetch = fetch,
  ) {}
  async search(q: SearchQuery) {
    const slices = [
      {
        origin: q.origin,
        destination: q.destination,
        departure_date: q.departureDate,
      },
    ];
    if (q.returnDate)
      slices.push({
        origin: q.destination,
        destination: q.origin,
        departure_date: q.returnDate,
      });
    const response = await this.request(
      "https://api.duffel.com/air/offer_requests?return_offers=true&supplier_timeout=12000",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Duffel-Version": "v2",
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            slices,
            passengers: Array.from({ length: q.passengers }, () => ({
              type: "adult",
            })),
            cabin_class: q.cabin,
            max_connections: q.directOnly ? 0 : q.maxStops,
          },
        }),
        signal: AbortSignal.timeout(18000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Flight provider unavailable (${response.status}). Please try again later.`,
      );
    return normalizeDuffel(await response.json(), q);
  }
}
