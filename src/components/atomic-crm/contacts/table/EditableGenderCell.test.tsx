import { RecordContextProvider } from "ra-core";
import { render } from "vitest-browser-react";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { EditableGenderCell } from "./EditableGenderCell";

describe("EditableGenderCell", () => {
  it("commits the newly selected gender", async () => {
    const updateMock = vi.fn().mockResolvedValue({ data: {} });
    const contact = buildContact({ id: 1, gender: "female" });

    const screen = await render(
      <StoryWrapper dataProvider={{ update: updateMock }}>
        <RecordContextProvider value={contact}>
          <EditableGenderCell />
        </RecordContextProvider>
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("combobox"))
      .toHaveTextContent("She/Her");

    await screen.getByRole("combobox").click();
    await screen.getByRole("listbox").getByText("He/Him").click();

    expect(updateMock).toHaveBeenCalledWith(
      "contacts",
      expect.objectContaining({
        id: 1,
        data: { gender: "male" },
      }),
    );
  });
});
