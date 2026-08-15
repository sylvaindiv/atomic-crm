import type { DataProvider } from "ra-core";
import { buildContact } from "@/test/StoryWrapper";
import { mergeContacts } from "./mergeContacts";

const winnerId = 1;
const loserId = 2;

// Loosely typed on purpose: DataProvider's methods are generic in RecordType,
// which a concrete per-test mock can't satisfy structurally. Mirrors the
// `params: any` convention already used for mocks in ContactCreate.test.tsx
// and useContactImport.test.tsx.
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

describe("mergeContacts", () => {
  it("repoints contacts referred by the loser to the winner, before the loser is deleted", async () => {
    // Arrange
    const winner = buildContact({ id: winnerId });
    const loser = buildContact({ id: loserId });
    const referredContact = buildContact({ id: 10, referred_by_id: loserId });
    const updateMany = vi.fn().mockResolvedValue({ data: [] });
    const del = vi.fn((_resource: string, params: any) =>
      Promise.resolve({ data: params.previousData }),
    );
    const dataProvider = buildDataProvider({
      getOne: vi.fn(getOneFor(winner, loser)),
      getManyReference: vi.fn((resource: string, params: any) =>
        resource === "contacts" && params.target === "referred_by_id"
          ? Promise.resolve({ data: [referredContact], total: 1 })
          : Promise.resolve({ data: [], total: 0 }),
      ),
      updateMany,
      delete: del,
    });

    // Act
    await mergeContacts(loserId, winnerId, dataProvider);

    // Assert
    expect(updateMany).toHaveBeenCalledWith("contacts", {
      ids: [10],
      data: { referred_by_id: winnerId },
    });
    expect(del).toHaveBeenCalledWith(
      "contacts",
      expect.objectContaining({ id: loserId }),
    );
    // CORRECTNESS-CRITICAL: the repoint must be requested before the loser
    // delete, otherwise ON DELETE SET NULL would orphan these references.
    expect(updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      del.mock.invocationCallOrder[0],
    );
  });

  it("excludes the winner from the repoint so it never becomes referred by itself", async () => {
    // Arrange: the winner happens to have been referred by the loser too.
    const winner = buildContact({ id: winnerId, referred_by_id: loserId });
    const loser = buildContact({ id: loserId });
    const otherReferredContact = buildContact({
      id: 11,
      referred_by_id: loserId,
    });
    const updateMany = vi.fn().mockResolvedValue({ data: [] });
    const dataProvider = buildDataProvider({
      getOne: vi.fn(getOneFor(winner, loser)),
      getManyReference: vi.fn((resource: string, params: any) =>
        resource === "contacts" && params.target === "referred_by_id"
          ? Promise.resolve({
              data: [winner, otherReferredContact],
              total: 2,
            })
          : Promise.resolve({ data: [], total: 0 }),
      ),
      updateMany,
    });

    // Act
    await mergeContacts(loserId, winnerId, dataProvider);

    // Assert
    expect(updateMany).toHaveBeenCalledWith("contacts", {
      ids: [11],
      data: { referred_by_id: winnerId },
    });
  });

  it("calls updateMany with an empty ids array when no contact was referred by the loser", async () => {
    // Arrange
    const winner = buildContact({ id: winnerId });
    const loser = buildContact({ id: loserId });
    const updateMany = vi.fn().mockResolvedValue({ data: [] });
    const dataProvider = buildDataProvider({
      getOne: vi.fn(getOneFor(winner, loser)),
      updateMany,
    });

    // Act
    await mergeContacts(loserId, winnerId, dataProvider);

    // Assert
    expect(updateMany).toHaveBeenCalledWith("contacts", {
      ids: [],
      data: { referred_by_id: winnerId },
    });
  });

  it("keeps the winner's own referred_by_id when it already has one", async () => {
    // Arrange
    const winner = buildContact({ id: winnerId, referred_by_id: 99 });
    const loser = buildContact({ id: loserId, referred_by_id: 42 });
    const update = vi.fn((_resource: string, params: any) =>
      Promise.resolve({ data: params.data }),
    );
    const dataProvider = buildDataProvider({
      getOne: vi.fn(getOneFor(winner, loser)),
      update,
    });

    // Act
    await mergeContacts(loserId, winnerId, dataProvider);

    // Assert
    expect(update).toHaveBeenCalledWith(
      "contacts",
      expect.objectContaining({
        id: winnerId,
        data: expect.objectContaining({ referred_by_id: 99 }),
      }),
    );
  });

  it("falls back to the loser's referred_by_id when the winner has none", async () => {
    // Arrange
    const winner = buildContact({ id: winnerId, referred_by_id: null });
    const loser = buildContact({ id: loserId, referred_by_id: 42 });
    const update = vi.fn((_resource: string, params: any) =>
      Promise.resolve({ data: params.data }),
    );
    const dataProvider = buildDataProvider({
      getOne: vi.fn(getOneFor(winner, loser)),
      update,
    });

    // Act
    await mergeContacts(loserId, winnerId, dataProvider);

    // Assert
    expect(update).toHaveBeenCalledWith(
      "contacts",
      expect.objectContaining({
        id: winnerId,
        data: expect.objectContaining({ referred_by_id: 42 }),
      }),
    );
  });
});
