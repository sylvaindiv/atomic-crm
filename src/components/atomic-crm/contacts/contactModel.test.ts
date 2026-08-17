import type { Contact } from "../types";
import { contactFullName, exportToVCard } from "./contactModel";

const makeContact = (overrides: Partial<Contact> = {}): Contact =>
  ({
    id: 1,
    first_name: "Ada",
    last_name: "Lovelace",
    title: "",
    email_jsonb: [],
    phone_jsonb: [],
    first_seen: "2024-01-01T00:00:00.000Z",
    last_seen: "2024-01-01T00:00:00.000Z",
    has_newsletter: false,
    tags: [],
    gender: "",
    status: "client",
    background: "",
    ...overrides,
  }) as unknown as Contact;

describe("exportToVCard", () => {
  it("omits last name from FN and N when the contact has none", () => {
    const contact = makeContact({ last_name: undefined });

    const vcard = exportToVCard(contact);

    expect(vcard).toContain("FN:Ada");
    expect(vcard).not.toContain("undefined");
    expect(vcard).toContain("N:;Ada;;;");
  });
});

describe("contactFullName", () => {
  it("joins first and last name when both are present", () => {
    const contact = makeContact({ first_name: "Ada", last_name: "Lovelace" });

    expect(contactFullName(contact)).toBe("Ada Lovelace");
  });

  it("omits last name when it is undefined", () => {
    const contact = makeContact({ last_name: undefined });

    expect(contactFullName(contact)).toBe("Ada");
  });

  it("omits last name when it is null (DB NULL)", () => {
    const contact = makeContact({ last_name: null as unknown as string });

    expect(contactFullName(contact)).toBe("Ada");
  });
});
