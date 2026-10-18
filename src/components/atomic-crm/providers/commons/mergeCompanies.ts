import type { Identifier, DataProvider } from "ra-core";

import type { Company, Contact } from "../../types";
import { httpUrl, socialLinks } from "../../companies/companyLinks";

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

  // Read every membership before writing, so pagination cannot skip moved rows.
  const loserContacts: Contact[] = [];
  for (let page = 1; ; page++) {
    const result = await dataProvider.getManyReference<Contact>("contacts", {
      target: "company_id",
      id: loserId,
      pagination: { page, perPage: 250 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    });
    loserContacts.push(...result.data);
    if (
      result.data.length < 250 ||
      loserContacts.length >= (result.total ?? Infinity)
    )
      break;
  }
  for (const contact of loserContacts) {
    const ids =
      contact.company_ids ??
      (contact.company_id == null ? [] : [contact.company_id]);
    await dataProvider.update<Contact>("contacts", {
      id: contact.id,
      data: {
        company_ids: [
          ...new Set(ids.map((id) => (id === loserId ? winnerId : id))),
        ],
      },
      previousData: contact,
    });
  }

  // Merge the new club-specific referee links without combining progress
  // across different clubs or creating duplicate club/referee pairs.
  const { data: sourceLinks = [] } = await dataProvider.getManyReference<any>(
    "club_referees",
    {
      target: "company_id",
      id: loserId,
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    },
  );
  const { data: targetLinks = [] } = await dataProvider.getManyReference<any>(
    "club_referees",
    {
      target: "company_id",
      id: winnerId,
      pagination: { page: 1, perPage: 1000 },
      sort: { field: "id", order: "ASC" },
      filter: {},
    },
  );
  for (const source of sourceLinks) {
    const target = targetLinks.find(
      (link: any) => String(link.contact_id) === String(source.contact_id),
    );
    if (target) {
      await dataProvider.update("club_referees", {
        id: target.id,
        data: {
          client_checklist: [
            ...new Set([
              ...(target.client_checklist ?? []),
              ...(source.client_checklist ?? []),
            ]),
          ],
        },
        previousData: target,
      });
      await dataProvider.delete("club_referees", {
        id: source.id,
        previousData: source,
      });
    } else {
      await dataProvider.update("club_referees", {
        id: source.id,
        data: { company_id: winnerId },
        previousData: source,
      });
    }
  }

  // 2. Update winner company with loser data: fields already set on the
  // winner are never overwritten.
  await dataProvider.update<Company>("companies", {
    id: winnerId,
    data: {
      sector: winnerCompany.sector || loserCompany.sector,
      size: winnerCompany.size || loserCompany.size,
      linkedin_url: winnerCompany.linkedin_url || loserCompany.linkedin_url,
      website: winnerCompany.website || loserCompany.website,
      email: winnerCompany.email || loserCompany.email,
      social_links: Array.from(
        new Set([...socialLinks(winnerCompany), ...socialLinks(loserCompany)]),
      ).filter(
        (link) =>
          link !==
          httpUrl(winnerCompany.linkedin_url || loserCompany.linkedin_url),
      ),
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
      is_client: Boolean(winnerCompany.is_client || loserCompany.is_client),
      client_checklist: [
        ...new Set([
          ...(winnerCompany.client_checklist ?? []),
          ...(loserCompany.client_checklist ?? []),
        ]),
      ],
      logo:
        winnerCompany.logo && winnerCompany.logo.src
          ? winnerCompany.logo
          : loserCompany.logo,
      context_links: winnerCompany.context_links?.length
        ? winnerCompany.context_links
        : loserCompany.context_links,
    },
    previousData: winnerCompany,
  });

  // 3. Delete the loser company only after all reassignments succeed
  await dataProvider.delete<Company>("companies", {
    id: loserId,
    previousData: loserCompany,
  });
};
