import type { Sale } from "../../types";
import { getAuthProvider } from "./authProvider";
import { baseDataProvider } from "./internal/httpClient";

vi.mock("./internal/httpClient", () => ({
  baseDataProvider: {
    getList: vi.fn(),
    create: vi.fn(),
  },
}));

const mockGetList = vi.mocked(baseDataProvider.getList);
const mockCreate = vi.mocked(baseDataProvider.create);

/** Minimal valid `sales` row, overridable per test. */
function buildSale(overrides: Partial<Sale> = {}): Sale {
  return {
    id: 1,
    first_name: "Admin",
    last_name: "",
    email: "admin@atomic-crm.invalid",
    administrator: true,
    disabled: false,
    user_id: "user-1",
    ...overrides,
  };
}

describe("getIdentity", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the existing sales row as-is, without creating one", async () => {
    const sale = buildSale({ id: 7, first_name: "Jane", last_name: "Doe" });
    mockGetList.mockResolvedValue({ data: [sale], total: 1 });

    const identity = await getAuthProvider().getIdentity!();

    expect(identity).toEqual({
      id: 7,
      fullName: "Jane Doe",
      avatar: undefined,
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("creates a default sales row with the placeholder email when the table is empty", async () => {
    const created = buildSale({ id: 1 });
    mockGetList.mockResolvedValue({ data: [], total: 0 });
    mockCreate.mockResolvedValue({ data: created });

    const identity = await getAuthProvider().getIdentity!();

    expect(mockCreate).toHaveBeenCalledWith(
      "sales",
      expect.objectContaining({
        data: expect.objectContaining({
          email: "admin@atomic-crm.invalid",
        }),
      }),
    );
    expect(identity.id).toBe(1);
    expect(identity.fullName).toBe("Admin");
  });

  it("refetches and returns the winning row when create rejects on a concurrent unique-email conflict", async () => {
    const winner = buildSale({ id: 2, user_id: "winner" });
    mockGetList
      .mockResolvedValueOnce({ data: [], total: 0 })
      .mockResolvedValueOnce({ data: [winner], total: 1 });
    mockCreate.mockRejectedValue(
      new Error("UNIQUE constraint failed: sales.email"),
    );

    const identity = await getAuthProvider().getIdentity!();

    expect(identity.id).toBe(2);
    expect(mockGetList).toHaveBeenCalledTimes(2);
  });
});
