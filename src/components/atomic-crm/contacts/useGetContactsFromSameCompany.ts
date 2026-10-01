import { useGetList } from "ra-core";
import type { Identifier } from "ra-core";
import type { Contact } from "../types";

export const useGetContactsFromSameCompany = (
  companyId: Identifier | null | undefined,
  excludeContactId: Identifier,
  contactType: Contact["contact_type"] = "referee",
) => {
  const { data, isPending, error } = useGetList<Contact>(
    contactType === "partner" ? "partners" : "contacts",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "last_name", order: "ASC" },
      filter: {
        company_id: companyId,
        id: { $ne: excludeContactId },
        contact_type: contactType,
      },
    },
    {
      enabled: !!companyId,
    },
  );

  return {
    contacts: data ?? [],
    isPending,
    error,
  };
};
