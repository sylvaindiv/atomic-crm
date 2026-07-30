import {
  RecordContextProvider,
  RecordRepresentation,
  useListContext,
  useTimeout,
  useTranslate,
} from "ra-core";
import { Link } from "react-router";
import { ReferenceField } from "@/components/admin/reference-field";
import { TextField } from "@/components/admin/text-field";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";

import { Status } from "../misc/Status";
import type { Contact } from "../types";
import { Avatar } from "./Avatar";

export const ContactListContentMobile = () => {
  const translate = useTranslate();
  const {
    data: contacts,
    error,
    isPending,
    refetch,
  } = useListContext<Contact>();
  const oneSecondHasPassed = useTimeout(1000);

  if (isPending) {
    if (!oneSecondHasPassed) {
      return null;
    }
    return (
      <>
        {[...Array(5)].map((_, index) => (
          <div
            key={index}
            className="flex flex-row items-center py-2 hover:bg-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
          >
            <div className="flex flex-row gap-4 items-center mr-4">
              <Skeleton className="w-10 h-10 rounded-full" />
            </div>
            <div className="flex-1 min-w-0">
              <Skeleton className="w-32 h-5 mb-2" />
              <Skeleton className="w-48 h-4" />
            </div>
          </div>
        ))}
      </>
    );
  }

  if (error && !contacts) {
    return (
      <div className="p-4">
        <div className="text-center text-muted-foreground mb-4">
          {translate("resources.contacts.list.error_loading")}
        </div>
        <div className="text-center mt-2">
          <Button
            onClick={() => {
              refetch();
            }}
          >
            <RotateCcw />
            {translate("crm.common.retry")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="md:divide-y">
      {contacts.map((contact) => (
        <RecordContextProvider key={contact.id} value={contact}>
          <ContactItemContentMobile contact={contact} />
        </RecordContextProvider>
      ))}
      {contacts.length === 0 && (
        <div className="p-4">
          <div className="text-muted-foreground">
            {translate("resources.contacts.empty.title")}
          </div>
        </div>
      )}
    </div>
  );
};

const ContactItemContentMobile = ({ contact }: { contact: Contact }) => {
  const translate = useTranslate();
  return (
    <Link
      to={`/contacts/${contact.id}/show`}
      className="flex flex-row gap-4 items-center py-2 hover:bg-muted transition-colors"
    >
      <Avatar />
      <div className="flex flex-col grow justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex justify-between">
            <div className="font-medium">
              <RecordRepresentation />
            </div>
            <Status status={contact.status} />
          </div>
          <div className="text-sm text-muted-foreground">
            <div className="flex flex-col gap-1">
              <span>
                {contact.title && contact.company_id != null
                  ? `${translate("resources.contacts.position_at", {
                      title: contact.title,
                    })} `
                  : contact.title}
                {contact.company_id != null && (
                  <ReferenceField
                    source="company_id"
                    reference="companies"
                    link={false}
                  >
                    <TextField source="name" />
                  </ReferenceField>
                )}
              </span>
              {contact.nb_tasks ? (
                <span>
                  {translate("crm.common.task_count", {
                    smart_count: contact.nb_tasks,
                  })}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
};
