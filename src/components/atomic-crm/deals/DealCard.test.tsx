import { render } from "vitest-browser-react";
import { DealCardContent } from "./DealCard";
import { StoryWrapper } from "@/test/StoryWrapper";
import {
  ClubDeal,
  JudgeDeal,
  JudgeDealWithClubAndNextAction,
  baseJudgeDeal,
  judgeContactsData,
} from "./DealCard.stories";

describe("DealCard", () => {
  it("shows the club name for a club deal", async () => {
    const screen = await render(<ClubDeal />);

    await expect
      .element(screen.getByText(/Padel Club Paris/))
      .toBeInTheDocument();
  });

  it("shows the judge name for a judge deal, with no broken company slot", async () => {
    const screen = await render(<JudgeDeal />);

    await expect.element(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();

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

  it("shows the club sub-row and an overdue chip for a judge deal with a club and an overdue next action", async () => {
    const screen = await render(<JudgeDealWithClubAndNextAction />);

    await expect
      .element(screen.getByText("Padel Club Paris"))
      .toBeInTheDocument();
    await expect.element(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("does not show a club sub-row for a club deal", async () => {
    const screen = await render(<ClubDeal />);

    // "Padel Club Paris" only appears once, as the row-1 party name -- no
    // second (sub-row) occurrence for club deals.
    await expect
      .poll(() => screen.getByText(/Padel Club Paris/).all().length)
      .toBe(1);
  });

  it("does not show a next-action chip when there is no next action due date", async () => {
    const screen = await render(<JudgeDeal />);

    await expect.element(screen.getByText(/Ada Lovelace/)).toBeInTheDocument();
    await expect.element(screen.getByText("Overdue")).not.toBeInTheDocument();
    await expect.element(screen.getByText("Due today")).not.toBeInTheDocument();
  });

  it("shows a 'Due today' chip when the next action is due today", async () => {
    const screen = await render(
      <StoryWrapper data={judgeContactsData}>
        <DealCardContent
          deal={{
            ...baseJudgeDeal,
            next_action_due_date: new Date().toISOString(),
          }}
        />
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("Due today")).toBeInTheDocument();
  });

  it("shows a compact 'Nd' chip when the next action is due later this week", async () => {
    // End-of-day, not Date.now() + 5 days: differenceInDays counts full
    // 24h periods, so a render delay of even a few ms could otherwise tip
    // an exact 5-day gap down to 4 -- padding to 23:59:59.999 keeps a wide
    // margin against that flake.
    const inFiveDays = new Date();
    inFiveDays.setDate(inFiveDays.getDate() + 5);
    inFiveDays.setHours(23, 59, 59, 999);

    const screen = await render(
      <StoryWrapper data={judgeContactsData}>
        <DealCardContent
          deal={{
            ...baseJudgeDeal,
            next_action_due_date: inFiveDays.toISOString(),
          }}
        />
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("5d")).toBeInTheDocument();
  });
});
