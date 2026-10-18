import { ContactClubs } from "../contacts/ContactClubs";
import { useState } from "react";
import {
  RecordRepresentation,
  ShowBase,
  useShowContext,
  useTranslate,
} from "ra-core";
import type { ShowBaseProps } from "ra-core";
import { useIsMobile } from "@/hooks/use-mobile";
import { ReferenceField } from "@/components/admin/reference-field";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Pencil } from "lucide-react";
import { Link, Navigate } from "react-router";

import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { CompanyAvatar } from "../companies/CompanyAvatar";
import { NoteCreateSheet } from "../notes/NoteCreateSheet";
import { OtherJudgesNotes } from "../notes/OtherJudgesNotes";
import { useGetContactsFromSameCompany } from "./useGetContactsFromSameCompany";
import { TagsListEdit } from "./TagsListEdit";
import { ContactEditSheet } from "./ContactEditSheet";
import { ContactStatusSelector } from "./ContactInputs";
import { ContactPersonalInfo } from "./ContactPersonalInfo";
import { ContactBackgroundInfo } from "./ContactBackgroundInfo";
import { ContactFollowUp } from "./ContactFollowUp";
import type { Contact } from "../types";
import { Avatar } from "./Avatar";
import { ContactAside, ContactCaseInfo } from "./ContactAside";
import { MobileBackButton } from "../misc/MobileBackButton";
import { resourceForContact, useContactResource } from "./contactResource";

export const ContactShow = (props: ShowBaseProps = {}) => {
  const isMobile = useIsMobile();

  return (
    <ShowBase
      queryOptions={{
        onError: isMobile
          ? () => {
              {
                /** Disable error notification as the content handles offline */
              }
            }
          : undefined,
      }}
      {...props}
    >
      {isMobile ? <ContactShowContentMobile /> : <ContactShowContent />}
    </ShowBase>
  );
};

