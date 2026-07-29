import { RecordContextProvider } from "ra-core";
import { render } from "vitest-browser-react";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import type { Sale } from "../../types";
import { EditableSalesCell } from "./EditableSalesCell";

/** Builds a valid `sales` row fixture, overridable per test. */
function buildSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 1,
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    administrator: false,
    disabled: false,
    user_id: "user-1",
    ...overrides,
  };
}

describe("EditableSalesCell", () => {
  it("resolves the closed-cell label from the fetched sales list and commits a new pick", async () => {
    const updateMock = vi.fn().mockResolvedValue({ data: {} });
    const contact = buildContact({ id: 1, sales_id: 1 });

    const screen = await render(
      <StoryWrapper
        data={{
          sales: [
            buildSale({ id: 1, first_name: "Jane", last_name: "Doe" }),
            buildSale({ id: 2, first_name: "John", last_name: "Smith" }),
          ],
        }}
        dataProvider={{ update: updateMock }}
      >
        <RecordContextProvider value={contact}>
          <EditableSalesCell />
        </RecordContextProvider>
      </StoryWrapper>,
    );

    // No denormalized sales name exists on contacts_summary, so the label
    // is resolved from the (eagerly-fetched, shared) sales list.
    await expect
      .element(
        screen.getByRole("button", { name: "Account manager: Jane Doe" }),
      )
      .toBeInTheDocument();

    await screen
      .getByRole("button", { name: "Account manager: Jane Doe" })
      .click();
    await screen.getByText("John Smith").click();

    expect(updateMock).toHaveBeenCalledWith(
      "contacts",
      expect.objectContaining({
        id: 1,
        data: { sales_id: 2 },
      }),
    );
  });
});
