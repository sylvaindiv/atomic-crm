import { test, expect } from "./fixtures";

test("user sets a contact's budget and case description, then edits both", async ({
  page,
  isMobile,
  createSales,
  menu,
  dismissToast,
}) => {
  test.skip(
    isMobile,
    "Editing a contact on mobile uses a different sheet-based flow",
  );

  const sales = await createSales({
    email: "john@doe.com",
    first_name: "John",
    last_name: "Doe",
    password: "password",
  });

  await page.goto("http://localhost:5175/");
  await page.getByLabel("Email").fill("john@doe.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveTitle(/Atomic CRM/);

  await menu.goToContacts();

  // Create a contact with a budget and case description directly through
  // the form (both fields now live on the contact -- TASK-003).
  await page.getByText("New Judge-Referee").click();
  await page.waitForLoadState("networkidle");
  await page.getByLabel("First name").fill("Ada");
  await page.getByLabel("Last name").fill("Lovelace");
  await page.getByLabel("Budget").fill("500");
  await page
    .getByLabel("Case description")
    .fill("Padel Masters vs Riviera Open");
  await expect(page.getByLabel("Account manager *")).toHaveText(
    `${sales.first_name} ${sales.last_name}`,
  );
  await page.getByRole("button", { name: "Save" }).click();
  await dismissToast("Element created");

  await expect(
    page.getByRole("heading", { name: "Ada Lovelace" }),
  ).toBeVisible();
  await expect(page.getByText("$500")).toBeVisible();
  await expect(
    page.getByText("Padel Masters vs Riviera Open"),
  ).toBeVisible();

  // Edit both fields and confirm the show page reflects the new values.
  await page.getByRole("link", { name: "Edit judge-referee" }).click();
  await page.getByLabel("Budget").fill("0");
  await page.getByLabel("Case description").fill("Case closed, no rematch");
  await page.getByRole("button", { name: /^save$/i }).click();
  await dismissToast("Element updated");

  await expect(page.getByText("$0.00")).toBeVisible();
  await expect(page.getByText("Case closed, no rematch")).toBeVisible();
});
