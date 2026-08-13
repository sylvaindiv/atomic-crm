import { render } from "vitest-browser-react";
import { ClubDeal, JudgeDeal } from "./DealShow.stories";

describe("DealShow", () => {
  it("shows the referee name exactly once for a judge deal", async () => {
    const screen = await render(<JudgeDeal />);

    await expect
      .element(screen.getByText(/Ada Lovelace/).first())
      .toBeVisible();
    await expect
      .poll(() => screen.getByText(/Ada Lovelace/).all().length)
      .toBe(1);
  });

  it("still shows the club's referee contact section for a club deal", async () => {
    const screen = await render(<ClubDeal />);

    await expect
      .element(screen.getByText(/Padel Club Paris/))
      .toBeVisible();
    await expect
      .element(screen.getByText(/Referee Contact/))
      .toBeVisible();
  });
});
