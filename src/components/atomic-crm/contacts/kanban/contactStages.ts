import { needsAction } from "../../misc/nextAction";
import type { ConfigurationContextValue } from "../../root/ConfigurationContext";
import type { Contact } from "../../types";

export type ContactsByStatus = Record<Contact["status"], Contact[]>;

// Kanban board is unpaginated — must fetch every contact, not a page.
export const KANBAN_PAGE_SIZE = 10_000;

// Every new contact starts with a blank `status` (no default in the schema,
// and the create form doesn't set one) -- give these their own column
// instead of silently dropping them, see getContactsByStatus below.
export const NO_STATUS = "";

// @hello-pangea/dnd's Droppable rejects an empty-string droppableId, so the
// NO_STATUS column needs a non-empty id for drag & drop -- translate to/from
// NO_STATUS at the DnD boundary only (see ContactKanban.tsx's onDragEnd).
export const NO_STATUS_DROPPABLE_ID = "no-status";

/**
 * Note statuses that are rendered as Kanban columns, in configuration
 * order. Reads the same `visibleInDealsKanban` flag the former deals
 * module's Kanban used (renaming this persisted configuration key is
 * deliberately out of scope, see TASK-004 ticket description).
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
 * per visible note status, in configuration order, plus a leading
 * NO_STATUS column for contacts with no status yet), each column sorted by
 * `index` -- contacts needing action (next action due today or overdue)
 * float to the top.
 *
 * A contact whose `status` is a real, configured status that's hidden from
 * the Kanban (`visibleInDealsKanban: false`, e.g. a closed/lost status) is
 * omitted from the result -- it never falls back to another column, and
 * its stored `status` is never rewritten.
 */
export const getContactsByStatus = (
  unorderedContacts: Contact[],
  noteStatuses: ConfigurationContextValue["noteStatuses"],
): ContactsByStatus => {
  if (!noteStatuses) return {};
  const visibleStatuses = getVisibleContactStatuses(noteStatuses);
  const columnValues = [...visibleStatuses.map((s) => s.value), NO_STATUS];
  const contactsByStatus: ContactsByStatus = columnValues.reduce(
    (obj, value) => ({ ...obj, [value]: [] }),
    {} as ContactsByStatus,
  );
  unorderedContacts.forEach((contact) => {
    if (contactsByStatus[contact.status]) {
      contactsByStatus[contact.status].push(contact);
    } else if (!contact.status) {
      contactsByStatus[NO_STATUS].push(contact);
    }
  });
  // Contacts that need action float to the top of their column; within
  // each group (needs-action / not), order is preserved by index.
  // Array.prototype.sort is stable, so a comparator that only decides the
  // needs-action group falls back to index untouched.
  columnValues.forEach((value) => {
    contactsByStatus[value] = contactsByStatus[value].sort(
      (recordA: Contact, recordB: Contact) =>
        Number(needsAction(recordB.next_action_due_date)) -
          Number(needsAction(recordA.next_action_due_date)) ||
        (recordA.index ?? 0) - (recordB.index ?? 0),
    );
  });
  return contactsByStatus;
};
