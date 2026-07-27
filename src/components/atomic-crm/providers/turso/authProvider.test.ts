import type { Sale } from "../../types";
import { getAuthProvider } from "./authProvider";

// Names must start with `mock` so Vitest's hoisting can wire them into the
// `vi.mock` factory below, which otherwise runs before any of this file's
// own declarations (see https://vitest.dev/api/vi.html#vi-mock).
const mockGetList = vi.fn();
const mockCreate = vi.fn();

vi.mock("./internal/httpClient", () => ({
  baseDataProvider: {
    getList: mockGetList,
    create: mockCreate,
  },
}));

/** Builds a valid `sales` row fixture, overridable per test. */
function buildSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 1,
    first_name: "Admin",
    last_name: "User",
    email: "admin@local",
    administrator: true,
    disabled: false,
    user_id: "user-id-1",
    ...overrides,
  };
}

/** `getIdentity` is optional on `AuthProvider`; this implementation always provides it. */
async function resolveIdentity() {
  const identity = await getAuthProvider().getIdentity?.();
  if (!identity) throw new Error("getIdentity() did not resolve");
  return identity;
}

describe("turso authProvider getIdentity", () => {
  beforeEach(() => {
    mockGetList.mockReset();
    mockCreate.mockReset();
  });

  it("returns the first sales row, sorted by id ascending, without creating one", async () => {
    // Arrange
    const sale = buildSale({
      id: 7,
      first_name: "Jane",
      last_name: "Doe",
      avatar: { src: "https://example.com/jane.png" } as Sale["avatar"],
    });
    mockGetList.mockResolvedValue({ data: [sale], total: 1 });

    // Act
    const identity = await resolveIdentity();

    // Assert
    expect(identity).toEqual({
      id: 7,
      fullName: "Jane Doe",
      avatar: "https://example.com/jane.png",
    });
    expect(mockGetList).toHaveBeenCalledWith("sales", {
      filter: {},
      pagination: { page: 1, perPage: 1 },
      sort: { field: "id", order: "ASC" },
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("self-provisions a default sales row when the table is empty", async () => {
    // Arrange
    mockGetList.mockResolvedValue({ data: [], total: 0 });
    mockCreate.mockResolvedValue({ data: buildSale({ id: 1 }) });

    // Act
    const identity = await resolveIdentity();

    // Assert
    expect(mockCreate).toHaveBeenCalledWith("sales", {
      data: expect.objectContaining({
        first_name: "Admin",
        last_name: "User",
        email: "admin@local",
        administrator: true,
        disabled: false,
        user_id: expect.any(String),
      }),
    });
    expect(identity).toEqual({
      id: 1,
      fullName: "Admin User",
      avatar: undefined,
    });
  });

  it("re-fetches and returns the existing row instead of throwing when a concurrent caller already created it", async () => {
    // Arrange: the table looked empty, but by the time our insert runs, a
    // concurrent caller (another tab / request) has already created the
    // default row, so the UNIQUE constraint on sales.email rejects ours.
    const raceWinner = buildSale({
      id: 2,
      first_name: "Race",
      last_name: "Winner",
    });
    mockGetList
      .mockResolvedValueOnce({ data: [], total: 0 })
      .mockResolvedValueOnce({ data: [raceWinner], total: 1 });
    mockCreate.mockRejectedValue(
      new Error("SQLITE_CONSTRAINT: UNIQUE constraint failed: sales.email"),
    );

    // Act
    const identity = await resolveIdentity();

    // Assert
    expect(identity).toEqual({
      id: 2,
      fullName: "Race Winner",
      avatar: undefined,
    });
    expect(mockGetList).toHaveBeenCalledTimes(2);
  });
});
