import type {
  Availability,
  Cabin,
  FlightItinerary,
  Money,
  ProgramId,
} from "../../types";
export interface AwardObservation {
  program: ProgramId;
  cabin: Cabin;
  segments: {
    origin: string;
    destination: string;
    flightNumber: string;
    departureLocal: string;
  }[];
  points: number | null;
  totalCharges: Money | null;
  availability: Availability;
}
export interface AwardProvider {
  search(
    origin: string,
    destination: string,
    date: string,
    cabin: Cabin,
  ): Promise<{ observations: AwardObservation[]; notices: string[] }>;
}
const numberKey = (s: string) =>
  s.replace(/\s/g, "").replace(/^([A-Z0-9]{2})0+(\d)/, "$1$2");
export function exactMatch(
  observation: AwardObservation,
  itinerary: FlightItinerary,
  slice: number,
): boolean {
  const segments = itinerary.segments.filter((s) => s.slice === slice);
  return (
    segments.length === observation.segments.length &&
    segments.every((s, i) => {
      const a = observation.segments[i];
      return (
        s.cabin === observation.cabin &&
        s.origin.iata === a.origin &&
        s.destination.iata === a.destination &&
        // Deliberately do not assume codeshare equivalence across programs.
        s.operatingAirline.code === s.marketingAirline.code &&
        !!s.operatingFlightNumber &&
        numberKey(s.operatingFlightNumber) === numberKey(a.flightNumber) &&
        s.departureTime?.slice(0, 16) === a.departureLocal.slice(0, 16)
      );
    })
  );
}
export function applyObservations(
  itinerary: FlightItinerary,
  observations: AwardObservation[],
  now = Date.now(),
): FlightItinerary {
  const slices = [...new Set(itinerary.segments.map((s) => s.slice))];
  return {
    ...itinerary,
    redemptions: itinerary.redemptions.map((option) => {
      const matches = slices.map((slice) =>
        observations.find((a) => {
          const age = a.availability.checkedAt
            ? now - Date.parse(a.availability.checkedAt)
            : Infinity;
          return (
            a.program === option.program &&
            age >= 0 &&
            age <= 24 * 3600000 &&
            exactMatch(a, itinerary, slice) &&
            (a.availability.seats === null ||
              a.availability.seats >= itinerary.passengers)
          );
        }),
      );
      if (matches.some((m) => !m)) return option;
      const all = matches as AwardObservation[];
      const points = all.every((m) => m.points !== null)
        ? all.reduce((sum, m) => sum + m.points!, 0) * itinerary.passengers
        : null;
      const charges = all.every(
        (m) =>
          m.totalCharges &&
          m.totalCharges.currency === all[0].totalCharges?.currency,
      )
        ? {
            amount:
              all.reduce((sum, m) => sum + m.totalCharges!.amount, 0) *
              itinerary.passengers,
            currency: all[0].totalCharges!.currency,
          }
        : null;
      const checkedAt = all.map((m) => m.availability.checkedAt!).sort()[0];
      return {
        ...option,
        ...(points === null
          ? {}
          : {
              pointsRequired: points,
              pointsMaximum: points,
              pricingKind: "fixed" as const,
            }),
        unavoidableCashCharges: charges,
        availability: {
          status: "INDICATIVE" as const,
          source: "Seats.aero cached trip data",
          checkedAt,
          seats: all.every((m) => m.availability.seats !== null)
            ? Math.min(...all.map((m) => m.availability.seats!))
            : null,
          limitations: [
            "Exact flights matched within this booking program. Cached inventory is not guaranteed.",
            ...(all.some((m) => m.availability.seats === null)
              ? [
                  "Seat quantity is unknown; availability for your whole party is not established.",
                ]
              : []),
          ],
        },
        pricingNotes: [
          ...option.pricingNotes,
          ...(points === null
            ? []
            : [
                "Points above use the matching provider quote rather than the distance estimate.",
              ]),
          "Provider cash charges are a combined amount; tax and carrier-charge components are not separately supplied.",
        ],
      };
    }),
  };
}
