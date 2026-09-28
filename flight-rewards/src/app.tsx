import {
  useEffect,
  useMemo,
  useRef,
  useState,
  Component,
  type ErrorInfo,
  type ReactNode,
  type FormEvent,
} from "react";
import { createRoot } from "react-dom/client";
import type {
  Cabin,
  ManualComparison,
  SearchQuery,
  SearchResponse,
  Wallet,
} from "../lib/types";
import { cabins } from "../lib/types";
import { airlines, cabinLabel } from "../lib/loyalty/catalog";
import {
  airports,
  airportByCode,
  shiftDate,
  today,
  validateQuery,
} from "../lib/search/query";
import {
  searchPlanning,
  plannedItinerary,
  type PlannedLeg,
} from "../lib/providers/flights/planning";
import { emptyFilters, resultList, type Sort } from "../lib/search/results";
import { parseWallet, walletKey, emptyWallet } from "../lib/points/wallet";
import {
  Field,
  Guide,
  ItineraryCard,
  Segmented,
  WalletPanel,
  dateLabel,
} from "./components";

const initialQuery: SearchQuery = {
  origin: "MEL",
  destination: "LAX",
  departureDate: shiftDate(today(), 60),
  returnDate: null,
  passengers: 1,
  cabin: "economy",
  directOnly: false,
  maxStops: 1,
  flexDays: 0,
  preferredAirlines: [],
  excludedAirlines: [],
};
function loadWallet() {
  try {
    return { wallet: parseWallet(localStorage.getItem(walletKey)), notice: "" };
  } catch {
    return {
      wallet: emptyWallet(),
      notice:
        "Saved wallet could not be read. You can enter balances for this visit.",
    };
  }
}
function AirportChoices() {
  return (
    <>
      {airports.map((a) => (
        <option value={a.iata} key={a.iata}>
          {a.iata} · {a.city}
        </option>
      ))}
    </>
  );
}
function App() {
  const [q, setQ] = useState<SearchQuery>(initialQuery),
    [mode, setMode] = useState<"planning" | "live">("planning"),
    [backend, setBackend] = useState<string | null>(null);
  const [response, setResponse] = useState<SearchResponse | null>(null),
    [activeQuery, setActiveQuery] = useState<SearchQuery | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [walletState, setWalletState] = useState(loadWallet),
    [filters, setFilters] = useState(emptyFilters),
    [sort, setSort] = useState<Sort>("points"),
    [manual, setManual] = useState<Record<string, ManualComparison>>({});
  const [custom, setCustom] = useState<
    { destination: string; airline: string; cabin: Cabin; stopover: boolean }[]
  >([{ destination: "LAX", airline: "QF", cabin: "economy", stopover: false }]);
  const searchRef = useRef(0),
    abortRef = useRef<AbortController | null>(null),
    resultsRef = useRef<HTMLElement>(null);
  useEffect(() => {
    fetch("./config.json", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((c) => {
        if (typeof c.apiBaseUrl === "string") {
          const u = new URL(c.apiBaseUrl);
          if (
            u.protocol === "https:" ||
            (u.protocol === "http:" &&
              ["localhost", "127.0.0.1"].includes(u.hostname))
          )
            setBackend(u.href.replace(/\/$/, ""));
        }
      })
      .catch(() => {});
    return () => abortRef.current?.abort();
  }, []);
  function update<K extends keyof SearchQuery>(key: K, value: SearchQuery[K]) {
    setQ((s) => ({ ...s, [key]: value }));
  }
  function saveWallet(wallet: Wallet) {
    let notice = "Wallet saved on this device.";
    try {
      localStorage.setItem(walletKey, JSON.stringify({ version: 1, wallet }));
    } catch {
      notice = "Storage is unavailable. Your wallet works for this visit only.";
    }
    setWalletState({ wallet, notice });
  }
  async function search(query = q, customLegs?: PlannedLeg[]) {
    const id = ++searchRef.current;
    abortRef.current?.abort();
    setError("");
    try {
      const valid = validateQuery(query);
      setBusy(true);
      let next: SearchResponse;
      if (customLegs) {
        const itinerary = plannedItinerary(customLegs, valid);
        next = {
          itineraries: [itinerary],
          searchedAt: new Date().toISOString(),
          mode: "planning",
          notices: [
            "Custom route estimate. You supplied the routing; no flights, connection times, operating cabins or reward seats have been checked.",
          ],
        };
      } else if (mode === "planning") {
        next = searchPlanning(valid);
      } else {
        if (!backend)
          throw new Error(
            "Live search is not connected. Choose Route estimates to continue.",
          );
        const controller = new AbortController();
        abortRef.current = controller;
        const timer = window.setTimeout(() => controller.abort(), 65000);
        try {
          const r = await fetch(`${backend}/api/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(valid),
            signal: controller.signal,
          });
          const payload = await r.json();
          if (!r.ok)
            throw new Error(
              typeof payload.error === "string"
                ? payload.error
                : "Live search is unavailable.",
            );
          if (
            payload.mode !== "live" ||
            !Array.isArray(payload.itineraries) ||
            !Array.isArray(payload.notices) ||
            payload.itineraries.some(
              (i: SearchResponse["itineraries"][number]) =>
                !Array.isArray(i.segments) ||
                !i.segments.length ||
                !Array.isArray(i.redemptions),
            )
          )
            throw new Error(
              "Live search returned incomplete data. Please try again.",
            );
          next = payload as SearchResponse;
        } finally {
          clearTimeout(timer);
        }
      }
      if (id !== searchRef.current) return;
      setResponse(next);
      setActiveQuery(valid);
      setFilters(emptyFilters());
      setManual({});
      requestAnimationFrame(() =>
        resultsRef.current?.focus({ preventScroll: true }),
      );
    } catch (e) {
      if (id === searchRef.current)
        setError(
          e instanceof Error
            ? e.name === "AbortError"
              ? "Search timed out or was cancelled. Please try again."
              : e.message
            : "Search could not be completed.",
        );
    } finally {
      if (id === searchRef.current) setBusy(false);
    }
  }
  function submit(e: FormEvent) {
    e.preventDefault();
    void search();
  }
  function preset(origin: string, destination: string) {
    const next = { ...q, origin, destination, directOnly: false };
    setQ(next);
    void search(next);
  }
  function customSearch() {
    const destinations = custom.map((s, i) =>
      i === custom.length - 1 ? q.destination : s.destination,
    );
    const legs = custom.map((s, i) => ({
      ...s,
      origin: i === 0 ? q.origin : destinations[i - 1],
      destination: destinations[i],
    }));
    void search(
      {
        ...q,
        preferredAirlines: [],
        excludedAirlines: [],
        maxStops: 2,
        directOnly: false,
        flexDays: 0,
      },
      legs,
    );
  }
  const visible = useMemo(
    () =>
      resultList(
        response?.itineraries ?? [],
        filters,
        sort,
        walletState.wallet,
        manual,
      ),
    [response, filters, sort, walletState.wallet, manual],
  );
  const hasSchedule = response?.itineraries.some((i) => i.kind === "scheduled");
  return (
    <>
      <div className="site-shell">
        <header className="site-header">
          <a href="../">← All apps</a>
          <a className="wordmark app-brand" href="#main">
            Flight Rewards <span aria-hidden="true">↗</span>
          </a>
          <nav aria-label="App sections">
            <a href="#wallet">My wallet</a>
            <a href="#guide">Field guide</a>
          </nav>
        </header>
        <main id="main">
          <section className="hero" aria-labelledby="title">
            <div>
              <p className="eyebrow">For the way you want to go</p>
              <h1 id="title">
                Your points.
                <br />
                <em>More possibilities.</em>
              </h1>
              <p className="hero-description">
                Find a way there with Qantas or Velocity.
                <br className="desktop-break" /> Compare the points, the
                partners, and the price.
              </p>
            </div>
            <div className="travel-note" aria-hidden="true">
              <svg viewBox="0 0 260 150">
                <path
                  d="M18 113Q59-4 171 44T238 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="4 5"
                />
                <circle
                  cx="18"
                  cy="113"
                  r="5"
                  fill="var(--paper)"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="m238 32-19 4 9 5 3 10 7-19Z"
                  fill="var(--paper)"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle
                  cx="125"
                  cy="81"
                  r="39"
                  fill="none"
                  stroke="currentColor"
                  opacity=".2"
                />
                <text x="125" y="76" textAnchor="middle">
                  QF + VA
                </text>
                <text x="125" y="94" textAnchor="middle" fontSize="9">
                  A LITTLE FURTHER
                </text>
              </svg>
              <p className="handwritten">the journey starts here.</p>
            </div>
          </section>
          <div className="workspace">
            <div className="main-column">
              <section
                className="search-panel panel"
                aria-labelledby="search-title"
              >
                <div className="section-top">
                  <h2 id="search-title">Where are we going?</h2>
                  <span className="small muted">01 / The plan</span>
                </div>
                <div className="mode-row">
                  <Segmented
                    label="Search mode"
                    value={mode}
                    options={[
                      { value: "planning", label: "Route estimates" },
                      {
                        value: "live",
                        label: "Live flights",
                        disabled: !backend,
                      },
                    ]}
                    onChange={(v) => {
                      setMode(v as "planning" | "live");
                      searchRef.current++;
                      abortRef.current?.abort();
                      setBusy(false);
                      setError("");
                    }}
                  />
                  <span className="mode-caption">
                    {backend
                      ? "Live search connected"
                      : "Live flight search not connected"}
                  </span>
                </div>
                <form onSubmit={submit}>
                  <div className="route-fields">
                    <Field label="From">
                      <select
                        value={q.origin}
                        onChange={(e) => update("origin", e.target.value)}
                      >
                        <AirportChoices />
                      </select>
                    </Field>
                    <button
                      className="swap"
                      type="button"
                      aria-label="Swap origin and destination"
                      onClick={() =>
                        setQ((s) => ({
                          ...s,
                          origin: s.destination,
                          destination: s.origin,
                        }))
                      }
                    >
                      ⇄
                    </button>
                    <Field label="To">
                      <select
                        value={q.destination}
                        onChange={(e) => update("destination", e.target.value)}
                      >
                        <AirportChoices />
                      </select>
                    </Field>
                  </div>
                  <div className="trip-controls">
                    <Segmented
                      label="Trip type"
                      value={q.returnDate ? "return" : "oneway"}
                      options={[
                        { value: "oneway", label: "One way" },
                        { value: "return", label: "Return" },
                      ]}
                      onChange={(v) =>
                        update(
                          "returnDate",
                          v === "return" ? shiftDate(q.departureDate, 7) : null,
                        )
                      }
                    />
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={q.directOnly}
                        onChange={(e) => update("directOnly", e.target.checked)}
                      />
                      Nonstop only
                    </label>
                  </div>
                  <div className="search-fields">
                    <Field label="Departure">
                      <input
                        type="date"
                        required
                        min={today()}
                        max={shiftDate(today(), 365)}
                        value={q.departureDate}
                        onChange={(e) =>
                          update("departureDate", e.target.value)
                        }
                      />
                    </Field>
                    {q.returnDate !== null && (
                      <Field label="Return">
                        <input
                          type="date"
                          required
                          min={q.departureDate}
                          max={shiftDate(today(), 365)}
                          value={q.returnDate}
                          onChange={(e) => update("returnDate", e.target.value)}
                        />
                      </Field>
                    )}
                    <Field label="Travellers">
                      <select
                        value={q.passengers}
                        onChange={(e) =>
                          update("passengers", Number(e.target.value))
                        }
                      >
                        {Array.from({ length: 9 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>
                            {i + 1} adult{i === 0 ? "" : "s"}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Cabin">
                      <select
                        value={q.cabin}
                        onChange={(e) =>
                          update("cabin", e.target.value as Cabin)
                        }
                      >
                        {cabins.map((c) => (
                          <option value={c} key={c}>
                            {cabinLabel(c)}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <details className="search-options">
                    <summary>Airlines, stops & flexible dates</summary>
                    <div className="option-grid">
                      <Field label="Maximum stops">
                        <select
                          disabled={q.directOnly}
                          value={q.directOnly ? 0 : q.maxStops}
                          onChange={(e) =>
                            update("maxStops", Number(e.target.value))
                          }
                        >
                          <option value="0">Nonstop</option>
                          <option value="1">1 stop</option>
                          <option value="2">2 stops</option>
                        </select>
                      </Field>
                      <Field
                        label="Date flexibility"
                        hint="For returns, both dates shift together, keeping the same trip length."
                      >
                        <select
                          value={q.flexDays}
                          onChange={(e) =>
                            update("flexDays", Number(e.target.value) as 0 | 3)
                          }
                        >
                          <option value="0">Exact dates</option>
                          <option value="3">±3 days</option>
                        </select>
                      </Field>
                      <Field
                        label="Preferred airlines"
                        hint="Optional. Select more than one with Ctrl / Command."
                      >
                        <select
                          multiple
                          value={q.preferredAirlines}
                          onChange={(e) =>
                            update(
                              "preferredAirlines",
                              Array.from(
                                e.target.selectedOptions,
                                (o) => o.value,
                              ),
                            )
                          }
                        >
                          {airlines.map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label="Excluded airlines"
                        hint="Leave blank to include every supported airline."
                      >
                        <select
                          multiple
                          value={q.excludedAirlines}
                          onChange={(e) =>
                            update(
                              "excludedAirlines",
                              Array.from(
                                e.target.selectedOptions,
                                (o) => o.value,
                              ),
                            )
                          }
                        >
                          {airlines.map((a) => (
                            <option key={a.code} value={a.code}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() =>
                        setQ((s) => ({
                          ...s,
                          preferredAirlines: [],
                          excludedAirlines: [],
                          flexDays: 0,
                          maxStops: 1,
                        }))
                      }
                    >
                      Reset extra options
                    </button>
                  </details>
                  <div className="search-action">
                    <button type="submit" className="button search-button">
                      {busy
                        ? "Searching…"
                        : mode === "planning"
                          ? "Explore points options"
                          : "Search live flights"}{" "}
                      <span aria-hidden="true">↗</span>
                    </button>
                    <p className="small muted">
                      {mode === "planning"
                        ? "Chart prices, with reward availability clearly marked as unverified."
                        : "Search cash schedules, then check supported reward sources."}
                    </p>
                  </div>
                  {busy && (
                    <button
                      className="text-button"
                      type="button"
                      onClick={() => {
                        searchRef.current++;
                        abortRef.current?.abort();
                        setBusy(false);
                        setError("Search cancelled.");
                      }}
                    >
                      Cancel search
                    </button>
                  )}
                </form>
                {mode === "planning" && (
                  <details className="custom-builder">
                    <summary>Have a specific route? Build an estimate</summary>
                    <p className="small muted">
                      Choose up to three segments, including mixed airlines or
                      cabins. This replaces the illustrative routing. Return
                      estimates mirror the route with connections.
                    </p>
                    {custom.map((leg, index) => (
                      <div className="custom-leg" key={index}>
                        <strong>
                          Leg {index + 1} · from{" "}
                          {index === 0
                            ? q.origin
                            : custom[index - 1].destination}
                        </strong>
                        <div className="option-grid">
                          <Field label={`Leg ${index + 1} destination`}>
                            <select
                              value={
                                index === custom.length - 1
                                  ? q.destination
                                  : leg.destination
                              }
                              disabled={index === custom.length - 1}
                              onChange={(e) =>
                                setCustom((rows) =>
                                  rows.map((r, n) =>
                                    n === index
                                      ? { ...r, destination: e.target.value }
                                      : r,
                                  ),
                                )
                              }
                            >
                              <AirportChoices />
                            </select>
                          </Field>
                          <Field label={`Leg ${index + 1} airline`}>
                            <select
                              value={leg.airline}
                              onChange={(e) =>
                                setCustom((rows) =>
                                  rows.map((r, n) =>
                                    n === index
                                      ? { ...r, airline: e.target.value }
                                      : r,
                                  ),
                                )
                              }
                            >
                              {airlines.map((a) => (
                                <option key={a.code} value={a.code}>
                                  {a.name}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label={`Leg ${index + 1} cabin`}>
                            <select
                              value={leg.cabin}
                              onChange={(e) =>
                                setCustom((rows) =>
                                  rows.map((r, n) =>
                                    n === index
                                      ? { ...r, cabin: e.target.value as Cabin }
                                      : r,
                                  ),
                                )
                              }
                            >
                              {cabins.map((c) => (
                                <option key={c} value={c}>
                                  {cabinLabel(c)}
                                </option>
                              ))}
                            </select>
                          </Field>
                          {index > 0 && (
                            <label className="check">
                              <input
                                type="checkbox"
                                checked={leg.stopover}
                                onChange={(e) =>
                                  setCustom((rows) =>
                                    rows.map((r, n) =>
                                      n === index
                                        ? { ...r, stopover: e.target.checked }
                                        : r,
                                    ),
                                  )
                                }
                              />
                              Stopover before this leg
                            </label>
                          )}
                        </div>
                        {custom.length > 1 && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              setCustom((rows) =>
                                rows.filter((_, n) => n !== index),
                              )
                            }
                          >
                            Remove leg {index + 1}
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="actions">
                      {custom.length < 3 && (
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() =>
                            setCustom((rows) => [
                              ...rows.slice(0, -1),
                              { ...rows.at(-1)!, destination: "SIN" },
                              {
                                destination: q.destination,
                                airline: rows.at(-1)!.airline,
                                cabin: q.cabin,
                                stopover: false,
                              },
                            ])
                          }
                        >
                          Add connection
                        </button>
                      )}
                      <button
                        type="button"
                        className="button"
                        onClick={customSearch}
                      >
                        Calculate my route
                      </button>
                    </div>
                  </details>
                )}
                {error && (
                  <p className="error-message" role="alert">
                    {error}
                  </p>
                )}
              </section>
              {!response && (
                <section className="start-state">
                  <p className="eyebrow">A few places to start</p>
                  <div className="presets">
                    <button onClick={() => preset("MEL", "LAX")}>
                      <strong>Melbourne → Los Angeles</strong>
                      <span>The Pacific crossing ↗</span>
                    </button>
                    <button onClick={() => preset("MEL", "LHR")}>
                      <strong>Melbourne → London</strong>
                      <span>A little further afield ↗</span>
                    </button>
                    <button onClick={() => preset("SYD", "MEL")}>
                      <strong>Sydney → Melbourne</strong>
                      <span>A quick change of scenery ↗</span>
                    </button>
                  </div>
                  <p className="small muted">
                    Try an illustrative route to explore the charts. These are
                    not scheduled flights.
                  </p>
                </section>
              )}
              <section
                className="results"
                tabIndex={-1}
                ref={resultsRef}
                aria-labelledby="results-title"
                aria-busy={busy}
              >
                {response && activeQuery && (
                  <>
                    <div className="results-heading">
                      <div>
                        <p className="eyebrow">02 / The possibilities</p>
                        <h2 id="results-title">
                          {airportByCode[activeQuery.origin].city} to{" "}
                          {airportByCode[activeQuery.destination].city}
                        </h2>
                        <p className="muted small">
                          {dateLabel(activeQuery.departureDate)}
                          {activeQuery.returnDate
                            ? ` – ${dateLabel(activeQuery.returnDate)}`
                            : ""}{" "}
                          · {activeQuery.passengers} adult
                          {activeQuery.passengers === 1 ? "" : "s"} ·{" "}
                          {cabinLabel(activeQuery.cabin)}
                        </p>
                      </div>
                    </div>
                    <div className="result-notice">
                      <strong>
                        {response.mode === "planning"
                          ? "Planning estimates · no live seats checked"
                          : "Cash schedules and reward options"}
                      </strong>
                      <p>
                        {response.mode === "planning"
                          ? response.notices[0]
                          : "A cash seat does not guarantee a reward seat. Read the availability label on each booking option."}
                      </p>
                      {response.notices.slice(
                        response.mode === "planning" ? 1 : 0,
                      ).length > 0 && (
                        <details>
                          <summary>Search notes</summary>
                          {response.notices
                            .slice(response.mode === "planning" ? 1 : 0)
                            .map((n, k) => (
                              <p key={k}>{n}</p>
                            ))}
                        </details>
                      )}
                    </div>
                    <div className="results-toolbar">
                      <div
                        className="filter-pills"
                        role="group"
                        aria-label="Filter loyalty program"
                      >
                        {(["all", "qantas", "velocity"] as const).map((p) => (
                          <button
                            key={p}
                            type="button"
                            aria-pressed={filters.program === p}
                            onClick={() =>
                              setFilters((s) => ({ ...s, program: p }))
                            }
                          >
                            {p === "all"
                              ? "All programs"
                              : p === "qantas"
                                ? "Qantas"
                                : "Velocity"}
                          </button>
                        ))}
                      </div>
                      <Field label="Sort results">
                        <select
                          value={sort}
                          onChange={(e) => setSort(e.target.value as Sort)}
                        >
                          <option value="points">Lowest points</option>
                          <option value="charges">Lowest cash charges</option>
                          <option value="effective">
                            Lowest effective cost
                          </option>
                          <option value="value">Highest cents per point</option>
                          <option value="duration" disabled={!hasSchedule}>
                            Shortest duration
                          </option>
                          <option value="stops">Fewest stops</option>
                          <option value="departure" disabled={!hasSchedule}>
                            Departure time
                          </option>
                        </select>
                      </Field>
                    </div>
                    <details className="result-filters">
                      <summary>
                        Refine results{" "}
                        <span className="muted">
                          · airline, availability, budget
                        </span>
                      </summary>
                      <div className="option-grid">
                        <Field label="Operating airline">
                          <select
                            value={filters.airline}
                            onChange={(e) =>
                              setFilters((s) => ({
                                ...s,
                                airline: e.target.value,
                              }))
                            }
                          >
                            <option value="all">All airlines</option>
                            {airlines.map((a) => (
                              <option key={a.code} value={a.code}>
                                {a.name}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Availability">
                          <select
                            value={filters.availability}
                            onChange={(e) =>
                              setFilters((s) => ({
                                ...s,
                                availability: e.target
                                  .value as typeof filters.availability,
                              }))
                            }
                          >
                            <option value="all">All availability</option>
                            <option value="CALCULATED">Calculated</option>
                            <option value="INDICATIVE">Indicative</option>
                            <option value="CONFIRMED">Confirmed</option>
                          </select>
                        </Field>
                        <Field label="Result cabin">
                          <select
                            value={filters.cabin}
                            onChange={(e) =>
                              setFilters((s) => ({
                                ...s,
                                cabin: e.target.value,
                              }))
                            }
                          >
                            <option value="all">All cabins</option>
                            {[...cabins, "mixed"].map((c) => (
                              <option key={c} value={c}>
                                {cabinLabel(c)}
                              </option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Maximum points (trip total)">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={filters.maxPoints}
                            placeholder="No limit"
                            onChange={(e) =>
                              setFilters((s) => ({
                                ...s,
                                maxPoints: e.target.value,
                              }))
                            }
                          />
                        </Field>
                        <Field label="Maximum cash charges (AUD)">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={filters.maxCharges}
                            placeholder="No limit"
                            onChange={(e) =>
                              setFilters((s) => ({
                                ...s,
                                maxCharges: e.target.value,
                              }))
                            }
                          />
                        </Field>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={filters.affordable}
                            onChange={(e) =>
                              setFilters((s) => ({
                                ...s,
                                affordable: e.target.checked,
                              }))
                            }
                          />
                          Enough points in my wallet
                        </label>
                      </div>
                      <p className="small muted">
                        Cash-charge limits exclude unknown charges. Points
                        limits and wallet coverage use the upper end of any
                        points range.
                      </p>
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => setFilters(emptyFilters())}
                      >
                        Reset filters
                      </button>
                    </details>
                    <p className="result-count" role="status">
                      {visible.length}{" "}
                      {response.mode === "planning"
                        ? "route estimate"
                        : "itinerary"}
                      {visible.length === 1 ? "" : "s"} · totals for{" "}
                      {activeQuery.passengers} traveller
                      {activeQuery.passengers === 1 ? "" : "s"}
                      {activeQuery.returnDate ? " and both directions" : ""}
                    </p>
                    {visible.length ? (
                      visible.map((i) => (
                        <ItineraryCard
                          key={i.id}
                          itinerary={i}
                          wallet={walletState.wallet}
                          manual={manual}
                          onComparison={(id, value) =>
                            setManual((s) => ({ ...s, [id]: value }))
                          }
                        />
                      ))
                    ) : (
                      <div className="empty-state">
                        <h3>
                          {response.itineraries.length
                            ? "Nothing matches just yet."
                            : "No routes returned."}
                        </h3>
                        <p>
                          {response.itineraries.length
                            ? "Try fewer filters, enter a wallet balance, or include calculated options."
                            : "Try another route or more stops. You can also build a custom estimate; no returned routes does not mean no flights exist."}
                        </p>
                        <button
                          className="button secondary"
                          onClick={() => setFilters(emptyFilters())}
                        >
                          Clear result filters
                        </button>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>
            <aside className="side-column">
              <WalletPanel
                wallet={walletState.wallet}
                onSave={saveWallet}
                notice={walletState.notice}
              />
              <div className="margin-note">
                <span className="eyebrow">Good to know</span>
                <h3>
                  Partner flight.
                  <br />
                  Your points.
                </h3>
                <p>
                  You can redeem your program’s points on eligible partner
                  flights. No transfer to the operating airline is involved.
                </p>
                <a className="text-link" href="#guide">
                  How it works ↓
                </a>
              </div>
            </aside>
          </div>
          <Guide />
        </main>
        <footer>
          <a href="../">← All apps</a>
          <span>A little further, thoughtfully.</span>
          <span>Flight Rewards · AUD comparisons</span>
        </footer>
      </div>
    </>
  );
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {}
  render() {
    return this.state.failed ? (
      <div className="site-shell">
        <h1>Something didn’t load.</h1>
        <p>Reload to try again. Your saved wallet has not been changed.</p>
        <button className="button" onClick={() => location.reload()}>
          Reload app
        </button>
        <p>
          <a href="../">All apps</a>
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("app")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
