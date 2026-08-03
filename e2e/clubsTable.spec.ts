import { test, expect } from "./fixtures";

/**
 * Covers the Clubs list rendering as a read-only table (TASK-001, replacing
 * the card grid) instead of exercising every column's resolved value: the
 * column-label -> translation-key wiring (notably the new
 * `resources.companies.fields.nb_deals` key) is asserted via the header row,
 * and the row-click-to-Show behavior -- the only interaction this read-only
 * table exposes -- is asserted end to end.
 */
test("clubs list renders as a table and a row navigates to the club's Show page", async ({
  page,
  isMobile,
  createSales,
  createCompany,
}) => {
  test.skip(
    isMobile,
    "The Clubs table only renders on desktop; mobile has no companies list.",
  );

  const sales = await createSales({
    email: "john@doe.com",
    first_name: "John",
    last_name: "Doe",
    password: "password",
  });

  await createCompany({ name: "Padel Club Paris", salesId: sales.id });

  await page.goto("http://localhost:5175/");
  await page.getByLabel("Email").fill("john@doe.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveTitle(/Atomic CRM/);

  await page.getByRole("link", { name: "Clubs" }).click();
  await page.waitForLoadState("networkidle");

  // Column headers, in the order specified by the ticket -- confirms the
  // table (not the old card grid) renders, and that every label resolves
  // through i18n rather than falling back to a raw source key.
  const headers = page.getByRole("columnheader");
  await expect(headers.getByText("Club name")).toBeVisible();
  await expect(headers.getByText("Sector")).toBeVisible();
  await expect(headers.getByText("Size")).toBeVisible();
  await expect(headers.getByText("City")).toBeVisible();
  await expect(headers.getByText("Account manager")).toBeVisible();
  await expect(headers.getByText("Number of judges-referees")).toBeVisible();
  await expect(headers.getByText("Number of deals")).toBeVisible();

  const row = page.getByRole("row", { name: /Padel Club Paris/ });
  await expect(row).toBeVisible();

  // Unlike the old card grid (whole card wrapped in a Link) and unlike the
  // Referees table (row click disabled, cells are editable), this read-only
  // table navigates to Show from anywhere on the row.
  await row.click();
  await expect(
    page.getByRole("heading", { name: "Padel Club Paris" }),
  ).toBeVisible();
});
