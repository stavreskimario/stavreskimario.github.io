import type {
  AvailabilityStatus,
  FlightItinerary,
  ManualComparison,
  ProgramId,
  Wallet,
} from "../types";
import { canAfford, comparisonValues } from "../points/value";
export interface Filters {
  program: "all" | ProgramId;
  airline: string;
  cabin: string;
  availability: "all" | AvailabilityStatus;
  affordable: boolean;
  maxPoints: string;
  maxCharges: string;
}
export const emptyFilters = (): Filters => ({
  program: "all",
  airline: "all",
  cabin: "all",
  availability: "all",
  affordable: false,
  maxPoints: "",
  maxCharges: "",
});
export type Sort =
  | "points"
  | "charges"
  | "effective"
  | "value"
  | "duration"
  | "stops"
  | "departure";
export const stops = (i: FlightItinerary) =>
  Math.max(
    ...[...new Set(i.segments.map((s) => s.slice))].map(
      (n) => i.segments.filter((s) => s.slice === n).length - 1,
    ),
  );
export function resultList(
  input: FlightItinerary[],
  filters: Filters,
  sort: Sort,
  wallet: Wallet,
  manual: Record<string, ManualComparison>,
): FlightItinerary[] {
  const activeRewardFilter =
    filters.program !== "all" ||
    filters.availability !== "all" ||
    filters.affordable ||
    filters.maxPoints !== "" ||
    filters.maxCharges !== "";
  const candidates = input
    .filter(
      (i) =>
        (filters.airline === "all" ||
          i.segments.some(
            (s) => s.operatingAirline.code === filters.airline,
          )) &&
        (filters.cabin === "all" || i.cabin === filters.cabin),
    )
    .map((i) => ({
      ...i,
      redemptions: i.redemptions.filter((o) => {
        const charges = comparisonValues(
          o,
          manual[o.id],
          i.cashFare?.total.currency === "AUD" ? i.cashFare.total.amount : null,
          wallet[o.program].valuationCents,
        ).charges;
        return (
          (filters.program === "all" || o.program === filters.program) &&
          (filters.availability === "all" ||
            o.availability.status === filters.availability) &&
          (!filters.affordable || canAfford(o, wallet[o.program])) &&
          (filters.maxPoints === "" ||
            (o.pointsRequired !== null &&
              (o.pointsMaximum ?? o.pointsRequired) <=
                Number(filters.maxPoints))) &&
          (filters.maxCharges === "" ||
            (charges !== null && charges <= Number(filters.maxCharges)))
        );
      }),
    }))
    .filter(
      (i) =>
        i.redemptions.length ||
        (!activeRewardFilter &&
          input.find((x) => x.id === i.id)?.redemptions.length === 0),
    );
  const metric = (i: FlightItinerary): number => {
    if (sort === "duration") return i.durationMinutes ?? Infinity;
    if (sort === "stops") return stops(i);
    if (sort === "departure")
      return i.segments[0].departureTime
        ? Number(i.segments[0].departureTime.replace(/[-:T]/g, "").slice(0, 12))
        : Infinity;
    const values = i.redemptions
      .map((o) => {
        const v = comparisonValues(
          o,
          manual[o.id],
          i.cashFare?.total.currency === "AUD" ? i.cashFare.total.amount : null,
          wallet[o.program].valuationCents,
        );
        if (sort === "charges") return v.charges;
        if (sort === "effective") return v.effectiveCost;
        if (sort === "value")
          return v.centsPerPoint === null ? null : -v.centsPerPoint;
        return o.pointsRequired;
      })
      .filter((v): v is number => v !== null);
    return values.length ? Math.min(...values) : Infinity;
  };
  return candidates.sort(
    (a, b) =>
      metric(a) - metric(b) || stops(a) - stops(b) || a.id.localeCompare(b.id),
  );
}
