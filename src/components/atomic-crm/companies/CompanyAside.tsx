import { Globe, Mail, Phone, Share2 } from "lucide-react";
import {
  useGetIdentity,
  useLocaleState,
  useRecordContext,
  useTranslate,
} from "ra-core";
import { EditButton } from "@/components/admin/edit-button";
import { DeleteButton } from "@/components/admin/delete-button";
import { ShowButton } from "@/components/admin/show-button";
import { TextField } from "@/components/admin/text-field";
import { SelectField } from "@/components/admin/select-field";

import { formatPhoneNumber } from "@/lib/utils";
import { formatLocalizedDate } from "../misc/RelativeDate";
import { AsideSection } from "../misc/AsideSection";
import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Company } from "../types";
import { getTranslatedCompanySizeLabel } from "./getTranslatedCompanySizeLabel";
import { sizes } from "./sizes";
import { useGetSalesName } from "../sales/useGetSalesName";
import { CompanyMergeButton } from "./CompanyMergeButton";
import { httpUrl, linkDomain, socialLinks } from "./companyLinks";

interface CompanyAsideProps {
  link?: string;
}

export const CompanyAside = ({ link = "edit" }: CompanyAsideProps) => {
  const record = useRecordContext<Company>();
  const translate = useTranslate();
  if (!record) return null;

  return (
    <div className="hidden sm:block w-92 min-w-92 space-y-4">
      <div className="flex flex-row space-x-1">
        {link === "edit" ? (
          <EditButton label={translate("resources.companies.action.edit")} />
        ) : (
          <ShowButton label={translate("resources.companies.action.show")} />
        )}
      </div>

      <CompanyInfo record={record} />

      <AddressInfo record={record} />

      <ContextInfo record={record} />

      <AdditionalInfo record={record} />

      {link !== "edit" && (
        <>
          <div className="mt-6 pt-6 border-t hidden sm:flex flex-col gap-2 items-start">
            <CompanyMergeButton />
          </div>
          <div className="mt-6 pt-6 border-t hidden sm:flex flex-col gap-2 items-start">
            <DeleteButton
              className="h-6 cursor-pointer hover:bg-destructive/10! text-destructive! border-destructive! focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40"
              size="sm"
            />
          </div>
        </>
      )}
    </div>
  );
};

export const CompanyInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  if (
    !record.website &&
    !record.email &&
    !record.phone_number &&
    !socialLinks(record).length
  ) {
    return null;
  }

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.contact")}
    >
      {record.website && httpUrl(record.website) && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Globe className="w-4 h-4" />
          <a
            href={httpUrl(record.website)!}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            {record.website.replace(/^https?:\/\//, "")}
          </a>
        </div>
      )}
      {record.email && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Mail className="w-4 h-4" />
          <a
            className="underline hover:no-underline"
            href={`mailto:${record.email}`}
          >
            {record.email}
          </a>
        </div>
      )}
      {record.phone_number && (
        <div className="flex flex-row items-center gap-1 min-h-[24px]">
          <Phone className="w-4 h-4" />
          <a
            href={`tel:${record.phone_number}`}
            className="text-sm underline hover:no-underline"
          >
            {formatPhoneNumber(record.phone_number)}
          </a>
        </div>
      )}
      {socialLinks(record).map((link) => (
        <div
          key={link}
          className="flex flex-row items-center gap-1 min-h-[24px]"
        >
          <Share2 className="w-4 h-4" />
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:no-underline"
          >
            {linkDomain(link)}
          </a>
        </div>
      ))}
    </AsideSection>
  );
};

export const ContextInfo = ({ record }: { record: Company }) => {
  const { companySectors } = useConfigurationContext();
  const translate = useTranslate();
  if (!record.revenue && !record.id) {
    return null;
  }

  const sector = companySectors.find((s) => s.value === record.sector);
  const sectorLabel = sector?.label;
  const translatedSizes = sizes.map((size) => ({
    ...size,
    name: getTranslatedCompanySizeLabel(size, translate),
  }));

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.context")}
    >
      {sectorLabel && (
        <span>
          {translate("resources.companies.fields.sector")}: {sectorLabel}
        </span>
      )}
      {record.size && (
        <span>
          {translate("resources.companies.fields.size")}:{" "}
          <SelectField source="size" choices={translatedSizes} />
        </span>
      )}
      {record.revenue && (
        <span>
          {translate("resources.companies.fields.revenue")}:{" "}
          <TextField source="revenue" />
        </span>
      )}
      {record.tax_identifier && (
        <span>
          {translate("resources.companies.fields.tax_identifier", {})}
          : <TextField source="tax_identifier" />
        </span>
      )}
    </AsideSection>
  );
};

export const AddressInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  if (
    !record.address &&
    !record.city &&
    !record.zipcode &&
    !record.state_abbr
  ) {
    return null;
  }

  return (
    <AsideSection
      title={translate("resources.companies.field_categories.address")}
      noGap
    >
      <TextField source="address" />
      <TextField source="city" />
      <TextField source="zipcode" />
      <TextField source="state_abbr" />
      <TextField source="country" />
    </AsideSection>
  );
};

export const AdditionalInfo = ({ record }: { record: Company }) => {
  const translate = useTranslate();
  const [locale = "en"] = useLocaleState();
  const { identity } = useGetIdentity();
  const isCurrentUser = record.sales_id === identity?.id;
  const salesName = useGetSalesName(record.sales_id, {
    enabled: !isCurrentUser,
  });
  if (
    !record.created_at &&
    !record.sales_id &&
    !record.description &&
    !record.context_links
  ) {
    return null;
  }
  return (
    <AsideSection
      title={translate("resources.companies.field_categories.additional_info")}
    >
      {record.description && (
        <p className="text-sm  mb-1">{record.description}</p>
      )}
      {record.context_links && (
        <div className="flex flex-col">
          {record.context_links.map((link, index) =>
            link && httpUrl(link) ? (
              <a
                key={index}
                className="text-sm underline hover:no-underline mb-1"
                href={httpUrl(link)!}
                target="_blank"
                rel="noopener noreferrer"
                title={link}
              >
                {linkDomain(httpUrl(link)!)}
              </a>
            ) : null,
          )}
        </div>
      )}
      {record.sales_id !== null && (
        <div className="inline-flex text-sm text-muted-foreground mb-1">
          {translate(
            isCurrentUser
              ? "resources.companies.followed_by_you"
              : "resources.companies.followed_by",
            { name: salesName },
          )}
        </div>
      )}
      {record.created_at && (
        <p className="text-sm text-muted-foreground mb-1">
          {translate("resources.companies.added_on", {
            date: formatLocalizedDate(record.created_at, locale),
          })}{" "}
        </p>
      )}
    </AsideSection>
  );
};
