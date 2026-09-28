import {
  cachedFlights,
  ProviderBudgetExceeded,
} from "../../../search/cached-flights";
import {
  validateQuery,
  flexibleQueries,
  today,
} from "../../../../lib/search/query";
import { DuffelProvider } from "../../../../lib/providers/flights/duffel.server";
import { SeatsAeroProvider } from "../../../../lib/providers/awards/seats-aero.server";
import { calculatedOptions } from "../../../../lib/providers/awards/calculated";
import {
  applyObservations,
  type AwardObservation,
} from "../../../../lib/providers/awards/types";
import {
  cacheGet,
  cacheSet,
  cacheKey,
  takeSearchBudget,
} from "../../../db/client";
import type { SearchResponse } from "../../../../lib/types";
export const runtime = "nodejs";
export const maxDuration = 60;
function cors(request: Request): Headers | null {
  const allowed = process.env.ALLOWED_ORIGIN;
  if (!allowed || request.headers.get("origin") !== allowed) return null;
  return new Headers({
    "Access-Control-Allow-Origin": allowed,
    Vary: "Origin",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Cache-Control": "no-store",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
  });
}
export async function OPTIONS(request: Request) {
  const headers = cors(request);
  return new Response(null, {
    status: headers ? 204 : 403,
    headers: headers ?? {},
  });
}
export async function POST(request: Request) {
  const headers = cors(request);
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: headers ?? { "Content-Type": "application/json" },
    });
  if (!headers) return reply({ error: "This origin is not enabled." }, 403);
  if (
    process.env.ENABLE_LIVE_SEARCH !== "true" ||
    !process.env.DUFFEL_ACCESS_TOKEN ||
    !process.env.DATABASE_URL
  )
    return reply(
      {
        error: "Live search is not connected yet. Use route estimates for now.",
      },
      503,
    );
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply({ error: "Expected a JSON search request." }, 415);
  let query;
  try {
    const reader = request.body?.getReader();
    let length = 0;
    const chunks: Uint8Array[] = [];
    if (!reader) throw new Error("Missing search.");
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192) {
        await reader.cancel();
        return reply({ error: "Search request is too large." }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    query = validateQuery(JSON.parse(new TextDecoder().decode(bytes)));
  } catch (e) {
    return reply(
      {
        error:
          e instanceof Error && !(e instanceof SyntaxError)
            ? e.message
            : "Invalid search request.",
      },
      400,
    );
  }
  try {
    const queries = flexibleQueries(query);
    const flights = new DuffelProvider(process.env.DUFFEL_ACCESS_TOKEN),
      awards = process.env.SEATS_AERO_API_KEY
        ? new SeatsAeroProvider(process.env.SEATS_AERO_API_KEY)
        : null;
    const results = await Promise.allSettled(
      queries.map(async (q) => {
        const key = cacheKey({ v: 1, provider: "duffel", q });
        const data = await cachedFlights({
          read: () =>
            cacheGet<Awaited<ReturnType<DuffelProvider["search"]>>>(
              "flights",
              key,
            ),
          reserve: () => takeSearchBudget(1),
          search: () => flights.search(q),
          write: (data) => cacheSet("flights", key, data, 300),
        });
        const observations: AwardObservation[] = [];
        const notices = [...data.notices];
        if (awards) {
          const legs = [
            {
              origin: q.origin,
              destination: q.destination,
              date: q.departureDate,
            },
            ...(q.returnDate
              ? [
                  {
                    origin: q.destination,
                    destination: q.origin,
                    date: q.returnDate,
                  },
                ]
              : []),
          ];
          for (const leg of legs) {
            try {
              const ak = cacheKey({ v: 1, ...leg, cabin: q.cabin });
              let awardData = await cacheGet<
                Awaited<ReturnType<SeatsAeroProvider["search"]>>
              >("awards", ak);
              if (!awardData) {
                awardData = await awards.search(
                  leg.origin,
                  leg.destination,
                  leg.date,
                  q.cabin,
                );
                await cacheSet("awards", ak, awardData, 900);
              }
              observations.push(...awardData.observations);
              notices.push(...awardData.notices);
            } catch {
              notices.push(
                "Award data could not be checked. Unmatched options remain calculated.",
              );
            }
          }
        } else
          notices.push(
            "Award inventory is not connected. All reward options are calculated.",
          );
        return {
          notices,
          itineraries: data.itineraries.map((i) =>
            applyObservations(
              { ...i, redemptions: calculatedOptions(i, today()) },
              observations,
            ),
          ),
        };
      }),
    );
    const fulfilled = results.filter(
      (
        x,
      ): x is PromiseFulfilledResult<
        Awaited<ReturnType<typeof flights.search>>
      > => x.status === "fulfilled",
    );
    const budgetExceeded = results.some(
      (r) =>
        r.status === "rejected" && r.reason instanceof ProviderBudgetExceeded,
    );
    if (!fulfilled.length && budgetExceeded)
      return reply(
        { error: "Search is busy. Please try again in a minute." },
        429,
      );
    if (!fulfilled.length)
      return reply(
        {
          error:
            "Flight search is temporarily unavailable. Try again or switch to route estimates.",
        },
        502,
      );
    const notices = [...new Set(fulfilled.flatMap((x) => x.value.notices))];
    if (budgetExceeded)
      notices.push(
        "Some uncached dates reached the live-search limit. Available results are shown.",
      );
    if (fulfilled.length < queries.length)
      notices.push("Some dates could not be searched; results are incomplete.");
    const response: SearchResponse = {
      mode: "live",
      searchedAt: new Date().toISOString(),
      notices,
      itineraries: fulfilled.flatMap((x) => x.value.itineraries),
    };
    return reply(response);
  } catch {
    return reply(
      {
        error:
          "Live search is temporarily unavailable. Your saved balances are unaffected.",
      },
      503,
    );
  }
}
