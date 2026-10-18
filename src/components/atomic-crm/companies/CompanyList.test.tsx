import { ResourceContextProvider } from "ra-core";
import { render } from "vitest-browser-react";

import { StoryWrapper } from "@/test/StoryWrapper";
import type { Company } from "../types";
import { CompanyList } from "./CompanyList";

const buildCompany = (overrides: Partial<Company>): Company => ({
  address: "1 Main Street",
  city: "Paris",
  country: "France",
  created_at: "2025-01-01T00:00:00.000Z",
  description: "",
  id: 1,
  linkedin_url: "",
  logo: { rawFile: new File([], "logo.png"), src: "", title: "" },
  name: "Club",
  phone_number: "",
  revenue: "",
  sector: "",
  size: 1,
  state_abbr: "",
  tax_identifier: "",
  website: "",
  zipcode: "75001",
  ...overrides,
});

describe("CompanyList", () => {
  it("filters clubs assigned to the current user without clearing search", async () => {
    const screen = await render(
      <StoryWrapper
        data={{
          companies: [
            buildCompany({ id: 1, name: "Mine Club", sales_id: 0 }),
            buildCompany({ id: 2, name: "Other Club", sales_id: undefined }),
          ],
        }}
      >
        <ResourceContextProvider value="companies">
          <CompanyList />
        </ResourceContextProvider>
      </StoryWrapper>,
    );

    await expect
      .element(screen.getByRole("button", { name: "Export" }))
      .not.toBeInTheDocument();

    await screen.getByPlaceholder("Search").fill("Other");
    await expect.element(screen.getByText("Other Club")).toBeVisible();

    const assignedToMe = screen.getByRole("switch", {
      name: "Assigned to me",
    });
    await assignedToMe.click();
    await expect.element(assignedToMe).toBeChecked();
    await expect
      .element(screen.getByText("Other Club"))
      .not.toBeInTheDocument();
    await expect.element(assignedToMe).toBeVisible();

    await assignedToMe.click();
    await expect.element(assignedToMe).not.toBeChecked();
    await expect.element(screen.getByText("Other Club")).toBeVisible();
  });
});
