import { useState } from "react";
import { useRecordContext, useTranslate, WithRecord } from "ra-core";
import { Link } from "react-router";
import { ArrayField } from "@/components/admin/array-field";
import { SingleFieldList } from "@/components/admin/single-field-list";
import { EmailField } from "@/components/admin/email-field";
import { Mail, Phone, Check, UserPlus } from "lucide-react";
import type { ReactNode } from "react";
import { formatPhoneNumber } from "@/lib/utils";
import { translatePersonalInfoTypeLabel } from "./contactModel";
import type { Contact } from "../types";

export const ContactPersonalInfo = () => {
  const record = useRecordContext<Contact>();

  if (!record) return null;

  return (
    <div>
      <ArrayField source="email_jsonb">
        <SingleFieldList className="flex-col gap-y-0">
          <EmailRow />
        </SingleFieldList>
      </ArrayField>

      <ArrayField source="phone_jsonb">
        <SingleFieldList className="flex-col gap-y-0">
          <PersonalInfoRow
            icon={<Phone className="w-4 h-4 text-muted-foreground" />}
            primary={<PhoneNumberField />}
            showType
          />
        </SingleFieldList>
      </ArrayField>
      {record.referred_by_name && (
        <PersonalInfoRow
          icon={<UserPlus className="w-4 h-4 text-muted-foreground" />}
          primary={
            <Link
              className="underline hover:no-underline text-sm text-muted-foreground"
              to={`/contacts/${record.referred_by_id}/show`}
            >
              {record.referred_by_name}
            </Link>
          }
        />
      )}
    </div>
  );
};

const EmailRow = () => {
  const record = useRecordContext<{ email: string }>();
  const translate = useTranslate();
  const [copied, setCopied] = useState(false);

  if (!record) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(record.email).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <PersonalInfoRow
      icon={
        <button
          type="button"
          onClick={handleCopy}
          title={translate("crm.common.copy")}
          className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Mail className="w-4 h-4" />
          )}
        </button>
      }
      primary={<EmailField source="email" />}
    />
  );
};

const PhoneNumberField = () => {
  const record = useRecordContext<{ number: string }>();
  if (!record) return null;
  return <span className="text-sm">{formatPhoneNumber(record.number)}</span>;
};

const PersonalInfoRow = ({
  icon,
  primary,
  showType,
}: {
  icon: ReactNode;
  primary: ReactNode;
  showType?: boolean;
}) => {
  const translate = useTranslate();

  return (
    <div className="flex flex-row items-center gap-x-2 py-1 min-h-6">
      {icon}
      <div className="flex flex-wrap gap-x-2 gap-y-0 text-sm">
        {primary}
        {showType ? (
          <WithRecord
            render={(row) =>
              row.type !== "Other" && (
                <span className="text-muted-foreground">
                  {translatePersonalInfoTypeLabel(row.type, translate)}
                </span>
              )
            }
          />
        ) : null}
      </div>
    </div>
  );
};
