import type { Db } from "./types";

export const finalize = (db: Db) => {
  // set contact status according to the latest note
  db.contact_notes
    .sort((a, b) => new Date(a.date).valueOf() - new Date(b.date).valueOf())
    .forEach((note) => {
      db.contacts[note.contact_id as number].status = note.status;
    });

  setLinkedDealIds(db);
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
