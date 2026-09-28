# Flight Rewards

A React + TypeScript app for comparing Qantas and Velocity redemptions. The interface follows this collection’s bone palette, serif headings and shared interaction primitives. `app.js` is compiled and committed so GitHub Pages can serve the folder without changing the existing publishing setup.

## What works on GitHub Pages

- Illustrative route search and a custom one-to-three-segment route builder, with one-way/return, adult passenger totals, cabin choices, airline inclusion/exclusion and stops.
- Separate Qantas and Velocity calculators using versioned reward charts, great-circle statute miles, connections, stopovers, changes of airline/table and mixed cabins.
- Partner redemptions grouped under the itinerary. No points transfer is implied or performed.
- A manual Qantas/Velocity wallet, editable AUD-cent valuations and points-shortfall/coverage indicators.
- Per-option cash comparison, cents per point and effective cost. User-entered amounts cover the whole trip and all passengers. Unknown charges are never substituted with zero. Foreign-currency fares do not enter AUD calculations without a user-supplied AUD equivalent.
- Program, airline, cabin, availability, wallet, maximum-points and maximum-charge filters; sorting by points, charges, effective cost, value and stops. Duration/departure sorting becomes available for actual scheduled results.
- Sources, chart effective dates, booking instructions and links to each booking program.

**The default Pages app is a planning calculator, not a live flight or award search.** Illustrative routes have no flight numbers, schedules, cash prices, aircraft or seat counts. Dates do not establish flight operation. Route seeds are examples for exploring chart pricing, not a maintained route network. A custom route means “price these supplied segments”, not “these flights exist”. Return planning mirrors the outbound route and assumes valid connections on the return. No mock flight or fare is presented as real.

Live acceptance criteria require the external backend and provider accounts described below. That service has source code and a database migration here, but is not hosted or credentialled by this PR. Accounts, cloud wallet synchronisation and stored personal search history are not enabled. Their database models are included for later authenticated use; the current API never writes anonymous wallet or user-history records.

## Run, edit and validate

Serve the repository root (not just this folder) to keep the shared imports and All apps links working:

```sh
python3 -m http.server 8000
# Open http://localhost:8000/apps/flight-rewards/
```

For TypeScript changes, from `apps/flight-rewards/` (Node.js 22.12+ recommended):

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run build:api
npx playwright install chromium
npm run test:browser
cd ../..
python3 scripts/validate.py
```

Commit source, lockfile, generated `app.js`/licence file, app metadata and the catalog together. Do not hand-edit the generated bundle. `scripts/build.mjs` rejects server provider/database modules in its browser dependency graph. The repository validator excludes dependency and Next build directories, but still checks the committed JS and relative HTML links. `npm test` exercises pricing boundaries, historical charts, connections, totals, wallet rules, unknown costs, provider mapping and award matching with deterministic fixtures; it makes no airline/provider requests.

`npm run test:browser` starts a temporary local server on port 8123 and checks search, comparisons, filters, custom connections, return/passenger totals, wallet persistence and blocked-storage feedback, keyboard submission, collection navigation, reduced motion, 320/375-pixel layouts and 200% text. It also runs automated WCAG A/AA checks with axe. Screenshots go into ignored `test-results/`. These Chromium checks do not replace manual assistive-technology or physical-device testing.

## Device-local storage

Only the wallet and valuations persist, under `mario-flight-rewards-wallet-v1`. Values are manually entered; no membership IDs, airline passwords, PINs, payment details or API keys are requested. Wallet save is explicit. Blocked/full storage produces an honest visit-only message. A blank balance is unknown; zero is a known zero. Clearing site data removes saved values. Searches, custom routes and manual fare comparisons are session-only. There is no automatic cloud sync or transfer between browsers/origins.

## Optional live backend

`server/` is a separate Next.js server deployment with a `POST /api/search` route, PostgreSQL and Drizzle. It cannot run on GitHub Pages. The public client continues to live at `/apps/flight-rewards/`.

1. Provision an external Node/Next.js host and PostgreSQL instance. This repository does not create those services or change Pages hosting.
2. In that host’s secret/environment configuration, set `DATABASE_URL`, `DUFFEL_ACCESS_TOKEN`, optional `SEATS_AERO_API_KEY`, and `ALLOWED_ORIGIN=https://stavreskimario.github.io`. Set `ENABLE_LIVE_SEARCH=true` only when ready. Use the provider’s appropriate account/access permissions; Seats.aero API access has account and usage restrictions. Do not paste real values into the repository or `config.json`.
3. With `DATABASE_URL` in the process environment, run `npm run db:setup` from `apps/flight-rewards/`. This applies the initial schema in a transaction and inserts catalog/chart seeds. Existing chart versions are never overwritten. Prefer a migration/seed role with write permissions, and give the runtime only the cache/rate-limit permissions it needs.
4. Build with `npm ci && npm run build:api`, then start with `npm run start:api`. The host must support the Node runtime and a request timeout of at least 60 seconds. For local development, `npm run dev:api`; supply environment variables in the process or `server/.env.local` (ignored by git).
5. In a feature-branch PR, set the **public URL only** in `config.json`, e.g. `{ "apiBaseUrl": "https://your-flight-api.example" }`. No credentials go in this file. The client enables Live flights when a valid HTTPS endpoint is configured. “Connected” describes configuration, not a health check; provider failures remain visible.
6. Validate with real provider sandbox credentials before enabling production data. Duffel test offers are explicitly labelled as test data. The original provider data must be reviewed against actual production payloads before release; the current automated adapter tests use documented fixtures.

