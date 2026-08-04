import { render } from "vitest-browser-react";
import { ClubDeal, JudgeDeal } from "./DealCard.stories";

describe("DealCard", () => {
  it("shows the club name and a Club badge for a club deal", async () => {
    const screen = await render(<ClubDeal />);

    await expect
      .element(screen.getByText(/Padel Club Paris/))
      .toBeInTheDocument();
    // exact: true -- "Padel Club Paris" also contains the substring "Club",
    // which would otherwise make this locator ambiguous against the badge.
    await expect
      .element(screen.getByText("Club", { exact: true }))
      .toBeInTheDocument();
  });

  it("shows the judge name and a Judge badge for a judge deal, with no broken company slot", async () => {
    const screen = await render(<JudgeDeal />);

    await expect.element(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    await expect.element(screen.getByText("Judge")).toBeInTheDocument();

    // The judge name must render inline inside the title <p>, not wrapped in
    // a block-level <div> -- a <div> forces its own line (breaking the
    // single-line title layout) and DOM APIs don't auto-correct invalid
    // div-inside-p nesting the way HTML string parsing would.
    const titleParagraph = screen
      .getByText(/Ada Lovelace/)
      .element()
      .closest("p");
    expect(titleParagraph).not.toBeNull();
    expect(titleParagraph?.querySelector("div")).toBeNull();
  });
});
