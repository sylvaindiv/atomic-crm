import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { ResourceContextProvider } from "ra-core";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { ContactList } from "./ContactList";

import {
  DesktopEmpty,
  DesktopSuccess,
  DesktopLoading,
  DesktopError,
  BulkTagButton,
} from "./ContactList.stories";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ContactList", () => {
  it("shows only partners with the shared table on desktop", async () => {
    page.viewport(1600, 900);
    const screen = await render(
      <StoryWrapper
        initialEntries={["/partners"]}
        data={{
          contacts: [
            buildContact({ id: 1, first_name: "Referee", status: "" }),
            buildContact({
              id: 2,
              first_name: "Partner",
              contact_type: "partner",
              status: "",
            }),
          ],
        }}
      >
        <div />
      </StoryWrapper>,
    );
    await expect.element(screen.getByText("Partner Lovelace")).toBeVisible();
    await expect
      .element(screen.getByText("Referee Lovelace"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "New Partner" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("switch", { name: "Assigned to me" }))
      .not.toBeInTheDocument();
  });

  it("filters referees assigned to the current user without clearing search", async () => {
    page.viewport(1600, 900);
    const screen = await render(
      <StoryWrapper
        data={{
          contacts: [
            buildContact({ id: 1, first_name: "Mine", sales_id: 0 }),
            buildContact({ id: 2, first_name: "Other", sales_id: 1 }),
            buildContact({
              id: 3,
              first_name: "Unassigned",
              sales_id: undefined,
            }),
          ],
        }}
      >
        <ResourceContextProvider value="contacts">
          <ContactList />
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await screen.getByPlaceholder("Search name, club...").fill("Other");
    await expect.element(screen.getByText("Other Lovelace")).toBeVisible();

    const assignedToMe = screen.getByRole("switch", {
      name: "Assigned to me",
    });
    await assignedToMe.click();
    await expect.element(assignedToMe).toBeChecked();
    await expect
      .element(screen.getByText("Other Lovelace"))
      .not.toBeInTheDocument();
    await expect.element(assignedToMe).toBeVisible();

    await assignedToMe.click();
    await expect.element(assignedToMe).not.toBeChecked();
    await expect.element(screen.getByText("Other Lovelace")).toBeVisible();
    await expect
      .element(screen.getByText("Mine Lovelace"))
      .not.toBeInTheDocument();
  });

  it("opens partners on the partner route on mobile", async () => {
    page.viewport(375, 667);
    const screen = await render(
      <StoryWrapper
        initialEntries={["/partners"]}
        data={{
          contacts: [
            buildContact({
              id: 2,
              first_name: "Partner",
              contact_type: "partner",
              status: "",
            }),
          ],
        }}
      >
        <div />
      </StoryWrapper>,
    );
    await expect
      .element(screen.getByRole("link", { name: /Partner Lovelace/ }))
      .toHaveAttribute("href", "/partners/2/show");
  });
  it("renders an invite to create the first contact when the app is empty", async () => {
    const screen = await render(<DesktopEmpty />);
    await expect
      .element(
        screen.getByRole("heading", { name: "No judges-referees found" }),
      )
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("It seems your judge-referee list is empty."))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Import CSV" }))
      .not.toBeInTheDocument();
  });

  it("renders contacts in a list", async () => {
    const screen = await render(<DesktopSuccess />);

    await expect.element(screen.getByText("Ada Lovelace")).toBeVisible();
    await expect.element(screen.getByText("Grace Hopper")).toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Import CSV" }))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Export" }))
      .not.toBeInTheDocument();
    await expect
      .element(
        screen.getByRole("heading", { name: "No judges-referees found" }),
      )
      .not.toBeInTheDocument();
  });

  /**
   * The desktop version doesn't show a skeleton yet
   */
  it.skip("renders a skeleton while loading", async () => {
    const screen = await render(<DesktopLoading />);

    await expect
      .poll(() => screen.container.querySelector('[data-slot="skeleton"]'))
      .not.toBeNull();
  });

  it("renders an error notification when loading contacts fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const screen = await render(<DesktopError />);

    await expect
      .element(screen.getByText("Error loading contacts"))
      .toBeVisible();
  });

  it("shows the bulk tag button only after selecting contacts", async () => {
    const screen = await render(<BulkTagButton />);

    await expect
      .element(screen.getByRole("button", { name: /^tag$/i }))
      .not.toBeInTheDocument();

    await expect
      .poll(() => getSelectionCheckboxes(screen.container).length)
      .toBe(2);

    const [selectionCheckbox] = getSelectionCheckboxes(screen.container);
    await selectionCheckbox.click();

    await expect
      .element(screen.getByRole("button", { name: /^tag$/i }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Export" }))
      .not.toBeInTheDocument();
  });

  it("adds an existing tag to selected contacts without duplicating it", async () => {
    const screen = await render(<BulkTagButton />);

    await expect
      .poll(() => getSelectionCheckboxes(screen.container).length)
      .toBe(2);

    const checkboxes = getSelectionCheckboxes(screen.container);
    await checkboxes[0].click();
    await checkboxes[1].click();

    await screen.getByRole("button", { name: /^tag$/i }).click();
    await screen.getByRole("button", { name: "VIP" }).click();

    await expect
      .element(screen.getByText("Tag added to 1 judge-referee"))
      .toBeInTheDocument();
    await expect
      .poll(() => screen.getByText("VIP").all().length)
      .toBeGreaterThanOrEqual(2);
    // close the notification
    await screen.getByRole("button", { name: /close/i }).click();
  });

  it("creates a new tag inline and applies it to the full selected list", async () => {
    const screen = await render(<BulkTagButton />);

    await expect
      .poll(() => getSelectionCheckboxes(screen.container).length)
      .toBe(2);

    const checkboxes = getSelectionCheckboxes(screen.container);
    await checkboxes[0].click();
    await checkboxes[1].click();

    await screen.getByRole("button", { name: /^Tag$/ }).click();
    await screen.getByRole("button", { name: /Create new tag/ }).click();

    await expect
      .element(
        screen.getByText(
          "Create a new tag and apply it to the selected judges-referees.",
        ),
      )
      .toBeVisible();

    await screen.getByLabelText("Tag name").fill("Prospect");
    await screen.getByRole("button", { name: /^Save$/ }).click();

    await expect
      .element(screen.getByText("Tag added to 2 judges-referees"))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Prospect").first()).toBeVisible();
    // close the notification
    await screen.getByRole("button", { name: /close/i }).click();
  });
});

// Scoped to the table body: `<DataTable>` also renders a "select all"
// checkbox in its header (same `data-slot="checkbox"`), which isn't one of
// the per-row selection checkboxes these tests click.
const getSelectionCheckboxes = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll(
      '[data-slot="table-body"] [data-slot="checkbox"]',
    ),
  ).map((element) => element as HTMLElement);
