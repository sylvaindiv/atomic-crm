import { RecordContextProvider } from "ra-core";
import { render } from "vitest-browser-react";
import { StoryWrapper } from "@/test/StoryWrapper";
import type { Company } from "../types";
import { CompanyStatusSelector } from "./CompanyInputs";

/** Builds a minimal `companies` row fixture -- only `id`/`status` matter here. */
function buildCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 1,
    name: "Padel Club A",
    created_at: "2025-01-01T00:00:00.000Z",
    ...overrides,
  } as Company;
}

describe("CompanyStatusSelector", () => {
  it("commits the newly selected status via a normal companies update", async () => {
    const updateMock = vi.fn().mockResolvedValue({ data: {} });
    const company = buildCompany({ id: 1, status: "a_recontacter" });

    const screen = await render(
      <StoryWrapper dataProvider={{ update: updateMock }}>
        <RecordContextProvider value={company}>
          <CompanyStatusSelector />
        </RecordContextProvider>
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("combobox"))
      .toHaveTextContent("A recontacter");

    await screen.getByRole("combobox").click();
    await screen.getByRole("listbox").getByText("Visio").click();

    expect(updateMock).toHaveBeenCalledWith(
      "companies",
      expect.objectContaining({
        id: 1,
        data: { status: "visio" },
        previousData: expect.objectContaining({ id: 1 }),
      }),
    );
  });

  it("renders nothing when there is no record (create form)", async () => {
    const screen = await render(
      <StoryWrapper>
        <CompanyStatusSelector />
      </StoryWrapper>,
    );

    await expect.element(screen.getByRole("combobox")).not.toBeInTheDocument();
  });
});
