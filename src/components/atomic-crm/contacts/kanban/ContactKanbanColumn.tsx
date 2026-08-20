import { Droppable } from "@hello-pangea/dnd";

import { formatDealAmount } from "../../misc/formatAmount";
import { Status } from "../../misc/Status";
import { useConfigurationContext } from "../../root/ConfigurationContext";
import type { Contact } from "../../types";
import { ContactKanbanCard } from "./ContactKanbanCard";
import { NO_STATUS, NO_STATUS_DROPPABLE_ID } from "./contactStages";

export const ContactKanbanColumn = ({
  status,
  label,
  contacts,
}: {
  status: string;
  label: string;
  contacts: Contact[];
}) => {
  const totalAmount = contacts.reduce(
    (sum, contact) => sum + (contact.amount ?? 0),
    0,
  );
  const { currency } = useConfigurationContext();
  return (
    // `role="group"` + `aria-label` give each column an accessible,
    // stable identity (also the e2e drag-and-drop test's scoping locator)
    // beyond its purely visual heading.
    <div className="flex-1 min-w-0 pb-8" role="group" aria-label={label}>
      <div className="flex flex-col items-center">
        <h3 className="text-base font-medium flex items-center">
          <Status status={status} />
          {label}
        </h3>
        <p className="text-sm text-muted-foreground">
          {formatDealAmount(totalAmount, currency)}
        </p>
      </div>
      <Droppable
        droppableId={status === NO_STATUS ? NO_STATUS_DROPPABLE_ID : status}
      >
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={`flex flex-col mt-2 divide-y divide-border ${
              snapshot.isDraggingOver ? "bg-muted" : ""
            }`}
          >
            {contacts.map((contact, index) => (
              <ContactKanbanCard
                key={contact.id}
                contact={contact}
                index={index}
              />
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
