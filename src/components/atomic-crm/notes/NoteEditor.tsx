import { useEffect } from "react";
import { useInput, useTranslate, ValidationError } from "ra-core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import DOMPurify from "dompurify";
import {
  Bold,
  Italic,
  Underline,
  Heading,
  List,
  ListOrdered,
  Link,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { noteToHtml, sanitizeNoteHtml } from "./noteContent";
import {
  validateNoteOrAttachmentRequired,
  validateNoteTextRequired,
} from "./noteModel";

export const NoteEditor = ({ required = false }: { required?: boolean }) => {
  const translate = useTranslate();
  const { field, fieldState, id } = useInput({
    source: "text",
    validate: required
      ? validateNoteTextRequired
      : validateNoteOrAttachmentRequired,
  });
  const { ref: inputRef } = field;
  const label = translate("resources.notes.inputs.add_note");
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: { openOnClick: false } })],
    content: noteToHtml(field.value),
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": label,
        "aria-multiline": "true",
        "data-placeholder": label,
        class:
          "min-h-24 p-3 outline-none [&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_a]:underline [&_a]:text-primary [&_h1]:text-2xl [&_h2]:text-xl [&_h3]:text-lg [&_h4]:font-semibold [&_h5]:font-semibold [&_h6]:font-semibold [&_h1]:font-bold [&_h2]:font-bold [&_h3]:font-bold",
      },
      // Keep semantic styles until Tiptap parses Word/Docs marks, then serialize
      // only the editor schema. Font and color attributes never reach storage.
      transformPastedHTML: (html) => DOMPurify.sanitize(html),
    },
    onUpdate: ({ editor }) =>
      field.onChange(sanitizeNoteHtml(editor.getHTML())),
    onBlur: () => field.onBlur(),
  });
  const state = useEditorState({
    editor,
    selector: ({ editor }) =>
      editor
        ? {
            empty: editor.isEmpty,
            bold: editor.isActive("bold"),
            italic: editor.isActive("italic"),
            underline: editor.isActive("underline"),
            heading: editor.isActive("heading"),
            bulletList: editor.isActive("bulletList"),
            orderedList: editor.isActive("orderedList"),
            link: editor.isActive("link"),
          }
        : null,
  });

  useEffect(() => {
    if (
      editor &&
      noteToHtml(field.value) !== sanitizeNoteHtml(editor.getHTML())
    ) {
      editor.commands.setContent(noteToHtml(field.value), {
        emitUpdate: false,
      });
    }
  }, [editor, field.value]);

  useEffect(() => {
    if (!editor) return;
    inputRef(editor.view.dom);
    editor.view.dom.id = id;
    editor.view.dom.setAttribute("aria-invalid", String(fieldState.invalid));
  }, [editor, inputRef, id, fieldState.invalid]);

  const tools = [
    {
      label: translate("resources.notes.editor.bold"),
      icon: Bold,
      active: state?.bold,
      run: () => editor?.chain().focus().toggleBold().run(),
    },
    {
      label: translate("resources.notes.editor.italic"),
      icon: Italic,
      active: state?.italic,
      run: () => editor?.chain().focus().toggleItalic().run(),
    },
    {
      label: translate("resources.notes.editor.underline"),
      icon: Underline,
      active: state?.underline,
      run: () => editor?.chain().focus().toggleUnderline().run(),
    },
    {
      label: translate("resources.notes.editor.heading"),
      icon: Heading,
      active: state?.heading,
      run: () => editor?.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      label: translate("resources.notes.editor.bullet_list"),
      icon: List,
      active: state?.bulletList,
      run: () => editor?.chain().focus().toggleBulletList().run(),
    },
    {
      label: translate("resources.notes.editor.ordered_list"),
      icon: ListOrdered,
      active: state?.orderedList,
      run: () => editor?.chain().focus().toggleOrderedList().run(),
    },
    {
      label: translate("resources.notes.editor.link"),
      icon: Link,
      active: state?.link,
      run: () => {
        const url = window.prompt(
          translate("resources.notes.editor.link"),
          editor?.getAttributes("link").href ?? "",
        );
        if (url === null) return;
        const chain = editor?.chain().focus().extendMarkRange("link");
        if (!url.trim()) chain?.unsetLink().run();
        else if (/^(https?:\/\/|mailto:|tel:)/i.test(url.trim()))
          chain?.setLink({ href: url.trim() }).run();
      },
    },
  ];

  return (
    <div>
      <div
        className="rounded-md border bg-background focus-within:ring-2 focus-within:ring-ring"
        aria-invalid={fieldState.invalid || undefined}
      >
        <div
          role="toolbar"
          aria-label={translate("resources.notes.editor.formatting")}
          className="flex flex-wrap gap-0.5 border-b p-1"
        >
          {tools.map(({ label, icon: Icon, active, run }) => (
            <Button
              key={label}
              type="button"
              variant={active ? "secondary" : "ghost"}
              size="icon"
              className="size-8"
              aria-label={label}
              title={label}
              aria-pressed={!!active}
              onMouseDown={(event) => event.preventDefault()}
              onClick={run}
            >
              <Icon className="size-4" />
            </Button>
          ))}
        </div>
        <div className="relative">
          {state?.empty && (
            <span className="pointer-events-none absolute top-3 left-3 text-muted-foreground">
              {label}
            </span>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>
      {fieldState.error && (
        <p className="text-sm text-destructive">
          <ValidationError error={fieldState.error.message ?? ""} />
        </p>
      )}
    </div>
  );
};
