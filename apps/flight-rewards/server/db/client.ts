import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import {
  cachedFlightSearch,
  cachedAwardAvailability,
  rateLimits,
} from "./schema";
let pool: Pool | undefined;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("Database is not configured.");
  pool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  });
  return drizzle(pool);
}
export const cacheKey = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function cacheGet<T>(
  kind: "flights" | "awards",
  key: string,
): Promise<T | null> {
  const table =
    kind === "flights" ? cachedFlightSearch : cachedAwardAvailability;
  const [row] = await db()
    .select()
    .from(table)
    .where(and(eq(table.key, key), gt(table.expiresAt, new Date())))
    .limit(1);
  return row ? (row.payload as T) : null;
}
export async function cacheSet(
  kind: "flights" | "awards",
  key: string,
  payload: unknown,
  seconds: number,
) {
  const table =
    kind === "flights" ? cachedFlightSearch : cachedAwardAvailability;
  const values = {
    key,
    payload,
    checkedAt: new Date(),
    expiresAt: new Date(Date.now() + seconds * 1000),
  };
  await db()
    .insert(table)
    .values(values)
    .onConflictDoUpdate({ target: table.key, set: values });
  await db().delete(table).where(lt(table.expiresAt, new Date()));
}
/** Shared global work budget: cannot be bypassed by spoofing an IP or by adding instances. */
export async function takeSearchBudget(units: number): Promise<boolean> {
  if (!Number.isInteger(units) || units < 1 || units > 28)
    throw new RangeError("Invalid search budget units.");
  const minute = Math.floor(Date.now() / 60000),
    key = `global:${minute}`;
  const [row] = await db()
    .insert(rateLimits)
    .values({ key, count: units, expiresAt: new Date((minute + 2) * 60000) })
    .onConflictDoUpdate({
      target: rateLimits.key,
      set: { count: sql`${rateLimits.count}+${units}` },
      setWhere: sql`${rateLimits.count}+${units} <= 28`,
    })
    .returning({ count: rateLimits.count });
  await db().delete(rateLimits).where(lt(rateLimits.expiresAt, new Date()));
  return !!row;
}
