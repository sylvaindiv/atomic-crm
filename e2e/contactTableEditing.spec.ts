import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

/**
 * Covers one edit round-trip (click -> editor appears -> change -> commit ->
 * persists after reload) for each inline-editable column family the new
 * desktop Contacts table (`ContactTable.tsx`, TASK-008) actually renders,
 * plus the regression this row-based table introduced: only the name cell
 * still navigates to the contact's Show page, every other cell mutates in
 * place instead of navigating.
 *
 * Families covered: text (title), reference (club), status, array/list
 * (email addresses), tags. `EditableBooleanCell` (`has_newsletter`) exists
 * as a component (TASK-005) but `ContactTable.tsx` never wires it up as a
 * column -- there is no boolean cell rendered anywhere in the table, so it
 * is intentionally left out here rather than exercising a column that
 * doesn't exist.
 *
 * Each test signs in and creates its own single contact (the `resetDb`
 * fixture wipes the database before every test), so within a test there is
 * exactly one data row and no ambiguity with a second contact's cells.
 */
test.describe("contact table inline editing", () => {
  let salesId: string | number;

  test.beforeEach(
    async ({ page, isMobile, createSales, createContact, menu }) => {
      test.skip(
        isMobile,
        "The inline-editable table only renders on desktop; mobile uses a card list.",
      );

      const sales = await createSales({
        email: "john@doe.com",
        first_name: "John",
        last_name: "Doe",
        password: "password",
      });
      salesId = sales.id;

      await createContact({
        first_name: "Ada",
        last_name: "Lovelace",
        sales_id: sales.id,
        title: "CTO",
      });

      await page.goto("http://localhost:5175/");
      await page.getByLabel("Email").fill("john@doe.com");
      await page.getByLabel("Password").fill("password");
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveTitle(/Atomic CRM/);

      await menu.goToContacts();
    },
  );

  test("edits a text cell and the new value survives a reload", async ({
    page,
  }) => {
    const row = page.getByRole("row", { name: "Ada Lovelace" });

    await row.getByRole("button", { name: "CTO" }).click();
    const titleInput = row.getByRole("textbox");
    await titleInput.fill("VP Engineering");
    await titleInput.press("Enter");
    await expect(
      row.getByRole("button", { name: "VP Engineering" }),
    ).toBeVisible();

    await page.waitForLoadState("networkidle");
    await page.reload();

    await expect(
      page
        .getByRole("row", { name: "Ada Lovelace" })
        .getByRole("button", { name: "VP Engineering" }),
    ).toBeVisible();
  });

  test("assigns a club through the reference cell and it survives a reload", async ({
    page,
    createCompany,
  }) => {
    await createCompany({ name: "Padel Club Paris", salesId });
    const row = page.getByRole("row", { name: "Ada Lovelace" });

    await row.getByRole("button", { name: "Club" }).click();
    await page.getByRole("option", { name: "Padel Club Paris" }).click();
    await expect(
      row.getByRole("button", { name: "Club: Padel Club Paris" }),
    ).toBeVisible();

    await page.waitForLoadState("networkidle");
    await page.reload();

    await expect(
      page
        .getByRole("row", { name: "Ada Lovelace" })
        .getByRole("button", { name: "Club: Padel Club Paris" }),
    ).toBeVisible();
  });

  test("changes the status through the inline selector and it survives a reload", async ({
    page,
  }) => {
    const row = page.getByRole("row", { name: "Ada Lovelace" });

    await row.getByRole("combobox").click();
    await page.getByRole("option", { name: "Visio" }).click();
    await expect(row).toContainText("Visio");

    await page.waitForLoadState("networkidle");
    await page.reload();

    await expect(
      page.getByRole("row", { name: "Ada Lovelace" }),
    ).toContainText("Visio");
  });

  test("adds an email through the list cell and it survives a reload", async ({
    page,
  }) => {
    const row = page.getByRole("row", { name: "Ada Lovelace" });
    const emailCell = await getColumnCell(page, row, "Email addresses");

    await emailCell.getByRole("button").click();
    await page.getByRole("button", { name: "Add email" }).click();
    const emailInput = page.getByRole("textbox", { name: "Email" });
    await emailInput.fill("ada@padel.example");
    await emailInput.press("Enter");
    await page.keyboard.press("Escape");

    await expect(
      emailCell.getByRole("button", { name: "ada@padel.example" }),
    ).toBeVisible();

    await page.waitForLoadState("networkidle");
    await page.reload();

    const reloadedEmailCell = await getColumnCell(
      page,
      page.getByRole("row", { name: "Ada Lovelace" }),
      "Email addresses",
    );
    await expect(
      reloadedEmailCell.getByRole("button", { name: "ada@padel.example" }),
    ).toBeVisible();
  });

  test("creates and attaches a tag through the inline editor and it survives a reload", async ({
    page,
  }) => {
    const row = page.getByRole("row", { name: "Ada Lovelace" });

    await row.getByRole("button", { name: "Add tag" }).click();
    await page.getByRole("menuitem", { name: "Create new tag" }).click();
    await page.getByLabel("Tag name").fill("Padel Prospect");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(row).toContainText("Padel Prospect");

    await page.waitForLoadState("networkidle");
    await page.reload();

    await expect(
      page.getByRole("row", { name: "Ada Lovelace" }),
    ).toContainText("Padel Prospect");
  });

  test("the name cell navigates to Show while an editable cell mutates in place", async ({
    page,
  }) => {
    const row = page.getByRole("row", { name: "Ada Lovelace" });

    // An editable cell opens its own in-row editor and never navigates away
    // from the list, unlike the old whole-row-is-a-Link card list.
    await row.getByRole("button", { name: "CTO" }).click();
    await expect(row.getByRole("textbox")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Ada Lovelace" }),
    ).not.toBeVisible();
    await row.getByRole("textbox").press("Escape");

    // The name cell is the sole exception: it renders its own Link to Show.
    await row.getByRole("link", { name: "Ada Lovelace" }).click();
    await expect(
      page.getByRole("heading", { name: "Ada Lovelace" }),
    ).toBeVisible();
  });

  test("selects a row via its checkbox even though the row is tinted by status", async ({
    page,
  }) => {
    // Ada is created with a status ("cold"), so this row is tinted through
    // `rowStyle`/`rowClassName` (TASK-003) -- the tint must not steal the
    // click from the row's own selection checkbox.
    const row = page.getByRole("row", { name: "Ada Lovelace" });

    await row.getByRole("checkbox").click();

    await expect(
      page.getByRole("button", { name: /select all/i }),
    ).toBeVisible();
  });
});

/**
 * Resolves one specific column's cell in `row` by the column's header
 * label. Needed for email/phone specifically: both collapse to the same
 * "-" placeholder with no distinguishing aria-label when empty (unlike the
 * reference cells, which always carry a field-name aria-label), so
 * accessible name alone can't tell them apart -- position under the
 * matching header can.
 */
const getColumnCell = async (
  page: Page,
  row: Locator,
  columnHeader: string,
): Promise<Locator> => {
  const headers = await page.getByRole("columnheader").allInnerTexts();
  const index = headers.findIndex((text) => text.trim() === columnHeader);
  return row.getByRole("cell").nth(index);
};
