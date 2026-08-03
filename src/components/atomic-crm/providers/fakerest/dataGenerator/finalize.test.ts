import type { Contact, Deal } from "../../../types";
import type { Db } from "./types";
import { finalize } from "./finalize";

const makeContact = (id: number): Contact =>
  ({ id, linked_deal_id: null }) as unknown as Contact;

const makeDeal = (overrides: Partial<Deal> & Pick<Deal, "id">): Deal =>
  ({
    name: "Deal",
    case_type: "judge",
    contact_ids: [],
    created_at: new Date("2020-01-01T00:00:00.000Z").toISOString(),
    ...overrides,
  }) as unknown as Deal;

const makeDb = (contacts: Contact[], deals: Deal[]): Db =>
  ({ contacts, contact_notes: [], deals } as unknown as Db);

describe("finalize", () => {
  it("leaves linked_deal_id null when the contact is party to no 'judge' deal", () => {
    const db = makeDb([makeContact(1)], []);

    finalize(db);

    expect(db.contacts[0].linked_deal_id).toBeNull();
  });

  it("ignores 'club' deals and archived 'judge' deals when linking a contact", () => {
    const db = makeDb(
      [makeContact(1)],
      [
        makeDeal({ id: 1, case_type: "club", contact_ids: [1] }),
        makeDeal({
          id: 2,
          case_type: "judge",
          contact_ids: [1],
          archived_at: "2020-06-01T00:00:00.000Z",
        }),
      ],
    );

    finalize(db);

    expect(db.contacts[0].linked_deal_id).toBeNull();
  });

  it("links a contact to its most recent non-archived 'judge' deal", () => {
    const db = makeDb(
      [makeContact(1)],
      [
        makeDeal({
          id: 1,
          case_type: "judge",
          contact_ids: [1],
          created_at: "2020-01-01T00:00:00.000Z",
        }),
        makeDeal({
          id: 2,
          case_type: "judge",
          contact_ids: [1],
          created_at: "2021-01-01T00:00:00.000Z",
        }),
      ],
    );

    finalize(db);

    expect(db.contacts[0].linked_deal_id).toBe(2);
  });
});
