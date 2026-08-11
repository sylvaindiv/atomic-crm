import { test, expect } from "./fixtures";

test.describe("club deal requires a linked contact", () => {
  test("blocks saving a club deal until a contact is selected", async ({
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
    await page.getByRole("listbox").getByText("Club").click();

    await page.getByLabel("Club *").click();
    // The company combobox portals its options popover, which momentarily
    // coexists with the always-mounted contact search input below -- scope
    // to the popover so the two "Search" placeholders aren't ambiguous.
    const companyPopover = page.locator('[data-slot="popover-content"]');
    await companyPopover.getByPlaceholder("Search").fill("Padel Club Paris");
    await page.getByRole("option", { name: "Padel Club Paris" }).click();

    // No contact selected yet -- save is blocked, no navigation happens.
    // The next-action fields are also empty and required, so "Required" now
    // matches 3 elements -- scope to the first one (the contact field) to
    // avoid a strict-mode violation.
    await page.getByRole("button", { name: /^save$/i }).click();
    await expect(page.getByText("Required").first()).toBeVisible();

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
});
