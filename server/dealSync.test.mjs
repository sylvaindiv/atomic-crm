import { afterUpdate } from "./dealSync.mjs";

/** Fake libSQL client: replays `responses` in order, records every call. */
function makeDb(responses = []) {
  const calls = [];
  const queue = [...responses];
  return {
    calls,
    execute: vi.fn(async (query) => {
      calls.push(query);
      return queue.shift() ?? { columns: [], rows: [] };
    }),
  };
}

const noDealFound = { columns: ["id"], rows: [] };

describe("dealSync.afterUpdate", () => {
  describe("Direction A: contact/company status -> deal stage", () => {
    it("moves the most recent non-archived judge deal to the new status", async () => {
      // Arrange
      const db = makeDb([{ columns: ["id"], rows: [[42]] }]);
      const updatedContact = {
        id: 5,
        first_name: "Jane",
        last_name: "Doe",
        sales_id: 3,
        status: "contacted",
      };

      // Act
      await afterUpdate(
        db,
        "contacts",
        { status: "contacted" },
        updatedContact,
      );

      // Assert
      expect(db.calls).toHaveLength(2);
      expect(db.calls[0].sql).toContain("'judge'");
      expect(db.calls[0].sql).toContain('archived_at" IS NULL');
      expect(db.calls[0].args).toEqual([5]);
      expect(db.calls[1].sql).toContain('UPDATE "deals" SET "stage" = ?');
      expect(db.calls[1].args).toEqual(["contacted", 42]);
    });

    it("creates a judge deal when none exists yet", async () => {
      // Arrange
      const db = makeDb([noDealFound]);
      const updatedContact = {
        id: 5,
        first_name: "Jane",
        last_name: "Doe",
        sales_id: 3,
        status: "contacted",
      };

      // Act
      await afterUpdate(
        db,
        "contacts",
        { status: "contacted" },
        updatedContact,
      );

      // Assert
      expect(db.calls).toHaveLength(2);
      expect(db.calls[1].sql).toContain('INSERT INTO "deals"');
      expect(db.calls[1].args).toEqual([
        "Jane Doe",
        "judge",
        "contacted",
        3,
        JSON.stringify([5]),
        null,
      ]);
    });

    it("moves the most recent non-archived club deal to the new status", async () => {
      // Arrange
      const db = makeDb([{ columns: ["id"], rows: [[99]] }]);
      const updatedCompany = {
        id: 8,
        name: "Padel Club",
        sales_id: 2,
        status: "prospect",
      };

      // Act
      await afterUpdate(
        db,
        "companies",
        { status: "prospect" },
        updatedCompany,
      );

      // Assert
      expect(db.calls).toHaveLength(2);
      expect(db.calls[0].sql).toContain("'club'");
      expect(db.calls[0].sql).toContain('"company_id" = ?');
      expect(db.calls[0].args).toEqual([8]);
      expect(db.calls[1].sql).toContain('UPDATE "deals" SET "stage" = ?');
      expect(db.calls[1].args).toEqual(["prospect", 99]);
    });

    it("creates a club deal when none exists yet", async () => {
      // Arrange
      const db = makeDb([noDealFound]);
      const updatedCompany = {
        id: 8,
        name: "Padel Club",
        sales_id: 2,
        status: "prospect",
      };

      // Act
      await afterUpdate(
        db,
        "companies",
        { status: "prospect" },
        updatedCompany,
      );

      // Assert
      expect(db.calls).toHaveLength(2);
      expect(db.calls[1].sql).toContain('INSERT INTO "deals"');
      expect(db.calls[1].args).toEqual([
        "Padel Club",
        "club",
        "prospect",
        2,
        "[]",
        8,
      ]);
    });
  });

  describe("Direction B: deal stage -> contact/company status", () => {
    it("writes the new stage as status on the linked contact for a judge deal", async () => {
      // Arrange
      const db = makeDb();
      const updatedDeal = {
        id: 10,
        case_type: "judge",
        contact_ids: [7],
        company_id: null,
      };

      // Act
      await afterUpdate(db, "deals", { stage: "won" }, updatedDeal);

      // Assert
      expect(db.calls).toHaveLength(1);
      expect(db.calls[0].sql).toContain('UPDATE "contacts" SET "status" = ?');
      expect(db.calls[0].args).toEqual(["won", 7]);
    });

    it("writes the new stage as status on the linked company for a club deal", async () => {
      // Arrange
      const db = makeDb();
      const updatedDeal = {
        id: 11,
        case_type: "club",
        contact_ids: [],
        company_id: 20,
      };

      // Act
      await afterUpdate(db, "deals", { stage: "won" }, updatedDeal);

      // Assert
      expect(db.calls).toHaveLength(1);
      expect(db.calls[0].sql).toContain('UPDATE "companies" SET "status" = ?');
      expect(db.calls[0].args).toEqual(["won", 20]);
    });

    it("does not crash when a judge deal has no linked contact", async () => {
      // Arrange
      const db = makeDb();
      const updatedDeal = {
        id: 12,
        case_type: "judge",
        contact_ids: [],
        company_id: null,
      };

      // Act
      await afterUpdate(db, "deals", { stage: "won" }, updatedDeal);

      // Assert
      expect(db.calls).toHaveLength(0);
    });

    it("does not crash when a club deal has no linked company", async () => {
      // Arrange
      const db = makeDb();
      const updatedDeal = {
        id: 13,
        case_type: "club",
        contact_ids: [],
        company_id: null,
      };

      // Act
      await afterUpdate(db, "deals", { stage: "won" }, updatedDeal);

      // Assert
      expect(db.calls).toHaveLength(0);
    });
  });

  describe("no-op cases", () => {
    it("leaves the deal untouched when data has no status field", async () => {
      // Arrange
      const db = makeDb();
      const updatedContact = { id: 5, first_name: "Jane", status: "old" };

      // Act
      await afterUpdate(db, "contacts", { first_name: "Jane" }, updatedContact);

      // Assert
      expect(db.calls).toHaveLength(0);
    });

    it("leaves the contact/company untouched when data has no stage field", async () => {
      // Arrange
      const db = makeDb();
      const updatedDeal = {
        id: 10,
        case_type: "judge",
        contact_ids: [7],
        stage: "won",
      };

      // Act
      await afterUpdate(db, "deals", { amount: 500 }, updatedDeal);

      // Assert
      expect(db.calls).toHaveLength(0);
    });

    it("is a no-op for tables other than contacts/companies/deals", async () => {
      // Arrange
      const db = makeDb();

      // Act
      await afterUpdate(db, "tasks", { status: "done" }, { id: 1 });

      // Assert
      expect(db.calls).toHaveLength(0);
    });
  });

  it("logs and swallows a sync error instead of failing the original update", async () => {
    // Arrange
    const db = {
      execute: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Act / Assert
    await expect(
      afterUpdate(
        db,
        "contacts",
        { status: "contacted" },
        { id: 5, first_name: "Jane", last_name: "Doe" },
      ),
    ).resolves.toBeUndefined();
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
