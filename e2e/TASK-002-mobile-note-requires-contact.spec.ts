import { test, expect } from "./fixtures";

test.describe("mobile Add-note FAB requires a selected contact", () => {
  test.beforeEach(({ isMobile }) => {
    test.skip(
      !isMobile,
      "The bottom-nav Add-note FAB only renders in the mobile layout",
    );
  });

  test("blocks saving until a contact is picked, from the contacts list", async ({
    page,
    createSales,
    createContact,
    dismissToast,
    menu,
  }) => {
    const sales = await createSales({
      first_name: "John",
      last_name: "Doe",
      email: "john@doe.com",
      password: "password",
    });

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

    await menu.goToContacts();
    await page.waitForLoadState("networkidle");

    // Global FAB, no contact in the current route -- opens in "pick a contact" mode.
    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("menuitem", { name: "Note" }).click();

    await page.getByPlaceholder("Add a note").fill("Called about the case");

    // No contact selected yet -- Save is structurally disabled, not just
    // blocked after a failed attempt.
    const saveButton = page.getByRole("button", { name: /^save$/i });
    await expect(saveButton).toBeDisabled();

    await page.getByLabel("Judge-Referee *").click();
    await page.getByPlaceholder("Search").fill("Ada Lovelace");
    await page.getByRole("option", { name: "Ada Lovelace" }).click();

    await expect(saveButton).toBeEnabled();
    await saveButton.click();

    await dismissToast("Note added");
    await expect(
      page.getByRole("heading", { name: "Ada Lovelace" }),
    ).toBeVisible();
  });

  test("pre-fills the contact and saves, from a specific contact page", async ({
    page,
    createSales,
    createContact,
    dismissToast,
  }) => {
    const sales = await createSales({
      first_name: "John",
      last_name: "Doe",
      email: "john@doe.com",
      password: "password",
    });

    const contact = await createContact({
      first_name: "Ada",
      last_name: "Lovelace",
      sales_id: sales.id,
    });

    await page.goto("http://localhost:5175/");
    await page.getByLabel("Email").fill("john@doe.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveTitle(/Atomic CRM/);

    await page.goto(`http://localhost:5175/#/contacts/${contact.id}/show`);
    await expect(
      page.getByRole("heading", { name: "Ada Lovelace" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Create" }).click();
    await page.getByRole("menuitem", { name: "Note" }).click();

    // Contact already resolved from the route -- no picker, Save is
    // available as soon as there is note text.
    await expect(page.getByLabel("Judge-Referee *")).not.toBeVisible();
    const saveButton = page.getByRole("button", { name: /^save$/i });
    await expect(saveButton).toBeEnabled();

    await page.getByPlaceholder("Add a note").fill("Called about the case");
    await saveButton.click();

    await dismissToast("Note added");
  });
});
