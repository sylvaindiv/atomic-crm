import { useRecordContext, useTranslate } from "ra-core";

import type { Contact } from "../../types";
import { EditableListCell, type EditableListEntry } from "./EditableListCell";
import { useUpdateContactField } from "./useUpdateContactField";

const toEntries = (
  phones: Contact["phone_jsonb"],
): EditableListEntry[] =>
  (phones ?? []).map((phone) => ({ value: phone.number, type: phone.type }));

const toPhoneJsonb = (entries: EditableListEntry[]): Contact["phone_jsonb"] =>
  entries.map((entry) => ({ number: entry.value, type: entry.type }));

/**
 * Table-cell editor for the contact's phone numbers (`phone_jsonb`).
 *
 * Thin adapter over `EditableListCell`: maps the column's `{ number, type }`
 * shape to the cell's generic `{ value, type }` entry and back, committing
 * through `useUpdateContactField("phone_jsonb")` (single-column optimistic
 * update).
 */
export const EditablePhonesCell = () => {
  const record = useRecordContext<Contact>();
  const updateField = useUpdateContactField("phone_jsonb");
  const translate = useTranslate();

  if (!record) return null;

  return (
    <EditableListCell
      entries={toEntries(record.phone_jsonb)}
      onCommit={(entries) => updateField(toPhoneJsonb(entries))}
      placeholder={translate("resources.contacts.fields.phone_number", {
        _: "Phone number",
      })}
      addLabel={translate("resources.contacts.action.add_phone_number", {
        _: "Add phone number",
      })}
    />
  );
};
