import { test, expect } from "./fixtures";

/**
 * Covers the contacts list's table/Kanban toggle (TASK-004): switching to
 * Kanban shows one column per visible note status with each contact's card
 * under its own status, and dragging a card to another column persists the
 * new status -- and the chosen view -- across a reload.
 */
test.describe("contacts Kanban", () => {
  let salesId: string | number;

  test.beforeEach(async ({ page, isMobile, createSales, menu }) => {
    test.skip(
      isMobile,
      "The Kanban toggle only renders on the desktop contacts list.",
    );

    const sales = await createSales({
      email: "coach@doe.com",
      first_name: "Coach",
      last_name: "Doe",
      password: "password",
    });
    salesId = sales.id;

    await page.goto("http://localhost:5175/");
    await page.getByLabel("Email").fill("coach@doe.com");
    await page.getByLabel("Password").fill("password");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveTitle(/Atomic CRM/);

    await menu.goToContacts();
  });

  test("switches to the Kanban view and drags a contact into another status column", async ({
    page,
    createContact,
  }) => {
    const alice = await createContact({
      first_name: "Alice",
      last_name: "Ada",
      sales_id: salesId,
      status: "a_recontacter",
    });
    await createContact({
      first_name: "Bob",
      last_name: "King",
      sales_id: salesId,
      status: "visio",
    });

    // Table is the default view.
    await page.reload();
    await expect(page.getByRole("row", { name: "Alice Ada" })).toBeVisible();

    await page.getByRole("button", { name: "Kanban" }).click();

    const recontacterColumn = page.getByRole("group", {
      name: "A recontacter",
    });
    const visioColumn = page.getByRole("group", { name: "Visio" });
    await expect(recontacterColumn.getByText("Alice Ada")).toBeVisible();
    await expect(visioColumn.getByText("Bob King")).toBeVisible();

    const handle = page.locator(
      `[data-rfd-drag-handle-draggable-id="${alice.id}"]`,
    );
    const sourceBox = await handle.boundingBox();
    const destinationBox = await visioColumn.boundingBox();
    if (!sourceBox || !destinationBox) {
      throw new Error(
        "Could not resolve the drag source/destination bounding boxes",
      );
    }

    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2,
      sourceBox.y + sourceBox.height / 2,
    );
    await page.mouse.down();
    // A first small move past the drag threshold, then several intermediate
    // steps into the destination column -- @hello-pangea/dnd's mouse sensor
    // tracks real mousemove events, not a single teleporting jump.
    await page.mouse.move(
      sourceBox.x + sourceBox.width / 2 + 10,
      sourceBox.y + sourceBox.height / 2,
      { steps: 5 },
    );
    await page.mouse.move(
      destinationBox.x + destinationBox.width / 2,
      destinationBox.y + destinationBox.height / 2,
      { steps: 10 },
    );
    await page.mouse.up();

    await expect(visioColumn.getByText("Alice Ada")).toBeVisible();
    await expect(recontacterColumn.getByText("Alice Ada")).not.toBeVisible();

    await page.waitForLoadState("networkidle");
    await page.reload();

    // The Kanban view and the moved contact's new column both survive the
    // reload -- no need to click the toggle again.
    await expect(
      page.getByRole("group", { name: "Visio" }).getByText("Alice Ada"),
    ).toBeVisible();
  });
});
