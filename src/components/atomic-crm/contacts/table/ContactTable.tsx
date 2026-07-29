import { useRecordContext } from "ra-core";
import { Link } from "react-router";
import { DataTable } from "@/components/admin/data-table";

import { RelativeDate } from "../../misc/RelativeDate";
import type { Contact } from "../../types";
import { Avatar } from "../Avatar";
import { EditableCompanyCell } from "./EditableCompanyCell";
import { EditableEmailsCell } from "./EditableEmailsCell";
import { EditableGenderCell } from "./EditableGenderCell";
import { EditablePhonesCell } from "./EditablePhonesCell";
import { EditableReferredByCell } from "./EditableReferredByCell";
import { EditableSalesCell } from "./EditableSalesCell";
import { EditableStatusCell } from "./EditableStatusCell";
import { EditableTagsCell } from "./EditableTagsCell";
import { EditableTextCell } from "./EditableTextCell";

/**
 * Desktop content for the Contacts list: a dense, ~17-column table built on
 * `admin/data-table.tsx`'s `<DataTable>`.
 *
 * A handful of columns are read-only/navigate-only (avatar, name, task
 * count, last/first seen); the rest are the inline-editable cell families
 * built in TASK-005/006/007 (text, reference, list, status, tags), plus
 * `EditableGenderCell` completing that family for the one column it didn't
 * cover. `background` and `gender` start hidden via `defaultHiddenColumns`
 * to keep the default view dense — reveal them with `<ColumnsButton />`
 * (wired in `ContactList.tsx`).
 *
 * `rowClick={false}` departs from the old card list's (`ContactListContent`)
 * click-anywhere-to-navigate row: an editable cell must mutate on click,
 * never navigate. `name` is the sole exception — it renders its own `Link`
 * to the Show page, since disabling row click removes any other way to
 * reach it. See
 * `adr/ADR-66f03297-TASK-008-inline-editable-contact-table.md`.
 *
 * `bulkActionsToolbar={false}` suppresses `<DataTable>`'s own default
 * floating toolbar: `ContactListLayoutDesktop` already renders one, wired to
 * the CRM-specific `ContactBulkActionButtons`, as a sibling of this table's
 * `<Card>`. `bulkActionButtons` is left at its default so the row/select-all
 * checkbox column keeps rendering.
 */
export const ContactTable = () => (
  <DataTable
    rowClick={false}
    bulkActionsToolbar={false}
    defaultHiddenColumns={["background", "gender"]}
  >
    <DataTable.Col label={false}>
      <Avatar width={20} height={20} />
    </DataTable.Col>
    <DataTable.Col source="last_name" label="resources.contacts.fields.name">
      <ContactNameCell />
    </DataTable.Col>
    <DataTable.Col source="title">
      <EditableTextCell source="title" />
    </DataTable.Col>
    <DataTable.Col source="linkedin_url">
      <EditableTextCell source="linkedin_url" />
    </DataTable.Col>
    <DataTable.Col source="background">
      <EditableTextCell source="background" multiline />
    </DataTable.Col>
    <DataTable.Col source="gender">
      <EditableGenderCell />
    </DataTable.Col>
    <DataTable.Col source="company_id">
      <EditableCompanyCell />
    </DataTable.Col>
    <DataTable.Col source="referred_by_id">
      <EditableReferredByCell />
    </DataTable.Col>
    <DataTable.Col source="sales_id">
      <EditableSalesCell />
    </DataTable.Col>
    <DataTable.Col source="status">
      <EditableStatusCell />
    </DataTable.Col>
    <DataTable.Col source="email_jsonb">
      <EditableEmailsCell />
    </DataTable.Col>
    <DataTable.Col source="phone_jsonb">
      <EditablePhonesCell />
    </DataTable.Col>
    <DataTable.Col source="tags">
      <EditableTagsCell />
    </DataTable.Col>
    <DataTable.NumberCol source="nb_tasks" />
    <DataTable.Col source="last_seen">
      <ContactLastSeenCell />
    </DataTable.Col>
    <DataTable.Col source="first_seen">
      <ContactFirstSeenCell />
    </DataTable.Col>
  </DataTable>
);

/**
 * The table's sole navigation trigger (see module doc). `first_name` /
 * `last_name` stay required()-only-in-the-form, so this just displays them.
 */
const ContactNameCell = () => {
  const record = useRecordContext<Contact>();
  if (!record) return null;
  return (
    <Link
      to={`/contacts/${record.id}/show`}
      className="block w-full truncate px-2 py-1 font-medium hover:underline"
    >
      {record.first_name} {record.last_name}
    </Link>
  );
};

const ContactLastSeenCell = () => {
  const record = useRecordContext<Contact>();
  if (!record?.last_seen) return null;
  return <RelativeDate date={record.last_seen} />;
};

const ContactFirstSeenCell = () => {
  const record = useRecordContext<Contact>();
  if (!record?.first_seen) return null;
  return <RelativeDate date={record.first_seen} />;
};
