import jsonExport from "jsonexport/dist";
import {
  downloadCSV,
  InfiniteListBase,
  useGetIdentity,
  useListContext,
  useStore,
  type Exporter,
  type Identifier,
} from "ra-core";
import { useSearchParams } from "react-router";
import { BulkActionsToolbar } from "@/components/admin/bulk-actions-toolbar";
import { BulkDeleteButton } from "@/components/admin/bulk-delete-button";
import { BulkExportButton } from "@/components/admin/bulk-export-button";
import { ColumnsButton } from "@/components/admin/columns-button";
import { CreateButton } from "@/components/admin/create-button";
import { ExportButton } from "@/components/admin/export-button";
import { List } from "@/components/admin/list";
import { SelectAllButton } from "@/components/admin/select-all-button";
import { SortButton } from "@/components/admin/sort-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import type { Company, Contact, ContactNote, Sale, Tag } from "../types";
import { BulkTagButton } from "./BulkTagButton";
import { ContactEmpty } from "./ContactEmpty";
import { ContactImportButton } from "./ContactImportButton";
import { ContactListContentMobile } from "./ContactListContent";
import {
  ContactListFilterSummary,
  ContactListFilter,
} from "./ContactListFilter";
import { ContactShowSheet } from "./ContactShowSheet";
import { TopToolbar } from "../layout/TopToolbar";
import { InfinitePagination } from "../misc/InfinitePagination";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { ContactTable } from "./table/ContactTable";

export const ContactList = () => {
  const { identity } = useGetIdentity();
  const [searchParams] = useSearchParams();
  const showId = searchParams.get("show");

  if (!identity) return null;

  return (
    <List
      title={false}
      actions={<ContactListActions />}
      perPage={25}
      sort={{ field: "last_seen", order: "DESC" }}
      exporter={exporter}
    >
      <ContactListLayoutDesktop />
      <ContactShowSheet open={!!showId} id={showId ?? undefined} />
    </List>
  );
};

const ContactListLayoutDesktop = () => {
  const { data, isPending, filterValues } = useListContext();
  const [filterPanelOpen] = useStore<boolean>("contacts.filterPanelOpen", true);

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (isPending) return null;

  if (!data?.length && !hasFilters) return <ContactEmpty />;

  return (
    <div className="flex flex-row gap-8">
      {filterPanelOpen && <ContactListFilter />}
      <div className="w-full flex flex-col gap-4">
        <Card className="py-0">
          <ContactTable />
        </Card>
      </div>
      <BulkActionsToolbar>
        <ContactBulkActionButtons />
      </BulkActionsToolbar>
    </div>
  );
};

const ContactBulkActionButtons = () => (
  <>
    <SelectAllButton />
    <BulkTagButton />
    <BulkExportButton />
    <BulkDeleteButton />
  </>
);

const ContactListActions = () => {
  const [filterPanelOpen, setFilterPanelOpen] = useStore<boolean>(
    "contacts.filterPanelOpen",
    true,
  );

  return (
    <TopToolbar>
      <SortButton fields={["first_name", "last_name", "last_seen"]} />
      <ColumnsButton />
      <Button
        variant="ghost"
        size="icon"
        aria-label={filterPanelOpen ? "Hide filters" : "Show filters"}
        onClick={() => setFilterPanelOpen(!filterPanelOpen)}
        className="cursor-pointer"
      >
        {filterPanelOpen ? (
          <PanelLeftClose className="size-4" />
        ) : (
          <PanelLeftOpen className="size-4" />
        )}
      </Button>
      <ContactImportButton />
      <ExportButton exporter={exporter} />
      <CreateButton />
    </TopToolbar>
  );
};

export const ContactListMobile = () => {
  const { identity } = useGetIdentity();
  if (!identity) return null;

  return (
    <InfiniteListBase
      perPage={25}
      sort={{ field: "last_seen", order: "DESC" }}
      exporter={exporter}
      queryOptions={{
        onError: () => {
          /* Disable error notification as ContactListLayoutMobile handles it */
        },
      }}
    >
      <ContactListLayoutMobile />
    </InfiniteListBase>
  );
};

