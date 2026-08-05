import { useRecordContext } from "ra-core";
import { Link, useSearchParams } from "react-router";
import { DataTable } from "@/components/admin/data-table";

import { RelativeDate } from "../../misc/RelativeDate";
import { useConfigurationContext } from "../../root/ConfigurationContext";
import type { Contact } from "../../types";

import { EditableCompanyCell } from "./EditableCompanyCell";
import { EditableEmailsCell } from "./EditableEmailsCell";
import { EditableGenderCell } from "./EditableGenderCell";
import { EditablePhonesCell } from "./EditablePhonesCell";
import { EditableReferredByCell } from "./EditableReferredByCell";
import { EditableSalesCell } from "./EditableSalesCell";
import { EditableStatusCell } from "./EditableStatusCell";
import { EditableTagsCell } from "./EditableTagsCell";
import { EditableTextCell } from "./EditableTextCell";
import { LatestNoteCell } from "./LatestNoteCell";

/**
 * Desktop content for the Contacts list: a dense, ~17-column table built on
 * `admin/data-table.tsx`'s `<DataTable>`.
 *
 * A handful of columns are read-only/navigate-only (avatar, name, task
 * count, last/first seen); the rest are the inline-editable cell families
 * built in TASK-005/006/007 (text, reference, list, status, tags), plus
 * `EditableGenderCell` completing that family for the one column it didn't
 * cover. `background` and `gender` start hidden via `hiddenColumns`
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
 *
 * The wrapping `<div>` tightens font size and cell padding for a denser
 * view, scoped to this table via descendant selectors (the shared
 * `admin/data-table.tsx` / `ui/table.tsx` primitives are left untouched).
 * Each row is also tinted 10% by its `status` color: `rowStyle` sets a
 * `--row-status-tint` CSS custom property via `color-mix()`, and
 * `rowClassName` applies it through the static Tailwind arbitrary class
 * `bg-(--row-status-tint)` rather than a raw inline `backgroundColor`, so
 * `TableRow`'s existing `hover:bg-muted/50` and
 * `data-[state=selected]:bg-muted` keep winning by CSS specificity.
 */
export const ContactTable = () => {
  const { noteStatuses } = useConfigurationContext();

  const getStatusTint = (record: Contact) => {
    if (!record.status) return undefined;
    return noteStatuses.find((status) => status.value === record.status);
  };

  return (
    <div className="text-xs [&_td]:px-1.5 [&_td]:py-0.5 [&_th]:px-1.5 [&_th]:h-7">
      <DataTable
        rowClick={false}
        bulkActionsToolbar={false}
        hiddenColumns={["gender"]}
        resizableColumns
        rowClassName={(record: Contact) =>
          getStatusTint(record) ? "bg-(--row-status-tint)" : undefined
        }
        rowStyle={(record: Contact) => {
          const statusTint = getStatusTint(record);
          if (!statusTint) return undefined;
          return {
            "--row-status-tint": `color-mix(in srgb, ${statusTint.color} 10%, transparent)`,
          } as React.CSSProperties;
        }}
      >
        <DataTable.Col
          source="last_name"
          label="resources.contacts.fields.name"
        >
          <ContactNameCell />
        </DataTable.Col>
        <DataTable.Col source="title">
          <EditableTextCell source="title" />
        </DataTable.Col>
        <DataTable.Col source="linkedin_url">
          <EditableTextCell source="linkedin_url" />
        </DataTable.Col>
        <DataTable.Col
          source="latest_note_text"
          label="resources.contacts.fields.latest_note_text"
        >
          <LatestNoteCell />
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
    </div>
  );
};

/**
 * The table's sole navigation trigger (see module doc). `first_name` /
 * `last_name` stay required()-only-in-the-form, so this just displays them.
 */
const ContactNameCell = () => {
  const record = useRecordContext<Contact>();
  const [searchParams] = useSearchParams();
  if (!record) return null;
  const params = new URLSearchParams(searchParams);
  params.set("show", String(record.id));
  return (
    <Link
      to={`?${params.toString()}`}
      className="block w-full truncate px-2 py-0.5 font-medium hover:underline"
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
