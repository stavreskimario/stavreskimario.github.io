import type {
  Airline,
  Cabin,
  LoyaltyProgram,
  RedemptionPartner,
} from "../types";
const all: Cabin[] = ["economy", "premium_economy", "business", "first"];
const make = (
  code: string,
  name: string,
  website: string,
  cabins = all,
): Airline => ({ code, name, website, cabins });
export const airlines: Airline[] = [
  make("QF", "Qantas", "https://www.qantas.com/"),
  make("VA", "Virgin Australia", "https://www.virginaustralia.com/", [
    "economy",
    "business",
  ]),
  make("EK", "Emirates", "https://www.emirates.com/"),
  make("UA", "United Airlines", "https://www.united.com/", [
    "economy",
    "premium_economy",
    "business",
  ]),
  make("QR", "Qatar Airways", "https://www.qatarairways.com/", [
    "economy",
    "business",
    "first",
  ]),
  make("SQ", "Singapore Airlines", "https://www.singaporeair.com/"),
  make("AC", "Air Canada", "https://www.aircanada.com/", [
    "economy",
    "premium_economy",
    "business",
  ]),
  make("NH", "ANA", "https://www.ana.co.jp/"),
  make("AA", "American Airlines", "https://www.aa.com/"),
  make("CX", "Cathay Pacific", "https://www.cathaypacific.com/"),
  make("JL", "Japan Airlines", "https://www.jal.com/"),
  make("BA", "British Airways", "https://www.britishairways.com/"),
];
export const airlineByCode = Object.fromEntries(
  airlines.map((a) => [a.code, a]),
);
export const programs: Record<"qantas" | "velocity", LoyaltyProgram> = {
  qantas: {
    id: "qantas",
    name: "Qantas Frequent Flyer",
    currency: "Qantas Points",
    bookingUrl: "https://www.qantas.com/au/en/book-a-trip/flights.html",
  },
  velocity: {
    id: "velocity",
    name: "Velocity Frequent Flyer",
    currency: "Velocity Points",
    bookingUrl: "https://www.virginaustralia.com/au/en/",
  },
};
export const qantasSource =
  "https://www.qantas.com/en-au/frequent-flyer/use-points/classic-flight-rewards/tables";
export const velocitySource =
  "https://www.velocityfrequentflyer.com/flying-status/use-points-for-flights";
export const partners: RedemptionPartner[] = [
  ...["QF", "EK", "AA", "CX", "JL", "BA", "QR"].map((airline) => ({
    program: "qantas" as const,
    airline,
    source: qantasSource,
  })),
  ...["VA", "UA", "QR", "SQ", "AC", "NH"].map((airline) => ({
    program: "velocity" as const,
    airline,
    source: velocitySource,
  })),
];
export const cabinLabel = (cabin: string) =>
  ({
    economy: "Economy",
    premium_economy: "Premium economy",
    business: "Business",
    first: "First",
    mixed: "Mixed cabin",
  })[cabin] || cabin;
