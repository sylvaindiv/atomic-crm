import { describe, it, expect } from "vitest";
import { transformFormValues } from "./SettingsPage";

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

    expect(result.config.noteStatuses?.map((status) => status.label)).toEqual([
      "Third",
      "First",
      "Second",
    ]);
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

  it("no longer includes dealCategories in the transformed config", () => {
    const data = {
      title: "My CRM",
      dealCategories: [{ value: "legacy", label: "Legacy" }],
    };

    const result = transformFormValues(data);

    expect(result.config).not.toHaveProperty("dealCategories");
  });

  it("preserves checklist IDs across label changes and creates IDs for new items", () => {
    const result = transformFormValues({
      clientChecklist: [
        { value: "stable-id", label: "Renamed step" },
        { label: "New step" },
      ],
    });

    expect(result.config.clientChecklist?.[0]).toEqual({
      value: "stable-id",
      label: "Renamed step",
    });
    expect(result.config.clientChecklist?.[1].value).toMatch(
      /^[0-9a-f-]{36}$/i,
    );
  });

  it("preserves an explicitly empty checklist and the other configuration", () => {
    const result = transformFormValues({
      title: "CRM test",
      clientChecklist: [],
    });

    expect(result.config.clientChecklist).toEqual([]);
    expect(result.config.title).toBe("CRM test");
  });
});
