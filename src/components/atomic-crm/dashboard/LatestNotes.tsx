import { formatDistance } from "date-fns";
import { FileText } from "lucide-react";
import { useGetIdentity, useGetList, useTranslate } from "ra-core";
import { ReferenceField } from "@/components/admin/reference-field";
import { Card, CardContent } from "@/components/ui/card";

import type { Contact, ContactNote } from "../types";

export const LatestNotes = () => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  const { data: contactNotesData, isPending: contactNotesLoading } =
    useGetList(
      "contact_notes",
      {
        pagination: { page: 1, perPage: 5 },
        sort: { field: "date", order: "DESC" },
        filter: { sales_id: identity?.id },
      },
      { enabled: Number.isInteger(identity?.id) },
    );
  if (contactNotesLoading) {
    return null;
  }
  // TypeScript guard
  if (!contactNotesData) {
    return null;
  }

  return (
    <div>
      <div className="flex items-center mb-4">
        <div className="ml-8 mr-8 flex">
          <FileText className="text-muted-foreground w-6 h-6" />
        </div>
        <h2 className="text-xl font-semibold text-muted-foreground">
          {translate("crm.dashboard.latest_notes")}
        </h2>
      </div>
      <Card>
        <CardContent>
          {contactNotesData.map((note) => (
            <div id={`contactNote_${note.id}`} key={note.id} className="mb-8">
              <div className="text-sm text-muted-foreground">
                <ContactLabel note={note} />
                {", "}
                {translate("crm.dashboard.latest_notes_added_ago", {
                  timeAgo: formatDistance(note.date, new Date(), {
                    addSuffix: true,
                  }),
                })}
              </div>
              <div>
                <p className="text-sm line-clamp-3 overflow-hidden">
                  {note.text}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

const ContactLabel = ({ note }: { note: ContactNote }) => {
  const translate = useTranslate();
  return (
    <>
      {translate("resources.contacts.forcedCaseName")}{" "}
      <ReferenceField<ContactNote, Contact>
        record={note}
        source="contact_id"
        reference="contacts"
        link="show"
      />
    </>
  );
};
