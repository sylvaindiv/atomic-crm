import { useRecordContext, useTranslate } from "ra-core";

import type { Contact } from "../../types";
import { EditableListCell, type EditableListEntry } from "./EditableListCell";
import { useUpdateContactField } from "./useUpdateContactField";

const toEntries = (
  emails: Contact["email_jsonb"],
): EditableListEntry[] =>
  (emails ?? []).map((email) => ({ value: email.email, type: email.type }));

const toEmailJsonb = (entries: EditableListEntry[]): Contact["email_jsonb"] =>
  entries.map((entry) => ({ email: entry.value, type: entry.type }));

/**
 * Table-cell editor for the contact's email addresses (`email_jsonb`).
 *
 * Thin adapter over `EditableListCell`: maps the column's `{ email, type }`
 * shape to the cell's generic `{ value, type }` entry and back, committing
 * through `useUpdateContactField("email_jsonb")` (single-column optimistic
 * update).
 */
export const EditableEmailsCell = () => {
  const record = useRecordContext<Contact>();
  const updateField = useUpdateContactField("email_jsonb");
  const translate = useTranslate();

  if (!record) return null;

  return (
    <EditableListCell
      entries={toEntries(record.email_jsonb)}
      onCommit={(entries) => updateField(toEmailJsonb(entries))}
      placeholder={translate("resources.contacts.fields.email", {
        _: "Email",
      })}
      addLabel={translate("resources.contacts.action.add_email", {
        _: "Add email",
      })}
    />
  );
};
