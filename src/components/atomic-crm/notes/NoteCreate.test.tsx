import { render } from "vitest-browser-react";
import { RecordContextProvider, Form } from "ra-core";
import { useFormContext, useWatch } from "react-hook-form";
import { userEvent } from "vitest/browser";
import { StoryWrapper, buildContact, createCrmDb } from "@/test/StoryWrapper";
import { createDataProvider } from "../providers/fakerest";
import { NoteCreate } from "./NoteCreate";
import { NoteCreateSheet } from "./NoteCreateSheet";
import { NoteEditSheet } from "./NoteEditSheet";
import { NoteInputsMobile } from "./NoteInputsMobile";
import { NoteEditor } from "./NoteEditor";
import { noteToText } from "./noteContent";

const contact = buildContact();
const html =
  '<h2>Suivi</h2><p><strong>Gras</strong> <em>italique</em> <u>souligné</u> <a href="https://example.com">lien</a></p><ul><li><p>Premier</p></li><li><p>Second</p></li></ul><ol><li><p>Appeler</p></li></ol>';

const paste = (content: string, type = "text/html") => {
  const node = document.querySelector(
    '[contenteditable="true"]',
  ) as HTMLElement;
  node.focus();
  const clipboardData = new DataTransfer();
  clipboardData.setData(type, content);
  node.dispatchEvent(
    new ClipboardEvent("paste", {
      clipboardData,
      bubbles: true,
      cancelable: true,
    }),
  );
};

describe("unified note creation", () => {
  it("creates one formatted note and one plain task, then resets text and deadline", async () => {
    const provider = createDataProvider({
      db: createCrmDb({ contacts: [contact] }),
      silent: true,
    });
    const create = vi.spyOn(provider, "create");
    const screen = await render(
      <StoryWrapper dataProvider={provider}>
        <RecordContextProvider value={contact}>
          <NoteCreate reference="contacts" />
        </RecordContextProvider>
      </StoryWrapper>,
    );
    const editor = screen.getByRole("textbox", { name: "Add a note" });
    await expect.element(editor).toBeVisible();
    paste(html);
    await expect.element(editor).toHaveTextContent("Second");
    await screen.getByLabelText("Due date").fill("2026-10-25");
    await screen.getByRole("button", { name: "Add this note" }).click();
    await expect.poll(() => create.mock.calls.length).toBe(1);
    await expect.element(screen.getByText("Note added")).toBeVisible();
    const notes = await provider.getList("contact_notes", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    });
    const tasks = await provider.getList("tasks", {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    });
    expect(notes.data).toHaveLength(1);
    expect(notes.data[0].text).toContain("<u>souligné</u>");
    expect(tasks.data).toHaveLength(1);
    expect(tasks.data[0]).toMatchObject({
      contact_id: contact.id,
      text: noteToText(html),
      due_date: "2026-10-25",
    });
    await expect.element(editor).toHaveTextContent("");
    await expect.element(screen.getByLabelText("Due date")).toHaveValue("");
    expect(document.querySelector('[name="next_action.text"]')).toBeNull();
  });

  it("creates from the mobile sheet, then edits without creating or syncing tasks", async () => {
    const provider = createDataProvider({
      db: createCrmDb({ contacts: [contact] }),
      latency: 0,
      silent: true,
    });
    const create = vi.spyOn(provider, "create");
    const update = vi.spyOn(provider, "update");
    const screen = await render(
      <StoryWrapper dataProvider={provider}>
        <NoteCreateSheet open onOpenChange={() => {}} contact_id={contact.id} />
      </StoryWrapper>,
    );
    const editor = screen.getByRole("textbox", { name: "Add a note" });
    await expect.element(editor).toBeVisible();
    paste(html);
    await screen.getByLabelText("Due date").fill("2026-10-25");
    await screen.getByRole("button", { name: "Save", exact: true }).click();
    await expect.element(screen.getByText("Note added")).toBeVisible();
    expect(create).toHaveBeenCalledOnce();
    const params = {
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" as const },
      filter: {},
    };
    const notes = await provider.getList("contact_notes", params);
    const before = await provider.getList("tasks", params);
    expect(notes.data).toHaveLength(1);
    expect(before.data).toHaveLength(1);
    await screen.unmount();
    const editScreen = await render(
      <StoryWrapper dataProvider={provider}>
        <NoteEditSheet
          open
          onOpenChange={() => {}}
          noteId={String(notes.data[0].id)}
        />
      </StoryWrapper>,
    );
    const edit = editScreen.getByRole("textbox", { name: "Add a note" });
    await expect.element(edit).toHaveTextContent("Second");
    expect(document.querySelector(".tiptap u")?.textContent).toBe("souligné");
    expect(document.querySelector('input[type="date"]')).toBeNull();
    await edit.fill("Note modifiée");
    await editScreen.getByRole("button", { name: "Save", exact: true }).click();
    await expect
      .poll(() => update.mock.calls.length, { timeout: 10000 })
      .toBeGreaterThan(0);
    await expect
      .poll(
        async () =>
          (await provider.getOne("contact_notes", { id: notes.data[0].id }))
            .data.text,
        { timeout: 10000 },
      )
      .toContain("Note modifiée");
    expect(create).toHaveBeenCalledOnce();
    expect((await provider.getList("tasks", params)).data).toEqual(before.data);
  });

  it("retains the draft and deadline on failure", async () => {
    const create = vi.fn().mockRejectedValue(new Error("Save failed"));
    const screen = await render(
      <StoryWrapper dataProvider={{ create }}>
        <RecordContextProvider value={contact}>
          <NoteCreate reference="contacts" />
        </RecordContextProvider>
      </StoryWrapper>,
    );
    const editor = screen.getByRole("textbox", { name: "Add a note" });
    await editor.fill("À conserver");
    await screen.getByLabelText("Due date").fill("2026-10-25");
    await screen.getByRole("button", { name: "Add this note" }).click();
    await expect.poll(() => create.mock.calls.length).toBe(1);
    await expect.element(screen.getByText("Save failed")).toBeVisible();
    await expect.element(editor).toHaveTextContent("À conserver");
    await expect
      .element(screen.getByLabelText("Due date"))
      .toHaveValue("2026-10-25");
  });

  it("requires visible text and a date at creation, including with an attachment", async () => {
    const screen = await render(
      <StoryWrapper>
        <Form
          defaultValues={{
            attachments: [{ src: "blob:test", title: "test.pdf" }],
          }}
        >
          <NoteInputsMobile creating />
          <button type="submit">Submit</button>
        </Form>
      </StoryWrapper>,
    );
    await screen.getByRole("button", { name: "Submit" }).click();
    await expect.element(screen.getByText("Required").first()).toBeVisible();
    await screen.getByRole("textbox", { name: "Add a note" }).fill("Note");
    await screen.getByRole("button", { name: "Submit" }).click();
    await expect.element(screen.getByText("Required").first()).toBeVisible();
  });
});

