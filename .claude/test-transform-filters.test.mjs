import { describe, it, expect } from "vitest";
import { transformFilter } from "./src/components/atomic-crm/providers/fakerest/internal/transformFilter";
import { buildWhere } from "./server/filter.mjs";

describe("transformFilter", () => {
  it("should handle nested filter objects with $ne", () => {
    const test = transformFilter({
      company_id: 1,
      id: { $ne: 2 },
    });

    expect(test).toEqual({ company_id: 1, id_neq: 2 });
  });

  it("should handle nested filter objects with $in", () => {
    const test = transformFilter({
      contact_id: { $in: [1, 2, 3] },
    });

    expect(test).toEqual({ contact_id_eq_any: [1, 2, 3] });
  });

  it("should handle both $ne and $in operators", () => {
    const test = transformFilter({
      company_id: 1,
      id: { $ne: 2 },
      contact_id: { $in: [1, 2, 3] },
    });

    expect(test).toEqual({
      company_id: 1,
      id_neq: 2,
      contact_id_eq_any: [1, 2, 3],
    });
  });

  it("should handle empty filter", () => {
    const test = transformFilter({});

    expect(test).toEqual({});
  });

  it("should handle null and undefined values", () => {
    const test = transformFilter({
      company_id: null,
      id: { $ne: null },
      contact_id: { $in: undefined },
    });

    expect(test).toEqual({
      company_id: null,
      id_neq: null,
    });
  });
});

describe("buildWhere", () => {
  it("should build WHERE clause for $ne operator", () => {
    const result = buildWhere({ id: { $ne: 2 } });
    expect(result.sql).toContain('"id" != ?');
    expect(result.args).toEqual([2]);
  });

  it("should build WHERE clause for $in operator", () => {
    const result = buildWhere({ contact_id: { $in: [1, 2, 3] } });
    expect(result.sql).toContain('"contact_id" IN');
    expect(result.sql).toContain("(?,?,?)");
    expect(result.args).toEqual([1, 2, 3]);
  });

  it("should build WHERE clause for both $ne and $in operators", () => {
    const result = buildWhere({
      company_id: 1,
      id: { $ne: 2 },
      contact_id: { $in: [1, 2, 3] },
    });

    expect(result.sql).toContain('"company_id" = ?');
    expect(result.sql).toContain('"id" != ?');
    expect(result.sql).toContain('"contact_id" IN');
    expect(result.sql).toContain("(?,?,?)");
    expect(result.args).toEqual([1, 2, 1, 2, 3]);
  });
});
