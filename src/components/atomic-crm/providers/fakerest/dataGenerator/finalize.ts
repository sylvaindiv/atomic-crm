import type { Db } from "./types";

export const finalize = (db: Db) => {
  // set contact status according to the latest note
  db.contact_notes
    .sort((a, b) => new Date(a.date).valueOf() - new Date(b.date).valueOf())
    .forEach((note) => {
      db.contacts[note.contact_id as number].status = note.status;
    });

  setContactNextActionDueDates(db);
};

/**
 * Mirrors the contacts_summary view's `next_action_due_date` computed
 * column: each contact's earliest open (not done) task due_date. Backs the
 * contacts Kanban's needs-action column sort, countdown chip and "To
 * handle" filter (TASK-004).
 */
const setContactNextActionDueDates = (db: Db) => {
  db.contacts.forEach((contact) => {
    const openDueDates = db.tasks
      .filter((t) => t.contact_id === contact.id && !t.done_date)
      .map((t) => t.due_date)
      .sort();
    contact.next_action_due_date = openDueDates[0] ?? null;
  });
};
