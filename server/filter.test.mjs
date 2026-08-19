import { buildWhere } from "./filter.mjs";

// AAA-style tests mirroring server/query.test.mjs.

describe("buildWhere — @isblank operator", () => {
  it("emits a NULL-or-empty clause with no args when value is true", () => {
    // Arrange / Act
    const { sql, args } = buildWhere({ "status@isblank": true });

    // Assert
    expect(sql).toBe('WHERE ("status" IS NULL OR "status" = \'\')');
    expect(args).toEqual([]);
  });

  it("emits no clause when value is false (boolean flag off)", () => {
    // Arrange / Act
    const { sql, args } = buildWhere({ "status@isblank": false });

    // Assert
    expect(sql).toBe("");
    expect(args).toEqual([]);
  });

  it("emits no clause when the key is omitted entirely", () => {
    // Arrange / Act
    const { sql, args } = buildWhere({ status: "active" });

    // Assert
    expect(sql).toBe('WHERE "status" = ?');
    expect(args).toEqual(["active"]);
  });
});