const ContactListLayoutMobile = () => {
  const { isPending, data, error, filterValues } = useListContext();

  const hasFilters = filterValues && Object.keys(filterValues).length > 0;

  if (!isPending && !data?.length && !hasFilters) return <ContactEmpty />;

  return (
    <div>
      <MobileHeader>
        <ContactListFilter />
      </MobileHeader>
      <MobileContent>
        <ContactListFilterSummary />
        <ContactListContentMobile />
        {!error && (
          <div className="flex justify-center">
            <InfinitePagination />
          </div>
        )}
      </MobileContent>
    </div>
  );
};

const exporter: Exporter<Contact> = async (
  records,
  fetchRelatedRecords,
  dataProvider,
) => {
  const companies = await fetchRelatedRecords<Company>(
    records,
    "company_id",
    "companies",
  );
  const sales = await fetchRelatedRecords<Sale>(records, "sales_id", "sales");
  const tags = await fetchRelatedRecords<Tag>(records, "tags", "tags");
  // contact.referred_by_name is denormalized on contacts_summary, but bulk
  // export (BulkExportButton) fetches records via getMany on the base
  // "contacts" resource, which doesn't carry summary-only fields -- so, like
  // company/sales above, re-resolve it explicitly rather than trust the spread.
  const referrers = await fetchRelatedRecords<Contact>(
    records,
    "referred_by_id",
    "contacts",
  );

  // Notes are 1-contact-to-many, so fetchRelatedRecords (keyed by a single
  // id per record) doesn't fit; fetch them all in one call instead. This is
  // a best-effort export of the two most recent notes as comment/comment_2
  // (the import counterpart of useContactImport) -- a contact with more than
  // two notes only gets the two most recent ones exported.
  const contactIds = records.map((contact) => contact.id);
  const { data: notes } = await dataProvider.getList<ContactNote>(
    "contact_notes",
    {
      filter: { "contact_id@in": `(${contactIds.join(",")})` },
      pagination: { page: 1, perPage: 10_000 },
      sort: { field: "date", order: "DESC" },
    },
  );
  const notesByContact = new Map<Identifier, ContactNote[]>();
  for (const note of notes) {
    const contactNotes = notesByContact.get(note.contact_id) ?? [];
    contactNotes.push(note);
    notesByContact.set(note.contact_id, contactNotes);
  }

  const contacts = records.map((contact) => {
    const recentNotes = notesByContact.get(contact.id) ?? [];
    const exportedContact = {
      ...contact,
      company:
        contact.company_id != null
          ? companies[contact.company_id].name
          : undefined,
      zipcode:
        contact.company_id != null
          ? companies[contact.company_id].zipcode
          : undefined,
      city:
        contact.company_id != null
          ? companies[contact.company_id].city
          : undefined,
      referred_by_name:
        contact.referred_by_id != null
          ? `${referrers[contact.referred_by_id].first_name ?? ""} ${
              referrers[contact.referred_by_id].last_name ?? ""
            }`.trim()
          : undefined,
      sales:
        contact.sales_id != null
          ? `${sales[contact.sales_id].first_name} ${sales[contact.sales_id].last_name}`
          : undefined,
      tags: contact.tags.map((tagId) => tags[tagId].name).join(", "),
      email_work: contact.email_jsonb?.find((email) => email.type === "Work")
        ?.email,
      email_home: contact.email_jsonb?.find((email) => email.type === "Home")
        ?.email,
      email_other: contact.email_jsonb?.find((email) => email.type === "Other")
        ?.email,
      email_jsonb: JSON.stringify(contact.email_jsonb),
      email_fts: undefined,
      phone_work: contact.phone_jsonb?.find((phone) => phone.type === "Work")
        ?.number,
      phone_home: contact.phone_jsonb?.find((phone) => phone.type === "Home")
        ?.number,
      phone_other: contact.phone_jsonb?.find((phone) => phone.type === "Other")
        ?.number,
      phone_jsonb: JSON.stringify(contact.phone_jsonb),
      phone_fts: undefined,
      comment: recentNotes[0]?.text,
      comment_2: recentNotes[1]?.text,
    };
    delete exportedContact.email_fts;
    delete exportedContact.phone_fts;
    return exportedContact;
  });
  return jsonExport(contacts, {}, (_err: any, csv: string) => {
    downloadCSV(csv, "contacts");
  });
};
