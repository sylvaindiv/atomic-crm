import type { DataProvider } from "ra-core";
import type { Company } from "../../types";
import { mergeCompanies } from "./mergeCompanies";

const winnerId = 1;
const loserId = 2;

// Loosely typed on purpose: DataProvider's methods are generic in RecordType,
// which a concrete per-test mock can't satisfy structurally. Mirrors the
// `params: any` convention already used in mergeContacts.test.ts.
type MockDataProvider = {
  getOne: (resource: string, params: any) => Promise<{ data: any }>;
  getManyReference: (
    resource: string,
    params: any,
  ) => Promise<{ data: any[]; total: number }>;
  update: (resource: string, params: any) => Promise<{ data: any }>;
  updateMany: (resource: string, params: any) => Promise<{ data: any[] }>;
  delete: (resource: string, params: any) => Promise<{ data: any }>;
};

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

/** getOne mock that resolves the winner or loser record by id. */
const getOneFor =
  (winner: { id: unknown }, loser: { id: unknown }) =>
  (_resource: string, { id }: any) => {
    if (id === winner.id) return Promise.resolve({ data: winner });
    if (id === loser.id) return Promise.resolve({ data: loser });
    throw new Error(`Unexpected getOne id: ${id}`);
  };

/** Builds a mock DataProvider with safe no-op defaults, overridable per test. */
const buildDataProvider = (
  overrides: Partial<MockDataProvider> = {},
): DataProvider => {
  const dataProvider: MockDataProvider = {
    getOne: vi.fn(),
    getManyReference: vi.fn().mockResolvedValue({ data: [], total: 0 }),
    update: vi.fn((_resource: string, params: any) =>
      Promise.resolve({ data: params.data }),
    ),
    updateMany: vi.fn().mockResolvedValue({ data: [] }),
    delete: vi.fn((_resource: string, params: any) =>
      Promise.resolve({ data: params.previousData }),
    ),
    ...overrides,
  };
  return dataProvider as unknown as DataProvider;
};

describe("mergeCompanies", () => {
  it("reassigns every contact whose company_id is the loser to the winner", async () => {
    // Arrange
    const winner = buildCompany({ id: winnerId });
    const loser = buildCompany({ id: loserId });
    const updateMany = vi.fn().mockResolvedValue({ data: [] });
    const dataProvider = buildDataProvider({
      getOne: vi.fn(getOneFor(winner, loser)),
      getManyReference: vi.fn((resource: string, params: any) =>
        resource === "contacts" && params.target === "company_id"
          ? Promise.resolve({
              data: [{ id: 10 }, { id: 11 }],
              total: 2,
            })
          : Promise.resolve({ data: [], total: 0 }),
      ),
      updateMany,
    });

    // Act
    await mergeCompanies(loserId, winnerId, dataProvider);

    // Assert
    expect(updateMany).toHaveBeenCalledWith("contacts", {
      ids: [10, 11],
      data: { company_id: winnerId },
    });
  });

  it("fills fields empty on the winner from the loser", async () => {
    // Arrange
    const winner = buildCompany({
      id: winnerId,
      sector: "",
      website: "",
      status: undefined,
    });
    const loser = buildCompany({
      id: loserId,
      sector: "Sports",
      website: "https://loser.example.com",
      status: "hot",
    });
    const update = vi.fn((_resource: string, params: any) =>
      Promise.resolve({ data: params.data }),
    );
    const dataProvider = buildDataProvider({
      getOne: vi.fn(getOneFor(winner, loser)),
      update,
    });

    // Act
    await mergeCompanies(loserId, winnerId, dataProvider);

    // Assert
    expect(update).toHaveBeenCalledWith(
      "companies",
      expect.objectContaining({
        id: winnerId,
        data: expect.objectContaining({
          sector: "Sports",
          website: "https://loser.example.com",
          status: "hot",
        }),
      }),
    );
  });

  it("never overwrites fields already set on the winner", async () => {
    // Arrange
    const winner = buildCompany({
      id: winnerId,
      sector: "Winner sector",
      website: "https://winner.example.com",
      status: "won",
    });
    const loser = buildCompany({
      id: loserId,
      sector: "Loser sector",
      website: "https://loser.example.com",
      status: "hot",
    });
    const update = vi.fn((_resource: string, params: any) =>
      Promise.resolve({ data: params.data }),
    );
    const dataProvider = buildDataProvider({
      getOne: vi.fn(getOneFor(winner, loser)),
      update,
    });

    // Act
    await mergeCompanies(loserId, winnerId, dataProvider);

    // Assert
    expect(update).toHaveBeenCalledWith(
      "companies",
      expect.objectContaining({
        id: winnerId,
        data: expect.objectContaining({
          sector: "Winner sector",
          website: "https://winner.example.com",
        }),
      }),
    );
  });

  it("does not include status in the winner update when the winner already has a status", async () => {
    // Arrange: `status` is only ever filled in from the loser, never
    // overwritten -- the key must be entirely absent once the winner
    // already has one.
    const winner = buildCompany({ id: winnerId, status: "won" });
    const loser = buildCompany({ id: loserId, status: "hot" });
    const update = vi.fn((_resource: string, params: any) =>
      Promise.resolve({ data: params.data }),
    );
    const dataProvider = buildDataProvider({
      getOne: vi.fn(getOneFor(winner, loser)),
      update,
    });

    // Act
    await mergeCompanies(loserId, winnerId, dataProvider);

    // Assert
    const [, { data }] = update.mock.calls[0];
    expect(data).not.toHaveProperty("status");
  });

  it("runs the winner update only after the contact reassignment resolves", async () => {
    // Arrange
    const winner = buildCompany({ id: winnerId });
    const loser = buildCompany({ id: loserId });
    const updateMany = vi.fn().mockResolvedValue({ data: [] });
    const update = vi.fn((_resource: string, params: any) =>
      Promise.resolve({ data: params.data }),
    );
    const dataProvider = buildDataProvider({
      getOne: vi.fn(getOneFor(winner, loser)),
      getManyReference: vi.fn().mockResolvedValue({
        data: [{ id: 10 }],
        total: 1,
      }),
      updateMany,
      update,
    });

    // Act
    await mergeCompanies(loserId, winnerId, dataProvider);

    // Assert: the contacts updateMany call resolves before the winner
    // `companies` update starts.
    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(update.mock.invocationCallOrder[0]).toBeGreaterThan(
      updateMany.mock.invocationCallOrder[0],
    );
  });

  it("deletes the loser company only after all reassignments succeed", async () => {
    // Arrange
    const winner = buildCompany({ id: winnerId });
    const loser = buildCompany({ id: loserId });
    const updateMany = vi.fn().mockResolvedValue({ data: [] });
    const update = vi.fn((_resource: string, params: any) =>
      Promise.resolve({ data: params.data }),
    );
    const del = vi.fn((_resource: string, params: any) =>
      Promise.resolve({ data: params.previousData }),
    );
    const dataProvider = buildDataProvider({
      getOne: vi.fn(getOneFor(winner, loser)),
      getManyReference: vi.fn().mockResolvedValue({
        data: [{ id: 10 }],
        total: 1,
      }),
      updateMany,
      update,
      delete: del,
    });

    // Act
    await mergeCompanies(loserId, winnerId, dataProvider);

    // Assert
    expect(del).toHaveBeenCalledWith(
      "companies",
      expect.objectContaining({ id: loserId }),
    );
    expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      del.mock.invocationCallOrder[0],
    );
    expect(update.mock.invocationCallOrder[0]).toBeLessThan(
      del.mock.invocationCallOrder[0],
    );
  });
});
