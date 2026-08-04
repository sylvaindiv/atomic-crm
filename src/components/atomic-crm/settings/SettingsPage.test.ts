import { describe, it, expect } from "vitest";
import type { RaRecord } from "ra-core";
import { transformFormValues, validateItemsInUse } from "./SettingsPage";

describe("validateItemsInUse", () => {
  const deals: RaRecord[] = [
    { id: 1, category: "ui-design" },
    { id: 2, category: "copywriting" },
    { id: 3, category: "ui-design" },
  ];

  it("returns undefined when items is undefined", () => {
    expect(
      validateItemsInUse(undefined, deals, "category", "categories"),
    ).toBe(undefined);
  });

  it("returns undefined when all in-use values are present", () => {
    const items = [
      { value: "ui-design", label: "UI Design" },
      { value: "copywriting", label: "Copywriting" },
    ];
    expect(
      validateItemsInUse(items, deals, "category", "categories"),
    ).toBe(undefined);
  });

  it("returns an error when an in-use value is removed", () => {
    const items = [{ value: "ui-design", label: "UI Design" }];
    expect(
      validateItemsInUse(items, deals, "category", "categories"),
    ).toBe(
      "Cannot remove categories that are still used by deals: copywriting",
    );
  });

  it("lists all missing in-use values", () => {
    const items: { value: string; label: string }[] = [];
    const result = validateItemsInUse(items, deals, "category", "categories");
    expect(result).toContain("ui-design");
    expect(result).toContain("copywriting");
  });

  it("returns an error when there are duplicate slugs", () => {
    const items = [
      { value: "ui-design", label: "UI Design" },
      { value: "ui-design", label: "UI Design again" },
      { value: "copywriting", label: "Copywriting" },
    ];
    expect(
      validateItemsInUse(items, deals, "category", "categories"),
    ).toBe("Duplicate categories: ui-design");
  });

  it("detects duplicates via slug fallback when value is empty", () => {
    const items = [
      { value: "", label: "UI Design" },
      { value: "ui-design", label: "Already UI Design" },
      { value: "copywriting", label: "Copywriting" },
    ];
    expect(
      validateItemsInUse(items, deals, "category", "categories"),
    ).toBe("Duplicate categories: ui-design");
  });

  it("returns 'Validating…' when deals have not loaded yet", () => {
    const items = [{ value: "ui-design", label: "UI Design" }];
    expect(
      validateItemsInUse(items, undefined, "category", "categories"),
    ).toBe("Validating…");
  });

  it("ignores deals with a falsy value for the checked field", () => {
    const dealsWithEmpty: RaRecord[] = [
      { id: 1, category: "" },
      { id: 2, category: null },
    ];
    const items = [{ value: "other", label: "Other" }];
    expect(
      validateItemsInUse(items, dealsWithEmpty, "category", "categories"),
    ).toBe(undefined);
  });

  it("works with the category field", () => {
    const items = [{ value: "ui-design", label: "UI Design" }];
    expect(
      validateItemsInUse(items, deals, "category", "categories"),
    ).toContain("copywriting");
  });
});

describe("transformFormValues", () => {
  it("preserves visibleInDealsKanban per note status item", () => {
    const data = {
      noteStatuses: [
        { label: "A", color: "#fff", visibleInDealsKanban: true },
        { label: "B", color: "#000", visibleInDealsKanban: false },
      ],
    };

    const result = transformFormValues(data);

    expect(result.config.noteStatuses).toEqual([
      { label: "A", color: "#fff", visibleInDealsKanban: true, value: "a" },
      { label: "B", color: "#000", visibleInDealsKanban: false, value: "b" },
    ]);
  });

  it("preserves the input array order", () => {
    const data = {
      noteStatuses: [
        { label: "Third", color: "#3", visibleInDealsKanban: false },
        { label: "First", color: "#1", visibleInDealsKanban: true },
        { label: "Second", color: "#2", visibleInDealsKanban: true },
      ],
    };

    const result = transformFormValues(data);

    expect(result.config.noteStatuses?.map((status) => status.label)).toEqual(
      ["Third", "First", "Second"],
    );
  });

  it("slugs the value from the label when absent", () => {
    const data = {
      noteStatuses: [
        { label: "In Progress", color: "#abc", visibleInDealsKanban: true },
      ],
    };

    const result = transformFormValues(data);

    expect(result.config.noteStatuses?.[0].value).toBe("in-progress");
  });
});
