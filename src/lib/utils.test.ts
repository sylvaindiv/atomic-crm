import { getContrastingTextColor, formatPhoneNumber } from "./utils";

describe("getContrastingTextColor", () => {
  it("returns dark text for a light background color", () => {
    const result = getContrastingTextColor("#ffff00");
    expect(result).toBe("#000000");
  });

  it("returns light text for a dark background color", () => {
    const result = getContrastingTextColor("#1a1a2e");
    expect(result).toBe("#ffffff");
  });
});

describe("formatPhoneNumber", () => {
  it("formats a plain 10-digit local number", () => {
    expect(formatPhoneNumber("0606060606")).toBe("06 06 06 06 06");
  });

  it("formats a local number with mixed separators", () => {
    expect(formatPhoneNumber("06.06.06.06.06")).toBe("06 06 06 06 06");
    expect(formatPhoneNumber("06-06-06-06-06")).toBe("06 06 06 06 06");
    expect(formatPhoneNumber("06 06 06 06 06")).toBe("06 06 06 06 06");
    expect(formatPhoneNumber("(06) 06 06 06 06")).toBe("06 06 06 06 06");
  });

  it("formats a +33 prefixed international number", () => {
    expect(formatPhoneNumber("+33606060606")).toBe("+33 06 06 06 06 06");
    expect(formatPhoneNumber("+33 6 06 06 06 06")).toBe("+33 06 06 06 06 06");
    expect(formatPhoneNumber("+33.6.06.06.06.06")).toBe("+33 06 06 06 06 06");
  });

  it("formats a 0033 prefixed international number", () => {
    expect(formatPhoneNumber("0033606060606")).toBe("+33 06 06 06 06 06");
    expect(formatPhoneNumber("0033 6 06 06 06 06")).toBe("+33 06 06 06 06 06");
  });

  it("returns non-French numbers unchanged", () => {
    expect(formatPhoneNumber("+1 555-123-4567")).toBe("+1 555-123-4567");
    expect(formatPhoneNumber("740.645.3807")).toBe("740.645.3807");
    expect(formatPhoneNumber("12345")).toBe("12345");
  });

  it("returns empty string unchanged", () => {
    expect(formatPhoneNumber("")).toBe("");
  });

  it("handles numbers with mixed US-style formatting", () => {
    expect(formatPhoneNumber("659-980-2015")).toBe("659-980-2015");
    expect(formatPhoneNumber("(446) 758-2122")).toBe("(446) 758-2122");
  });
});
