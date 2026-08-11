import { formatDealAmount } from "./dealUtils";

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
