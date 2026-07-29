import { RecordContextProvider } from "ra-core";
import { render } from "vitest-browser-react";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import type { Company, Contact } from "../../types";
import { EditableReferenceCell } from "./EditableReferenceCell";

/** Builds a minimal `companies` row fixture — only `id`/`name` matter here. */
function buildCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 1,
    name: "Company",
    created_at: "2025-01-01T00:00:00.000Z",
    ...overrides,
  } as Company;
}

const TestCompanyCell = ({ contact }: { contact: Contact }) => (
  <RecordContextProvider value={contact}>
    <EditableReferenceCell<Company>
      source="company_id"
      reference="companies"
      label="Club"
      displayValue={contact.company_name}
      optionText={(company) => company.name}
      sort={{ field: "name", order: "ASC" }}
      nullable
    />
  </RecordContextProvider>
);

describe("EditableReferenceCell", () => {
  it("commits the selected option's id to the contact record", async () => {
    const updateMock = vi.fn().mockResolvedValue({ data: {} });
    const contact = buildContact({
      id: 1,
      company_id: null,
      company_name: undefined,
    });

    const screen = await render(
      <StoryWrapper
        data={{ companies: [buildCompany({ id: 2, name: "Padel Club A" })] }}
        dataProvider={{ update: updateMock }}
      >
        <TestCompanyCell contact={contact} />
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "Club" }).click();
    await screen.getByText("Padel Club A").click();

    expect(updateMock).toHaveBeenCalledWith(
      "contacts",
      expect.objectContaining({
        id: 1,
        data: { company_id: 2 },
        previousData: expect.objectContaining({ id: 1, company_id: null }),
      }),
    );
  });

  it("clears the value back to null when the clear option is selected", async () => {
    const updateMock = vi.fn().mockResolvedValue({ data: {} });
    const contact = buildContact({
      id: 1,
      company_id: 2,
      company_name: "Padel Club A",
    });

    const screen = await render(
      <StoryWrapper
        data={{ companies: [buildCompany({ id: 2, name: "Padel Club A" })] }}
        dataProvider={{ update: updateMock }}
      >
        <TestCompanyCell contact={contact} />
      </StoryWrapper>,
    );

    await screen
      .getByRole("button", { name: "Club: Padel Club A" })
      .click();
    // The leading clear option is the only "—" on screen once the popover
    // is open (the trigger itself reads "Padel Club A", not "—").
    await screen.getByText("—").click();

    expect(updateMock).toHaveBeenCalledWith(
      "contacts",
      expect.objectContaining({
        id: 1,
        data: { company_id: null },
      }),
    );
  });
});
