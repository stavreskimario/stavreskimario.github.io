import {
  cachedFlights,
  ProviderBudgetExceeded,
} from "../server/search/cached-flights";
import { formatMoney } from "../lib/points/format";
import test from "node:test";
import assert from "node:assert/strict";
import {
  plannedItinerary,
  searchPlanning,
  type PlannedLeg,
} from "../lib/providers/flights/planning";
import { qantasPrice } from "../lib/rewards/qantas";
import { velocityPrice } from "../lib/rewards/velocity";
import { findChart, lookup } from "../lib/rewards/charts";
import { milesBetween, isBreak, localToEpoch } from "../lib/search/distance";
import {
  airportByCode,
  validateQuery,
  shiftDate,
  today,
  flexibleQueries,
} from "../lib/search/query";
import { compare, canAfford, balanceStatus } from "../lib/points/value";
import { emptyWallet, parseWallet } from "../lib/points/wallet";
import { emptyFilters, resultList } from "../lib/search/results";
import {
  normalizeDuffel,
  DuffelProvider,
} from "../lib/providers/flights/duffel.server";
import { normalizeSeats } from "../lib/providers/awards/seats-aero.server";
import {
  applyObservations,
  type AwardObservation,
} from "../lib/providers/awards/types";
import type { SearchQuery, FlightItinerary } from "../lib/types";
const q: SearchQuery = {
  origin: "MEL",
  destination: "LAX",
  departureDate: shiftDate(today(), 60),
  returnDate: null,
  cabin: "economy",
  passengers: 1,
  directOnly: false,
  maxStops: 2,
  preferredAirlines: [],
  excludedAirlines: [],
  flexDays: 0,
};
const leg = (
  origin: string,
  destination: string,
  airline = "UA",
  cabin: PlannedLeg["cabin"] = "economy",
  stopover = false,
): PlannedLeg => ({ origin, destination, airline, cabin, stopover });
const plan = (legs: PlannedLeg[], overrides: Partial<SearchQuery> = {}) =>
  plannedItinerary(legs, {
    ...q,
    origin: legs[0].origin,
    destination: legs.at(-1)!.destination,
    ...overrides,
  });
