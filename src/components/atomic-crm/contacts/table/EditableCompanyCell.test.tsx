import { RecordContextProvider } from "ra-core";
import { render } from "vitest-browser-react";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import { EditableCompanyCell } from "./EditableCompanyCell";

describe("EditableCompanyCell", () => {
  it("creates a new club inline and assigns it to the contact", async () => {
    const createMock = vi
      .fn()
      .mockResolvedValue({ data: { id: 9, name: "New Padel Club" } });
    const updateMock = vi.fn().mockResolvedValue({ data: {} });
    const contact = buildContact({
      id: 1,
      company_id: null,
      company_name: undefined,
    });

    const screen = await render(
      <StoryWrapper dataProvider={{ create: createMock, update: updateMock }}>
        <RecordContextProvider value={contact}>
          <EditableCompanyCell />
        </RecordContextProvider>
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "Club" }).click();
    await screen.getByPlaceholder("Search...").fill("New Padel Club");
    await screen.getByText("Create New Padel Club").click();

    await expect.poll(() => updateMock).toBeCalledTimes(1);

    expect(createMock).toHaveBeenCalledWith(
      "companies",
      expect.objectContaining({
        data: expect.objectContaining({ name: "New Padel Club" }),
      }),
    );
    expect(updateMock).toHaveBeenCalledWith(
      "contacts",
      expect.objectContaining({
        id: 1,
        data: { company_id: 9 },
      }),
    );
  });
});
