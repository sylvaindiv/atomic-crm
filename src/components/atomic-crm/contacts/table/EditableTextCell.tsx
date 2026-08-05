import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useRecordContext } from "ra-core";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

import type { Contact } from "../../types";
import { useUpdateContactField } from "./useUpdateContactField";

/** Contact columns holding a plain string value, safe for a text/textarea cell. */
type EditableTextField =
  | "title"
  | "linkedin_url"
  | "background"
  | "postal_code"
  | "city";

interface EditableTextCellProps {
  /** Contact column this cell reads and commits to. */
  source: EditableTextField;
  /** Renders a `Textarea` instead of a single-line `Input` (e.g. background notes). */
  multiline?: boolean;
}

/**
 * Click-to-edit table cell for a single text column on the current contact.
 *
 * Shows the plain value until clicked, then swaps in a focused, controlled
 * input (or textarea when `multiline`). Commits on blur or on Enter
 * (Shift+Enter inserts a newline in a textarea instead of committing);
 * reverts the draft on Escape without writing anything.
 */
export const EditableTextCell = ({
  source,
  multiline = false,
}: EditableTextCellProps) => {
  const record = useRecordContext<Contact>();
  const updateField = useUpdateContactField(source);
  const value = record?.[source] ?? "";

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isEditing) return;
    const target = multiline ? textareaRef.current : inputRef.current;
    target?.focus();
    target?.select();
  }, [isEditing, multiline]);

  if (!record) return null;

  const startEditing = () => {
    setDraft(value);
    setIsEditing(true);
  };

  const commit = () => {
    setIsEditing(false);
    if (draft !== value) {
      updateField(draft);
    }
  };

  const cancel = () => {
    setDraft(value);
    setIsEditing(false);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    } else if (event.key === "Enter" && !event.shiftKey) {
      // Shift+Enter inserts a newline in the textarea instead of committing.
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <div onClick={(event) => event.stopPropagation()}>
      {isEditing ? (
        multiline ? (
          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            className="min-h-16"
          />
        ) : (
          <Input
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
          />
        )
      ) : (
        <button
          type="button"
          onClick={startEditing}
          className={cn(
            "block w-full truncate rounded px-2 py-1 text-left hover:bg-accent",
            !value && "text-muted-foreground",
          )}
        >
          {value || "—"}
        </button>
      )}
    </div>
  );
};
