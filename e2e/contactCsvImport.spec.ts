import { test, expect } from "./fixtures";

test("user imports contacts from a CSV including a company address and a comment", async ({
  page,
  createSales,
  menu,
}) => {
  await createSales({
    email: "jane@doe.com",
    first_name: "Jane",
    last_name: "Doe",
    password: "password",
  });

  await page.goto("http://localhost:5175/");
  await page.getByLabel("Email").fill("jane@doe.com");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("link", { name: "Contacts" })).toBeVisible();
  await menu.goToContacts();

  await page.getByRole("button", { name: "Import CSV" }).click();

  // Minimal CSV exercising the new columns: company address (zipcode/city,
  // with the leading zero that dynamicTyping used to strip) and a comment
  // (imported as a contact_notes row).
  const csv = [
    "first_name,last_name,gender,status,company,zipcode,city,comment",
    "Ada,Lovelace,female,a_recontacter,Analytical Engines,01120,Montluel,Loves punch cards",
  ].join("\n");

  await page.locator('input[type="file"]').setInputFiles({
    name: "contacts.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });

  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Import CSV" }).click();

  await expect(page.getByText(/Contacts import complete/i)).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByText("Ada Lovelace")).toBeVisible();
});
