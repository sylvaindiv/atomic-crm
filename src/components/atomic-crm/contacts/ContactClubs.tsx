import { useGetMany, useRecordContext, useResourceContext } from "ra-core";
import { Link } from "react-router";
import { ReferenceArrayInput } from "@/components/admin/reference-array-input";
import { AutocompleteArrayInput } from "@/components/admin/autocomplete-array-input";
import { ReferenceInput } from "@/components/admin/reference-input";
import {
  AutocompleteCompanyInput,
  useCreateCompany,
} from "../companies/AutocompleteCompanyInput";
import type { Company, Contact } from "../types";

import { contactClubIds } from "./contactModel";

export function ContactClubsInput() {
  const record = useRecordContext<Contact>();
  const resource = useResourceContext();
  const createCompany = useCreateCompany();
  return record?.contact_type === "partner" || resource === "partners" ? (
    <ReferenceInput source="company_id" reference="companies" perPage={25}>
      <AutocompleteCompanyInput label="Club" />
    </ReferenceInput>
  ) : (
    <ReferenceArrayInput
      source="company_ids"
      reference="companies"
      sort={{ field: "name", order: "ASC" }}
      perPage={25}
    >
      <AutocompleteArrayInput
        onCreate={createCompany}
        createItemLabel="resources.companies.autocomplete.create_item"
        label="Clubs"
        optionText="name"
        helperText={false}
        defaultValue={contactClubIds(record)}
      />
    </ReferenceArrayInput>
  );
}

export function ContactClubs() {
  const record = useRecordContext<Contact>();
  const ids = contactClubIds(record);
  const { data } = useGetMany<Company>(
    "companies",
    { ids },
    { enabled: ids.length > 0 },
  );
  return (
    <span className="inline-flex flex-wrap gap-x-2">
      {ids.map((id) => {
        const club = data?.find((company) => company.id === id);
        return club ? (
          <Link key={id} to={`/companies/${id}/show`} className="underline">
            {club.name}
          </Link>
        ) : null;
      })}
    </span>
  );
}
