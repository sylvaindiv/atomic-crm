import { useState } from "react";
import { render } from "vitest-browser-react";
import { StoryWrapper } from "@/test/StoryWrapper";
import { EditableListCell, type EditableListEntry } from "./EditableListCell";

/**
 * Wraps `EditableListCell` with local state so a commit is reflected back
 * into `entries` — mirroring how a real contact record updates after an
 * optimistic write, since the popover's draft resets from this prop each
 * time it (re)opens.
 */
const TestListCell = ({
  initialEntries,
  onCommit,
}: {
  initialEntries: EditableListEntry[];
  onCommit: (entries: EditableListEntry[]) => void;
}) => {
  const [entries, setEntries] = useState(initialEntries);
  return (
    <EditableListCell
      entries={entries}
      onCommit={(next) => {
        setEntries(next);
        onCommit(next);
      }}
      placeholder="Email"
      addLabel="Add email"
    />
  );
};

describe("EditableListCell", () => {
  it("commits a new blank entry when Add is clicked", async () => {
    const onCommit = vi.fn();
    const screen = await render(
      <StoryWrapper>
        <TestListCell initialEntries={[]} onCommit={onCommit} />
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "—" }).click();
    await screen.getByRole("button", { name: "Add email" }).click();

    expect(onCommit).toHaveBeenCalledWith([{ value: "", type: "Work" }]);
  });

  it("commits the array without the removed entry when its remove button is clicked", async () => {
    const onCommit = vi.fn();
    const entries: EditableListEntry[] = [
      { value: "ada@example.com", type: "Work" },
      { value: "ada@home.com", type: "Home" },
    ];
    const screen = await render(
      <StoryWrapper>
        <TestListCell initialEntries={entries} onCommit={onCommit} />
      </StoryWrapper>,
    );

    await screen
      .getByRole("button", { name: "ada@example.com, ada@home.com" })
      .click();
    await screen
      .getByRole("button", { name: "Remove ada@example.com" })
      .click();

    expect(onCommit).toHaveBeenCalledWith([
      { value: "ada@home.com", type: "Home" },
    ]);
  });

  it("commits the edited value once the input is blurred", async () => {
    const onCommit = vi.fn();
    const entries: EditableListEntry[] = [
      { value: "ada@example.com", type: "Work" },
    ];
    const screen = await render(
      <StoryWrapper>
        <TestListCell initialEntries={entries} onCommit={onCommit} />
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "ada@example.com" }).click();
    await screen
      .getByRole("textbox", { name: "Email" })
      .fill("ada@newmail.com");
    // Clicking "Add" moves focus away, blurring the value input first.
    await screen.getByRole("button", { name: "Add email" }).click();

    expect(onCommit).toHaveBeenNthCalledWith(1, [
      { value: "ada@newmail.com", type: "Work" },
    ]);
  });

  it("does not commit on blur when the value is unchanged", async () => {
    const onCommit = vi.fn();
    const entries: EditableListEntry[] = [
      { value: "ada@example.com", type: "Work" },
    ];
    const screen = await render(
      <StoryWrapper>
        <TestListCell initialEntries={entries} onCommit={onCommit} />
      </StoryWrapper>,
    );

    await screen.getByRole("button", { name: "ada@example.com" }).click();
    await screen.getByRole("textbox", { name: "Email" }).click();
    // Clicking "Add" blurs the untouched input, then adds a new row: only
    // that one commit should have fired, not a spurious one from the blur.
    await screen.getByRole("button", { name: "Add email" }).click();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenNthCalledWith(1, [
      { value: "ada@example.com", type: "Work" },
      { value: "", type: "Work" },
    ]);
  });
});
