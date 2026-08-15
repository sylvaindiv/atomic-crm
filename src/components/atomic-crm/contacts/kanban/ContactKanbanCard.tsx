import {
  Draggable,
  type DraggableProvided,
  type DraggableStateSnapshot,
} from "@hello-pangea/dnd";
import { RecordContextProvider, useTranslate } from "ra-core";
import type { CSSProperties } from "react";
import { Link, useSearchParams } from "react-router";
import { Card, CardContent } from "@/components/ui/card";

import { formatDealAmount } from "../../misc/formatAmount";
import { NextActionChip } from "../../misc/NextActionChip";
import { useConfigurationContext } from "../../root/ConfigurationContext";
import type { Contact } from "../../types";
import { Avatar } from "../Avatar";

export const ContactKanbanCard = ({
  contact,
  index,
}: {
  contact: Contact;
  index: number;
}) => {
  if (!contact) return null;

  return (
    <Draggable draggableId={String(contact.id)} index={index}>
      {(provided, snapshot) => (
        <ContactKanbanCardContent
          provided={provided}
          snapshot={snapshot}
          contact={contact}
        />
      )}
    </Draggable>
  );
};

const ContactKanbanCardContent = ({
  provided,
  snapshot,
  contact,
}: {
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  contact: Contact;
}) => {
  const { currency } = useConfigurationContext();
  const [searchParams] = useSearchParams();

  // Opens the contact through the same `?show=<id>` sheet the table view's
  // name cell uses, rather than a full-page redirect -- keeps navigation
  // consistent across the two views (see `contacts/table/ContactTable.tsx`).
  const params = new URLSearchParams(searchParams);
  params.set("show", String(contact.id));

  return (
    <Link
      to={`?${params.toString()}`}
      className="block cursor-pointer"
      {...provided.draggableProps}
      // @hello-pangea/dnd's `DraggingStyle` predates this project's
      // `--radix-*` CSS custom-property augmentation of `CSSProperties` --
      // same object, narrower type expected by `Link`.
      style={provided.draggableProps.style as CSSProperties}
      {...provided.dragHandleProps}
      ref={provided.innerRef}
    >
      <RecordContextProvider value={contact}>
        <Card
          className={`rounded-none border-0 py-3 transition-all duration-200 ${
            snapshot.isDragging ? "opacity-90 shadow-lg" : "hover:bg-muted/50"
          }`}
        >
          <CardContent className="px-3 flex flex-col">
            <div className="flex-1 flex">
              <p className="flex-1 text-sm font-medium mb-1">
                {contact.first_name} {contact.last_name}
              </p>
              <Avatar width={20} height={20} />
            </div>
            {contact.company_name && (
              <ContactCompanySubRow companyName={contact.company_name} />
            )}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {formatDealAmount(contact.amount, currency)}
              </p>
              <NextActionChip dueDate={contact.next_action_due_date} />
            </div>
          </CardContent>
        </Card>
      </RecordContextProvider>
    </Link>
  );
};

// Small muted sub-row showing the contact's club, as indicative context
// only -- unlike the deal card, a contact card never hides it (there is no
// separate case-type distinction to repeat).
const ContactCompanySubRow = ({ companyName }: { companyName: string }) => {
  const translate = useTranslate();
  return (
    <p className="text-xs text-muted-foreground truncate mb-1">
      <span className="sr-only">
        {translate("resources.contacts.fields.company_id")}:{" "}
      </span>
      {companyName}
    </p>
  );
};
