import type { FlightItinerary, ProgramId, RedemptionOption } from "../../types";
import { partners, programs } from "../../loyalty/catalog";
import { qantasPrice } from "../../rewards/qantas";
import { velocityPrice } from "../../rewards/velocity";
export function calculatedOptions(
  itinerary: FlightItinerary,
  bookingDate = new Date().toISOString().slice(0, 10),
): RedemptionOption[] {
  return (["qantas", "velocity"] as ProgramId[]).flatMap((program) => {
    if (
      !itinerary.segments.length ||
      !itinerary.segments.every((s) =>
        partners.some(
          (p) => p.program === program && p.airline === s.operatingAirline.code,
        ),
      )
    )
      return [];
    const price = (program === "qantas" ? qantasPrice : velocityPrice)(
      itinerary,
      bookingDate,
    );
    const own = itinerary.segments.every(
      (s) => s.operatingAirline.code === (program === "qantas" ? "QF" : "VA"),
    );
    const names = [
      ...new Set(itinerary.segments.map((s) => s.operatingAirline.name)),
    ].join(" + ");
    return [
      {
        id: `${itinerary.id}-${program}`,
        program,
        operatingAirlines: [
          ...new Set(itinerary.segments.map((s) => s.operatingAirline.code)),
        ],
        relationship: own ? "own-airline" : "partner-redemption",
        pointsRequired: price.minimum,
        pointsMaximum: price.maximum,
        pricingKind:
          price.minimum === null
            ? "unpriced"
            : price.minimum === price.maximum
              ? "fixed"
              : "range",
        taxes: null,
        carrierCharges: null,
        unavoidableCashCharges: null,
        cabin: itinerary.cabin,
        availability: {
          status: "CALCULATED",
          source: "Published reward charts",
          checkedAt: null,
          seats: null,
          limitations: [
            "Reward seats have not been checked.",
            "Cash-seat availability does not establish reward availability.",
          ],
        },
        bookingUrl: programs[program].bookingUrl,
        explanation: own
          ? `Book ${names} through ${programs[program].name} using ${programs[program].currency}.`
          : `${names} ${itinerary.segments.length === 1 ? "is a redemption partner" : "can be booked through redemption partnerships"} of ${programs[program].name}. Book through that program. Your points remain ${programs[program].currency}; they are not transferred to the operating airline.`,
        pricingNotes: price.notes,
        chartVersions: price.versions,
        pricingCalculatedAt: new Date().toISOString(),
      },
    ];
  });
}
