import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Link } from "react-router";
import { useTranslate } from "ra-core";
import type { Identifier } from "ra-core";

import { useGetContactsFromSameCompany } from "../contacts/useGetContactsFromSameCompany";
import { useGetNotesForContacts } from "./useGetNotesForContacts";
import { Status } from "../misc/Status";
import { Markdown } from "../misc/Markdown";
import { RelativeDate } from "../misc/RelativeDate";
import { NoteAttachments } from "./NoteAttachments";
import type { Contact, ContactNote } from "../types";

const MAX_NOTES_PER_JUDGE = 3;

export const OtherJudgesNotes = ({ contact }: { contact: Contact }) => {
  const translate = useTranslate();

  const { contacts, isPending: isContactsPending } =
    useGetContactsFromSameCompany(contact.company_id, contact.id);

  const contactIds = useMemo(() => contacts.map((c) => c.id), [contacts]);

  const { notes, isPending: isNotesPending } =
    useGetNotesForContacts(contactIds);

  const isPending = isContactsPending || isNotesPending;

  // Group notes by contact
  const notesByContact = useMemo(() => {
    const grouped: Record<Identifier, ContactNote[]> = {};
    notes.forEach((note) => {
      if (!grouped[note.contact_id]) {
        grouped[note.contact_id] = [];
      }
      grouped[note.contact_id].push(note);
    });
    return grouped;
  }, [notes]);

  if (isPending || !contact.company_id) return null;

  if (contacts.length === 0) return null;

  if (notes.length === 0) {
    return (
      <Card id="other-judges-notes" className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">
            {translate("resources.contacts.other_judges_notes", {
              smart_count: contacts.length,
            })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {translate("resources.contacts.other_judges_notes_empty")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card id="other-judges-notes" className="mt-6">
      <CardHeader>
        <CardTitle className="text-lg">
          {translate("resources.contacts.other_judges_notes", {
            smart_count: contacts.length,
          })}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {Object.entries(notesByContact).map(([contactId, contactNotes]) => {
          const contactInfo = contacts.find(
            (c) => c.id === parseInt(contactId),
          );
          if (!contactInfo) return null;

          const trimmedNotes = contactNotes.slice(0, MAX_NOTES_PER_JUDGE);

          return (
            <div
              key={contactId}
              className="rounded-lg border bg-muted/30 p-4 mb-4 last:mb-0"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/contacts/${contactInfo.id}/show`}
                    className="font-medium text-sm text-foreground hover:underline"
                  >
                    {contactInfo.first_name} {contactInfo.last_name}
                  </Link>
                  {contactInfo.status && <Status status={contactInfo.status} />}
                </div>
                <Link
                  to={`/contacts/${contactInfo.id}/show`}
                  className="text-sm text-muted-foreground hover:underline"
                >
                  {translate(
                    "resources.contacts.other_judges_notes_view_profile",
                  )}
                </Link>
              </div>
              <div className="space-y-2">
                {trimmedNotes.map((note, index) => (
                  <div key={note.id}>
                    {index > 0 && <Separator className="my-2" />}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      {note.status && <Status status={note.status} />}
                      <RelativeDate date={note.date} />
                    </div>
                    <div className="text-sm [&>*]:text-sm">
                      {note.text && <Markdown>{note.text}</Markdown>}
                      {note.attachments && <NoteAttachments note={note} />}
                    </div>
                  </div>
                ))}
              </div>
              {trimmedNotes.length < contactNotes.length && (
                <p className="text-xs text-muted-foreground mt-2">
                  {translate("resources.contacts.other_judges_notes_more", {
                    smart_count: contactNotes.length - trimmedNotes.length,
                  })}
                </p>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
