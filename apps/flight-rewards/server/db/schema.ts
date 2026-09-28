import {
  pgTable,
  text,
  integer,
  jsonb,
  timestamp,
  uuid,
  numeric,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";
const time = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" });
export const users = pgTable("app_user", {
  id: uuid("id").primaryKey().defaultRandom(),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const airports = pgTable("airport", {
  iata: text("iata").primaryKey(),
  icao: text("icao"),
  city: text("city").notNull(),
  country: text("country").notNull(),
  latitude: numeric("latitude").notNull(),
  longitude: numeric("longitude").notNull(),
  timezone: text("timezone").notNull(),
});
export const airlines = pgTable("airline", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
  data: jsonb("data").notNull(),
});
export const loyaltyPrograms = pgTable("loyalty_program", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  currency: text("currency").notNull(),
  bookingUrl: text("booking_url").notNull(),
});
export const redemptionPartners = pgTable(
  "redemption_partner",
  {
    programId: text("program_id")
      .notNull()
      .references(() => loyaltyPrograms.id),
    airlineCode: text("airline_code")
      .notNull()
      .references(() => airlines.code),
    source: text("source").notNull(),
  },
  (t) => [primaryKey({ columns: [t.programId, t.airlineCode] })],
);
export const rewardCharts = pgTable("reward_chart", {
  id: text("id").primaryKey(),
  programId: text("program_id")
    .notNull()
    .references(() => loyaltyPrograms.id),
  partnerGroup: text("partner_group").notNull(),
});
export const rewardChartVersions = pgTable(
  "reward_chart_version",
  {
    id: text("id").primaryKey(),
    chartId: text("chart_id")
      .notNull()
      .references(() => rewardCharts.id),
    effectiveFrom: text("effective_from").notNull(),
    effectiveTo: text("effective_to"),
    data: jsonb("data").notNull(),
  },
  (t) => [uniqueIndex("chart_effective_unique").on(t.chartId, t.effectiveFrom)],
);
export const pointsBalances = pgTable(
  "points_balance",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    programId: text("program_id")
      .notNull()
      .references(() => loyaltyPrograms.id),
    balance: integer("balance"),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.programId] })],
);
export const pointValuations = pgTable(
  "point_valuation",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    programId: text("program_id")
      .notNull()
      .references(() => loyaltyPrograms.id),
    audCents: numeric("aud_cents").notNull(),
    updatedAt: time("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.programId] })],
);
export const searchHistory = pgTable("search_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  query: jsonb("query").notNull(),
  createdAt: time("created_at").notNull().defaultNow(),
});
export const cachedFlightSearch = pgTable("cached_flight_search", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").notNull(),
  checkedAt: time("checked_at").notNull().defaultNow(),
  expiresAt: time("expires_at").notNull(),
});
export const cachedAwardAvailability = pgTable("cached_award_availability", {
  key: text("key").primaryKey(),
  payload: jsonb("payload").notNull(),
  checkedAt: time("checked_at").notNull().defaultNow(),
  expiresAt: time("expires_at").notNull(),
});
export const rateLimits = pgTable("search_rate_limit", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: time("expires_at").notNull(),
});
