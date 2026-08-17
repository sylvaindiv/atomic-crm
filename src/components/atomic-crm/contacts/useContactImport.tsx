import { useDataProvider, useGetIdentity, type DataProvider } from "ra-core";
import { useCallback, useMemo } from "react";

import type { Company, Contact, ContactNote, Tag } from "../types";
import { contactFullName } from "./contactModel";

export type ContactImportSchema = {
  first_name: string;
  last_name: string;
  gender: string;
  title: string;
  company: string;
  zipcode: string;
  city: string;
  email_work: string;
  email_home: string;
  email_other: string;
  phone_work: string;
  phone_home: string;
  phone_other: string;
  background: string;
  avatar: string;
  first_seen: string;
  last_seen: string;
  has_newsletter: string;
  status: string;
  tags: string;
  linkedin_url: string;
  known_via: string;
  comment: string;
  comment_2: string;
  postal_code: string;
  // The contact's own city, named contact_city (not city) to avoid clashing
  // with the company address's city column above.
  contact_city: string;
};

// The subset of a batch row needed to create a company, when its name doesn't
// match an existing one.
type CompanyImportInfo = {
  name: string;
  zipcode?: string;
  city?: string;
};

export function useContactImport() {
  const today = new Date().toISOString();
  const user = useGetIdentity();
  const dataProvider = useDataProvider();

  // company cache to avoid creating the same company multiple times and costly roundtrips
  // Cache is dependent of dataProvider, so it's safe to use it as a dependency
  const companiesCache = useMemo(
    () => new Map<string, Company>(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataProvider],
  );
  const getCompanies = useCallback(
    async (companies: CompanyImportInfo[]) => {
      // Only used for companies actually being created (never for a company
      // that already matched by name), so a matched company's address is
      // never overwritten.
      const addressByName = new Map(
        companies.map(({ name, zipcode, city }) => [name, { zipcode, city }]),
      );
      return fetchRecordsWithCache<Company>(
        "companies",
        companiesCache,
        companies.map(({ name }) => name),
        (name) => ({
          name,
          created_at: new Date().toISOString(),
          sales_id: user?.identity?.id,
          ...addressByName.get(name),
        }),
        dataProvider,
      );
    },
    [companiesCache, user?.identity?.id, dataProvider],
  );

  // Tags cache to avoid creating the same tag multiple times and costly roundtrips
  // Cache is dependent of dataProvider, so it's safe to use it as a dependency
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tagsCache = useMemo(() => new Map<string, Tag>(), [dataProvider]);
  const getTags = useCallback(
    async (names: string[]) =>
      fetchRecordsWithCache<Tag>(
        "tags",
        tagsCache,
        names,
        (name) => ({
          name,
          color: "#f9f9f9",
        }),
        dataProvider,
      ),
    [tagsCache, dataProvider],
  );

  // Contact cache for resolving known_via -> referred_by_id. Unlike
  // companies/tags, contacts have no single filterable "name" column
  // (first_name/last_name are split, and the backend filter layer only
  // matches real columns), so we can't reuse fetchRecordsWithCache's
  // server-side `name@in` lookup. Instead, any call with an unresolved name
  // re-fetches the current contacts snapshot and matches client-side,
  // case-insensitively, on the exact "first_name last_name" concatenation.
  // Matches are cached (a referrer named in several rows/batches is only
  // ever looked up once); unmatched names are re-checked on the next batch
  // that needs them, so a referrer created by an earlier batch in the same
  // import still resolves. Never creates a stub contact for an unmatched
  // name -- referred_by_id is simply left null.
  // v1 limitation: a referrer created earlier in the SAME batch is not
  // visible yet, since every row in a batch resolves referrers before any
  // of that batch's contacts are created -- it resolves to null, same as an
  // unknown name.
  // See adr/ADR-c7993f35-TASK-004-contact-referral-full-table-lookup.md.
  const contactsByNameCache = useMemo(
    () => new Map<string, Contact>(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dataProvider],
  );
  const getContactsByName = useCallback(
    async (names: string[]) => {
      const normalizedNames = [
        ...new Set(
          names.map((name) => name.trim().toLowerCase()).filter((name) => name),
        ),
      ];
      const unresolvedNames = normalizedNames.filter(
        (name) => !contactsByNameCache.has(name),
      );

      if (unresolvedNames.length > 0) {
        const { data: contacts } = await dataProvider.getList<Contact>(
          "contacts",
          {
            filter: {},
            pagination: { page: 1, perPage: 1000 },
            sort: { field: "id", order: "ASC" },
          },
        );
        for (const contact of contacts) {
          const fullName = contactFullName(contact).toLowerCase();
          if (!contactsByNameCache.has(fullName)) {
            contactsByNameCache.set(fullName, contact);
          }
        }
      }

      return normalizedNames.reduce((acc, name) => {
        const contact = contactsByNameCache.get(name);
        if (contact) acc.set(name, contact);
        return acc;
      }, new Map<string, Contact>());
    },
    [contactsByNameCache, dataProvider],
  );

  const processBatch = useCallback(
    async (batch: ContactImportSchema[]) => {
      const [companies, tags, referrers] = await Promise.all([
        getCompanies(
          batch
            .map((contact) => ({
              name: contact.company?.trim(),
              zipcode: contact.zipcode?.trim(),
              city: contact.city?.trim(),
            }))
            .filter((company) => company.name),
        ),
        getTags(batch.flatMap((batch) => parseTags(batch.tags))),
        getContactsByName(
          batch
            .map((contact) => contact.known_via?.trim())
            .filter((name) => name),
        ),
      ]);

      await Promise.all(
        batch.map(
          async ({
            first_name,
            last_name,
            gender,
            title,
            email_work,
            email_home,
            email_other,
            phone_work,
            phone_home,
            phone_other,
            background,
            first_seen,
            last_seen,
            has_newsletter,
            status,
            company: companyName,
            tags: tagNames,
            linkedin_url,
            known_via,
            comment,
            comment_2,
            postal_code,
            contact_city,
          }) => {
            const email_jsonb = [
              { email: email_work, type: "Work" },
              { email: email_home, type: "Home" },
              { email: email_other, type: "Other" },
            ].filter(({ email }) => email);
            const phone_jsonb = [
              { number: phone_work, type: "Work" },
              { number: phone_home, type: "Home" },
              { number: phone_other, type: "Other" },
            ].filter(({ number }) => number);
            const company = companyName?.trim()
              ? companies.get(companyName.trim())
              : undefined;
            const tagList = parseTags(tagNames)
              .map((name) => tags.get(name))
              .filter((tag): tag is Tag => !!tag);
            const referrer = referrers.get(known_via?.trim().toLowerCase());

            const { data: createdContact } = await dataProvider.create<Contact>(
              "contacts",
              {
                data: {
                  first_name,
                  last_name,
                  gender,
                  title,
                  email_jsonb,
                  phone_jsonb,
                  background,
                  first_seen: first_seen
                    ? new Date(first_seen).toISOString()
                    : today,
                  last_seen: last_seen
                    ? new Date(last_seen).toISOString()
                    : today,
                  // dynamicTyping is off (see usePapaParse), so has_newsletter
                  // arrives as the literal string "true"/"false", not a boolean.
                  has_newsletter: has_newsletter === "true",
                  status,
                  company_id: company?.id,
                  referred_by_id: referrer?.id,
                  tags: tagList.map((tag) => tag.id),
                  sales_id: user?.identity?.id,
                  linkedin_url,
                  postal_code,
                  city: contact_city,
                },
              },
            );

            const comments = [comment, comment_2].filter((text) =>
              text?.trim(),
            );
            await Promise.all(
              comments.map((text) =>
                dataProvider.create<ContactNote>("contact_notes", {
                  data: {
                    contact_id: createdContact.id,
                    text: text.trim(),
                    date: today,
                    sales_id: user?.identity?.id,
                  },
                }),
              ),
            );
          },
        ),
      );
    },
    [
      dataProvider,
      getCompanies,
      getTags,
      getContactsByName,
      user?.identity?.id,
      today,
    ],
  );

  return processBatch;
}