test("Great-circle miles are symmetric and handle dateline; chart edges have no missing bands", () => {
  const mel = airportByCode.MEL,
    lax = airportByCode.LAX;
  assert.ok(milesBetween(mel, lax) > 7900 && milesBetween(mel, lax) < 8000);
  assert.equal(milesBetween(mel, mel), 0);
  assert.equal(milesBetween(mel, lax), milesBetween(lax, mel));
  const a = { ...mel, latitude: 0, longitude: 179 },
    b = { ...mel, latitude: 0, longitude: -179 };
  assert.ok(milesBetween(a, b) < 140);
  const c = findChart("qantas", "qantas", "2026-09-28")!;
  assert.equal(lookup(c, 600, "economy")!.minimum, 9200);
  assert.equal(lookup(c, 601, "economy")!.minimum, 13800);
  assert.equal(lookup(c, 15001, "economy"), null);
});
test("Booking-date chart selection retains history and Emirates 2026 transition", () => {
  const domestic = plan([leg("MEL", "SYD", "QF")]);
  assert.equal(qantasPrice(domestic, "2025-08-04").minimum, 8000);
  assert.equal(qantasPrice(domestic, "2025-08-05").minimum, 9200);
  const emirates = plan([leg("SYD", "DXB", "EK")]);
  assert.equal(qantasPrice(emirates, "2026-03-30").minimum, 48200);
  assert.equal(qantasPrice(emirates, "2026-03-31").minimum, 53100);
  assert.equal(findChart("qantas", "emirates", "2026-03-30"), undefined);
});
test("Independent program pricing and return/passenger totals", () => {
  assert.equal(
    velocityPrice(plan([leg("MEL", "LAX")]), "2026-09-28").minimum,
    48000,
  );
  assert.equal(
    qantasPrice(plan([leg("MEL", "LAX", "QF")]), "2026-09-28").minimum,
    48200,
  );
  assert.equal(
    velocityPrice(
      plan([leg("MEL", "LAX")], {
        passengers: 2,
        returnDate: shiftDate(q.departureDate, 7),
      }),
      "2026-09-28",
    ).minimum,
    192000,
  );
});
test("Velocity connections sum flown miles, while stopovers and cabin changes split", () => {
  const connecting = plan([leg("SYD", "LAX"), leg("LAX", "EWR")]);
  assert.equal(velocityPrice(connecting, "2026-09-28").minimum, 63000);
  const stopping = plan([
    leg("SYD", "LAX"),
    leg("LAX", "EWR", "UA", "economy", true),
  ]);
  assert.equal(velocityPrice(stopping, "2026-09-28").minimum, 71500);
  const mixed = plan([
    leg("MEL", "SYD", "VA"),
    leg("SYD", "SIN", "SQ", "business"),
  ]);
  assert.ok(
    velocityPrice(mixed, "2026-09-28").notes.some((n) =>
      n.includes("2 separately"),
    ),
  );
});
test("Qantas mixed-cabin minimum and partner changes are program-specific", () => {
  const mixed = plan([
    leg("MEL", "SYD", "QF", "business"),
    leg("SYD", "LAX", "QF"),
  ]);
  assert.equal(qantasPrice(mixed, "2026-09-28").minimum, 67500);
  const cx = plan([leg("MEL", "HKG", "CX"), leg("HKG", "LHR", "BA")]);
  assert.ok(
    qantasPrice(cx, "2026-09-28").notes.some((n) => n.includes("2 separately")),
  );
});
test("Domestic Velocity range is never presented as a guaranteed low price", () => {
  const i = plan([leg("SYD", "MEL", "VA")]),
    o = i.redemptions[0];
  assert.equal(o.pointsRequired, 5900);
  assert.equal(o.pointsMaximum, 12900);
  assert.equal(o.pricingKind, "range");
  const wallet = emptyWallet();
  wallet.velocity.balance = 10000;
  assert.equal(canAfford(o, wallet.velocity), false);
  assert.equal(balanceStatus(o, wallet.velocity), "Covers the minimum only");
  assert.equal(
    resultList(
      [i],
      { ...emptyFilters(), affordable: true },
      "points",
      wallet,
      {},
    ).length,
    0,
  );
  assert.equal(
    resultList(
      [i],
      { ...emptyFilters(), maxPoints: "10000" },
      "points",
      wallet,
      {},
    ).length,
    0,
  );
});
test("Ineligible cabins, SQ exclusions, codeshares and VA Doha do not get misleading estimates", () => {
  assert.equal(
    velocityPrice(plan([leg("MEL", "SIN", "SQ", "first")]), "2026-09-28")
      .minimum,
    null,
  );
  assert.equal(
    velocityPrice(plan([leg("SIN", "HKG", "SQ")]), "2026-09-28").minimum,
    null,
  );
  assert.equal(
    velocityPrice(
      plan([leg("MEL", "LAX", "UA", "premium_economy")]),
      "2026-09-28",
    ).minimum,
    null,
  );
  assert.equal(
    velocityPrice(plan([leg("MEL", "DOH", "VA")]), "2026-09-28").minimum,
    null,
  );
  const codeShare = plan([leg("MEL", "LAX", "UA")]);
  codeShare.segments[0].marketingAirline = {
    ...codeShare.segments[0].marketingAirline,
    code: "VA",
  };
  assert.equal(velocityPrice(codeShare, "2026-09-28").minimum, null);
  assert.equal(
    velocityPrice(plan([leg("MEL", "LAX", "VA")]), "2026-09-28").minimum,
    null,
  );
});
test("Planning search never fabricates flight numbers, prices or inventory; direct/exclusion filters work", () => {
  const results = searchPlanning({
    ...q,
    directOnly: true,
    excludedAirlines: ["UA"],
  });
  assert.ok(results.itineraries.length > 0);
  for (const i of results.itineraries) {
    assert.equal(i.cashFare, null);
    assert.equal(i.segments.length, 1);
    assert.notEqual(i.segments[0].operatingAirline.code, "UA");
    assert.equal(i.segments[0].flightNumber, null);
    assert.equal(i.segments[0].departureTime, null);
    for (const o of i.redemptions) {
      assert.equal(o.availability.status, "CALCULATED");
      assert.equal(o.availability.checkedAt, null);
      assert.equal(o.unavoidableCashCharges, null);
    }
  }
});
test("Unknown cash charges remain unknown; personal valuation units and negative value are correct", () => {
  assert.deepEqual(compare(100000, 4000, 200, 1.8), {
    centsPerPoint: 3.8,
    effectiveCost: 2000,
  });
  assert.deepEqual(compare(100000, 4000, null, 1.8), {
    centsPerPoint: null,
    effectiveCost: null,
  });
  assert.equal(compare(10000, 100, 200, 1.8).centsPerPoint, -1);
  assert.equal(compare(10000, 100, 0, 0).effectiveCost, 0);
});
test("Wallet parsing preserves unknown vs zero and rejects corrupt or nonnumeric balances", () => {
  const wallet = emptyWallet();
  wallet.qantas.balance = 0;
  assert.equal(
    parseWallet(JSON.stringify({ version: 1, wallet })).qantas.balance,
    0,
  );
  assert.equal(parseWallet(null).qantas.balance, null);
  assert.throws(() => parseWallet("{bad"));
  assert.throws(() =>
    parseWallet(
      JSON.stringify({
        version: 1,
        wallet: { ...wallet, qantas: { ...wallet.qantas, balance: "100" } },
      }),
    ),
  );
});
test("Query validation prevents invalid dates, amounts, same airports and conflicting filters", () => {
  assert.throws(() => validateQuery({ ...q, origin: "LAX" }));
  assert.throws(() => validateQuery({ ...q, departureDate: "2027-02-30" }));
  assert.throws(() => validateQuery({ ...q, passengers: -1 }));
  assert.throws(() =>
    validateQuery({ ...q, returnDate: shiftDate(q.departureDate, -1) }),
  );
  assert.throws(() =>
    validateQuery({
      ...q,
      preferredAirlines: ["UA"],
      excludedAirlines: ["UA"],
    }),
  );
  const queries = flexibleQueries({
    ...q,
    flexDays: 3,
    returnDate: shiftDate(q.departureDate, 7),
  });
  assert.equal(queries.length, 7);
  assert.ok(
    queries.every((x) => x.returnDate === shiftDate(x.departureDate, 7)),
  );
});
test("Local-time connection rules distinguish domestic overnight and international elapsed time", () => {
  assert.equal(
    localToEpoch("2026-12-20T12:00:00", "Australia/Melbourne"),
    Date.parse("2026-12-20T01:00:00Z"),
  );
  const i = plan([leg("MEL", "SYD", "QF"), leg("SYD", "LAX", "QF")]);
  const [a, b] = structuredClone(i.segments);
  delete b.connectionBefore;
  a.arrivalTime = "2026-12-20T22:00:00";
  b.departureTime = "2026-12-21T09:00:00";
  assert.equal(isBreak(a, b, true), true);
  assert.equal(isBreak(a, b, false), false);
  b.departureTime = "2026-12-22T00:01:00";
  assert.equal(isBreak(a, b, false), true);
});
function rawAirport(code: string) {
  const a = airportByCode[code];
  return {
    iata_code: code,
    city_name: a.city,
    iata_country_code: a.country,
    latitude: a.latitude,
    longitude: a.longitude,
    time_zone: a.timezone,
  };
}
function duffelOffer(amount = "2000", live = true) {
  return {
    id: "off_1",
    total_amount: amount,
    total_currency: "AUD",
    tax_amount: null,
    tax_currency: "AUD",
    live_mode: live,
    expires_at: shiftDate(q.departureDate, -1) + "T00:00:00Z",
    slices: [
      {
        duration: "PT14H20M",
        segments: [
          {
            origin: rawAirport("MEL"),
            destination: rawAirport("LAX"),
            operating_carrier: { iata_code: "UA", name: "United Airlines" },
            marketing_carrier: { iata_code: "UA", name: "United Airlines" },
            operating_carrier_flight_number: "99",
            marketing_carrier_flight_number: "99",
            departing_at: q.departureDate + "T11:00:00",
            arriving_at: q.departureDate + "T06:20:00",
            duration: "PT14H20M",
            aircraft: { name: "Boeing 787" },
            passengers: [{ cabin_class: "economy" }],
          },
        ],
      },
    ],
  };
}
test("Duffel mapping deduplicates physical flights and keeps cash taxes distinct from reward charges", () => {
  const r = normalizeDuffel(
    {
      data: {
        live_mode: true,
        offers: [duffelOffer("2000"), duffelOffer("1800"), { bad: 1 }],
      },
    },
    q,
  );
  assert.equal(r.itineraries.length, 1);
  const i = r.itineraries[0];
  assert.equal(i.cashFare!.total.amount, 1800);
  assert.equal(i.cashFare!.taxes, null);
  assert.equal(i.cashFare!.isTest, false);
  assert.equal(i.segments[0].operatingAirline.name, "United Airlines");
  assert.equal(i.durationMinutes, 860);
  const testData = normalizeDuffel(
    { data: { live_mode: false, offers: [duffelOffer("99", false)] } },
    q,
  );
  assert.equal(testData.itineraries[0].cashFare!.isTest, true);
});
test("Duffel provider sends passenger counts and return slices server-side, and reports failures", async () => {
  let requestBody: any;
  const provider = new DuffelProvider("test-only", async (_url, init) => {
    requestBody = JSON.parse(init!.body as string);
    return new Response(
      JSON.stringify({ data: { live_mode: true, offers: [] } }),
      { status: 200 },
    );
  });
  await provider.search({
    ...q,
    passengers: 2,
    returnDate: shiftDate(q.departureDate, 7),
  });
  assert.equal(requestBody.data.passengers.length, 2);
  assert.equal(requestBody.data.slices.length, 2);
  await assert.rejects(
    () =>
      new DuffelProvider(
        "test-only",
        async () => new Response("{}", { status: 401 }),
      ).search(q),
    /unavailable/,
  );
});
function scheduled(): FlightItinerary {
  const i = plan([leg("MEL", "LAX")]);
  i.kind = "scheduled";
  i.segments[0].flightNumber = "UA99";
  i.segments[0].operatingFlightNumber = "UA99";
  i.segments[0].departureTime = q.departureDate + "T11:00:00";
  return i;
}
function observation(): AwardObservation {
  return {
    program: "velocity",
    cabin: "economy",
    segments: [
      {
        origin: "MEL",
        destination: "LAX",
        flightNumber: "UA99",
        departureLocal: q.departureDate + "T11:00:00Z",
      },
    ],
    points: 48000,
    totalCharges: { amount: 150, currency: "AUD" },
    availability: {
      status: "INDICATIVE",
      source: "Seats.aero",
      checkedAt: new Date().toISOString(),
      seats: 2,
      limitations: [],
    },
  };
}
test("Award matching is program, cabin, flight, route, local time and party specific", () => {
  const i = scheduled(),
    good = observation();
  assert.equal(
    applyObservations(i, [good]).redemptions[0].availability.status,
    "INDICATIVE",
  );
  for (const bad of [
    { ...good, program: "qantas" as const },
    { ...good, cabin: "business" as const },
    { ...good, segments: [{ ...good.segments[0], flightNumber: "UA100" }] },
    {
      ...good,
      segments: [
        { ...good.segments[0], departureLocal: q.departureDate + "T12:00:00Z" },
      ],
    },
    {
      ...good,
      availability: {
        ...good.availability,
        checkedAt: new Date(Date.now() - 25 * 3600000).toISOString(),
      },
    },
  ])
    assert.equal(
      applyObservations(i, [bad]).redemptions[0].availability.status,
      "CALCULATED",
    );
  i.passengers = 3;
  assert.equal(
    applyObservations(i, [good]).redemptions[0].availability.status,
    "CALCULATED",
  );
});
test("Both return slices must match before any whole-trip availability is promoted", () => {
  const i = scheduled();
  i.returnDate = shiftDate(q.departureDate, 7);
  i.segments.push({
    ...i.segments[0],
    origin: airportByCode.LAX,
    destination: airportByCode.MEL,
    slice: 1,
    departureTime: i.returnDate + "T20:00:00",
    operatingFlightNumber: "UA98",
  });
  assert.equal(
    applyObservations(i, [observation()]).redemptions[0].availability.status,
    "CALCULATED",
  );
});
test("Seats adapter ignores other programs, summary-only records and unknown currency", () => {
  const trip = {
    Source: "velocity",
    Cabin: "economy",
    AvailabilitySegments: [
      {
        OriginAirport: "MEL",
        DestinationAirport: "LAX",
        FlightNumber: "UA99",
        DepartsAt: q.departureDate + "T11:00:00Z",
      },
    ],
    MileageCost: 48000,
    TotalTaxes: 15000,
    TaxesCurrency: "AUD",
    RemainingSeats: 0,
    UpdatedAt: new Date().toISOString(),
  };
  const [row] = normalizeSeats({
    data: [
      { Source: "velocity", AvailabilityTrips: [trip] },
      { Source: "united", AvailabilityTrips: [{ ...trip, Source: "united" }] },
      { Source: "qantas", YAvailable: true },
    ],
  });
  assert.equal(row.totalCharges!.amount, 150);
  assert.equal(row.availability.seats, null);
  assert.equal(row.availability.status, "INDICATIVE");
  assert.equal(row.segments[0].departureLocal, q.departureDate + "T11:00:00");
  assert.equal(row.availability.checkedAt, trip.UpdatedAt);
  assert.equal(
    applyObservations(scheduled(), [row]).redemptions[0].availability.status,
    "INDICATIVE",
  );
  for (const timestamp of [
    q.departureDate + "T11:00:00",
    q.departureDate + "T11:00:00.123Z",
  ]) {
    const [local] = normalizeSeats({
      data: [
        {
          Source: "velocity",
          AvailabilityTrips: [
            {
              ...trip,
              AvailabilitySegments: [
                { ...trip.AvailabilitySegments[0], DepartsAt: timestamp },
              ],
            },
          ],
        },
      ],
    });
    assert.equal(
      local.segments[0].departureLocal,
      q.departureDate + "T11:00:00",
    );
    assert.equal(
      applyObservations(scheduled(), [local]).redemptions[0].availability
        .status,
      "INDICATIVE",
    );
  }
  for (const timestamp of [
    "2026-02-30T11:00:00Z",
    "invalid",
    q.departureDate + "T11:00:00+10:00",
  ]) {
    assert.deepEqual(
      normalizeSeats({
        data: [
          {
            Source: "velocity",
            AvailabilityTrips: [
              {
                ...trip,
                AvailabilitySegments: [
                  { ...trip.AvailabilitySegments[0], DepartsAt: timestamp },
                ],
              },
            ],
          },
        ],
      }),
      [],
    );
  }
  assert.equal(
    normalizeSeats({
      data: [
        {
          Source: "velocity",
          AvailabilityTrips: [{ ...trip, TaxesCurrency: "" }],
        },
      ],
    })[0].totalCharges,
    null,
  );
  assert.throws(() => normalizeSeats({ bad: 1 }));
});
test("Surcharge filters omit unknown amounts, while highest-value sorting puts unknown last", () => {
  const a = plan([leg("MEL", "LAX")]),
    b = plan([leg("MEL", "LAX", "QF")]);
  const manual = { [a.redemptions[0].id]: { cash: 2000, charges: 150 } };
  assert.equal(
    resultList([b, a], emptyFilters(), "value", emptyWallet(), manual)[0].id,
    a.id,
  );
  assert.equal(
    resultList(
      [a, b],
      { ...emptyFilters(), maxCharges: "200" },
      "points",
      emptyWallet(),
      manual,
    ).length,
    1,
  );
});

