import { describe, expect, it } from "vitest";
import { noteToHtml, noteToText, sanitizeNoteHtml } from "./noteContent";
import {
  buildNoteNextAction,
  validateNoteTextRequired,
  validateNoteOrAttachmentRequired,
} from "./noteModel";

describe("rich note content", () => {
  it("converts historical Markdown and text without changing their source", () => {
    const old = "**Appel**\nSuite\n\n- Un\n- Deux";
    expect(noteToHtml(old)).toContain("<strong>Appel</strong>");
    expect(noteToText(old)).toBe("Appel\nSuite\n\nUn\nDeux");
    expect(old).toBe("**Appel**\nSuite\n\n- Un\n- Deux");
  });

  it("keeps supported markup and removes executable HTML, fonts and colors", () => {
    const html = sanitizeNoteHtml(
      '<h2 style="color:red">Titre</h2><p onclick="alert(1)"><strong>Gras</strong> <em>italique</em> <u>souligné</u> <a href="https://example.com">Lien</a><a href="javascript:alert(1)">danger</a></p><script>alert(1)</script><img src=x onerror="alert(1)">',
    );
    expect(html).toContain("<u>souligné</u>");
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toMatch(/style=|onclick|javascript:|script|img/);
  });

  it("extracts complete task text with paragraphs and list item separation", () => {
    const text =
      "<h2>Suivi</h2><p>Appeler<br>demain</p><ul><li><p>Un</p></li><li><p>Deux</p></li></ul>";
    expect(
      buildNoteNextAction({ text, next_action: { due_date: "2026-10-25" } }),
    ).toEqual({
      mode: "create",
      text: "Suivi\n\nAppeler\ndemain\n\nUn\nDeux",
      due_date: "2026-10-25",
    });
  });

  it("rejects visually empty notes, even with attachments at creation", () => {
    for (const text of [
      "",
      "   ",
      "<p><br></p>",
      "<p>&nbsp;</p>",
      "<p>\u200b</p>",
    ]) {
      expect(validateNoteTextRequired(text)).toBe("ra.validation.required");
    }
    expect(
      validateNoteOrAttachmentRequired("<p></p>", { attachments: [{}] }),
    ).toBeUndefined();
  });

  it("requires a valid date-only deadline and keeps it unchanged", () => {
    for (const date of ["", "2026-02-30", "2026-10-25T00:00:00.000Z"]) {
      expect(() =>
        buildNoteNextAction({ text: "Note", next_action: { due_date: date } }),
      ).toThrow();
    }
    expect(
      buildNoteNextAction({
        text: "Note",
        next_action: { due_date: "2026-10-25" },
      }).mode,
    ).toBe("create");
  });
});
