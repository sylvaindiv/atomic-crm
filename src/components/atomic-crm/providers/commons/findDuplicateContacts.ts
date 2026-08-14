import type { DataProvider, Identifier } from "ra-core";

import type { Contact } from "../../types";

// See adr/ADR-02f50f28-TASK-002-duplicate-contact-matching.md

// A single client-side "get everything" read, mirroring the bounded-fetch
// convention already used for contact lookups (see getContactsByName in
// useContactImport.tsx and ADR-c7993f35-TASK-004): the filter layer can't
// compare a normalized/derived value server-side, so candidates are matched
// client-side against a bounded snapshot instead.
const CANDIDATE_FETCH_LIMIT = 1000;

// A name entirely wrapped in parentheses is a placeholder (e.g.
// "(non renseigne)"), not a real name -- never usable for name matching.
const PLACEHOLDER_NAME_PATTERN = /^\(.*\)$/;

// Diacritic marks left behind by NFD decomposition (e.g. "e" + COMBINING
// ACUTE ACCENT after decomposing "é"). Stripping them is what turns
// "Sebastien Hery" and "Sébastien HÉRY" into the same normalized string.
const DIACRITICS_PATTERN = /\p{Diacritic}/gu;

export type DuplicateMatchReason = "name" | "email" | "phone";

export interface DuplicateContactCandidate {
  contact: Contact;
  /**
   * Every lookup that surfaced this candidate. A phone-only match ("phone"
   * is the only entry) is a weak signal -- two people can share a club's
   * landline -- and must never be treated as safe to auto-preselect; only a
   * "name" or "email" entry corroborates identity.
   */
  matchedBy: DuplicateMatchReason[];
}

/**
 * Normalize free text for comparison: lowercase, accent-stripped,
 * whitespace-collapsed. Generic on purpose -- reused beyond contact names
 * (e.g. club/company name matching).
 */
export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedFullName(contact: Contact): string {
  return normalizeText(`${contact.first_name} ${contact.last_name}`);
}

function isUsableName(normalizedName: string): boolean {
  return (
    normalizedName.length > 0 && !PLACEHOLDER_NAME_PATTERN.test(normalizedName)
  );
}

/** True when the candidate corroborates identity strongly enough to auto-preselect. */
export function canAutoPreselect(
  candidate: DuplicateContactCandidate,
): boolean {
  return (
    candidate.matchedBy.includes("name") ||
    candidate.matchedBy.includes("email")
  );
}

/**
 * Find candidate duplicates of `contact` by unioning three lookups: name
 * (case- and accent-insensitive, blank/placeholder names excluded), shared
 * email_jsonb entry, shared phone_jsonb entry. Each candidate appears once,
 * carrying every reason it matched. Ranked strongest-first (name/email
 * before phone-only) so the best candidate is first.
 */
export async function findDuplicateContacts(
  contact: Contact,
  dataProvider: DataProvider,
): Promise<DuplicateContactCandidate[]> {
  const { data: contacts } = await dataProvider.getList<Contact>("contacts", {
    filter: {},
    pagination: { page: 1, perPage: CANDIDATE_FETCH_LIMIT },
    sort: { field: "id", order: "ASC" },
  });

  const targetName = normalizedFullName(contact);
  const targetNameIsUsable = isUsableName(targetName);
  const targetEmails = new Set(
    (contact.email_jsonb || []).map((entry) => entry.email).filter(Boolean),
  );
  const targetPhones = new Set(
    (contact.phone_jsonb || []).map((entry) => entry.number).filter(Boolean),
  );

  const candidates = new Map<Identifier, DuplicateContactCandidate>();

  for (const other of contacts) {
    if (other.id === contact.id) continue;

    const matchedBy: DuplicateMatchReason[] = [];

    if (targetNameIsUsable && normalizedFullName(other) === targetName) {
      matchedBy.push("name");
    }
    if (
      (other.email_jsonb || []).some((entry) => targetEmails.has(entry.email))
    ) {
      matchedBy.push("email");
    }
    if (
      (other.phone_jsonb || []).some((entry) => targetPhones.has(entry.number))
    ) {
      matchedBy.push("phone");
    }

    if (matchedBy.length > 0) {
      candidates.set(other.id, { contact: other, matchedBy });
    }
  }

  return Array.from(candidates.values()).sort(
    (a, b) => Number(canAutoPreselect(b)) - Number(canAutoPreselect(a)),
  );
}
