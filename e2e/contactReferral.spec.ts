import { test, expect } from "./fixtures";

test("user selects a referrer for a contact and sees it reflected", async ({
  page,
  isMobile,
  createContact,
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

  await menu.goToContacts();
  await expect(page.getByText("Ada Lovelace")).toBeVisible();

  // Open Ada's show page, then her edit form
  await page.getByText("Ada Lovelace").click();
  await expect(
    page.getByRole("heading", { name: "Ada Lovelace" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit judge-referee" }).click();

  // Select Grace as the referrer
  await page.getByLabel(/referred by/i).click();
  await page.getByText("Grace Hopper").click();

  await page.getByRole("button", { name: /^save$/i }).click();
  await dismissToast("Element updated");

  // Back on Ada's show page, the referrer is displayed and links to Grace's page
  await expect(page.getByText("Grace Hopper")).toBeVisible();
  await page.getByText("Grace Hopper").click();

  await expect(
    page.getByRole("heading", { name: "Grace Hopper" }),
  ).toBeVisible();
});
