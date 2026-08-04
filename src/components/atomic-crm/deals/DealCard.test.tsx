import { render } from "vitest-browser-react";
import { ClubDeal, JudgeDeal } from "./DealCard.stories";

describe("DealCard", () => {
  it("shows the club name and a Club badge for a club deal", async () => {
    const screen = await render(<ClubDeal />);

    await expect
      .element(screen.getByText(/Padel Club Paris/))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Club")).toBeInTheDocument();
  });

  it("shows the judge name and a Judge badge for a judge deal, with no broken company slot", async () => {
    const screen = await render(<JudgeDeal />);

    await expect.element(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    await expect.element(screen.getByText("Judge")).toBeInTheDocument();
  });
});
