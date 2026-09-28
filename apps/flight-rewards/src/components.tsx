import {
  useEffect,
  useRef,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type FormEvent,
  type ReactNode,
} from "react";
import type {
  ManualComparison,
  FlightItinerary,
  ProgramId,
  RedemptionOption,
  Wallet,
} from "../lib/types";
import {
  programs,
  cabinLabel,
  qantasSource,
  velocitySource,
  airlines,
} from "../lib/loyalty/catalog";
import {
  balanceStatus,
  canAfford,
  comparisonValues,
} from "../lib/points/value";
import { rewardCharts } from "../lib/rewards/charts";
import { segmentMiles } from "../lib/search/distance";
import { stops } from "../lib/search/results";
export const number = (value: number) => value.toLocaleString("en-AU");
export const aud = (value: number) =>
  new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
export const dateLabel = (date: string) =>
  new Date(date + "T12:00:00Z").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
export const timestamp = (value: string | null) =>
  value
    ? new Date(value).toLocaleString("en-AU", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      })
    : "Never checked";
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const control = isValidElement<{ id?: string; "aria-describedby"?: string }>(
    children,
  )
    ? cloneElement(children, {
        id,
        "aria-describedby": hint ? `${id}-hint` : undefined,
      })
    : children;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {control}
      {hint && (
        <small id={`${id}-hint`} className="muted">
          {hint}
        </small>
      )}
    </div>
  );
}
export function AirlinePicker({
  label,
  value,
  emptyLabel,
  hint,
  onChange,
}: {
  label: string;
  value: string[];
  emptyLabel: string;
  hint: string;
  onChange: (value: string[]) => void;
}) {
  const id = useId();
  return (
    <details className="airline-picker">
      <summary>
        <span className="picker-title">{label}</span>
        <span className="picker-count">
          {value.length ? `${value.length} selected` : emptyLabel}
        </span>
      </summary>
      {value.length > 0 && (
        <p className="picker-selection" aria-live="polite">
          {airlines
            .filter((a) => value.includes(a.code))
            .map((a) => a.name)
            .join(" · ")}
        </p>
      )}
      <fieldset aria-describedby={`${id}-hint`}>
        <legend className="visually-hidden">{label}</legend>
        <p className="muted small" id={`${id}-hint`}>
          {hint}
        </p>
        <div className="airline-choices">
          {airlines.map((a) => (
            <label key={a.code} className="airline-choice" data-press>
              <input
                type="checkbox"
                checked={value.includes(a.code)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...value, a.code]
                      : value.filter((code) => code !== a.code),
                  )
                }
              />
              <span>{a.name}</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className="text-button"
          onClick={() => onChange([])}
          disabled={!value.length}
        >
          Clear {label.toLowerCase()}
        </button>
      </fieldset>
    </details>
  );
}
export function External({
  href,
  children,
  className = "text-link",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <a
      className={className}
      href={/^https:\/\//.test(href) ? href : undefined}
      target="_blank"
      rel="noopener noreferrer"
    >
      {children} <span aria-hidden="true">↗</span>
    </a>
  );
}
export function Segmented({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: { value: string; label: string; disabled?: boolean }[];
  onChange: (v: string) => void;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null),
    pill = useRef<{ sync: (layout?: boolean) => void } | null>(null);
  useEffect(() => {
    const el = ref.current;
    const UI = (
      window as unknown as {
        SiteUI?: {
          SelectionPill: new (
            el: HTMLElement,
            selector: string,
          ) => { sync: (layout?: boolean) => void };
        };
      }
    ).SiteUI;
    if (el && UI) {
      pill.current = new UI.SelectionPill(el, '[aria-pressed="true"]');
      const observer = new ResizeObserver(() => pill.current?.sync(true));
      observer.observe(el);
      document.fonts.ready.then(() => pill.current?.sync(true));
      return () => observer.disconnect();
    }
  }, []);
  useEffect(() => {
    pill.current?.sync();
  }, [value]);
  return (
    <div className="segmented" role="group" aria-label={label} ref={ref}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          disabled={o.disabled}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
export function WalletPanel({
  wallet,
  onSave,
  notice,
}: {
  wallet: Wallet;
  onSave: (w: Wallet) => void;
  notice: string;
}) {
  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const next: Wallet = structuredClone(wallet);
    for (const p of ["qantas", "velocity"] as ProgramId[]) {
      const raw = String(data.get(p) ?? "").trim();
      const balance = raw === "" ? null : Number(raw);
      const valuation = Number(data.get(`${p}-value`));
      if (
        (balance !== null &&
          (!Number.isSafeInteger(balance) || balance < 0 || balance > 1e9)) ||
        !Number.isFinite(valuation) ||
        valuation < 0 ||
        valuation > 100
      )
        return;
      next[p] = {
        balance,
        valuationCents: valuation,
        updatedAt: new Date().toISOString(),
      };
    }
    onSave(next);
  }
  return (
    <section
      className="wallet panel"
      id="wallet"
      aria-labelledby="wallet-title"
    >
      <div className="section-top">
        <span className="eyebrow">Your head start</span>
        <span aria-hidden="true">◈</span>
      </div>
      <h2 id="wallet-title">A little in the bank.</h2>
      <p className="muted small">Add your points to see what’s within reach.</p>
      <form onSubmit={save}>
        {(["qantas", "velocity"] as ProgramId[]).map((p) => (
          <div className={`wallet-program ${p}`} key={p}>
            <div className="program-name">
              <span className="program-dot" aria-hidden="true" />
              <strong>{programs[p].currency}</strong>
            </div>
            <Field label={`${p === "qantas" ? "Qantas" : "Velocity"} balance`}>
              <input
                aria-label={`${p === "qantas" ? "Qantas" : "Velocity"} balance`}
                name={p}
                type="number"
                min="0"
                max="1000000000"
                step="1"
                inputMode="numeric"
                placeholder="Not entered"
                defaultValue={wallet[p].balance ?? ""}
              />
            </Field>
            <small className="muted">
              {wallet[p].updatedAt
                ? `Updated ${timestamp(wallet[p].updatedAt)}`
                : "No balance saved yet"}
            </small>
          </div>
        ))}
        <details className="valuation">
          <summary>Your point valuations</summary>
          <p className="small muted">
            What one point is worth to you, in AUD cents. The 1.8¢ starting
            value is editable.
          </p>
          {(["qantas", "velocity"] as ProgramId[]).map((p) => (
            <Field
              key={p}
              label={`${p === "qantas" ? "Qantas" : "Velocity"} value (cents)`}
            >
              <input
                name={`${p}-value`}
                type="number"
                min="0"
                max="100"
                step="0.1"
                required
                defaultValue={wallet[p].valuationCents}
              />
            </Field>
          ))}
        </details>
        <button type="submit" className="button wallet-save">
          Save my wallet
        </button>
        <p className="small muted storage-note">
          Saved in this browser on this device. No account or cloud sync.
        </p>
        <p className="status" role="status">
          {notice}
        </p>
      </form>
    </section>
  );
}
export function Guide() {
  return (
    <section className="guide" id="guide" aria-labelledby="guide-title">
      <p className="eyebrow">A field guide to flying on points</p>
      <h2 id="guide-title">Same flight. Different ways to book.</h2>
      <div className="guide-grid">
        <div>
          <h3>Partner redemption</h3>
          <p>
            Use Velocity Points to book an eligible United flight through
            Velocity. Use Qantas Points to book an eligible Emirates flight
            through Qantas. The points stay in the program you book through.
          </p>
        </div>
        <div>
          <h3>Points transfer</h3>
          <p>
            A transfer moves points into another loyalty currency. A redemption
            partnership does not grant that ability. This app compares
            redemptions and does not transfer points.
          </p>
        </div>
      </div>
      <details>
        <summary>Reading availability and value</summary>
        <dl className="guide-definitions">
          <dt>Calculated</dt>
          <dd>A theoretical chart price. No reward seat has been checked.</dd>
          <dt>Indicative</dt>
          <dd>
            A third party has reported the matching flights in the booking
            program. It may be stale, and the seat count may be unknown.
          </dd>
          <dt>Confirmed</dt>
          <dd>
            Reserved for a provider with recent, direct award-inventory
            confirmation. Neither route estimates nor cached Seats.aero data
            receive this label.
          </dd>
          <dt>Cents per point</dt>
          <dd>
            (Cash fare − unavoidable cash charges) ÷ points × 100. Unknown
            charges stay unknown; enter a quote to compare.
          </dd>
          <dt>Effective cost</dt>
          <dd>
            Points × your valuation in AUD cents ÷ 100 + unavoidable cash
            charges. This is your personal valuation, not a cash fare.
          </dd>
        </dl>
      </details>
      <details>
        <summary>Sources, dates and coverage</summary>
        <p>
          Charts verified 28 September 2026. Pricing uses the booking date, not
          the travel date. Great-circle statute miles are an estimate; the
          program’s quoted mileage can differ near a zone boundary.
        </p>
        <p>
          <External href={qantasSource}>Qantas reward tables</External> ·{" "}
          <External href={velocitySource}>Velocity reward tables</External> ·{" "}
          <External href="https://www.qantas.com/en-au/frequent-flyer/join/terms-conditions">
            Qantas connection rules
          </External>
        </p>
        <p>
          The bundled airport and route selection is limited. Illustrative
          routes do not confirm a flight, connection, cabin or date operates.
          Live search coverage also depends on the provider. Codeshares and
          special Virgin Australia/Doha pricing need a program quote. Only adult
          travellers are included.
        </p>
        <p>
          Taxes and carrier charges vary. Enter the full combined amount for the
          whole trip and all travellers. No currency conversion is assumed.
          Returns in estimate mode mirror the outbound route, with assumed
          connections on the way home.
        </p>
      </details>
    </section>
  );
}
function Comparison({
  option,
  itinerary,
  wallet,
  value,
  onChange,
}: {
  option: RedemptionOption;
  itinerary: FlightItinerary;
  wallet: Wallet;
  value: ManualComparison | undefined;
  onChange: (v: ManualComparison) => void;
}) {
  const v = comparisonValues(
    option,
    value,
    itinerary.cashFare?.total.currency === "AUD"
      ? itinerary.cashFare.total.amount
      : null,
    wallet[option.program].valuationCents,
  );
  const [message, setMessage] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const money = (key: string) => {
      const raw = String(data.get(key) ?? "").trim();
      return raw === "" ? null : Number(raw);
    };
    const cash = money("cash"),
      charges = money("charges");
    if (
      [cash, charges].some(
        (x) => x !== null && (!Number.isFinite(x) || x < 0 || x > 1e7),
      )
    )
      return;
    onChange({ cash, charges });
    setMessage("Comparison updated for this visit.");
  }
  return (
    <details className="comparison">
      <summary>
        Compare with a cash fare <span aria-hidden="true">＋</span>
      </summary>
      <p className="small muted">
        Enter comparable quotes for the{" "}
        <strong>
          whole trip and all {itinerary.passengers} traveller
          {itinerary.passengers === 1 ? "" : "s"}
        </strong>
        , in AUD. Include every tax, fee and carrier charge.
      </p>
      <form onSubmit={submit} className="comparison-form">
        <Field label="Comparable cash fare (AUD)">
          <input
            name="cash"
            type="number"
            min="0"
            max="10000000"
            step="0.01"
            placeholder={v.cash === null ? "Unknown" : String(v.cash)}
            defaultValue={value?.cash ?? ""}
          />
        </Field>
        <Field label="Reward taxes, fees & charges (AUD)">
          <input
            name="charges"
            type="number"
            min="0"
            max="10000000"
            step="0.01"
            placeholder={v.charges === null ? "Unknown" : String(v.charges)}
            defaultValue={value?.charges ?? ""}
          />
        </Field>
        <button className="button secondary" type="submit">
          Update comparison
        </button>
      </form>
      <p className="status" role="status">
        {message}
      </p>
      <dl className="value-grid">
        <div>
          <dt>Cash fare</dt>
          <dd>{v.cash === null ? "Not entered" : aud(v.cash)}</dd>
        </div>
        <div>
          <dt>
            Value per point
            {option.pricingKind === "range" ? " · at minimum points" : ""}
          </dt>
          <dd>
            {v.centsPerPoint === null
              ? "Needs both quotes"
              : `${v.centsPerPoint.toFixed(2)}¢`}
          </dd>
        </div>
        <div>
          <dt>
            Your effective cost{option.pricingKind === "range" ? " · from" : ""}
          </dt>
          <dd>
            {v.effectiveCost === null
              ? "Needs cash charges"
              : aud(v.effectiveCost)}
          </dd>
        </div>
      </dl>
      <p className="small muted">
        Your inputs are estimates and do not verify availability. Personal point
        value: {wallet[option.program].valuationCents} AUD cents.
      </p>
    </details>
  );
}
export function ItineraryCard({
  itinerary,
  wallet,
  manual,
  onComparison,
}: {
  itinerary: FlightItinerary;
  wallet: Wallet;
  manual: Record<string, ManualComparison>;
  onComparison: (id: string, v: ManualComparison) => void;
}) {
  const i = itinerary,
    outbound = i.segments.filter((s) => s.slice === 0),
    operators = [...new Set(i.segments.map((s) => s.operatingAirline.name))],
    isPlan = i.kind === "planning";
  const stopCount = stops(i),
    route = [
      outbound[0].origin.iata,
      ...outbound.map((s) => s.destination.iata),
    ];
  const time = (v: string | null) =>
    v ? v.slice(11, 16) : "Schedule not checked";
  return (
    <article
      className="itinerary-card"
      aria-label={`${operators.join(" + ")} ${i.origin.iata} to ${i.destination.iata}`}
    >
      <div className="flight-head">
        <div className="carrier-mark" aria-hidden="true">
          {outbound[0].operatingAirline.code}
        </div>
        <div>
          <strong>{operators.join(" + ")}</strong>
          <p className="small muted">
            {isPlan
              ? "Illustrative route"
              : outbound
                  .map(
                    (s) =>
                      s.operatingFlightNumber ?? s.flightNumber ?? "Flight",
                  )
                  .join(" · ")}{" "}
            · {cabinLabel(i.cabin)}
          </p>
        </div>
        <span className="route-kind">
          {isPlan
            ? "Route estimate"
            : i.cashFare?.isTest
              ? "Test data"
              : "Scheduled flight"}
        </span>
      </div>
      <div className="route-row">
        <div>
          <span className="airport-code">{i.origin.iata}</span>
          <span>{i.origin.city}</span>
        </div>
        <div className="route-middle">
          <span>
            {stopCount === 0
              ? "Nonstop"
              : `${stopCount} stop${stopCount === 1 ? "" : "s"}`}
          </span>
          <div className="route-line" aria-hidden="true">
            <i />
            <span>✈</span>
            <i />
          </div>
          <span>
            {route.slice(1, -1).join(" · ") ||
              `${number(Math.round(segmentMiles(outbound)))} miles`}
          </span>
        </div>
        <div>
          <span className="airport-code">{i.destination.iata}</span>
          <span>{i.destination.city}</span>
        </div>
      </div>
      <p className="trip-meta">
        {dateLabel(i.departureDate)}
        {i.returnDate
          ? ` – ${dateLabel(i.returnDate)} · return`
          : " · one way"}{" "}
        · {i.passengers} adult{i.passengers === 1 ? "" : "s"}
        {i.durationMinutes !== null
          ? ` · ${Math.floor(i.durationMinutes / 60)}h ${Math.round(i.durationMinutes % 60)}m total travel`
          : ""}
      </p>
      <details className="segments">
        <summary>
          {isPlan ? "Route assumptions" : "Flight details & local times"}
        </summary>
        {i.segments.map((s, n) => (
          <div className="segment" key={n}>
            <strong>
              {s.slice === 0 ? "Outbound" : "Return"} · {s.origin.iata} →{" "}
              {s.destination.iata}
            </strong>
            <span>
              {s.operatingAirline.name} · {cabinLabel(s.cabin)}
              {s.aircraft ? ` · ${s.aircraft}` : ""}
            </span>
            {isPlan ? (
              <span>
                {s.connectionBefore === "stopover"
                  ? "Stopover before this segment"
                  : s.connectionBefore === "connection"
                    ? "Assumes a valid connection before this segment"
                    : "Flight operation not checked"}
              </span>
            ) : (
              <span>
                {s.operatingFlightNumber ?? s.flightNumber} ·{" "}
                {s.departureTime?.slice(0, 10)} {time(s.departureTime)} (
                {s.origin.timezone}) → {s.arrivalTime?.slice(0, 10)}{" "}
                {time(s.arrivalTime)} ({s.destination.timezone})
              </span>
            )}
            {s.operatingAirline.code !== s.marketingAirline.code && (
              <span>
                Marketed by {s.marketingAirline.name} as {s.flightNumber}
              </span>
            )}
          </div>
        ))}
      </details>
      <div className="booking-options">
        <p className="eyebrow">Ways to book · totals for your trip</p>
        {i.redemptions.map((o) => {
          const enough = canAfford(o, wallet[o.program]);
          const values = comparisonValues(
            o,
            manual[o.id],
            i.cashFare?.total.currency === "AUD"
              ? i.cashFare.total.amount
              : null,
            wallet[o.program].valuationCents,
          );
          return (
            <section
              className={`reward-option ${o.program}`}
              key={o.id}
              aria-label={`${o.program === "qantas" ? "Qantas" : "Velocity"} booking option`}
            >
              <div className="reward-top">
                <span className="program-name">
                  <span className="program-dot" aria-hidden="true" />
                  <strong>
                    {o.program === "qantas" ? "Qantas" : "Velocity"}
                  </strong>
                </span>
                <span
                  className={`availability ${o.availability.status.toLowerCase()}`}
                >
                  {o.availability.status === "CALCULATED"
                    ? "Calculated"
                    : o.availability.status === "INDICATIVE"
                      ? "Indicative"
                      : "Confirmed"}
                </span>
              </div>
              <div className="reward-price">
                <strong>
                  {o.pointsRequired === null
                    ? "Quote required"
                    : number(o.pointsRequired)}
                  {o.pricingKind === "range" && `–${number(o.pointsMaximum!)}`}
                </strong>
                {o.pointsRequired !== null && <span> points</span>}
              </div>
              <p className="surcharge">
                {values.charges === null
                  ? "Taxes & carrier charges not quoted"
                  : `+ ${aud(values.charges)} AUD in combined cash charges${manual[o.id]?.charges !== null && manual[o.id]?.charges !== undefined ? " · your estimate" : ""}`}
              </p>
              {i.passengers > 1 && o.pointsRequired !== null && (
                <p className="small muted">
                  {number(o.pointsRequired / i.passengers)}
                  {o.pricingKind === "range"
                    ? `–${number(o.pointsMaximum! / i.passengers)}`
                    : ""}{" "}
                  points per person for this trip
                </p>
              )}
              <div className="reward-bottom">
                <span className={`balance ${enough ? "enough" : ""}`}>
                  {enough ? "✓ " : ""}
                  {balanceStatus(o, wallet[o.program])}
                </span>
                <External href={o.bookingUrl}>
                  Check {o.program === "qantas" ? "Qantas" : "Velocity"}
                </External>
              </div>
              <p className="availability-note">
                {o.availability.status === "CALCULATED"
                  ? "Reward seats not checked"
                  : `${o.availability.seats === null ? "Seat count unknown" : `${o.availability.seats} seats reported`} · checked ${timestamp(o.availability.checkedAt)}`}
              </p>
              <details className="explanation">
                <summary>Why this program?</summary>
                <p>{o.explanation}</p>
                {o.pricingNotes.map((n, k) => (
                  <p className="small" key={k}>
                    {n}
                  </p>
                ))}
                <p className="small">
                  Source: {o.availability.source}.{" "}
                  {o.availability.limitations.join(" ")}
                </p>
                {o.chartVersions.map((id) => {
                  const c = rewardCharts.find((x) => x.id === id);
                  return c ? (
                    <p className="small muted" key={id}>
                      <External href={c.source}>Reward chart</External> ·
                      bookings from {dateLabel(c.effectiveFrom)} · verified{" "}
                      {dateLabel(c.verifiedAt)}
                    </p>
                  ) : null;
                })}
                <p className="small">
                  Price calculated {timestamp(o.pricingCalculatedAt)}. Open{" "}
                  {programs[o.program].name}, choose reward seats/use points,
                  and search these airports, dates, flights and cabin. Confirm
                  the full quote and all travellers before booking.
                </p>
              </details>
              <Comparison
                option={o}
                itinerary={i}
                wallet={wallet}
                value={manual[o.id]}
                onChange={(v) => onComparison(o.id, v)}
              />
            </section>
          );
        })}
        {!i.redemptions.length && (
          <p className="muted">
            No supported Qantas or Velocity redemption covers every segment of
            this itinerary.
          </p>
        )}
        <div className="cash-option">
          <span>
            <strong>Pay with cash</strong>
            <small>
              {i.cashFare
                ? `${i.cashFare.isTest ? "Simulated test fare · " : ""}${i.cashFare.source} · ${timestamp(i.cashFare.checkedAt)}`
                : "No cash fare checked"}
            </small>
          </span>
          <strong>
            {i.cashFare
              ? new Intl.NumberFormat("en-AU", {
                  style: "currency",
                  currency: i.cashFare.total.currency,
                  currencyDisplay: "code",
                  maximumFractionDigits: 0,
                }).format(i.cashFare.total.amount)
              : "Quote needed"}
          </strong>
        </div>
        {i.cashFare && (
          <p className="small muted">
            Cash fare includes all travellers
            {i.returnDate ? " and both directions" : ""}.{" "}
            {i.cashFare.expiresAt
              ? `Offer expires ${timestamp(i.cashFare.expiresAt)}.`
              : ""}{" "}
            Check the airline’s current fare and conditions.
          </p>
        )}
      </div>
    </article>
  );
}
