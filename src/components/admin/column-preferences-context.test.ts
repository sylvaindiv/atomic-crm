import { describe, expect, it } from "vitest";
import { orderedColumnIds } from "./column-preferences-context";

describe("orderedColumnIds", () => {
  it("drops removed columns and appends new ones", () => {
    expect(
      orderedColumnIds(["name", "city", "email"], ["city", "removed", "name"]),
    ).toEqual(["city", "name", "email"]);
  });
});
