import { test, expect } from "./fixtures";

/**
 * Covers TASK-009: the deals resource (folder, routes, nav entries) was
 * deleted entirely. This spec is the deliberate, documented exception to
 * the repo-wide `\bdeals?\b` sweep -- the string legitimately appears here
 * by design, asserting its absence from the running app.
 */
test.describe("deals resource removed", () => {
  // Force French so the not-found heading assertion below is deterministic
  // regardless of the CI machine's own locale.
  test.use({ locale: "fr-FR" });

  test.beforeEach(async ({ page, createSales }) => {
    await createSales({
      email: "sales@doe.com",
      first_name: "Sam",
      last_name: "Doe",
      password: "password",
    });

    await page.goto("http://localhost:5175/");
    await page.getByLabel("Email").fill("sales@doe.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveTitle(/Atomic CRM/);
  });

  test("has no Affaires navigation entry and /deals renders the missing-page view", async ({
    page,
  }) => {
    await expect(page.getByRole("link", { name: /affaires/i })).toHaveCount(
      0,
    );
    await expect(page.locator('a[href*="/deals"]')).toHaveCount(0);

    await page.goto("http://localhost:5175/#/deals");
    await expect(
      page.getByRole("heading", { name: "Page manquante" }),
    ).toBeVisible();
  });
});
