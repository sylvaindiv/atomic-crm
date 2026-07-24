import type { Company, Tag } from "../../../types";
import type { Db } from "./types";
import { generateContacts } from "./contacts";

const makeCompany = (id: number): Company =>
  ({
    id,
    name: `Company ${id}`,
    size: 500,
    nb_contacts: 0,
    created_at: new Date("2020-01-01T00:00:00.000Z").toISOString(),
    sales_id: 1,
  }) as unknown as Company;

const makeTags = (): Tag[] => [
  { id: 1, name: "vip", color: "#fff" },
  { id: 2, name: "prospect", color: "#000" },
];

describe("generateContacts", () => {
  it("leaves referred_by_id null on the very first generated contact", () => {
    const db = { companies: [makeCompany(1)], tags: makeTags() } as unknown as Db;

    const [firstContact] = generateContacts(db, 1);

    expect(firstContact.referred_by_id).toBeNull();
    expect(firstContact.referred_by_name).toBe("");
  });

  it("only refers to an already-generated contact, denormalizing a matching referred_by_name", () => {
    // 5 companies * 50-contact capacity (size 500) comfortably exceeds the
    // 200 contacts generated below, so the "pick a company with room" loop
    // in generateContacts can never exhaust it.
    const db = {
      companies: Array.from({ length: 5 }, (_, index) => makeCompany(index)),
      tags: makeTags(),
    } as unknown as Db;

    const contacts = generateContacts(db, 200);
    const byId = new Map(contacts.map((contact) => [contact.id, contact]));

    const withReferrer = contacts.filter(
      (contact) => contact.referred_by_id != null,
    );
    const withoutReferrer = contacts.filter(
      (contact) => contact.referred_by_id == null,
    );

    // ~15% weighted chance per contact, applied up to 199 times, makes both
    // groups non-empty for all practical purposes (a large sample, not a
    // timing- or environment-dependent flake source).
    expect(withReferrer.length).toBeGreaterThan(0);
    expect(withoutReferrer.length).toBeGreaterThan(0);

    for (const contact of withoutReferrer) {
      expect(contact.referred_by_name).toBe("");
    }

    for (const contact of withReferrer) {
      const referrer = byId.get(contact.referred_by_id!);
      expect(referrer).toBeDefined();
      expect(Number(referrer!.id)).toBeLessThan(Number(contact.id));
      expect(contact.referred_by_name).toBe(
        `${referrer!.first_name} ${referrer!.last_name}`,
      );
    }
  });
});
