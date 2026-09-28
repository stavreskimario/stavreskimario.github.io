import type { Cabin, ProgramId } from "../../types";
import type { AwardObservation, AwardProvider } from "./types";
interface RawSegment {
  OriginAirport?: string;
  DestinationAirport?: string;
  FlightNumber?: string;
  DepartsAt?: string;
  Order?: number;
}
interface RawTrip {
  Source?: string;
  Cabin?: string;
  AvailabilitySegments?: RawSegment[];
  MileageCost?: number;
  TotalTaxes?: number;
  TaxesCurrency?: string;
  RemainingSeats?: number;
  UpdatedAt?: string;
  MixedCabinPct?: number;
}
interface RawAvailability {
  Source?: string;
  Route?: { Source?: string };
  AvailabilityTrips?: RawTrip[];
}
/** Seats.aero flight times are airport-local, including their misleading Z suffix.
 * https://developers.seats.aero/reference/concepts-copy#availability-trips
 * UpdatedAt is a real instant and must not use this normalization.
 */
export function seatsDepartureLocal(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?Z?$/.exec(
    value,
  );
  if (!match) return null; // Numeric offsets are outside the documented local-time format.
  const local = match[1];
  const date = new Date(local + "Z");
  return Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 19) === local
    ? local
    : null;
}
export function normalizeSeats(payload: unknown): AwardObservation[] {
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { data?: unknown }).data)
  )
    throw new Error("Award provider returned an unexpected response.");
  const observations: AwardObservation[] = [];
  for (const row of (payload as { data: RawAvailability[] }).data) {
    const source = row.Source ?? row.Route?.Source;
    if (source !== "qantas" && source !== "velocity") continue;
    for (const trip of row.AvailabilityTrips ?? []) {
      if (
        (trip.Source && trip.Source !== source) ||
        !["economy", "premium_economy", "business", "first"].includes(
          trip.Cabin ?? "",
        ) ||
        (trip.MixedCabinPct ?? 0) > 0
      )
        continue;
      const segments = [...(trip.AvailabilitySegments ?? [])].sort(
        (a, b) => (a.Order ?? 0) - (b.Order ?? 0),
      );
      if (
        !segments.length ||
        segments.some(
          (s) =>
            !s.OriginAirport ||
            !s.DestinationAirport ||
            !s.FlightNumber ||
            !seatsDepartureLocal(s.DepartsAt),
        )
      )
        continue;
      if (!trip.UpdatedAt || !Number.isFinite(Date.parse(trip.UpdatedAt)))
        continue;
      observations.push({
        program: source as ProgramId,
        cabin: trip.Cabin as Cabin,
        segments: segments.map((s) => ({
          origin: s.OriginAirport!,
          destination: s.DestinationAirport!,
          flightNumber: s.FlightNumber!,
          departureLocal: seatsDepartureLocal(s.DepartsAt)!,
        })),
        points:
          typeof trip.MileageCost === "number" &&
          Number.isInteger(trip.MileageCost) &&
          trip.MileageCost > 0
            ? trip.MileageCost
            : null,
        // API amounts are minor currency units; never silently interpret missing currency as AUD.
        totalCharges:
          typeof trip.TotalTaxes === "number" &&
          Number.isFinite(trip.TotalTaxes) &&
          trip.TotalTaxes >= 0 &&
          /^[A-Z]{3}$/.test(trip.TaxesCurrency ?? "")
            ? { amount: trip.TotalTaxes / 100, currency: trip.TaxesCurrency! }
            : null,
        availability: {
          status: "INDICATIVE",
          source: "Seats.aero cached trip data",
          checkedAt: trip.UpdatedAt,
          seats:
            source === "velocity" &&
            Number.isInteger(trip.RemainingSeats) &&
            trip.RemainingSeats! > 0
              ? trip.RemainingSeats!
              : null,
          limitations: ["Cached data may be stale or incomplete."],
        },
      });
    }
  }
  return observations;
}
export class SeatsAeroProvider implements AwardProvider {
  constructor(
    private token: string,
    private request: typeof fetch = fetch,
  ) {}
  async search(
    origin: string,
    destination: string,
    date: string,
    cabin: Cabin,
  ) {
    const params = new URLSearchParams({
      origin_airport: origin,
      destination_airport: destination,
      start_date: date,
      end_date: date,
      sources: "qantas,velocity",
      cabins: cabin,
      include_trips: "true",
      min_cabin_pct: "100",
      take: "1000",
    });
    const response = await this.request(
      `https://seats.aero/partnerapi/search?${params}`,
      {
        headers: {
          "Partner-Authorization": this.token,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!response.ok)
      throw new Error(
        `Award provider unavailable (${response.status}). Reward prices remain calculated.`,
      );
    const payload = (await response.json()) as {
      data?: unknown[];
      hasMore?: boolean;
    };
    return {
      observations: normalizeSeats(payload),
      notices: [
        ...(payload.hasMore || (payload.data?.length ?? 0) >= 1000
          ? [
              "Award results are truncated; no match does not establish that seats are unavailable.",
            ]
          : []),
        "Seats.aero coverage is partial. Only matching Qantas/Velocity trip records affect availability; other programs do not prove access.",
      ],
    };
  }
}
