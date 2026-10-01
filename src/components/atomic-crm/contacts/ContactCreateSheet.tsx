import { useGetIdentity, useTranslate } from "ra-core";
import { CreateSheet } from "../misc/CreateSheet";
import { ContactInputs } from "./ContactInputs";
import {
  cleanupContactForCreate,
  defaultEmailJsonb,
  defaultPhoneJsonb,
} from "./contactModel";
import { useContactResource } from "./contactResource";

export interface ContactCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactType?: "referee" | "partner";
}

export const ContactCreateSheet = ({
  open,
  onOpenChange,
  contactType,
}: ContactCreateSheetProps) => {
  const { identity } = useGetIdentity();
  const translate = useTranslate();
  const currentResource = useContactResource();
  const resource =
    contactType === "partner" ||
    (!contactType && currentResource === "partners")
      ? "partners"
      : "contacts";
  return (
    <CreateSheet
      resource={resource}
      title={translate(`resources.${resource}.action.new`)}
      defaultValues={{
        sales_id: identity?.id,
        contact_type: resource === "partners" ? "partner" : "referee",
        email_jsonb: defaultEmailJsonb,
        phone_jsonb: defaultPhoneJsonb,
      }}
      transform={cleanupContactForCreate}
      open={open}
      onOpenChange={onOpenChange}
    >
      <ContactInputs />
    </CreateSheet>
  );
};
