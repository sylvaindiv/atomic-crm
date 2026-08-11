import { composeStories } from "@storybook/react-vite";
import { render } from "vitest-browser-react";
import * as stories from "./DealInputs.stories";
import {
  DealInputsStory,
  EditJudgeDealFromRealRecord,
} from "./DealInputs.stories";

const { Create, EditJudgeDeal, EditClubDeal, EditClubDealWithIdZero } =
  composeStories(stories);

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

    // Several required fields (name, case type) are empty at once, so
    // assert at least one "Required" error surfaced rather than pin down a
    // single occurrence.
    await expect
      .poll(() => screen.getByText("Required").all().length)
      .toBeGreaterThan(0);
  });

  it("shows the club company input and the linked contact input for a club deal", async () => {
    const screen = await render(<EditClubDeal />);

    await expect.element(screen.getByLabelText("Club")).toBeInTheDocument();
    await expect
      .element(screen.getByLabelText("Judge-Referee"))
      .toBeInTheDocument();
  });

  it("shows the linked contact input and hides the club company input for a judge deal", async () => {
    const screen = await render(<EditJudgeDeal />);

    await expect
      .element(screen.getByLabelText("Judge-Referee"))
      .toBeInTheDocument();
    await expect.element(screen.getByLabelText("Club")).not.toBeInTheDocument();
  });

  it("reveals the club company input after choosing the club case type, alongside the always-present contact input", async () => {
    const screen = await render(<Create />);

    await screen.getByRole("combobox", { name: /case type/i }).click();
    await screen.getByRole("listbox").getByText("Club").click();

    await expect.element(screen.getByLabelText("Club")).toBeInTheDocument();
    await expect
      .element(screen.getByLabelText("Judge-Referee"))
      .toBeInTheDocument();
  });

  it("hides the club company input after choosing the judge case type, keeping the contact input", async () => {
    const screen = await render(<Create />);

    await screen.getByRole("combobox", { name: /case type/i }).click();
    await screen.getByRole("listbox").getByText("Judge").click();

    await expect
      .element(screen.getByLabelText("Judge-Referee"))
      .toBeInTheDocument();
    await expect.element(screen.getByLabelText("Club")).not.toBeInTheDocument();
  });

  it("blocks submission of a club deal without a linked contact, in create", async () => {
    const onSubmit = vi.fn();
    const screen = await render(
      <DealInputsStory
        defaultValues={{
          case_type: "club",
          name: "Padel dispute",
          company_id: 1,
        }}
        withSaveButton
        saveButtonType="submit"
        onSubmit={onSubmit}
      />,
    );

    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect
      .poll(
        () =>
          screen
            .getByLabelText("Judge-Referee")
            .element()
            .closest('[data-slot="form-item"]')?.textContent,
      )
      .toContain("Required");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("blocks submission of a club deal without a linked contact, in edit", async () => {
    const onSubmit = vi.fn();
    const screen = await render(
      <EditClubDeal
        record={{ id: 43, case_type: "club", company_id: 1 }}
        withSaveButton
        saveButtonType="submit"
        onSubmit={onSubmit}
      />,
    );

    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect
      .poll(
        () =>
          screen
            .getByLabelText("Judge-Referee")
            .element()
            .closest('[data-slot="form-item"]')?.textContent,
      )
      .toContain("Required");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("clears company_id but keeps contact_ids when switching from club to judge", async () => {
    const onSubmit = vi.fn();
    const screen = await render(
      <DealInputsStory
        defaultValues={{
          case_type: "club",
          name: "Padel dispute",
          company_id: 1,
          contact_ids: [1],
        }}
        withSaveButton
        saveButtonType="submit"
        onSubmit={onSubmit}
      />,
    );

    await screen.getByRole("combobox", { name: /case type/i }).click();
    await screen.getByRole("listbox").getByText("Judge").click();

    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.poll(() => onSubmit.mock.calls.length).toBeGreaterThan(0);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.company_id).toBeNull();
    expect(submitted.contact_ids).toEqual([1]);
  });

  it("treats a record with id 0 as an edit form, hiding the case type select and keeping its linked contacts", async () => {
    const screen = await render(<EditClubDealWithIdZero />);

    await expect.element(screen.getByText("Case type")).not.toBeInTheDocument();
    await expect.element(screen.getByLabelText("Club")).toBeInTheDocument();
  });

  it("does not clear contact_ids on save for a club deal whose id is 0", async () => {
    const onSubmit = vi.fn();
    const screen = await render(
      <DealInputsStory
        record={{
          id: 0,
          name: "Padel dispute",
          case_type: "club",
          company_id: 1,
          contact_ids: [1],
        }}
        withSaveButton
        saveButtonType="submit"
        onSubmit={onSubmit}
      />,
    );

    await screen.getByRole("button", { name: /^save$/i }).click();

    await expect.poll(() => onSubmit.mock.calls.length).toBeGreaterThan(0);
    const submitted = onSubmit.mock.calls[0][0];
    expect(submitted.contact_ids).toEqual([1]);
  });

  it("resolves case_type from the real fetched record on edit, showing the judge input and hiding the club input", async () => {
    const screen = await render(<EditJudgeDealFromRealRecord />);

    await expect
      .element(screen.getByLabelText("Judge-Referee"))
      .toBeInTheDocument();
    await expect.element(screen.getByLabelText("Club")).not.toBeInTheDocument();
    await expect.element(screen.getByText("Case type")).not.toBeInTheDocument();
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
