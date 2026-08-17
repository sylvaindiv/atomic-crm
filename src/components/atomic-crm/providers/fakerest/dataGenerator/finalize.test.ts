import type { Contact, Task } from "../../../types";
import type { Db } from "./types";
import { finalize } from "./finalize";

const makeContact = (id: number, overrides: Partial<Contact> = {}): Contact =>
  ({ id, ...overrides }) as unknown as Contact;

const makeTask = (overrides: Partial<Task> & Pick<Task, "id">): Task =>
  ({ done_date: null, ...overrides }) as unknown as Task;

const makeDb = (contacts: Contact[], tasks: Task[] = []): Db =>
  ({
    contacts,
    contact_notes: [],
    tasks,
  }) as unknown as Db;

describe("finalize", () => {
  it("picks the earliest open (not done) task as a contact's own next_action_due_date", () => {
    const db = makeDb(
      [makeContact(1)],
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
    const db = makeDb([makeContact(1)]);

    finalize(db);

    expect(db.contacts[0].next_action_due_date).toBeNull();
  });
});
