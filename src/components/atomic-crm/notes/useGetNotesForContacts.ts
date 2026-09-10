import { useGetList } from "ra-core";
import type { Identifier } from "ra-core";
import type { ContactNote } from "../types";

export const useGetNotesForContacts = (contactIds: Identifier[]) => {
  const { data, isPending, error } = useGetList<ContactNote>(
    "contact_notes",
    {
      pagination: { page: 1, perPage: 100 },
      sort: { field: "date", order: "DESC" },
      filter: {
        contact_id: { $in: contactIds },
      },
    },
    {
      enabled: contactIds.length > 0,
    },
  );

  return {
    notes: data ?? [],
    isPending,
    error,
  };
};
