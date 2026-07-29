import { test, expect } from "./fixtures";

test("user adds a tag to several contacts", async ({
  page,
  isMobile,
  createContact,
  createSales,
  menu,
  dismissToast,
}) => {
  test.skip(isMobile, "Bulk tag is only available on desktop");

  const sales = await createSales({
    email: "john@doe.com",
    first_name: "John",
    last_name: "Doe",
    password: "password",
  });

  await createContact({
    first_name: "Ada",
    last_name: "Lovelace",
    sales_id: sales.id,
    title: "CTO",
  });
  await createContact({
    first_name: "Grace",
    last_name: "Hopper",
    sales_id: sales.id,
    title: "Rear Admiral",
  });

  await page.goto("http://localhost:5175/");

  await page.getByLabel("Email").fill("john@doe.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveTitle(/Atomic CRM/);
  await expect(page.getByRole("link", { name: "Referees" })).toBeVisible();

  await menu.goToContacts();
  await expect(page.getByText("Ada Lovelace")).toBeVisible();
  await expect(page.getByText("Grace Hopper")).toBeVisible();

  // Scoped to the table body: the table header also renders a "select all"
  // checkbox (same role), which isn't one of the per-row selection
  // checkboxes this test means to click.
  const rowCheckboxes = page.locator("tbody").getByRole("checkbox");
  await rowCheckboxes.first().click();
  await page.getByRole("button", { name: /select all/i }).click();

  await page.getByRole("button", { name: /^Tag$/ }).click();
  await page.getByRole("button", { name: "Create new tag" }).click();
  await page.getByLabel("Tag name").fill("Prospect");
  await page.getByRole("button", { name: "Save" }).click();

  await dismissToast("Tag added to 2 judges-referees");

  // The tag now lives in its own column, a sibling of (not nested under)
  // the name cell's link -- assert against the whole table row instead of
  // walking up from the name to a shared ancestor link.
  await expect(page.getByRole("row", { name: "Grace Hopper" })).toContainText(
    "Prospect",
  );
  await expect(page.getByRole("row", { name: "Ada Lovelace" })).toContainText(
    "Prospect",
  );
});
