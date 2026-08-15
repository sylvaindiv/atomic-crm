import type { Identifier, DataProvider } from "ra-core";

import type { Company, Contact } from "../../types";

/**
 * Merge one company (loser) into another company (winner).
 *
 * Reassigns the loser's contacts (`contacts.company_id`) to the winner,
 * fills the winner's empty fields from the loser, and deletes the loser
 * company.
 */
export const mergeCompanies = async (
  loserId: Identifier,
  winnerId: Identifier,
  dataProvider: DataProvider,
) => {
  // Fetch both companies using dataProvider to get fresh data
  const { data: winnerCompany } = await dataProvider.getOne<Company>(
    "companies",
    { id: winnerId },
  );
  const { data: loserCompany } = await dataProvider.getOne<Company>(
    "companies",
    { id: loserId },
  );

  if (!winnerCompany || !loserCompany) {
    throw new Error("Could not fetch companies");
  }

  // 1. Reassign all contacts from loser to winner
  const { data: loserContacts } = await dataProvider.getManyReference<Contact>(
    "contacts",
    {
      target: "company_id",
      id: loserId,
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    },
  );

  // The reassignment must settle before the loser company is deleted below.
  await dataProvider.updateMany<Contact>("contacts", {
    ids: (loserContacts || []).map((contact) => contact.id),
    data: { company_id: winnerId },
  });

  // 2. Update winner company with loser data: fields already set on the
  // winner are never overwritten. `status` is only included when genuinely
  // filling it from the loser -- unlike the other fields, an empty string
  // is not a valid fallback for it (it must be a known status value or
  // absent entirely).
  await dataProvider.update<Company>("companies", {
    id: winnerId,
    data: {
      sector: winnerCompany.sector || loserCompany.sector,
      size: winnerCompany.size || loserCompany.size,
      linkedin_url: winnerCompany.linkedin_url || loserCompany.linkedin_url,
      website: winnerCompany.website || loserCompany.website,
      phone_number: winnerCompany.phone_number || loserCompany.phone_number,
      address: winnerCompany.address || loserCompany.address,
      zipcode: winnerCompany.zipcode || loserCompany.zipcode,
      city: winnerCompany.city || loserCompany.city,
      state_abbr: winnerCompany.state_abbr || loserCompany.state_abbr,
      country: winnerCompany.country || loserCompany.country,
      description: winnerCompany.description || loserCompany.description,
      revenue: winnerCompany.revenue || loserCompany.revenue,
      tax_identifier:
        winnerCompany.tax_identifier || loserCompany.tax_identifier,
      logo:
        winnerCompany.logo && winnerCompany.logo.src
          ? winnerCompany.logo
          : loserCompany.logo,
      context_links: winnerCompany.context_links?.length
        ? winnerCompany.context_links
        : loserCompany.context_links,
      ...(!winnerCompany.status && loserCompany.status
        ? { status: loserCompany.status }
        : {}),
    },
    previousData: winnerCompany,
  });

  // 3. Delete the loser company only after all reassignments succeed
  await dataProvider.delete<Company>("companies", {
    id: loserId,
    previousData: loserCompany,
  });
};
