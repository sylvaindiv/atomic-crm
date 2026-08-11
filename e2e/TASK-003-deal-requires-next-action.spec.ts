import { test, expect } from "./fixtures";

test.describe("deal requires a next action", () => {
  test("blocks saving a deal until the next action is filled in", async ({
    page,
    isMobile,
    createSales,
    createContact,
  }) => {
    test.skip(
      isMobile,
      "Deal creation is desktop-only in this suite (no deals list on mobile)",
    );

    const sales = await createSales({
      first_name: "John",
      last_name: "Doe",
      email: "john@doe.com",
      password: "password",
    });

    // No task created for this contact -- the next-action fields must start
    // empty and block the save until filled in.
    await createContact({
      first_name: "Ada",
      last_name: "Lovelace",
      sales_id: sales.id,
    });

    await page.goto("http://localhost:5175/");
    await page.getByLabel("Email").fill("john@doe.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveTitle(/Atomic CRM/);

    await page.goto("http://localhost:5175/#/deals/create");

    await page.getByLabel("Name *").fill("Padel dispute");
    await page.getByRole("combobox", { name: /case type/i }).click();
    await page.getByRole("listbox").getByText("Judge").click();

    await page.getByPlaceholder("Search").fill("Ada Lovelace");
    await page.getByRole("option", { name: "Ada Lovelace" }).click();

    // Next action left empty -- save is blocked, no navigation happens.
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText("Required")).toBeVisible();
    await expect(page.getByText("Element created")).not.toBeVisible();

    // Scoped to the "Next action" section -- its "Type" field would
    // otherwise collide with the unrelated "Case type" combobox above.
    const nextAction = page
      .getByRole("heading", { name: "Next action" })
      .locator("..");
    await nextAction.getByLabel("What's next *").fill("Call the referee");
    await nextAction.getByLabel("Due date").fill("2026-04-11T21:00");
    await nextAction.getByLabel("Type").click();
    await page.getByRole("option", { name: "Call" }).click();

    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText("Element created")).toBeVisible();
  });
});
