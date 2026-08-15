import {
  accumulateContactAmount,
  getDealStageBucket,
  LOST_STAGE_VALUE,
  PENDING_STAGE_WEIGHT,
  WON_STAGE_VALUE,
  type MonthTotals,
} from "./AmountChart";

describe("getDealStageBucket", () => {
  it("buckets the Client status as won with full weight", () => {
    expect(getDealStageBucket(WON_STAGE_VALUE)).toEqual({
      bucket: "won",
      weight: 1,
    });
  });

  it("buckets the Mort status as lost with full weight", () => {
    expect(getDealStageBucket(LOST_STAGE_VALUE)).toEqual({
      bucket: "lost",
      weight: 1,
    });
  });

  it("buckets any other status as pending with the flat pending weight", () => {
    expect(getDealStageBucket("a_recontacter")).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
    expect(getDealStageBucket("visio")).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
  });

  it("buckets an unknown or legacy status value as pending instead of throwing or producing NaN", () => {
    expect(getDealStageBucket("won")).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
    expect(getDealStageBucket("lost")).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
    expect(getDealStageBucket("opportunity")).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
    expect(getDealStageBucket("a-brand-new-status-added-later")).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
  });

  it("buckets empty or missing input as pending instead of throwing or producing NaN", () => {
    expect(getDealStageBucket("")).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
    expect(getDealStageBucket(undefined)).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
    expect(getDealStageBucket(null)).toEqual({
      bucket: "pending",
      weight: PENDING_STAGE_WEIGHT,
    });
  });

});

describe("accumulateContactAmount", () => {
  const emptyMonth: MonthTotals = {
    date: "Jan",
    won: 0,
    pending: 0,
    lost: 0,
  };

  it("treats a null amount as 0 and never produces NaN", () => {
    const totals = accumulateContactAmount(emptyMonth, {
      status: WON_STAGE_VALUE,
      amount: null,
    });
    expect(totals.won).toBe(0);
    expect(Number.isNaN(totals.won)).toBe(false);
  });

  it("treats an undefined amount as 0 and never produces NaN", () => {
    const totals = accumulateContactAmount(emptyMonth, {
      status: "a_recontacter",
      amount: undefined,
    });
    expect(totals.pending).toBe(0);
    expect(Number.isNaN(totals.pending)).toBe(false);
  });

  it("adds a won contact's amount to the won total", () => {
    const totals = accumulateContactAmount(emptyMonth, {
      status: WON_STAGE_VALUE,
      amount: 100,
    });
    expect(totals).toEqual({ ...emptyMonth, won: 100 });
  });

  it("subtracts a lost contact's amount from the lost total", () => {
    const totals = accumulateContactAmount(emptyMonth, {
      status: LOST_STAGE_VALUE,
      amount: 100,
    });
    expect(totals).toEqual({ ...emptyMonth, lost: -100 });
  });

  it("weights a pending contact's amount by the flat pending weight", () => {
    const totals = accumulateContactAmount(emptyMonth, {
      status: "a_recontacter",
      amount: 100,
    });
    expect(totals).toEqual({
      ...emptyMonth,
      pending: 100 * PENDING_STAGE_WEIGHT,
    });
  });

  it("does not mutate the totals it was given", () => {
    const totals = accumulateContactAmount(emptyMonth, {
      status: WON_STAGE_VALUE,
      amount: 100,
    });
    expect(emptyMonth.won).toBe(0);
    expect(totals).not.toBe(emptyMonth);
  });
});
