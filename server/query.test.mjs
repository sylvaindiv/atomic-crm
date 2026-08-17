import { RESOURCES } from "./resources.mjs";
import { create, update } from "./query.mjs";

// `vi.mock` factories are hoisted above the rest of the file, so the mocks
// they reference must be created via `vi.hoisted` (see
// https://vitest.dev/api/vi.html#vi-hoisted) — matches the pattern used in
// providers/turso/authProvider.test.ts.
const mockExecute = vi.hoisted(() => vi.fn());
const tableColumnsFixture = vi.hoisted(() => ({}));
const requiredColumnsFixture = vi.hoisted(() => ({}));

vi.mock("./db.mjs", () => ({
  db: { execute: mockExecute },
  tableColumns: tableColumnsFixture,
  requiredColumns: requiredColumnsFixture,
}));

const cfg = RESOURCES.contact_notes;

describe("query.mjs required-column validation", () => {
  beforeEach(() => {
    mockExecute.mockReset();
    // Mirrors contact_notes: contact_id is NOT NULL with no DEFAULT, every
    // other column is nullable or defaulted (see db/schema.sql).
    tableColumnsFixture[cfg.table] = [
      "id",
      "contact_id",
      "text",
      "date",
      "sales_id",
      "status",
      "attachments",
    ];
    requiredColumnsFixture[cfg.table] = ["contact_id"];
  });

  describe("create()", () => {
    it("throws before inserting when a required column is missing", async () => {
      // Arrange / Act / Assert
      await expect(create(cfg, { data: { text: "hello" } })).rejects.toThrow(
        "contact_id is required",
      );
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("throws before inserting when a required column is explicitly null", async () => {
      // Arrange / Act / Assert
      await expect(
        create(cfg, { data: { contact_id: null, text: "hello" } }),
      ).rejects.toThrow("contact_id is required");
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("inserts when the required column is present", async () => {
      // Arrange
      mockExecute.mockResolvedValue({
        columns: ["id", "contact_id"],
        rows: [[1, 5]],
      });

      // Act
      const { data } = await create(cfg, {
        data: { contact_id: 5, text: "hello" },
      });

      // Assert
      expect(data).toEqual({ id: 1, contact_id: 5 });
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });

    it("accepts a nullable/defaulted column omitted from the payload", async () => {
      // Arrange
      mockExecute.mockResolvedValue({
        columns: ["id", "contact_id"],
        rows: [[1, 5]],
      });

      // Act / Assert: `text`, `date`, `status`, `attachments` are all
      // omitted here and none of them are required.
      await expect(
        create(cfg, { data: { contact_id: 5 } }),
      ).resolves.toBeDefined();
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });

  describe("update()", () => {
    it("rejects a required column explicitly cleared to null", async () => {
      // Arrange / Act / Assert
      await expect(
        update(cfg, { id: 1, data: { contact_id: null } }),
      ).rejects.toThrow("contact_id is required");
      expect(mockExecute).not.toHaveBeenCalled();
    });

    it("allows a partial update that simply omits the required column", async () => {
      // Arrange
      mockExecute.mockResolvedValue({
        columns: ["id", "contact_id", "text"],
        rows: [[1, 5, "updated"]],
      });

      // Act
      const { data } = await update(cfg, {
        id: 1,
        data: { text: "updated" },
      });

      // Assert
      expect(data).toEqual({ id: 1, contact_id: 5, text: "updated" });
      expect(mockExecute).toHaveBeenCalledTimes(1);
    });
  });
});
