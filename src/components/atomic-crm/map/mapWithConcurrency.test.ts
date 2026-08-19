import { mapWithConcurrency } from "./mapWithConcurrency";

describe("mapWithConcurrency", () => {
  it("resolves results in the same order as the input items", async () => {
    const items = [30, 10, 20];

    const results = await mapWithConcurrency(items, 3, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });

    expect(results).toEqual([30, 10, 20]);
  });

  it("never runs more than `concurrency` calls at the same time", async () => {
    const items = Array.from({ length: 10 }, (_, i) => i);
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency(items, 3, async (item) => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return item;
    });

    expect(maxInFlight).toBeLessThanOrEqual(3);
  });

  it("processes every item exactly once", async () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const seen: number[] = [];

    await mapWithConcurrency(items, 4, async (item) => {
      seen.push(item);
      return item;
    });

    expect(seen.sort((a, b) => a - b)).toEqual(items);
  });
});
