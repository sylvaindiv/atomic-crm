import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import isEqual from "lodash/isEqual";
import {
  useDataProvider,
  useListContext,
  useTranslate,
  type DataProvider,
} from "ra-core";
import { useEffect, useState } from "react";

import { useConfigurationContext } from "../../root/ConfigurationContext";
import type { Contact } from "../../types";
import { ContactKanbanColumn } from "./ContactKanbanColumn";
import type { ContactsByStatus } from "./contactStages";
import {
  getContactsByStatus,
  getVisibleContactStatuses,
  KANBAN_PAGE_SIZE,
  NO_STATUS,
  NO_STATUS_DROPPABLE_ID,
} from "./contactStages";

const toStatusValue = (droppableId: string) =>
  droppableId === NO_STATUS_DROPPABLE_ID ? NO_STATUS : droppableId;

/**
 * Contacts Kanban board: one column per note status flagged visible in the
 * Kanban (`contactStages.ts`), drag & drop across and within columns
 * persisting `status` + `index` on the `contacts` resource. Ported from
 * the former deals module's Kanban (TASK-004) -- see
 * `adr/ADR-33662640-TASK-001-fold-deals-into-contacts.md` for why it
 * moved onto contacts.
 */
export const ContactKanban = () => {
  const translate = useTranslate();
  const { noteStatuses } = useConfigurationContext();
  const visibleStatuses = getVisibleContactStatuses(noteStatuses);
  // Leading column for contacts with no status yet (the default for every
  // new contact) -- not a configured note status, so it's prepended here
  // rather than living in noteStatuses.
  const columns = [
    {
      value: NO_STATUS,
      label: translate("resources.contacts.background.status_none"),
    },
    ...visibleStatuses,
  ];
  const {
    data: unorderedContacts,
    isPending,
    refetch,
  } = useListContext<Contact>();
  const dataProvider = useDataProvider();

  const [contactsByStatus, setContactsByStatus] = useState<ContactsByStatus>(
    getContactsByStatus([], noteStatuses),
  );

  useEffect(() => {
    if (unorderedContacts) {
      const newContactsByStatus = getContactsByStatus(
        unorderedContacts,
        noteStatuses,
      );
      if (!isEqual(newContactsByStatus, contactsByStatus)) {
        setContactsByStatus(newContactsByStatus);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unorderedContacts, noteStatuses]);

  if (isPending) return null;

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;

    if (!destination) {
      return;
    }

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const sourceStatus = toStatusValue(source.droppableId);
    const destinationStatus = toStatusValue(destination.droppableId);
    const sourceContact = contactsByStatus[sourceStatus][source.index]!;
    const destinationContact = contactsByStatus[destinationStatus][
      destination.index
    ] ?? {
      status: destinationStatus,
      index: undefined, // undefined if dropped after the last item
    };

    // compute local state change synchronously
    setContactsByStatus(
      updateContactStatusLocal(
        sourceContact,
        { status: sourceStatus, index: source.index },
        { status: destinationStatus, index: destination.index },
        contactsByStatus,
      ),
    );

    // persist the changes
    updateContactStatus(sourceContact, destinationContact, dataProvider).then(
      () => {
        refetch();
      },
    );
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex divide-x divide-border">
        {columns.map((status) => (
          <ContactKanbanColumn
            status={status.value}
            label={status.label}
            contacts={contactsByStatus[status.value] ?? []}
            key={status.value}
          />
        ))}
      </div>
    </DragDropContext>
  );
};

const updateContactStatusLocal = (
  sourceContact: Contact,
  source: { status: string; index: number },
  destination: {
    status: string;
    index?: number; // undefined if dropped after the last item
  },
  contactsByStatus: ContactsByStatus,
) => {
  if (source.status === destination.status) {
    // moving contact inside the same column
    const column = contactsByStatus[source.status];
    column.splice(source.index, 1);
    column.splice(destination.index ?? column.length + 1, 0, sourceContact);
    return {
      ...contactsByStatus,
      [destination.status]: column,
    };
  } else {
    // moving contact across columns
    const sourceColumn = contactsByStatus[source.status];
    const destinationColumn = contactsByStatus[destination.status];
    sourceColumn.splice(source.index, 1);
    destinationColumn.splice(
      destination.index ?? destinationColumn.length + 1,
      0,
      sourceContact,
    );
    return {
      ...contactsByStatus,
      [source.status]: sourceColumn,
      [destination.status]: destinationColumn,
    };
  }
};

// NO_STATUS covers both NULL and "" (see server/filter.mjs's isblank
// operator) -- an exact-match `status` filter would only catch "", so
// blank-status contacts must be fetched with isblank instead.
const statusFilter = (status: string) =>
  status === NO_STATUS ? { "status@isblank": true } : { status };

// Persists a drag & drop move on the `contacts` resource. Only ever sends
// `status` and/or `index` in the update payload -- never any other contact
// field -- and issues one update per moved card (never a full-column
// rewrite where avoidable).
const updateContactStatus = async (
  source: Contact,
  destination: {
    status: string;
    index?: number; // undefined if dropped after the last item
  },
  dataProvider: DataProvider,
) => {
  if (source.status === destination.status) {
    // moving contact inside the same column
    // Fetch all the contacts in this status (because the list may be
    // filtered, but we need to update even non-filtered contacts)
    const { data: columnContacts } = await dataProvider.getList<Contact>(
      "contacts",
      {
        sort: { field: "index", order: "ASC" },
        pagination: { page: 1, perPage: KANBAN_PAGE_SIZE },
        filter: statusFilter(source.status),
      },
    );
    const destinationIndex = destination.index ?? columnContacts.length + 1;
    const sourceIndex = source.index ?? 0;

    if (sourceIndex > destinationIndex) {
      // contact moved up, eg
      // dest   src
      //  <------
      // [4, 7, 23, 5]
      await Promise.all([
        // for all contacts between destinationIndex and sourceIndex, increase the index
        ...columnContacts
          .filter(
            (contact) =>
              (contact.index ?? 0) >= destinationIndex &&
              (contact.index ?? 0) < sourceIndex,
          )
          .map((contact) =>
            dataProvider.update("contacts", {
              id: contact.id,
              data: { index: (contact.index ?? 0) + 1 },
              previousData: contact,
            }),
          ),
        // for the contact that was moved, update its index
        dataProvider.update("contacts", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source,
        }),
      ]);
    } else {
      // contact moved down, e.g
      // src   dest
      //  ------>
      // [4, 7, 23, 5]
      await Promise.all([
        // for all contacts between sourceIndex and destinationIndex, decrease the index
        ...columnContacts
          .filter(
            (contact) =>
              (contact.index ?? 0) <= destinationIndex &&
              (contact.index ?? 0) > sourceIndex,
          )
          .map((contact) =>
            dataProvider.update("contacts", {
              id: contact.id,
              data: { index: (contact.index ?? 0) - 1 },
              previousData: contact,
            }),
          ),
        // for the contact that was moved, update its index
        dataProvider.update("contacts", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source,
        }),
      ]);
    }
  } else {
    // moving contact across columns
    // Fetch all the contacts in both statuses (because the list may be
    // filtered, but we need to update even non-filtered contacts)
    const [{ data: sourceContacts }, { data: destinationContacts }] =
      await Promise.all([
        dataProvider.getList<Contact>("contacts", {
          sort: { field: "index", order: "ASC" },
          pagination: { page: 1, perPage: KANBAN_PAGE_SIZE },
          filter: statusFilter(source.status),
        }),
        dataProvider.getList<Contact>("contacts", {
          sort: { field: "index", order: "ASC" },
          pagination: { page: 1, perPage: KANBAN_PAGE_SIZE },
          filter: statusFilter(destination.status),
        }),
      ]);
    const destinationIndex =
      destination.index ?? destinationContacts.length + 1;
    const sourceIndex = source.index ?? 0;

    await Promise.all([
      // decrease index on the contacts after the source index in the source column
      ...sourceContacts
        .filter((contact) => (contact.index ?? 0) > sourceIndex)
        .map((contact) =>
          dataProvider.update("contacts", {
            id: contact.id,
            data: { index: (contact.index ?? 0) - 1 },
            previousData: contact,
          }),
        ),
      // increase index on the contacts after the destination index in the destination column
      ...destinationContacts
        .filter((contact) => (contact.index ?? 0) >= destinationIndex)
        .map((contact) =>
          dataProvider.update("contacts", {
            id: contact.id,
            data: { index: (contact.index ?? 0) + 1 },
            previousData: contact,
          }),
        ),
      // change the dragged contact to take the destination index and column
      dataProvider.update("contacts", {
        id: source.id,
        data: {
          index: destinationIndex,
          status: destination.status,
        },
        previousData: source,
      }),
    ]);
  }
};
