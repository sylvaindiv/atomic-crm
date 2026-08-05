import { useRecordContext, useTranslate } from "ra-core";

import type { Contact, Sale } from "../../types";
import { EditableReferenceCell } from "./EditableReferenceCell";

/**
 * Table-cell wrapper around `EditableReferenceCell` for the contact's
 * account manager (`sales_id`).
 *
 * Unlike company/referred-by, `contacts_summary` has no denormalized sales
 * name, so this cell fetches the whole (small, bounded) sales list once —
 * `alwaysFetch` — and lets `EditableReferenceCell` resolve the closed-cell
 * label from it. Every row requests the exact same query, so the
 * data-fetching cache dedupes it to a single request for the whole table,
 * the same trick `useTags` uses for the (also small) tags reference.
 */
export const EditableSalesCell = () => {
  const record = useRecordContext<Contact>();
  const translate = useTranslate();

  if (!record) return null;

  return (
    <EditableReferenceCell<Sale>
      source="sales_id"
      reference="sales"
      label={translate("resources.contacts.fields.sales_id")}
      optionText={(sale) => `${sale.first_name} ${sale.last_name}`}
      sort={{ field: "last_name", order: "ASC" }}
      filter={{ "disabled@neq": true }}
      alwaysFetch
    />
  );
};
