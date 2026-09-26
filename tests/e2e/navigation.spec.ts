import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = ["/", "/radar/", "/research/", "/models/", "/health/"];

for (const route of routes) {
  test(`renders ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
  });
}

test("legacy routes remain reachable", async ({ page }) => {
  for (const route of ["/digests/", "/curation/", "/sources/"]) {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
  }
});

test("@a11y primary navigation has no serious violations", async ({ page }) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(
    results.violations.filter((item) =>
      ["serious", "critical"].includes(item.impact ?? ""),
    ),
  ).toEqual([]);
});
