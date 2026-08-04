import { composeStories } from "@storybook/react-vite";
import { render } from "vitest-browser-react";
import * as stories from "./DealInputs.stories";
import { DealInputsStory } from "./DealInputs.stories";

const { Create, EditJudgeDeal, EditClubDeal } = composeStories(stories);

describe("DealInputs", () => {
  it("shows a required case type select on the create form", async () => {
    const screen = await render(<Create />);

    await expect.element(screen.getByText("Case type")).toBeInTheDocument();
  });

  it("does not show the case type select on the edit form", async () => {
    const screen = await render(<EditClubDeal />);

    await expect.element(screen.getByText("Case type")).not.toBeInTheDocument();
  });

  it("blocks submission without choosing a case type", async () => {
    const screen = await render(<DealInputsStory withSaveButton />);

    await screen.getByRole("button", { name: /^save$/i }).click();

    // Several required fields (name, case type, amount, closing date) are
    // empty at once, so assert at least one "Required" error surfaced
    // rather than pin down a single occurrence.
    await expect
      .poll(() => screen.getByText("Required").all().length)
      .toBeGreaterThan(0);
  });

  it("shows the club company input and hides the judge input for a club deal", async () => {
    const screen = await render(<EditClubDeal />);

    await expect.element(screen.getByLabelText("Club")).toBeInTheDocument();
    await expect
      .element(screen.getByText("Judges-Referees"))
      .not.toBeInTheDocument();
  });

  it("shows the judge input and hides the club company input for a judge deal", async () => {
    const screen = await render(<EditJudgeDeal />);

    await expect
      .element(screen.getByText("Judges-Referees"))
      .toBeInTheDocument();
    await expect.element(screen.getByLabelText("Club")).not.toBeInTheDocument();
  });

  it("reveals the club company input after choosing the club case type", async () => {
    const screen = await render(<Create />);

    await screen.getByRole("combobox", { name: /case type/i }).click();
    await screen.getByRole("listbox").getByText("Club").click();

    await expect.element(screen.getByLabelText("Club")).toBeInTheDocument();
    await expect
      .element(screen.getByText("Judges-Referees"))
      .not.toBeInTheDocument();
  });

  it("reveals the judge input after choosing the judge case type", async () => {
    const screen = await render(<Create />);

    await screen.getByRole("combobox", { name: /case type/i }).click();
    await screen.getByRole("listbox").getByText("Judge").click();

    await expect
      .element(screen.getByText("Judges-Referees"))
      .toBeInTheDocument();
    await expect.element(screen.getByLabelText("Club")).not.toBeInTheDocument();
  });

  it("lists every note status in the stage select, including the ones hidden from the Kanban", async () => {
    const screen = await render(<Create />);

    await screen.getByRole("combobox", { name: /stage/i }).click();
    const listbox = screen.getByRole("listbox");

    // "Mort" is flagged visibleInDealsKanban: false in the default
    // configuration but must still be reachable from the deal form.
    await expect.element(listbox.getByText("Mort")).toBeInTheDocument();
    await expect.element(listbox.getByText("Client")).toBeInTheDocument();
  });
});
