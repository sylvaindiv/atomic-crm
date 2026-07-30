import { RecordContextProvider, useGetOne } from "ra-core";
import { render } from "vitest-browser-react";
import { buildContact, StoryWrapper } from "@/test/StoryWrapper";
import type { Contact } from "../../types";
import { useUpdateContactField } from "./useUpdateContactField";

/** Renders the contact's live `title` and a button that commits a new one. */
const TestField = ({
  contactId,
  nextTitle,
}: {
  contactId: number;
  nextTitle: string;
}) => {
  const { data: record } = useGetOne<Contact>("contacts", { id: contactId });
  if (!record) return null;

  return (
    <RecordContextProvider value={record}>
      <span>{record.title}</span>
      <TestFieldButton nextTitle={nextTitle} />
    </RecordContextProvider>
  );
};

const TestFieldButton = ({ nextTitle }: { nextTitle: string }) => {
  const updateTitle = useUpdateContactField("title");
  return <button onClick={() => updateTitle(nextTitle)}>update</button>;
};

describe("useUpdateContactField", () => {
  it("applies the new value optimistically before the request resolves", async () => {
    let resolveUpdate: ((result: { data: Contact }) => void) | undefined;
    const updatePromise = new Promise<{ data: Contact }>((resolve) => {
      resolveUpdate = resolve;
    });
    const updateMock = vi.fn().mockReturnValue(updatePromise);
    const contact = buildContact({ id: 1, title: "CTO" });

    const screen = await render(
      <StoryWrapper
        data={{ contacts: [contact] }}
        dataProvider={{ update: updateMock }}
      >
        <TestField contactId={1} nextTitle="CEO" />
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("CTO")).toBeInTheDocument();

    await screen.getByRole("button", { name: "update" }).click();

    // Optimistic: the new value is already on screen before the request settles.
    await expect.element(screen.getByText("CEO")).toBeInTheDocument();

    expect(updateMock).toHaveBeenCalledWith(
      "contacts",
      expect.objectContaining({
        id: 1,
        data: { title: "CEO" },
        previousData: expect.objectContaining({ id: 1, title: "CTO" }),
      }),
    );

    resolveUpdate?.({ data: { ...contact, title: "CEO" } });
    await expect.element(screen.getByText("CEO")).toBeInTheDocument();
  });

  it("rolls back to the previous value and notifies on error", async () => {
    let rejectUpdate: ((error: Error) => void) | undefined;
    const updatePromise = new Promise<{ data: Contact }>((_resolve, reject) => {
      rejectUpdate = reject;
    });
    const updateMock = vi.fn().mockReturnValue(updatePromise);
    const contact = buildContact({ id: 1, title: "CTO" });

    const screen = await render(
      <StoryWrapper
        data={{ contacts: [contact] }}
        dataProvider={{ update: updateMock }}
      >
        <TestField contactId={1} nextTitle="CEO" />
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("CTO")).toBeInTheDocument();

    await screen.getByRole("button", { name: "update" }).click();

    // Optimistic: applied before the rejection, so there is something to roll back.
    await expect.element(screen.getByText("CEO")).toBeInTheDocument();

    rejectUpdate?.(new Error("Update failed"));

    await expect.element(screen.getByText("Update failed")).toBeInTheDocument();

    // Rolled back: the optimistic "CEO" write is reverted after the rejection.
    await expect.element(screen.getByText("CTO")).toBeInTheDocument();
  });

  it("does not issue a request when the value is unchanged", async () => {
    const updateMock = vi.fn().mockResolvedValue({ data: {} });
    const contact = buildContact({ id: 1, title: "CTO" });

    const screen = await render(
      <StoryWrapper
        data={{ contacts: [contact] }}
        dataProvider={{ update: updateMock }}
      >
        <TestField contactId={1} nextTitle="CTO" />
      </StoryWrapper>,
    );

    await expect.element(screen.getByText("CTO")).toBeInTheDocument();

    await screen.getByRole("button", { name: "update" }).click();

    expect(updateMock).not.toHaveBeenCalled();
  });
});