The route validates allowed airports, dates, travellers, cabins, stops and airline IDs; bounds request bodies; uses provider timeouts; and permits only the configured browser origin. **CORS is not authentication.** A PostgreSQL global work budget limits paid search requests across instances (28 date-search units per minute; flexible search consumes up to seven). Protect a public deployment with the host’s traffic controls and provider account spend limits. No endpoint accepts arbitrary provider URLs. Errors do not return tokens, connection strings or raw provider responses.

Flexible search checks up to seven departures. For returns it shifts both dates together, maintaining the selected trip length, rather than performing a 49-combination grid. Failed dates generate an incomplete-results notice. Searches use actual offered cabins, including mixed-cabin itineraries. Offers are deduplicated by operating flights, segment route, local departure and cabin; the lowest comparable currency fare is retained. These may have different baggage/refund conditions from rewards.

### Provider boundaries and caches

| Layer | Implementation | Behaviour |
| --- | --- | --- |
| Cash flight search | `lib/providers/flights/duffel.server.ts` | Maps offers to canonical types; no raw objects leave the adapter. Keeps passenger/return totals and currency; rejects incomplete routes. |
| Award estimates | `lib/providers/awards/calculated.ts` | Available without a provider; status is always `CALCULATED`, checkedAt/seat count are null. |
| Award inventory | `lib/providers/awards/seats-aero.server.ts` | Reads cached Qantas/Velocity trip records only. No scraping or consumer website automation. |
| Matching | `lib/providers/awards/types.ts` | Matches every segment’s route, number, local departure, cabin and booking program. Every return slice must match. Known insufficient quantities, mixed cabins, other programs and observations older than 24 hours are not promoted. |
| Flight/cache expiry | PostgreSQL | Five minutes, also invalidated when the provider’s offer expires. Schedules share the fare cache; they are not reused as independent live availability. |
| Award cache | PostgreSQL | Fifteen minutes; original inventory timestamps are preserved. Cache refresh never implies fresh inventory. |
| Static catalog/charts | Versioned local JSON | Reviewed 28 September 2026, not refreshed during searches. Add versions with new effective dates instead of replacing historical rates. |

