import { test, expect } from "./fixtures";

test.describe("dashboard monthly amount chart reads contacts", () => {
  test("a contact with no budget renders on the dashboard chart without NaN", async ({
    page,
    isMobile,
    createSales,
    createContact,
    menu,
  }) => {
    test.skip(
      isMobile,
      "The amount chart is desktop-only in this suite (mobile dashboard has no chart)",
    );

    const sales = await createSales({
      first_name: "John",
      last_name: "Doe",
      email: "john@doe.com",
      password: "password",
    });

    // No amount set -- must contribute 0 to the chart, never NaN.
    await createContact({
      first_name: "Ada",
      last_name: "Lovelace",
      sales_id: sales.id,
      notes: [{ text: "First contact" }],
    });

    await page.goto("http://localhost:5175/");
    await page.getByLabel("Email").fill("john@doe.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveTitle(/Atomic CRM/);

    await menu.goToDashboard();

    await expect(
      page.getByRole("heading", { name: "Upcoming Amount" }),
    ).toBeVisible();
    await expect(page.getByText("NaN")).toHaveCount(0);
  });
});
