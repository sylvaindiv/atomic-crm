import type { DataProvider } from "ra-core";

import type { Company } from "../../types";
import { normalizeText } from "./findDuplicateContacts";

// See adr/ADR-02f50f28-TASK-003-club-merge-name-only-matching.md

// Same bounded client-side snapshot convention as findDuplicateContacts.ts
// (see ADR-02f50f28-TASK-002): the filter layer can't compare a normalized
// derived value server-side.
const CANDIDATE_FETCH_LIMIT = 1000;

/**
 * Find companies (clubs) whose name normalizes (lowercase, accent-stripped,
 * whitespace-collapsed) to the same value as `company`'s -- the only usable
 * duplicate signal, since no company row has phone_number, website or
 * address populated in production. Unlike contacts, there is a single match
 * reason, so candidates are returned as plain records, not ranked.
 */
export async function findDuplicateCompanies(
  company: Company,
  dataProvider: DataProvider,
): Promise<Company[]> {
  const targetName = normalizeText(company.name || "");
  if (!targetName) return [];

  const { data: companies } = await dataProvider.getList<Company>("companies", {
    filter: {},
    pagination: { page: 1, perPage: CANDIDATE_FETCH_LIMIT },
    sort: { field: "id", order: "ASC" },
  });

  return companies.filter(
    (other) =>
      other.id !== company.id && normalizeText(other.name || "") === targetName,
  );
}
