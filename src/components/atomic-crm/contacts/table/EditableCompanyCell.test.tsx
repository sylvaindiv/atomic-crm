import { page } from "vitest/browser";
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
      <StoryWrapper
        data={{ contacts: [contact] }}
        dataProvider={{
          create: createMock,
          update: updateMock,
          getMany: vi
            .fn()
            .mockResolvedValue({ data: [{ id: 9, name: "New Padel Club" }] }),
        }}
      >
        <RecordContextProvider value={contact}>
          <EditableCompanyCell />
        </RecordContextProvider>
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "Modifier les clubs" }).click();
    await page
      .getByPlaceholder("Search", { exact: true })
      .fill("New Padel Club");
    await page.getByText("Create New Padel Club").click();

    await page.getByRole("button", { name: "Enregistrer" }).click();

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
        data: expect.objectContaining({ company_ids: [9] }),
      }),
    );
  });
});
