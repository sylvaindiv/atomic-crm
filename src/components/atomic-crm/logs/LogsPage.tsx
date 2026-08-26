import { useRecordContext } from "ra-core";

import { DataTable } from "@/components/admin/data-table";
import { DateField } from "@/components/admin/date-field";
import { List } from "@/components/admin/list";
import { ReferenceField } from "@/components/admin/reference-field";

import type { RecordHistory } from "../types";

// Matches the singular labels in frenchCrmMessages.ts's `resources.*.name`.
const TABLE_LABELS: Record<string, string> = {
  contacts: "Juge-arbitre",
  companies: "Club",
  contact_notes: "Note",
  sales: "Utilisateur",
  tasks: "Tâche",
  tags: "Étiquette",
};

// Tables that belong to a contact (referee) via a contact_id FK — for these,
// showing the owning referee's name is more useful than the note/task id.
const CONTACT_CHILD_TABLES = new Set(["contact_notes", "tasks"]);

// Large/binary-ish fields aren't useful in a one-line summary.
const SUMMARY_SKIP_FIELDS = new Set([
  "avatar",
  "logo",
  "attachments",
  "context_links",
]);

// Shows the referee/club name (looked up live, so it reflects the current
// name even for old log entries) for contacts/companies; falls back to a
// generic "<type> #<id>" label for every other logged resource.
function ElementField() {
  const record = useRecordContext<RecordHistory>();
  if (!record) return null;
  const label = TABLE_LABELS[record.table_name] ?? record.table_name;
  if (record.table_name === "contacts" || record.table_name === "companies") {
    return (
      <ReferenceField
        source="record_id"
        reference={record.table_name}
        empty={`${label} #${record.record_id} (supprimé)`}
      />
    );
  }
  if (CONTACT_CHILD_TABLES.has(record.table_name)) {
    return (
      <ReferenceField
        source="record_id"
        reference={record.table_name}
        empty={`${label} #${record.record_id} (supprimée)`}
      >
        <span>
          {label} de{" "}
          <ReferenceField
            source="contact_id"
            reference="contacts"
            empty="juge-arbitre inconnu"
          />
        </span>
      </ReferenceField>
    );
  }
  return (
    <span>
      {label} #{record.record_id}
    </span>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "∅";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

// Renders the changed/created fields as "field: value, field: value, …".
// This is a snapshot of the write payload, not a before/after diff.
function DetailsField() {
  const record = useRecordContext<RecordHistory>();
  if (!record?.data) return null;
  const entries = Object.entries(record.data).filter(
    ([key, value]) => !SUMMARY_SKIP_FIELDS.has(key) && value !== undefined,
  );
  if (entries.length === 0) return null;
  return (
    <span className="text-sm text-muted-foreground">
      {entries
        .map(([key, value]) => `${key}: ${formatValue(value)}`)
        .join(", ")}
    </span>
  );
}

// Not registered as a <Resource> on purpose: no sidebar entry, no link
// anywhere in the app. Reachable only by navigating to /logs directly.
export function LogsPage() {
  return (
    <List
      resource="record_history"
      sort={{ field: "created_at", order: "DESC" }}
    >
      <DataTable>
        <DataTable.Col source="created_at" label="Date">
          <DateField source="created_at" showDate showTime />
        </DataTable.Col>
        <DataTable.Col source="table_name" label="Élément">
          <ElementField />
        </DataTable.Col>
        <DataTable.Col source="action" label="Action" />
        <DataTable.Col source="data" label="Détails">
          <DetailsField />
        </DataTable.Col>
      </DataTable>
    </List>
  );
}

LogsPage.path = "/logs";
