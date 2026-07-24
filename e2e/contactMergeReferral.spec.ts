import { test, expect } from "./fixtures";

test("merging a contact repoints the contacts it referred to the winner", async ({
  page,
  isMobile,
  createContact,
  createSales,
  menu,
  dismissToast,
}) => {
  test.skip(isMobile, "Contact merge is only available on desktop");

  const sales = await createSales({
    email: "john@doe.com",
    first_name: "John",
    last_name: "Doe",
    password: "password",
  });

  await createContact({
    first_name: "Isaac",
    last_name: "Newton",
    sales_id: sales.id,
  });
  await createContact({
    first_name: "Marie",
    last_name: "Curie",
    sales_id: sales.id,
  });
  await createContact({
    first_name: "Rosalind",
    last_name: "Franklin",
    sales_id: sales.id,
  });

  await page.goto("http://localhost:5175/");

  await page.getByLabel("Email").fill("john@doe.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveTitle(/Atomic CRM/);

  // Rosalind is referred by Isaac, who will be merged away (the loser)
  await menu.goToContacts();
  await page.getByText("Rosalind Franklin").click();
  await page.getByRole("link", { name: "Edit contact" }).click();
  await page.getByLabel(/referred by/i).click();
  await page.getByText("Isaac Newton").click();
  await page.getByRole("button", { name: /^save$/i }).click();
  await dismissToast("Element updated");

  // Merge Isaac (loser) into Marie (winner)
  await menu.goToContacts();
  await page.getByText("Isaac Newton").click();
  await page.getByRole("link", { name: "Edit contact" }).click();
  await page
    .getByRole("button", { name: "Merge with another contact" })
    .click();

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox").click();
  await page.getByText("Marie Curie").click();

  // The dialog reports that Rosalind's referral will be repointed
  await expect(
    dialog.getByText("1 contact referred by this contact will be updated"),
  ).toBeVisible();

  await dialog.getByRole("button", { name: "Merge Contacts" }).click();
  await dismissToast("Contacts merged successfully");

  // Redirected to the winner's page
  await expect(
    page.getByRole("heading", { name: "Marie Curie" }),
  ).toBeVisible();

  // Rosalind is now referred by Marie instead of the deleted Isaac
  await menu.goToContacts();
  await page.getByText("Rosalind Franklin").click();
  await expect(page.getByText("Marie Curie")).toBeVisible();
});
