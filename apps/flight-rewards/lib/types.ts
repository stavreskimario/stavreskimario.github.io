export type ProgramId = "qantas" | "velocity";
export const cabins = [
  "economy",
  "premium_economy",
  "business",
  "first",
] as const;
export type Cabin = (typeof cabins)[number];
export type AvailabilityStatus = "CONFIRMED" | "INDICATIVE" | "CALCULATED";
export interface Airport {
  iata: string;
  icao: string | null;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
}
export interface Airline {
  code: string;
  name: string;
  website: string;
  cabins: Cabin[];
}
export interface LoyaltyProgram {
  id: ProgramId;
  name: string;
  currency: string;
  bookingUrl: string;
}
export interface RedemptionPartner {
  program: ProgramId;
  airline: string;
  source: string;
  notes?: string;
}
export interface FlightSegment {
  origin: Airport;
  destination: Airport;
  operatingAirline: Airline;
  marketingAirline: Airline;
  flightNumber: string | null;
  operatingFlightNumber: string | null;
  departureTime: string | null;
  arrivalTime: string | null;
  durationMinutes: number | null;
  aircraft: string | null;
  cabin: Cabin;
  slice: number;
  /** Planning assumptions only. Live flights derive breaks from their local times/timezones. */
  connectionBefore?: "connection" | "stopover";
}
export interface Money {
  amount: number;
  currency: string;
}
export interface CashFare {
  total: Money;
  taxes: Money | null;
  source: string;
  checkedAt: string;
  expiresAt: string | null;
  isTest: boolean;
}
export interface FlightItinerary {
  id: string;
  origin: Airport;
  destination: Airport;
  segments: FlightSegment[];
  cabin: Cabin | "mixed";
  passengers: number;
  departureDate: string;
  returnDate: string | null;
  durationMinutes: number | null;
  cashFare: CashFare | null;
  kind: "planning" | "scheduled";
  source: string;
  redemptions: RedemptionOption[];
}
export interface Availability {
  status: AvailabilityStatus;
  source: string;
  checkedAt: string | null;
  seats: number | null;
  limitations: string[];
}
export interface RedemptionOption {
  id: string;
  program: ProgramId;
  operatingAirlines: string[];
  relationship: "own-airline" | "partner-redemption";
  pointsRequired: number | null;
  pointsMaximum: number | null;
  pricingKind: "fixed" | "range" | "unpriced";
  taxes: Money | null;
  carrierCharges: Money | null;
  unavoidableCashCharges: Money | null;
  cabin: Cabin | "mixed";
  availability: Availability;
  bookingUrl: string;
  explanation: string;
  pricingNotes: string[];
  chartVersions: string[];
  pricingCalculatedAt: string;
}
export interface RewardChartVersion {
  id: string;
  program: ProgramId;
  group: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  verifiedAt: string;
  source: string;
  ruleType: string;
  notes: string[];
  zones: {
    maxMiles: number;
    prices: Partial<Record<Cabin, number>>;
    maximum?: Partial<Record<Cabin, number>>;
  }[];
}
export interface SearchQuery {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string | null;
  passengers: number;
  cabin: Cabin;
  directOnly: boolean;
  maxStops: number;
  flexDays: 0 | 3;
  preferredAirlines: string[];
  excludedAirlines: string[];
}
export interface SearchResponse {
  itineraries: FlightItinerary[];
  notices: string[];
  searchedAt: string;
  mode: "planning" | "live";
}
export interface WalletEntry {
  balance: number | null;
  valuationCents: number;
  updatedAt: string | null;
}
export type Wallet = Record<ProgramId, WalletEntry>;
export interface ManualComparison {
  cash: number | null;
  charges: number | null;
}
