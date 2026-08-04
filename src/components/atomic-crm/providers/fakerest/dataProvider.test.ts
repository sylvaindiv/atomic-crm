import { createCrmDb } from "@/test/StoryWrapper";
import type { Company } from "../../types";
import { createDataProvider } from "./dataProvider";

/** Builds a minimal `companies` row fixture with an existing logo. */
function buildCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 1,
    name: "Padel Club A",
    logo: { src: "data:image/png;base64,existing-logo" },
    created_at: "2025-01-01T00:00:00.000Z",
    ...overrides,
  } as Company;
}

describe("companies dataProvider beforeUpdate", () => {
  it("preserves the existing logo on a partial update that omits it", async () => {
    // Arrange
    const company = buildCompany();
    const dataProvider = createDataProvider({
      db: createCrmDb({ companies: [company] }),
      latency: 0,
      silent: true,
    });

    // Act
    const { data: updated } = await dataProvider.update("companies", {
      id: 1,
      data: { status: "client" },
      previousData: company,
    });

    // Assert
    expect(updated.logo).toEqual(company.logo);
    expect(updated.status).toBe("client");
  });

  it("still processes the logo when the update carries one", async () => {
    // Arrange
    const company = buildCompany();
    const dataProvider = createDataProvider({
      db: createCrmDb({ companies: [company] }),
      latency: 0,
      silent: true,
    });
    const newLogo = { src: "data:image/png;base64,new-logo", title: "logo" };

    // Act
    const { data: updated } = await dataProvider.update("companies", {
      id: 1,
      data: { logo: newLogo },
      previousData: company,
    });

    // Assert
    expect(updated.logo).toEqual(newLogo);
  });
});
