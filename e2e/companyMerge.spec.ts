import { test, expect } from "./fixtures";

test("merging two clubs that only differ by case reassigns contacts and deals to the winner", async ({
  page,
  isMobile,
  createSales,
  createCompany,
  createContact,
  createDeal,
  dismissToast,
}) => {
  test.skip(isMobile, "Club merge is only available on desktop");

  const sales = await createSales({
    email: "jane@doe.com",
    first_name: "Jane",
    last_name: "Doe",
    password: "password",
  });

  // Same club, entered twice with different case -- the loser will be
  // suggested as a duplicate of the winner by normalized name.
  const loser = await createCompany({
    name: "Padel Club Paris",
    salesId: sales.id,
  });
  const winner = await createCompany({
    name: "PADEL CLUB PARIS",
    salesId: sales.id,
  });

  await createContact({
    first_name: "Isaac",
    last_name: "Newton",
    company_id: loser.id,
    sales_id: sales.id,
  });
  await createDeal({
    name: "Court renovation",
    caseType: "club",
    companyId: loser.id,
    salesId: sales.id,
  });

  await page.goto("http://localhost:5175/");
  await page.getByLabel("Email").fill("jane@doe.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveTitle(/Atomic CRM/);

  await page.getByRole("link", { name: "Clubs" }).click();
  await page.waitForLoadState("networkidle");
  await page.getByRole("row", { name: /^Padel Club Paris/ }).click();
  await page.getByRole("link", { name: "Edit club" }).click();
  await page.getByRole("button", { name: "Merge with another club" }).click();

  const dialog = page.getByRole("dialog");

  // The case-only variant is found and auto-preselected as the merge target.
  await expect(dialog.getByText("PADEL CLUB PARIS")).toBeVisible();

  // The dialog previews what will be reassigned before confirmation.
  await expect(
    dialog.getByText("1 judge-referee will be reassigned"),
  ).toBeVisible();
  await expect(dialog.getByText("1 deal will be reassigned")).toBeVisible();

  await dialog.getByRole("button", { name: "Merge Clubs" }).click();
  await dismissToast("Clubs merged successfully");

  // Redirected to the winner's page, which now carries the loser's contact
  // and deal.
  await expect(
    page.getByRole("heading", { name: "PADEL CLUB PARIS" }),
  ).toBeVisible();
  await expect(page.getByText("1 judge-referee", { exact: true })).toBeVisible();
  await expect(page.getByText("1 deal", { exact: true })).toBeVisible();

  // The loser club no longer appears in the clubs list.
  await page.getByRole("link", { name: "Clubs" }).click();
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Padel Club Paris", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("PADEL CLUB PARIS")).toBeVisible();

  // The reassigned contact now points at the winner club.
  await page.getByRole("link", { name: "Referees" }).click();
  await page.getByText("Isaac Newton").click();
  await expect(page.getByText("PADEL CLUB PARIS")).toBeVisible();
});
