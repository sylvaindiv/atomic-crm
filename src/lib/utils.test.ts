import { getContrastingTextColor } from "./utils";

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
