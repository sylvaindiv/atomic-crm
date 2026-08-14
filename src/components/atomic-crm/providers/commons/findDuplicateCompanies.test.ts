import type { DataProvider } from "ra-core";
import type { Company } from "../../types";
import { findDuplicateCompanies } from "./findDuplicateCompanies";

/** Builds a minimal, valid Company record; overridable per test. */
const buildCompany = (overrides: Partial<Company> = {}): Company => ({
  id: 1,
  name: "Acme",
  logo: {} as Company["logo"],
  sector: "",
  size: 1,
  linkedin_url: "",
  website: "",
  phone_number: "",
  address: "",
  zipcode: "",
  city: "",
  state_abbr: "",
  created_at: "2025-01-01T09:00:00.000Z",
  description: "",
  revenue: "",
  tax_identifier: "",
  country: "",
  ...overrides,
});

/** DataProvider mock exposing only the getList call the helper makes. */
const buildDataProvider = (companies: unknown[]): DataProvider =>
  ({
    getList: vi
      .fn()
      .mockResolvedValue({ data: companies, total: companies.length }),
  }) as unknown as DataProvider;

describe("findDuplicateCompanies", () => {
  it("finds a club whose name only differs by case and accents", async () => {
    // Arrange
    const target = buildCompany({ id: 1, name: "Padel Club Réunion" });
    const accentVariant = buildCompany({ id: 2, name: "PADEL CLUB REUNION" });
    const dataProvider = buildDataProvider([target, accentVariant]);

    // Act
    const candidates = await findDuplicateCompanies(target, dataProvider);

    // Assert
    expect(candidates.map((c) => c.id)).toEqual([2]);
  });

  it("never returns the company itself", async () => {
    // Arrange
    const target = buildCompany({ id: 1, name: "Padel Club Paris" });
    const dataProvider = buildDataProvider([target]);

    // Act
    const candidates = await findDuplicateCompanies(target, dataProvider);

    // Assert
    expect(candidates).toHaveLength(0);
  });

  it("returns nothing for two unrelated club names", async () => {
    // Arrange
    const target = buildCompany({ id: 1, name: "Padel Club Paris" });
    const other = buildCompany({ id: 2, name: "Tennis Club Lyon" });
    const dataProvider = buildDataProvider([target, other]);

    // Act
    const candidates = await findDuplicateCompanies(target, dataProvider);

    // Assert
    expect(candidates).toHaveLength(0);
  });

  it("returns nothing when the target name is blank", async () => {
    // Arrange
    const target = buildCompany({ id: 1, name: "" });
    const other = buildCompany({ id: 2, name: "" });
    const dataProvider = buildDataProvider([target, other]);

    // Act
    const candidates = await findDuplicateCompanies(target, dataProvider);

    // Assert
    expect(candidates).toHaveLength(0);
  });
});
