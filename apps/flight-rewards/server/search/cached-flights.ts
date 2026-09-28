import type { FlightProvider } from "../../lib/providers/flights/types";
type FlightResults = Awaited<ReturnType<FlightProvider["search"]>>;
export class ProviderBudgetExceeded extends Error {
  constructor() {
    super("Search is busy. Please try again in a minute.");
  }
}
/** Cache hits never reserve paid-provider capacity. Reservations are atomic in PostgreSQL. */
export async function cachedFlights(
  deps: {
    read: () => Promise<FlightResults | null>;
    reserve: () => Promise<boolean>;
    search: () => Promise<FlightResults>;
    write: (data: FlightResults) => Promise<void>;
  },
  now = Date.now(),
) {
  const cached = await deps.read();
  const expired = cached?.itineraries.some((i) => {
    const expiry = i.cashFare?.expiresAt;
    return (
      expiry != null &&
      (!Number.isFinite(Date.parse(expiry)) || Date.parse(expiry) <= now)
    );
  });
  if (cached && !expired) return cached;
  // Each actual attempt reserves one unit before calling Duffel, across all instances.
  // Failed attempts retain their reservation because a provider request was made.
  if (!(await deps.reserve())) throw new ProviderBudgetExceeded();
  const data = await deps.search();
  await deps.write(data);
  return data;
}
