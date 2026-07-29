import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { useTranslate } from "ra-core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { translatePersonalInfoTypeLabel } from "../contactModel";

/** The `type` tag shared by both email and phone entries (see `Contact` in `../../types`). */
export type PersonalInfoType = "Work" | "Home" | "Other";

/**
 * Normalized shape `EditableListCell` operates on, regardless of the
 * underlying Contact column's value key (`email` on `EmailAndType`, `number`
 * on `PhoneNumberAndType`). Concrete cells map to/from their own column type.
 */
export interface EditableListEntry {
  value: string;
  type: PersonalInfoType;
}

interface EditableListCellProps {
  /** Current array value, e.g. the contact's emails or phone numbers. */
  entries: EditableListEntry[];
  /**
   * Persists the next full array. Wired to `useUpdateContactField` by the
   * concrete cell (e.g. `EditableEmailsCell`), so every call is a
   * single-column optimistic update — never a per-entry round-trip.
   */
  onCommit: (entries: EditableListEntry[]) => void;
  /** Placeholder (and accessible label) for the value input, e.g. "Email". */
  placeholder: string;
  /** Label of the "add a row" button, e.g. "Add email". */
  addLabel: string;
}

const PERSONAL_INFO_TYPES: PersonalInfoType[] = ["Work", "Home", "Other"];

const createEntry = (): EditableListEntry => ({ value: "", type: "Work" });

const sameEntries = (a: EditableListEntry[], b: EditableListEntry[]) =>
  JSON.stringify(a) === JSON.stringify(b);

/**
 * Generic popover editor for a Contact array-of-object column (emails, phone
 * numbers, ...): add, remove, or edit entries, each holding a text `value`
 * and a `type` ("Work" | "Home" | "Other").
 *
 * Mirrors `TagsListEdit`'s add/remove shape, but unlike tags these entries
 * have no identity of their own (no id, no separate resource) — the whole
 * array is always the unit of commit. Built without `useInput()` /
 * `admin/*-input.tsx`: this cell renders inside a `DataTable` row, not a
 * react-hook-form ancestor, so it manages its own draft state instead.
 *
 * Add, remove, and type changes commit immediately (one discrete action, one
 * commit), matching `EditableBooleanCell`'s always-live toggle. Editing a
 * value keeps a local draft while focused and commits on blur or Enter,
 * matching `EditableTextCell`, so typing doesn't issue a request per
 * keystroke. The draft resets from `entries` each time the popover opens, so
 * it always starts from the latest server state.
 *
 * The popover content portals to `document.body` (Radix), but a click
 * originating inside it still bubbles through the React tree (not the DOM
 * tree) up to the wrapping `stopPropagation` guard below — the same guard
 * `EditableTagsCell` / `EditableStatusCell` copy from `data-table.tsx`'s row
 * click handler, so opening or using this editor never triggers row
 * navigation.
 */
export const EditableListCell = ({
  entries,
  onCommit,
  placeholder,
  addLabel,
}: EditableListCellProps) => {
  const translate = useTranslate();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(entries);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) setDraft(entries);
    setOpen(nextOpen);
  };

  const commit = (next: EditableListEntry[]) => {
    setDraft(next);
    onCommit(next);
  };

  const handleAdd = () => commit([...draft, createEntry()]);

  const handleRemove = (index: number) =>
    commit(draft.filter((_, i) => i !== index));

  const handleTypeChange = (index: number, type: PersonalInfoType) =>
    commit(draft.map((entry, i) => (i === index ? { ...entry, type } : entry)));

  const handleValueChange = (index: number, value: string) =>
    setDraft(
      draft.map((entry, i) => (i === index ? { ...entry, value } : entry)),
    );

  const handleValueBlur = () => {
    if (!sameEntries(draft, entries)) onCommit(draft);
  };

  const handleValueKeyDown = (
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === "Escape") {
      event.preventDefault();
      // Falls back to the current draft entry (no-op revert) if `entries`
      // hasn't caught up yet with a just-added row at this index.
      setDraft(
        draft.map((entry, i) =>
          i === index ? (entries[index] ?? entry) : entry,
        ),
      );
      event.currentTarget.blur();
    }
  };

  const summary = entries
    .map((entry) => entry.value)
    .filter(Boolean)
    .join(", ");

  return (
    <div onClick={(event) => event.stopPropagation()}>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "block w-full truncate rounded px-2 py-1 text-left hover:bg-accent",
              !summary && "text-muted-foreground",
            )}
          >
            {summary || "—"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="flex flex-col gap-2">
            {draft.map((entry, index) => (
              <div key={index} className="flex items-center gap-1">
                <Input
                  value={entry.value}
                  placeholder={placeholder}
                  aria-label={placeholder}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    handleValueChange(index, event.target.value)
                  }
                  onBlur={handleValueBlur}
                  onKeyDown={(event) => handleValueKeyDown(index, event)}
                  className="flex-1"
                />
                <Select
                  value={entry.type}
                  onValueChange={(type) =>
                    handleTypeChange(index, type as PersonalInfoType)
                  }
                >
                  <SelectTrigger
                    size="sm"
                    className="w-24 min-w-24"
                    aria-label={translate("resources.contacts.fields.type", {
                      _: "Type",
                    })}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONAL_INFO_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {translatePersonalInfoTypeLabel(type, translate)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  aria-label={translate("ra.action.remove", {
                    _: `Remove ${entry.value || placeholder}`,
                  })}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="cursor-pointer"
              onClick={handleAdd}
            >
              <Plus className="w-4 h-4 mr-1" />
              {addLabel}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};
