import { useRecordContext, useTranslate } from "ra-core";

import type { Contact } from "../../types";
import { EditableReferenceCell } from "./EditableReferenceCell";

/**
 * Table-cell wrapper around `EditableReferenceCell` for the contact's
 * referrer (`referred_by_id`).
 *
 * Excludes the current record from its own options — a contact cannot
 * refer itself (see adr/ADR-c7993f35-TASK-001-referred-by-self-fk.md).
 */
export const EditableReferredByCell = () => {
  const record = useRecordContext<Contact>();
  const translate = useTranslate();

  if (!record) return null;

  return (
    <EditableReferenceCell<Contact>
      source="referred_by_id"
      reference="contacts"
      label={translate("resources.contacts.fields.referred_by_id")}
      displayValue={record.referred_by_name}
      optionText={(contact) => `${contact.first_name} ${contact.last_name}`}
      sort={{ field: "last_name", order: "ASC" }}
      filter={{ "id@neq": record.id }}
      nullable
    />
  );
};
