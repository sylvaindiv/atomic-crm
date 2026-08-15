import { needsAction } from "../../misc/nextAction";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import type { Contact } from "../../types";

export type ContactsByStatus = Record<Contact["status"], Contact[]>;

/**
 * Note statuses that are rendered as Kanban columns, in configuration
 * order. Reads the same `visibleInDealsKanban` flag the deals Kanban used
 * (renaming this persisted configuration key is deliberately out of scope,
 * see TASK-004 ticket description).
 *
 * A note status persisted before the flag existed has no such property on
 * it: treat a missing flag as visible, so a pre-existing configuration
 * never opens on an empty board.
 */
export const getVisibleContactStatuses = (
  noteStatuses: ConfigurationContextValue["noteStatuses"],
) => noteStatuses.filter((status) => status.visibleInDealsKanban !== false);

/**
 * Groups contacts by their `status` into the visible Kanban columns (one
 * per visible note status, in configuration order), each column sorted by
 * `index` -- contacts needing action (next action due today or overdue)
 * float to the top.
 *
 * A contact whose `status` matches no visible column is omitted from the
 * result -- it never falls back to the first column, and its stored
 * `status` is never rewritten. It simply stops appearing on the board
 * until a real status is assigned.
 */
export const getContactsByStatus = (
  unorderedContacts: Contact[],
  noteStatuses: ConfigurationContextValue["noteStatuses"],
): ContactsByStatus => {
  if (!noteStatuses) return {};
  const visibleStatuses = getVisibleContactStatuses(noteStatuses);
  const contactsByStatus: ContactsByStatus = visibleStatuses.reduce(
    (obj, status) => ({ ...obj, [status.value]: [] }),
    {} as ContactsByStatus,
  );
  unorderedContacts.forEach((contact) => {
    if (contactsByStatus[contact.status]) {
      contactsByStatus[contact.status].push(contact);
    }
  });
  // Contacts that need action float to the top of their column; within
  // each group (needs-action / not), order is preserved by index.
  // Array.prototype.sort is stable, so a comparator that only decides the
  // needs-action group falls back to index untouched.
  visibleStatuses.forEach((status) => {
    contactsByStatus[status.value] = contactsByStatus[status.value].sort(
      (recordA: Contact, recordB: Contact) =>
        Number(needsAction(recordB.next_action_due_date)) -
          Number(needsAction(recordA.next_action_due_date)) ||
        (recordA.index ?? 0) - (recordB.index ?? 0),
    );
  });
  return contactsByStatus;
};
