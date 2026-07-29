import { RecordContextProvider } from "ra-core";
import { render } from "vitest-browser-react";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { EditableReferredByCell } from "./EditableReferredByCell";

describe("EditableReferredByCell", () => {
  it("excludes the current record from its own referrer options", async () => {
    const currentContact = buildContact({
      id: 1,
      first_name: "Ada",
      last_name: "Lovelace",
      referred_by_id: null,
      referred_by_name: undefined,
    });
    const otherContact = buildContact({
      id: 2,
      first_name: "Grace",
      last_name: "Hopper",
    });

    const screen = await render(
      <StoryWrapper data={{ contacts: [currentContact, otherContact] }}>
        <RecordContextProvider value={currentContact}>
          <EditableReferredByCell />
        </RecordContextProvider>
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "Referred by" }).click();

    // The other contact is a valid referrer...
    await expect.element(screen.getByText("Grace Hopper")).toBeVisible();
    // ...but the current record must never be able to refer itself.
    await expect
      .element(screen.getByText("Ada Lovelace"))
      .not.toBeInTheDocument();
  });
});
