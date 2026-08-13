import type { Db } from "./types";

export const finalize = (db: Db) => {
  // set contact status according to the latest note
  db.contact_notes
    .sort((a, b) => new Date(a.date).valueOf() - new Date(b.date).valueOf())
    .forEach((note) => {
      db.contacts[note.contact_id as number].status = note.status;
    });

  setLinkedDealIds(db);
  setDealSummaryFields(db);
};

/**
 * Mirrors the contacts_summary view's `linked_deal_id` computed column: for
 * each contact, the most recent non-archived 'judge' deal it is a party to.
 */
const setLinkedDealIds = (db: Db) => {
  const judgeDeals = db.deals
    .filter((deal) => deal.case_type === "judge" && !deal.archived_at)
    .sort(
      (a, b) =>
        new Date(b.created_at).valueOf() - new Date(a.created_at).valueOf(),
    );

  db.contacts.forEach((contact) => {
    const linkedDeal = judgeDeals.find((deal) =>
      deal.contact_ids.includes(contact.id),
    );
    contact.linked_deal_id = linkedDeal?.id ?? null;
  });
};

/**
 * Mirrors the deals_summary view's computed columns: contact_name (from
 * contact_ids[0]), club_name (linked company for 'club' deals, or the
 * referee's company for 'judge' deals) and next_action_due_date (earliest
 * open task's due_date of contact_ids[0]).
 */
const setDealSummaryFields = (db: Db) => {
  db.deals.forEach((deal) => {
    const primaryContactId = deal.contact_ids?.[0];
    const primaryContact = db.contacts.find((c) => c.id === primaryContactId);

    deal.contact_name = primaryContact
      ? `${primaryContact.first_name ?? ""} ${primaryContact.last_name ?? ""}`.trim()
      : null;

    const clubCompanyId =
      deal.case_type === "club" ? deal.company_id : primaryContact?.company_id;
    const clubCompany = db.companies.find((c) => c.id === clubCompanyId);
    deal.club_name = clubCompany?.name ?? null;

    const openDueDates = db.tasks
      .filter((t) => t.contact_id === primaryContactId && !t.done_date)
      .map((t) => t.due_date)
      .sort();
    deal.next_action_due_date = openDueDates[0] ?? null;
  });
};
