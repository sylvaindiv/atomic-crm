import { dealNeedsAction, formatDealAmount } from "./dealUtils";

describe("formatDealAmount", () => {
  it("formats a positive amount as compact currency", () => {
    expect(formatDealAmount(500, "USD")).toBe("$500");
  });

  it("returns a placeholder when the amount is null", () => {
    expect(formatDealAmount(null, "USD")).toBe("–");
  });

  it("returns a placeholder when the amount is undefined", () => {
    expect(formatDealAmount(undefined, "USD")).toBe("–");
  });

  it("formats a zero amount as currency rather than the placeholder", () => {
    expect(formatDealAmount(0, "USD")).toBe("$0.00");
  });
});

describe("dealNeedsAction", () => {
  it("returns false when there is no due date", () => {
    expect(dealNeedsAction(null)).toBe(false);
    expect(dealNeedsAction(undefined)).toBe(false);
  });

  it("returns true for an overdue due date", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(dealNeedsAction(yesterday)).toBe(true);
  });

  it("returns true for a due date of today", () => {
    expect(dealNeedsAction(new Date().toISOString())).toBe(true);
  });

  it("returns false for a due date in the future", () => {
    const nextWeek = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(dealNeedsAction(nextWeek)).toBe(false);
  });
});
