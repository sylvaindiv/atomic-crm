import type { Company, Contact, Deal, Task } from "../../../types";
import type { Db } from "./types";
import { finalize } from "./finalize";

const makeContact = (id: number, overrides: Partial<Contact> = {}): Contact =>
  ({ id, linked_deal_id: null, ...overrides }) as unknown as Contact;

const makeCompany = (
  overrides: Partial<Company> & Pick<Company, "id">,
): Company => ({ name: "Company", ...overrides }) as unknown as Company;

const makeTask = (overrides: Partial<Task> & Pick<Task, "id">): Task =>
  ({ done_date: null, ...overrides }) as unknown as Task;

const makeDeal = (overrides: Partial<Deal> & Pick<Deal, "id">): Deal =>
  ({
    name: "Deal",
    case_type: "judge",
    contact_ids: [],
    created_at: new Date("2020-01-01T00:00:00.000Z").toISOString(),
    ...overrides,
  }) as unknown as Deal;

const makeDb = (
  contacts: Contact[],
  deals: Deal[],
  companies: Company[] = [],
  tasks: Task[] = [],
): Db =>
  ({
    contacts,
    contact_notes: [],
    deals,
    companies,
    tasks,
  }) as unknown as Db;

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

  it("resolves club_name through the referee's company for a judge deal", () => {
    const company = makeCompany({ id: 1, name: "Padel Club Paris" });
    const contact = makeContact(1, { company_id: 1 });
    const db = makeDb(
      [contact],
      [makeDeal({ id: 1, case_type: "judge", contact_ids: [1] })],
      [company],
    );

    finalize(db);

    expect(db.deals[0].club_name).toBe("Padel Club Paris");
  });

  it("picks the earliest open (not done) task as next_action_due_date", () => {
    const db = makeDb(
      [makeContact(1)],
      [makeDeal({ id: 1, case_type: "judge", contact_ids: [1] })],
      [],
      [
        makeTask({ id: 1, contact_id: 1, due_date: "2026-03-01" }),
        makeTask({
          id: 2,
          contact_id: 1,
          due_date: "2026-01-01",
          done_date: "2026-01-02",
        }),
        makeTask({ id: 3, contact_id: 1, due_date: "2026-02-01" }),
      ],
    );

    finalize(db);

    expect(db.deals[0].next_action_due_date).toBe("2026-02-01");
  });

  it("picks the earliest open (not done) task as a contact's own next_action_due_date", () => {
    const db = makeDb(
      [makeContact(1)],
      [],
      [],
      [
        makeTask({ id: 1, contact_id: 1, due_date: "2026-03-01" }),
        makeTask({
          id: 2,
          contact_id: 1,
          due_date: "2026-01-01",
          done_date: "2026-01-02",
        }),
        makeTask({ id: 3, contact_id: 1, due_date: "2026-02-01" }),
      ],
    );

    finalize(db);

    expect(db.contacts[0].next_action_due_date).toBe("2026-02-01");
  });

  it("leaves a contact's next_action_due_date null when it has no open task", () => {
    const db = makeDb([makeContact(1)], []);

    finalize(db);

    expect(db.contacts[0].next_action_due_date).toBeNull();
  });
});