test("Cached searches remain available when the paid-provider budget is exhausted", async () => {
  const data = { itineraries: [], notices: [] };
  let reservations = 0;
  const deps = {
    read: async () => data,
    reserve: async () => {
      reservations++;
      return false;
    },
    search: async () => {
      throw new Error("Cache hit must not call provider");
    },
    write: async () => {
      throw new Error("Cache hit must not refresh expiry");
    },
  };
  const results = await Promise.all(
    Array.from({ length: 35 }, () => cachedFlights(deps)),
  );
  assert.equal(reservations, 0);
  assert.ok(results.every((r) => r === data));
});

test("Mixed flexible-date searches reserve only their missing dates", async () => {
  const data = { itineraries: [], notices: [] };
  let reservations = 0,
    calls = 0,
    writes = 0;
  await Promise.all(
    Array.from({ length: 7 }, (_, i) =>
      cachedFlights({
        read: async () => (i < 5 ? data : null),
        reserve: async () => {
          reservations++;
          return true;
        },
        search: async () => {
          calls++;
          return data;
        },
        write: async () => {
          writes++;
        },
      }),
    ),
  );
  assert.equal(reservations, 2);
  assert.equal(calls, 2);
  assert.equal(writes, 2);
});

test("Expired offers require a reservation and budget rejection never calls the provider", async () => {
  const data = normalizeDuffel(
    { data: { live_mode: true, offers: [duffelOffer()] } },
    q,
  );
  const itinerary = data.itineraries[0];
  itinerary.cashFare!.expiresAt = "2026-01-01T00:00:00Z";
  let calls = 0,
    reservations = 0;
  await assert.rejects(
    () =>
      cachedFlights({
        read: async () => ({ itineraries: [itinerary], notices: [] }),
        reserve: async () => {
          reservations++;
          return false;
        },
        search: async () => {
          calls++;
          return { itineraries: [], notices: [] };
        },
        write: async () => {},
      }),
    ProviderBudgetExceeded,
  );
  assert.equal(reservations, 1);
  assert.equal(calls, 0);
});

test("Concurrent cache misses cannot call the provider without a successful reservation", async () => {
  let remaining = 28,
    calls = 0;
  const results = await Promise.allSettled(
    Array.from({ length: 40 }, () =>
      cachedFlights({
        read: async () => null,
        // An atomic-reservation test double; production uses a conditional PostgreSQL upsert.
        reserve: async () => (remaining > 0 ? (remaining--, true) : false),
        search: async () => {
          calls++;
          return { itineraries: [], notices: [] };
        },
        write: async () => {},
      }),
    ),
  );
  assert.equal(calls, 28);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 28);
  assert.ok(
    results
      .filter((r) => r.status === "rejected")
      .every((r) => r.reason instanceof ProviderBudgetExceeded),
  );
});

test("Currency display retains the currency's normal minor units", () => {
  assert.match(formatMoney(150.5, "AUD", "code"), /^AUD\s150\.50$/);
  assert.match(formatMoney(150.5, "USD", "code"), /^USD\s150\.50$/);
  assert.match(formatMoney(150.5, "JPY", "code"), /^JPY\s151$/);
  assert.match(formatMoney(150.505, "KWD", "code"), /^KWD\s150\.505$/);
});
