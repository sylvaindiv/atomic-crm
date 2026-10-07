import { useRecordContext } from "ra-core";
import { DataTable } from "@/components/admin/data-table";
import { ReferenceField } from "@/components/admin/reference-field";
import type { Company } from "../../types";
import { CompanyAvatar } from "../CompanyAvatar";
import { httpUrl, linkDomain, socialLinks } from "../companyLinks";

export const CompanyTable = () => {
  return (
    <div className="overflow-x-auto text-xs [&_td]:px-1.5 [&_td]:py-0.5 [&_th]:px-1.5 [&_th]:h-7">
      <DataTable
        rowClick="show"
        bulkActionButtons={false}
        className="min-w-[1050px]"
      >
        <DataTable.Col source="name">
          <NameCell />
        </DataTable.Col>
        <DataTable.Col source="zipcode">
          <ValueCell field="zipcode" />
        </DataTable.Col>
        <DataTable.Col source="city">
          <ValueCell field="city" />
        </DataTable.Col>
        <DataTable.Col source="nb_contacts">
          <ValueCell field="nb_contacts" />
        </DataTable.Col>
        <DataTable.Col source="sales_id">
          <ReferenceField
            source="sales_id"
            reference="sales"
            link={false}
            empty="—"
          />
        </DataTable.Col>
        <DataTable.Col source="website">
          <LinkCell field="website" />
        </DataTable.Col>
        <DataTable.Col source="phone_number">
          <LinkCell field="phone_number" />
        </DataTable.Col>
        <DataTable.Col source="email">
          <LinkCell field="email" />
        </DataTable.Col>
        <DataTable.Col source="social_links">
          <SocialCell />
        </DataTable.Col>
      </DataTable>
    </div>
  );
};

const NameCell = () => {
  const record = useRecordContext<Company>();
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <CompanyAvatar width={20} height={20} />
      {record?.name || "—"}
    </div>
  );
};

const ValueCell = ({
  field,
}: {
  field: "zipcode" | "city" | "nb_contacts";
}) => {
  const record = useRecordContext<Company>();
  return <>{record?.[field] || (record?.[field] === 0 ? 0 : "—")}</>;
};

const LinkCell = ({
  field,
}: {
  field: "website" | "phone_number" | "email";
}) => {
  const record = useRecordContext<Company>();
  const value = record?.[field];
  const href =
    field === "website"
      ? httpUrl(value)
      : field === "phone_number"
        ? value && `tel:${value}`
        : value && `mailto:${value}`;
  if (!value) return <>—</>;
  if (!href) return <>{value}</>;
  return (
    <a
      href={href}
      onClick={(event) => event.stopPropagation()}
      className="underline hover:no-underline"
      {...(field === "website"
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {value}
    </a>
  );
};

const SocialCell = () => {
  const record = useRecordContext<Company>();
  const links = record ? socialLinks(record) : [];
  if (!links.length) return <>—</>;
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-1">
      {links.map((link) => (
        <a
          key={link}
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => event.stopPropagation()}
          className="underline hover:no-underline"
        >
          {linkDomain(link)}
        </a>
      ))}
    </div>
  );
};
