import { buildContact, createCrmDb } from "@/test/StoryWrapper";
import { createDataProvider } from "../fakerest/dataProvider";
import { withContactTypes } from "./withContactTypes";
import { updateContactStatus } from "../../contacts/kanban/ContactKanban";

const params = (page = 1, perPage = 10, filter = {}) => ({
  pagination: { page, perPage },
  sort: { field: "id", order: "ASC" as const },
  filter,
});

describe("contact populations in FakeRest", () => {
  it("filters before pagination and keeps created partners in their own resource", async () => {
    const db = createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Referee", contact_type: "referee" }),
        buildContact({ id: 2, first_name: "Partner", contact_type: "partner" }),
        buildContact({ id: 3, first_name: "Another", contact_type: "referee" }),
      ],
    });
    const provider = withContactTypes(
      createDataProvider({ db, latency: 0, silent: true }),
    );

    const referees = await provider.getList("contacts", params(1, 1));
    const partners = await provider.getList("partners", params(1, 1));
    expect(referees.total).toBe(2);
    expect(referees.data.map((contact) => contact.id)).toEqual([1]);
    expect(partners.total).toBe(1);
    expect(partners.data.map((contact) => contact.id)).toEqual([2]);
    expect(
      (await provider.getList("partners", params(1, 10, { q: "Partner" })))
        .total,
    ).toBe(1);
    expect(
      (await provider.getList("contacts", params(1, 10, { q: "Partner" })))
        .total,
    ).toBe(0);

    const created = await provider.create("partners", {
      data: {
        first_name: "New",
        last_name: "Partner",
        contact_type: "referee",
      },
    });
    expect(created.data.contact_type).toBe("partner");
    await provider.update("partners", {
      id: created.data.id,
      data: { last_name: "Updated", contact_type: "referee" },
      previousData: created.data,
    });
    expect(
      (await provider.getOne("partners", { id: created.data.id })).data
        .last_name,
    ).toBe("Updated");
    expect((await provider.getList("partners", params())).total).toBe(2);
    expect((await provider.getList("contacts", params())).total).toBe(2);
    await expect(provider.getOne("partners", { id: 1 })).rejects.toThrow();
    await expect(
      provider.update("contacts", {
        id: created.data.id,
        data: { last_name: "Wrong tab" },
        previousData: created.data,
      }),
    ).rejects.toThrow();
  });

  it("keeps partner notes and tasks out of referee dashboard queries", async () => {
    const db = createCrmDb({
      contacts: [
        buildContact({ id: 1 }),
        buildContact({ id: 2, contact_type: "partner" }),
      ],
      contact_notes: [
        {
          id: 1,
          contact_id: 1,
          text: "Referee note",
          date: "2026-01-01",
          sales_id: 1,
          status: "",
        },
        {
          id: 2,
          contact_id: 2,
          text: "Partner note",
          date: "2026-01-02",
          sales_id: 1,
          status: "",
        },
      ],
      tasks: [
        {
          id: 1,
          contact_id: 1,
          type: "call",
          text: "Referee task",
          due_date: "2026-01-01",
          sales_id: 1,
        },
        {
          id: 2,
          contact_id: 2,
          type: "call",
          text: "Partner task",
          due_date: "2026-01-02",
          sales_id: 1,
        },
      ],
    });
    const provider = withContactTypes(
      createDataProvider({ db, latency: 0, silent: true }),
    );
    for (const resource of ["contact_notes", "tasks"]) {
      const result = await provider.getList(
        resource,
        params(1, 1, { contact_type: "referee" }),
      );
      expect(result.total).toBe(1);
      expect(result.data[0].contact_id).toBe(1);
    }
    const activity = await provider.getList("activity_log", params());
    expect(
      activity.data
        .filter((entry) => entry.contactNote)
        .map((entry) => entry.contactNote.contact_id),
    ).toEqual([1]);
  });

  it("reorders partners without changing a referee sharing their status and index", async () => {
    const referee = buildContact({ id: 1, status: "client", index: 0 });
    const firstPartner = buildContact({
      id: 2,
      contact_type: "partner",
      status: "client",
      index: 0,
    });
    const secondPartner = buildContact({
      id: 3,
      contact_type: "partner",
      status: "client",
      index: 1,
    });
    const db = createCrmDb({
      contacts: [referee, firstPartner, secondPartner],
    });
    const provider = withContactTypes(
      createDataProvider({ db, latency: 0, silent: true }),
    );

    await updateContactStatus(secondPartner, firstPartner, provider);

    expect((await provider.getOne("contacts", { id: 1 })).data.index).toBe(0);
    expect((await provider.getOne("partners", { id: 3 })).data.index).toBe(0);
  });

  it("keeps a partner with Client status out of referee views", async () => {
    const db = createCrmDb({
      contacts: [
        buildContact({ id: 1, status: "client", company_id: 5 }),
        buildContact({
          id: 2,
          contact_type: "partner",
          status: "client",
          company_id: 5,
        }),
      ],
    });
    const provider = withContactTypes(
      createDataProvider({ db, latency: 0, silent: true }),
    );
    expect(
      (
        await provider.getList("contacts", params(1, 10, { status: "client" }))
      ).data.map((contact) => contact.id),
    ).toEqual([1]);
    expect(
      (
        await provider.getList("partners", params(1, 10, { status: "client" }))
      ).data.map((contact) => contact.id),
    ).toEqual([2]);
    const related = await provider.getManyReference("contacts_summary", {
      target: "company_id",
      id: 5,
      ...params(),
    });
    expect(related.total).toBe(1);
    expect(related.data[0].id).toBe(1);
  });
});
