import type { Contact, NoteStatus } from "../../types";
import { getContactsByStatus, getVisibleContactStatuses } from "./contactStages";

const makeStatus = (
  overrides: Partial<NoteStatus> & Pick<NoteStatus, "value">,
): NoteStatus =>
  ({
    label: overrides.value,
    color: "#000000",
    visibleInDealsKanban: true,
    ...overrides,
  }) as NoteStatus;

const makeContact = (
  overrides: Partial<Contact> & Pick<Contact, "id" | "status">,
): Contact =>
  ({
    first_name: "Jane",
    last_name: "Doe",
    index: 0,
    ...overrides,
  }) as unknown as Contact;

describe("getVisibleContactStatuses", () => {
  it("excludes a status explicitly flagged not visible", () => {
    const noteStatuses = [
      makeStatus({ value: "a" }),
      makeStatus({ value: "b", visibleInDealsKanban: false }),
    ];

    expect(
      getVisibleContactStatuses(noteStatuses).map((s) => s.value),
    ).toEqual(["a"]);
  });

  it("treats a status persisted without the visibility flag as visible", () => {
    const noteStatuses = [
      { value: "legacy", label: "Legacy", color: "#000000" } as NoteStatus,
    ];

    expect(
      getVisibleContactStatuses(noteStatuses).map((s) => s.value),
    ).toEqual(["legacy"]);
  });
});

describe("getContactsByStatus", () => {
  it("groups contacts per visible column, ordered by index", () => {
    const noteStatuses = [
      makeStatus({ value: "a_recontacter" }),
      makeStatus({ value: "client" }),
    ];
    const contacts = [
      makeContact({ id: 1, status: "client", index: 1 }),
      makeContact({ id: 2, status: "a_recontacter", index: 0 }),
      makeContact({ id: 3, status: "client", index: 0 }),
    ];

    const result = getContactsByStatus(contacts, noteStatuses);

    expect(result.a_recontacter.map((c) => c.id)).toEqual([2]);
    expect(result.client.map((c) => c.id)).toEqual([3, 1]);
  });

  it("preserves configuration order for the produced columns", () => {
    const noteStatuses = [
      makeStatus({ value: "z" }),
      makeStatus({ value: "a" }),
    ];

    const result = getContactsByStatus([], noteStatuses);

    expect(Object.keys(result)).toEqual(["z", "a"]);
  });

  it("omits a contact whose status matches no visible column, without rewriting its status", () => {
    const noteStatuses = [makeStatus({ value: "client" })];
    const contact = makeContact({ id: 1, status: "won", index: 0 });

    const result = getContactsByStatus([contact], noteStatuses);

    expect(result.client).toEqual([]);
    expect(result.won).toBeUndefined();
    expect(contact.status).toBe("won");
  });

  it("omits a contact whose status is flagged not visible", () => {
    const noteStatuses = [
      makeStatus({ value: "client" }),
      makeStatus({ value: "mort", visibleInDealsKanban: false }),
    ];
    const contact = makeContact({ id: 1, status: "mort", index: 0 });

    const result = getContactsByStatus([contact], noteStatuses);

    expect(result.mort).toBeUndefined();
    expect(contact.status).toBe("mort");
  });

  it("sorts contacts needing action (overdue or due today) above the rest, index otherwise", () => {
    const noteStatuses = [makeStatus({ value: "client" })];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const today = new Date().toISOString();
    const nextWeek = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const contacts = [
      makeContact({
        id: 1,
        status: "client",
        index: 0,
        next_action_due_date: nextWeek,
      }),
      makeContact({
        id: 2,
        status: "client",
        index: 1,
        next_action_due_date: yesterday,
      }),
      makeContact({
        id: 3,
        status: "client",
        index: 2,
        next_action_due_date: null,
      }),
      makeContact({
        id: 4,
        status: "client",
        index: 3,
        next_action_due_date: today,
      }),
    ];

    const result = getContactsByStatus(contacts, noteStatuses);

    // needs-action contacts (2, 4) first, in their original index order,
    // then the rest (1, 3) in their original index order.
    expect(result.client.map((c) => c.id)).toEqual([2, 4, 1, 3]);
  });
});
