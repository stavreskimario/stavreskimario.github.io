import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = fileURLToPath(new URL("../test-results/", import.meta.url));
await mkdir(output, { recursive: true });
const staticServer = spawn(
  "python3",
  ["-m", "http.server", "8123", "--bind", "127.0.0.1"],
  { cwd: root, stdio: "ignore" },
);
process.on("exit", () => staticServer.kill());
for (let n = 0; n < 40; n++) {
  try {
    await fetch("http://127.0.0.1:8123/");
    break;
  } catch {
    await new Promise((r) => setTimeout(r, 100));
  }
}
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8123/apps/flight-rewards/");
  await page
    .getByRole("heading", { name: "Your points. More possibilities." })
    .waitFor();
  // Multi-selection works with ordinary taps and Space, without modifier keys.
  await page.setViewportSize({ width: 375, height: 900 });
  await page.locator(".search-options > summary").tap();
  await page
    .locator(".airline-picker > summary")
    .filter({ hasText: "Included airlines" })
    .tap();
  const included = page.getByRole("group", {
    name: "Included airlines",
    exact: true,
  });
  await included
    .locator("label")
    .filter({ hasText: /^Qantas$/ })
    .tap();
  await included
    .getByRole("checkbox", { name: "United Airlines", exact: true })
    .focus();
  await page.keyboard.press("Space");
  assert.ok(
    await included
      .getByRole("checkbox", { name: "Qantas", exact: true })
      .isChecked(),
  );
  assert.ok(
    await included
      .getByRole("checkbox", { name: "United Airlines", exact: true })
      .isChecked(),
  );
  assert.ok(
    (
      await page.locator(".airline-picker > summary").first().innerText()
    ).includes("2 selected"),
  );
  await page
    .locator(".airline-picker > summary")
    .filter({ hasText: "Excluded airlines" })
    .tap();
  const excluded = page.getByRole("group", {
    name: "Excluded airlines",
    exact: true,
  });
  await excluded
    .locator("label")
    .filter({ hasText: /^Qantas$/ })
    .tap();
  assert.equal(
    await included
      .getByRole("checkbox", { name: "Qantas", exact: true })
      .isChecked(),
    false,
  );
  assert.ok(
    await excluded
      .getByRole("checkbox", { name: "Qantas", exact: true })
      .isChecked(),
  );
  assert.equal(await page.locator("select[multiple]").count(), 0);
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
  }
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
  );
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));
  await page.setViewportSize({ width: 375, height: 900 });
  await page
    .locator(".search-options")
    .screenshot({ path: join(output, "airline-choices-mobile.png") });
  const pickerAxe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  assert.deepEqual(
    pickerAxe.violations,
    [],
    "Accessible expanded airline choices",
  );
  await page.getByRole("button", { name: "Explore points options" }).tap();
  await page.locator(".itinerary-card").first().waitFor();
  for (const name of await page
    .locator(".itinerary-card")
    .evaluateAll((es) => es.map((e) => e.getAttribute("aria-label"))))
    assert.ok(name.startsWith("United Airlines"));
  await included
    .getByRole("button", { name: "Clear included airlines", exact: true })
    .tap();
  await excluded
    .getByRole("button", { name: "Clear excluded airlines", exact: true })
    .tap();
  assert.equal(await page.locator(".airline-picker input:checked").count(), 0);
  await page.locator(".search-options > summary").tap();
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: join(output, "desktop-start.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Explore points options" }).click();
  await page.locator(".itinerary-card").first().waitFor();
  assert.ok((await page.locator(".itinerary-card").count()) > 2);
  assert.ok(
    (await page.locator(".itinerary-card").first().innerText()).includes(
      "48,000",
    ),
  );
  assert.equal(await page.locator(".availability.confirmed").count(), 0);
  await page
    .getByRole("spinbutton", { name: "Qantas balance", exact: true })
    .fill("60000");
  await page
    .getByRole("spinbutton", { name: "Velocity balance", exact: true })
    .fill("120000");
  await page.getByRole("button", { name: "Save my wallet" }).click();
  assert.ok(await page.getByText("Wallet saved on this device.").isVisible());
  assert.ok(
    (await page.getByText("✓ Enough points", { exact: true }).count()) > 0,
  );
  const ua = page
    .getByRole("article", { name: "United Airlines MEL to LAX", exact: true })
    .first();
  await ua.locator(".comparison>summary").click();
  await ua
    .getByRole("spinbutton", { name: "Comparable cash fare (AUD)" })
    .fill("2000");
  await ua
    .getByRole("spinbutton", { name: "Reward taxes, fees & charges (AUD)" })
    .fill("150.50");
  await ua.getByRole("button", { name: "Update comparison" }).click();
  assert.ok((await ua.innerText()).includes("3.85¢"));
  assert.ok((await ua.innerText()).includes("$1,014.50"));
  await page.getByText("Refine results", { exact: false }).first().click();
  await page
    .getByLabel("Availability", { exact: true })
    .selectOption("CONFIRMED");
  assert.equal(await page.locator(".itinerary-card").count(), 0);
  assert.ok(await page.getByText("Nothing matches just yet.").isVisible());
  await page.getByRole("button", { name: "Clear result filters" }).click();
  await page.screenshot({
    path: join(output, "desktop-results.png"),
    fullPage: true,
  });
  const axe = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  console.log(
    "Axe violations",
    JSON.stringify(
      axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.map((n) => n.target),
      })),
    ),
  );
  await page.reload();
  await page
    .getByRole("spinbutton", { name: "Qantas balance", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("spinbutton", { name: "Qantas balance", exact: true })
      .inputValue(),
    "60000",
  );
  await page
    .getByRole("group", { name: "Trip type", exact: true })
    .getByRole("button", { name: "Return", exact: true })
    .click();
  await page.getByLabel("Travellers", { exact: true }).selectOption("2");
  await page.getByLabel("Cabin", { exact: true }).selectOption("business");
  await page.getByLabel("Nonstop only", { exact: true }).check();
  await page.getByRole("button", { name: "Explore points options" }).focus();
  await page.keyboard.press("Enter");
  await page.locator(".itinerary-card").first().waitFor();
  assert.ok(
    (await page.locator(".itinerary-card").first().innerText()).includes(
      "408,000",
    ),
  );
  await page
    .getByRole("group", { name: "Trip type", exact: true })
    .getByRole("button", { name: "One way", exact: true })
    .click();
  await page.getByLabel("To", { exact: true }).selectOption("LHR");
  await page.getByLabel("Travellers", { exact: true }).selectOption("1");
  await page.getByLabel("Cabin", { exact: true }).selectOption("economy");
  await page.locator(".custom-builder>summary").click();
  await page
    .getByRole("button", { name: "Add connection", exact: true })
    .click();
  await page.getByLabel("Leg 1 airline", { exact: true }).selectOption("SQ");
  await page.getByLabel("Leg 2 airline", { exact: true }).selectOption("SQ");
  await page
    .getByRole("button", { name: "Calculate my route", exact: true })
    .click();
  assert.equal(await page.locator(".itinerary-card").count(), 1);
  assert.ok(
    (await page.locator(".itinerary-card").innerText()).includes("80,000"),
  );
  await page.getByLabel("From", { exact: true }).selectOption("LHR");
  await page.getByRole("button", { name: "Explore points options" }).click();
  assert.ok(await page.getByRole("alert").isVisible());
  await page.getByLabel("From", { exact: true }).selectOption("MEL");
  for (const width of [375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    );
    assert.equal(overflow, false, `Overflow at ${width}`);
    await page.screenshot({
      path: join(output, `mobile-${width}.png`),
      fullPage: true,
    });
  }
  await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
    "Overflow at 200%",
  );
  await page.screenshot({
    path: join(output, "mobile-200.png"),
    fullPage: true,
  });
  await page.evaluate(() => (document.documentElement.style.fontSize = ""));
  await page
    .getByRole("link", { name: "← All apps", exact: true })
    .first()
    .click();
  await page.waitForURL("http://127.0.0.1:8123/");
  await page
    .getByRole("link", { name: /Flight Rewards/ })
    .first()
    .click();
  await page.waitForURL("**/apps/flight-rewards/");
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => {
    Storage.prototype.setItem = function () {
      throw new DOMException("Blocked", "SecurityError");
    };
  });
  const b = await blocked.newPage();
  await b.goto("http://127.0.0.1:8123/apps/flight-rewards/");
  await b
    .getByRole("spinbutton", { name: "Velocity balance", exact: true })
    .fill("100000");
  await b.getByRole("button", { name: "Save my wallet" }).click();
  assert.ok(
    await b
      .getByText(
        "Storage is unavailable. Your wallet works for this visit only.",
      )
      .isVisible(),
  );
  assert.deepEqual(errors, []);
  console.log(
    "Browser smoke passed: search, wallet reload, cash value, filters, return totals, custom connections, validation, keyboard, mobile/reduced motion, 200% text, navigation and storage fallback.",
  );
  assert.deepEqual(axe.violations, [], "WCAG A/AA automated checks");
} finally {
  await browser.close();
  staticServer.kill();
}