Cached Seats.aero data is **INDICATIVE**, never CONFIRMED. Unknown quantity stays null (including Qantas, which does not supply a reliable count). Matching a seat without a known quantity does not establish availability for the whole party. A missing match is not evidence that a route has no seats. `CONFIRMED` exists in the domain and UI for a future appropriate live source; no current adapter emits it.

Provider total cash charges may be available without a tax/carrier-charge breakdown. Those components remain null, and the combined quoted amount is shown. Only explicit AUD totals are used directly in value calculations. No FX rate is guessed. No ticket issuance, orders, payments or automated points transfers are implemented.

### Database model coverage

Drizzle models and `server/db/migrations/0001_initial.sql` cover User, Airport, Airline, LoyaltyProgram, RedemptionPartner, RewardChart, RewardChartVersion, PointsBalance, PointValuation, SearchHistory, CachedFlightSearch and CachedAwardAvailability, plus a shared search rate-limit table. Foreign keys preserve relationships; program partnership records contain no transfer capability. Chart snapshots are append-only in the seed process. Date boundaries are inclusive.

## Reward data and pricing limitations

Source links are also visible inside the app:

- [Qantas Classic Flight Reward tables](https://www.qantas.com/en-au/frequent-flyer/use-points/classic-flight-rewards/tables)
- [Qantas terms: Trip definition and section 14.3](https://www.qantas.com/en-au/frequent-flyer/join/terms-conditions)
- [Qantas Emirates partner page](https://www.qantas.com/en-au/where-we-fly/partner-airlines/emirates)
- [Velocity reward tables and connection rules](https://www.velocityfrequentflyer.com/flying-status/use-points-for-flights)
- [Velocity January 2025 changes and archived domestic range](https://www.velocityfrequentflyer.com/velocity-program-changes/changes-to-points-earn-and-reward-seats)
- [Velocity Singapore Airlines restrictions](https://www.velocityfrequentflyer.com/partners-offers/airlines/singapore-airlines)
- [Duffel offer requests](https://duffel.com/docs/api/offer-requests), [Seats.aero concepts](https://developers.seats.aero/reference/concepts-copy), [cached search](https://developers.seats.aero/reference/cached-search)

Qantas QF/AA, partner and Emirates tables are distinct. Emirates moves from the partner chart to Qantas on 5 August 2025, then to its own chart on 31 March 2026. The current Emirates table’s “Return Miles” heading is inconsistent with the per-Trip introduction: one-way pricing is cross-checked against Qantas’ Sydney–Dubai economy example (53,100) and Sydney–Dubai business example (143,000) on its Emirates partner pages. The overlapping printed 1,201-mile endpoint is normalised into contiguous 600/1,200/2,400 bands.

Qantas adds flown segment miles within a Trip, breaks Trips at stopovers, partner-carrier/table changes, return boundaries and the 15,000-mile limit. Mixed-cabin pricing uses the lower of highest-cabin Trip pricing or splitting at cabin changes. The app does not implement oneworld round-the-world awards or a best-ticketing optimisation across complex loops; custom routes are for linear journeys.

Velocity uses separate United, Singapore/Qatar, Air Canada/ANA and Virgin Australia domestic/short-haul tables. Domestic economy shows the entire range; affordability and maximum-points filters use its upper bound. Value/points sorting uses the minimum and is labelled as such in comparisons. Stopovers, cabin changes and table changes split pricing. Domestic overnight connections use the local calendar day; other connections use a 24-hour limit.

Codeshares, special Virgin Australia/Doha region pricing, unsupported date versions and out-of-chart distances produce **Quote required** instead of a guessed value. Singapore Airlines First rewards and flights to/from China/Hong Kong are excluded from Velocity estimates. The shared premium-economy chart does not establish UA/AC/ANA eligibility; those estimates are withheld. Emirates First status/age restrictions are called out without collecting or promising status-dependent inventory.

Airport coordinates and IANA timezones are a small bundled planning catalog, not an exhaustive airport directory. Actual carrier mileage, routing restrictions and availability can differ. Verify all estimates and unavoidable charges on the booking program’s site.