const fetchRecordsWithCache = async function <T>(
  resource: string,
  cache: Map<string, T>,
  names: string[],
  getCreateData: (name: string) => Partial<T>,
  dataProvider: DataProvider,
) {
  const trimmedNames = [...new Set(names.map((name) => name.trim()))];
  const uncachedRecordNames = trimmedNames.filter((name) => !cache.has(name));

  // check the backend for existing records
  if (uncachedRecordNames.length > 0) {
    const response = await dataProvider.getList(resource, {
      filter: {
        "name@in": `(${uncachedRecordNames
          .map((name) => `"${name}"`)
          .join(",")})`,
      },
      pagination: { page: 1, perPage: trimmedNames.length },
      sort: { field: "id", order: "ASC" },
    });
    for (const record of response.data) {
      cache.set(record.name.trim(), record);
    }
  }

  // create missing records in parallel
  await Promise.all(
    uncachedRecordNames.map(async (name) => {
      if (cache.has(name)) return;
      const response = await dataProvider.create(resource, {
        data: getCreateData(name),
      });
      cache.set(name, response.data);
    }),
  );

  // now all records are in cache, return a map of all records
  return trimmedNames.reduce((acc, name) => {
    acc.set(name, cache.get(name) as T);
    return acc;
  }, new Map<string, T>());
};

const parseTags = (tags: string) =>
  tags
    ?.split(",")
    ?.map((tag: string) => tag.trim())
    ?.filter((tag: string) => tag) ?? [];
