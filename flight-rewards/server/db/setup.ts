import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import airportData from "../../data/airports.json";
import { airlines, partners, programs } from "../../lib/loyalty/catalog";
import { rewardCharts } from "../../lib/rewards/charts";
async function setup() {
  if (!process.env.DATABASE_URL)
    throw new Error("Set DATABASE_URL in the server environment.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      await readFile(
        new URL("./migrations/0001_initial.sql", import.meta.url),
        "utf8",
      ),
    );
    for (const p of Object.values(programs))
      await client.query(
        "INSERT INTO loyalty_program(id,name,currency,booking_url) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
        [p.id, p.name, p.currency, p.bookingUrl],
      );
    for (const a of airlines)
      await client.query(
        "INSERT INTO airline(code,name,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [a.code, a.name, JSON.stringify(a)],
      );
    for (const a of airportData)
      await client.query(
        "INSERT INTO airport(iata,icao,city,country,latitude,longitude,timezone) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING",
        [
          a.iata,
          a.icao,
          a.city,
          a.country,
          a.latitude,
          a.longitude,
          a.timezone,
        ],
      );
    for (const p of partners)
      await client.query(
        "INSERT INTO redemption_partner(program_id,airline_code,source) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [p.program, p.airline, p.source],
      );
    for (const c of rewardCharts) {
      const id = `${c.program}-${c.group}`;
      await client.query(
        "INSERT INTO reward_chart(id,program_id,partner_group) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
        [id, c.program, c.group],
      );
      // Immutable snapshots: a new rate requires a new ID/effective date, never an UPDATE.
      await client.query(
        "INSERT INTO reward_chart_version(id,chart_id,effective_from,effective_to,data) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
        [c.id, id, c.effectiveFrom, c.effectiveTo, JSON.stringify(c)],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}
setup()
  .then(() => console.log("Database schema and versioned charts are ready."))
  .catch(() => {
    console.error(
      "Database setup failed. Check database access and migration compatibility.",
    );
    process.exitCode = 1;
  });
