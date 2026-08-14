import type { NoteStatus } from "../types";
import type { Deal } from "../types";
import { getDealsByStage, getVisibleDealStatuses } from "./stages";

const makeStatus = (
  overrides: Partial<NoteStatus> & Pick<NoteStatus, "value">,
): NoteStatus =>
  ({
    label: overrides.value,
    color: "#000000",
    visibleInDealsKanban: true,
    ...overrides,
  }) as NoteStatus;

const makeDeal = (
  overrides: Partial<Deal> & Pick<Deal, "id" | "stage">,
): Deal =>
  ({
    name: "Deal",
    index: 0,
    ...overrides,
  }) as unknown as Deal;

describe("getVisibleDealStatuses", () => {
  it("excludes a status explicitly flagged not visible", () => {
    const noteStatuses = [
      makeStatus({ value: "a" }),
      makeStatus({ value: "b", visibleInDealsKanban: false }),
    ];

    expect(getVisibleDealStatuses(noteStatuses).map((s) => s.value)).toEqual([
      "a",
    ]);
  });

  it("treats a status persisted without the visibility flag as visible", () => {
    const noteStatuses = [
      { value: "legacy", label: "Legacy", color: "#000000" } as NoteStatus,
    ];

    expect(getVisibleDealStatuses(noteStatuses).map((s) => s.value)).toEqual([
      "legacy",
    ]);
  });
});

describe("getDealsByStage", () => {
  it("groups deals per visible column, ordered by index", () => {
    const noteStatuses = [
      makeStatus({ value: "a_recontacter" }),
      makeStatus({ value: "client" }),
    ];
    const deals = [
      makeDeal({ id: 1, stage: "client", index: 1 }),
      makeDeal({ id: 2, stage: "a_recontacter", index: 0 }),
      makeDeal({ id: 3, stage: "client", index: 0 }),
    ];

    const result = getDealsByStage(deals, noteStatuses);

    expect(result.a_recontacter.map((d) => d.id)).toEqual([2]);
    expect(result.client.map((d) => d.id)).toEqual([3, 1]);
  });

  it("preserves configuration order for the produced columns", () => {
    const noteStatuses = [
      makeStatus({ value: "z" }),
      makeStatus({ value: "a" }),
    ];

    const result = getDealsByStage([], noteStatuses);

    expect(Object.keys(result)).toEqual(["z", "a"]);
  });

  it("omits a deal whose stage matches no visible column, without rewriting its stage", () => {
    const noteStatuses = [makeStatus({ value: "client" })];
    const deal = makeDeal({ id: 1, stage: "won", index: 0 });

    const result = getDealsByStage([deal], noteStatuses);

    expect(result.client).toEqual([]);
    expect(result.won).toBeUndefined();
    expect(deal.stage).toBe("won");
  });

  it("omits a deal whose stage is flagged not visible", () => {
    const noteStatuses = [
      makeStatus({ value: "client" }),
      makeStatus({ value: "mort", visibleInDealsKanban: false }),
    ];
    const deal = makeDeal({ id: 1, stage: "mort", index: 0 });

    const result = getDealsByStage([deal], noteStatuses);

    expect(result.mort).toBeUndefined();
    expect(deal.stage).toBe("mort");
  });

  it("sorts deals needing action (overdue or due today) above the rest, index otherwise", () => {
    const noteStatuses = [makeStatus({ value: "client" })];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString();
    const nextWeek = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const deals = [
      makeDeal({
        id: 1,
        stage: "client",
        index: 0,
        next_action_due_date: nextWeek,
      }),
      makeDeal({
        id: 2,
        stage: "client",
        index: 1,
        next_action_due_date: yesterday,
      }),
      makeDeal({
        id: 3,
        stage: "client",
        index: 2,
        next_action_due_date: null,
      }),
      makeDeal({
        id: 4,
        stage: "client",
        index: 3,
        next_action_due_date: today,
      }),
    ];

    const result = getDealsByStage(deals, noteStatuses);

    // needs-action deals (2, 4) first, in their original index order,
    // then the rest (1, 3) in their original index order.
    expect(result.client.map((d) => d.id)).toEqual([2, 4, 1, 3]);
  });
});