const EditorState = () => {
  const { reset } = useFormContext();
  const text = useWatch({ name: "text" });
  return (
    <>
      <NoteEditor />
      <output data-testid="value">{text}</output>
      <button type="button" onClick={() => reset({ text })}>
        Reload
      </button>
    </>
  );
};

describe("shared rich editor", () => {
  it("pastes supported styles, strips unsafe content and restores the saved markup", async () => {
    const screen = await render(
      <StoryWrapper>
        <Form>
          <EditorState />
        </Form>
      </StoryWrapper>,
    );
    await expect
      .element(screen.getByRole("textbox", { name: "Add a note" }))
      .toBeVisible();
    paste(
      html +
        '<p><span style="font-weight:700;font-style:italic;text-decoration:underline;color:red;font-family:Arial">Word</span></p><script>alert(1)</script><img src=x onerror="alert(1)">',
    );
    const value = screen.getByTestId("value");
    await expect.element(value).toHaveTextContent("<u>");
    const saved = value.element().textContent ?? "";
    expect(saved).toContain("<strong><em><u>Word</u></em></strong>");
    expect(saved).not.toMatch(/style=|script|img|onerror/);
    await screen.getByRole("button", { name: "Reload" }).click();
    expect(document.querySelector(".tiptap")?.innerHTML).toContain(
      "<u>souligné</u>",
    );
    expect(document.querySelector(".tiptap h2")?.textContent).toBe("Suivi");
    expect(document.querySelectorAll(".tiptap li")).toHaveLength(3);
  });

  it("pastes plain text and creates/removes a link from the toolbar", async () => {
    const screen = await render(
      <StoryWrapper>
        <Form>
          <EditorState />
        </Form>
      </StoryWrapper>,
    );
    const editor = screen.getByRole("textbox", { name: "Add a note" });
    await expect.element(editor).toBeVisible();
    paste("Compte rendu", "text/plain");
    await expect.element(editor).toHaveTextContent("Compte rendu");
    await userEvent.keyboard("{Meta>}a{/Meta}");
    const prompt = vi
      .spyOn(window, "prompt")
      .mockReturnValue("https://example.com");
    try {
      await screen.getByRole("button", { name: "Link", exact: true }).click();
      await expect
        .element(screen.getByTestId("value"))
        .toHaveTextContent('href="https://example.com"');
      prompt.mockReturnValue("");
      await screen.getByRole("button", { name: "Link", exact: true }).click();
      await expect
        .element(screen.getByTestId("value"))
        .not.toHaveTextContent("<a");
    } finally {
      prompt.mockRestore();
    }
  });

  it("uses Enter for paragraphs, Shift+Enter for a line break and supports undo/redo", async () => {
    const screen = await render(
      <StoryWrapper>
        <Form>
          <EditorState />
        </Form>
      </StoryWrapper>,
    );
    const editor = screen.getByRole("textbox", { name: "Add a note" });
    await editor.fill("Premier");
    await userEvent.keyboard("{End}{Enter}Second{Shift>}{Enter}{/Shift}Suite");
    await expect
      .element(screen.getByTestId("value"))
      .toHaveTextContent("<p>Premier</p><p>Second<br>Suite</p>");
    await userEvent.keyboard("{Meta>}z{/Meta}");
    await expect.element(editor).not.toHaveTextContent("Second");
    await userEvent.keyboard("{Meta>}{Shift>}z{/Shift}{/Meta}");
    await expect.element(editor).toHaveTextContent("Suite");
  });

  it("loads historical Markdown without rewriting it just by opening", async () => {
    const text = "**Ancienne**\nSuite\n\n- Point";
    const screen = await render(
      <StoryWrapper>
        <Form defaultValues={{ text }}>
          <EditorState />
        </Form>
      </StoryWrapper>,
    );
    await expect
      .element(screen.getByRole("textbox", { name: "Add a note" }))
      .toHaveTextContent("Ancienne");
    expect(document.querySelector(".tiptap strong")?.textContent).toBe(
      "Ancienne",
    );
    expect(screen.getByTestId("value").element().textContent).toBe(text);
    expect(document.querySelector('input[type="date"]')).toBeNull();
  });
});
