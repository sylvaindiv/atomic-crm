import { test, expect } from "./fixtures";

test("merging a contact auto-suggests an accent/case-variant duplicate", async ({
  page,
  isMobile,
  createContact,
  createSales,
  menu,
}) => {
  test.skip(isMobile, "Contact merge is only available on desktop");

  const sales = await createSales({
    email: "jane@doe.com",
    first_name: "Jane",
    last_name: "Doe",
    password: "password",
  });

  // Same person, entered twice with different case and accents.
  await createContact({
    first_name: "René",
    last_name: "Dupont",
    sales_id: sales.id,
  });
  await createContact({
    first_name: "Rene",
    last_name: "DUPONT",
    sales_id: sales.id,
  });

  await page.goto("http://localhost:5175/");

  await page.getByLabel("Email").fill("jane@doe.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveTitle(/Atomic CRM/);

  await menu.goToContacts();
  await page.getByText("René Dupont").click();
  await page.getByRole("link", { name: "Edit judge-referee" }).click();
  await page
    .getByRole("button", { name: "Merge with another judge-referee" })
    .click();

  const dialog = page.getByRole("dialog");

  // The accent/case-only variant is found and auto-preselected as the
  // merge target, without the user having to search for it.
  await expect(dialog.getByText("Rene DUPONT")).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Merge Judges-Referees" }),
  ).toBeEnabled();
});