const ContactShowContentMobile = () => {
  const translate = useTranslate();
  const resource = useContactResource();
  const { defaultTitle, record, isPending } = useShowContext<Contact>();
  const [noteCreateOpen, setNoteCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const { contacts: otherContacts } = useGetContactsFromSameCompany(
    record?.company_ids ?? record?.company_id ?? null,
    record?.id ?? 0,
    record?.contact_type ?? "referee",
  );
  const hasOtherJudges = otherContacts.length > 0;
  if (isPending || !record) return null;
  if (resourceForContact(record) !== resource) {
    return (
      <Navigate
        to={`/${resourceForContact(record)}/${record.id}/show`}
        replace
      />
    );
  }

  return (
    <>
      {/* We need to repeat the note creation sheet here to support the note 
      create button that is rendered when there are no notes. */}
      <NoteCreateSheet
        open={noteCreateOpen}
        onOpenChange={setNoteCreateOpen}
        contact_id={record.id}
      />
      <ContactEditSheet
        open={editOpen}
        onOpenChange={setEditOpen}
        contactId={record.id}
      />
      <MobileHeader>
        <MobileBackButton to={`/${resource}`} />
        <div className="flex flex-1 min-w-0">
          <Link to={`/${resource}`} className="flex-1 min-w-0">
            <h1 className="truncate text-xl font-semibold">{defaultTitle}</h1>
          </Link>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label={translate("ra.action.edit")}
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="size-5" />
        </Button>
      </MobileHeader>
      <MobileContent>
        <div className="mb-6">
          <div className="flex items-center mb-4">
            <Avatar />
            <div className="mx-3 flex-1">
              <h2 className="text-2xl font-bold">
                <RecordRepresentation />
              </h2>
              <div className="text-sm text-muted-foreground">
                {record.title && record.company_id != null
                  ? `${translate("resources.contacts.position_at", {
                      title: record.title,
                    })} `
                  : record.title}
                {record.company_id != null && <ContactClubs />}
              </div>
            </div>
            <div>
              <ReferenceField
                source="company_id"
                reference="companies"
                link="show"
                className="no-underline"
              >
                <CompanyAvatar />
              </ReferenceField>
            </div>
          </div>
        </div>

        <Tabs defaultValue="follow_up" className="w-full">
          <TabsList
            className={`grid w-full h-10 ${hasOtherJudges ? "grid-cols-3" : "grid-cols-2"}`}
          >
            <TabsTrigger value="follow_up">
              {translate("crm.follow_up.title")}
            </TabsTrigger>
            {hasOtherJudges && (
              <TabsTrigger value="other_notes">
                {translate("crm.follow_up.other_notes")}
              </TabsTrigger>
            )}
            <TabsTrigger value="details">
              {translate("crm.common.details")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="follow_up" className="mt-2">
            <ContactFollowUp
              contact={record}
              mobile
              onCreateNote={() => setNoteCreateOpen(true)}
            />
          </TabsContent>

          {hasOtherJudges && (
            <TabsContent value="other_notes" className="mt-2">
              <OtherJudgesNotes contact={record} />
            </TabsContent>
          )}

          <TabsContent value="details" className="mt-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold">
                  {translate("resources.notes.fields.status")}
                </h3>
                <Separator />
                <div className="mt-3">
                  <ContactStatusSelector />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {translate(
                    "resources.contacts.field_categories.personal_info",
                  )}
                </h3>
                <Separator />
                <div className="mt-3">
                  <ContactPersonalInfo />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold">
                  {translate(
                    "resources.contacts.field_categories.background_info",
                  )}
                </h3>
                <Separator />
                <div className="mt-3">
                  <ContactBackgroundInfo />
                </div>
              </div>
              <ContactCaseInfo />
              <div>
                <h3 className="text-lg font-semibold">
                  {translate("resources.tags.name", { smart_count: 2 })}
                </h3>
                <Separator />
                <div className="mt-3">
                  <TagsListEdit />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </MobileContent>
    </>
  );
};

export const ContactShowContent = () => {
  const translate = useTranslate();
  const resource = useContactResource();
  const { record, isPending } = useShowContext<Contact>();
  const { contacts: otherContacts } = useGetContactsFromSameCompany(
    record?.company_ids ?? record?.company_id ?? null,
    record?.id ?? 0,
    record?.contact_type ?? "referee",
  );
  if (isPending || !record) return null;
  if (resourceForContact(record) !== resource) {
    return (
      <Navigate
        to={`/${resourceForContact(record)}/${record.id}/show`}
        replace
      />
    );
  }

  const scrollToOtherJudgesNotes = () => {
    document
      .getElementById("other-judges-notes")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mt-2 mb-2 flex gap-8">
      <div className="flex-1">
        <Card>
          <CardContent>
            <div className="flex">
              <Avatar />
              <div className="ml-2 flex-1">
                <h5 className="text-xl font-semibold">
                  <RecordRepresentation />
                </h5>
                <div className="inline-flex text-sm text-muted-foreground">
                  {record.title && record.company_id != null
                    ? `${translate("resources.contacts.position_at", {
                        title: record.title,
                      })} `
                    : record.title}
                  {record.company_id != null && <ContactClubs />}
                  {otherContacts.length > 0 && (
                    <button
                      type="button"
                      onClick={scrollToOtherJudgesNotes}
                      className="ml-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs text-muted-foreground hover:bg-muted cursor-pointer"
                    >
                      +{otherContacts.length}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <ReferenceField
                  source="company_id"
                  reference="companies"
                  link="show"
                  className="no-underline"
                >
                  <CompanyAvatar />
                </ReferenceField>
              </div>
            </div>
            <ContactFollowUp contact={record} />
          </CardContent>
        </Card>

        <OtherJudgesNotes contact={record} />
      </div>
      <ContactAside showTasks={false} />
    </div>
  );
};
