import { test, expect } from "./fixtures";

test.describe("deal record shape: no closing date, optional budget", () => {
  test("the deal creation form has no expected-closing-date field and no required budget", async ({
    page,
    isMobile,
    createSales,
    createCompany,
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

    await createCompany({ name: "Padel Club Paris", salesId: sales.id });

    // The deal create dialog only mounts once at least one contact exists
    // (see DealEmpty.tsx) -- unrelated to this deal, just needed to unlock
    // the create flow from an otherwise-empty deals list.
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

    await page.goto("http://localhost:5175/deals/create");

    await expect(page.getByLabel("Name *")).toBeVisible();
    await expect(page.getByText("Expected closing date")).not.toBeVisible();

    // Budget is no longer a required field: no asterisk on its label, and a
    // deal can be saved without ever touching it.
    await expect(page.getByLabel("Budget")).toBeVisible();
    await expect(page.getByLabel("Budget *")).not.toBeVisible();

    await page.getByLabel("Name *").fill("Padel dispute");
    await page.getByRole("combobox", { name: /case type/i }).click();
    await page.getByRole("listbox").getByText("Club").click();
    await page.getByLabel("Club *").click();
    await page.getByPlaceholder("Search").fill("Padel Club Paris");
    await page.getByRole("option", { name: "Padel Club Paris" }).click();

    await page.getByPlaceholder("Search").fill("Ada Lovelace");
    await page.getByRole("option", { name: "Ada Lovelace" }).click();

    // A deal also requires a next action -- fill in the mini-form before
    // saving (the contact has no open task, so it starts empty). Scoped to
    // the "Next action" section -- its "Type" field would otherwise collide
    // with the unrelated "Case type" combobox above.
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

  test("a deal saved with no budget is displayed without any NaN", async ({
    page,
    isMobile,
    createSales,
    createCompany,
    createDeal,
  }) => {
    test.skip(
      isMobile,
      "Deal Show opens as a desktop-only dialog in this suite",
    );

    const sales = await createSales({
      first_name: "John",
      last_name: "Doe",
      email: "john@doe.com",
      password: "password",
    });

    const company = await createCompany({
      name: "Padel Club Paris",
      salesId: sales.id,
    });

    const deal = await createDeal({
      name: "Padel dispute",
      companyId: company.id,
      salesId: sales.id,
      amount: null,
    });

    await page.goto("http://localhost:5175/");
    await page.getByLabel("Email").fill("john@doe.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveTitle(/Atomic CRM/);

    await page.getByRole("link", { name: "Deals" }).click();
    await page.waitForLoadState("networkidle");

    // The kanban card for the amount-less deal renders with no NaN.
    await expect(page.getByText("Padel dispute")).toBeVisible();
    await expect(page.getByText("NaN")).toHaveCount(0);

    await page.goto(`http://localhost:5175/deals/${deal.id}/show`);
    await expect(
      page.getByRole("heading", { name: "Padel dispute" }),
    ).toBeVisible();
    await expect(page.getByText("NaN")).toHaveCount(0);
  });
});
