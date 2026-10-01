import { createCrmDb } from "@/test/StoryWrapper";
import { buildContact } from "@/test/StoryWrapper";
import type { Company, Task } from "../../types";
import { createDataProvider } from "./dataProvider";

/** Builds a minimal `companies` row fixture with an existing logo. */
function buildCompany(overrides: Partial<Company> = {}): Company {
  return {
    id: 1,
    name: "Padel Club A",
    logo: { src: "data:image/png;base64,existing-logo" },
    created_at: "2025-01-01T00:00:00.000Z",
    ...overrides,
  } as Company;
}

describe("companies dataProvider beforeUpdate", () => {
  it("preserves the existing logo on a partial update that omits it", async () => {
    // Arrange
    const company = buildCompany();
    const dataProvider = createDataProvider({
      db: createCrmDb({ companies: [company] }),
      latency: 0,
      silent: true,
    });

    // Act
    const { data: updated } = await dataProvider.update("companies", {
      id: 1,
      data: { status: "client" },
      previousData: company,
    });

    // Assert
    expect(updated.logo).toEqual(company.logo);
    expect(updated.status).toBe("client");
  });

  it("still processes the logo when the update carries one", async () => {
    // Arrange
    const company = buildCompany();
    const dataProvider = createDataProvider({
      db: createCrmDb({ companies: [company] }),
      latency: 0,
      silent: true,
    });
    const newLogo = { src: "data:image/png;base64,new-logo", title: "logo" };

    // Act
    const { data: updated } = await dataProvider.update("companies", {
      id: 1,
      data: { logo: newLogo },
      previousData: company,
    });

    // Assert
    expect(updated.logo).toEqual(newLogo);
  });
});

describe("contact note next action creation", () => {
  const note = {
    contact_id: 1,
    date: "2026-10-01T10:00:00.000Z",
    sales_id: 0,
    text: "Point de suivi",
  };

  const listRecords = (
    dataProvider: ReturnType<typeof createDataProvider>,
    resource: string,
  ) =>
    dataProvider.getList(resource, {
      filter: {},
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });

  it("creates a task, updates the contact and preserves attachment hooks", async () => {
    const db = createCrmDb({ contacts: [buildContact()] });
    const dataProvider = createDataProvider({ db, latency: 0, silent: true });

    const { data: createdNote } = await dataProvider.create("contact_notes", {
      data: {
        ...note,
        attachments: [
          {
            src: "data:image/png;base64,AA==",
            title: "capture.png",
            rawFile: new File([], "capture.png", { type: "image/png" }),
          },
        ],
        next_action: {
          mode: "create",
          text: "Rappeler le club",
          due_date: "2026-10-03",
        },
      },
    });

    expect(createdNote).not.toHaveProperty("next_action");
    expect(createdNote.attachments?.[0].type).toBe("image/png");
    const { data: notes } = await listRecords(dataProvider, "contact_notes");
    const { data: tasks } = await listRecords(dataProvider, "tasks");
    const { data: updatedContact } = await dataProvider.getOne("contacts", {
      id: 1,
    });
    expect(notes).toHaveLength(1);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      contact_id: 1,
      type: "none",
      text: "Rappeler le club",
      due_date: "2026-10-03",
      done_date: null,
      sales_id: 0,
    });
    expect(updatedContact.nb_tasks).toBe(1);
    expect(updatedContact.last_seen).not.toBe("2025-01-02T10:00:00.000Z");
  });

  it("accepts an existing open task without creating a duplicate", async () => {
    const task: Task = {
      id: 12,
      contact_id: 1,
      type: "call",
      text: "Déjà planifié",
      due_date: "2026-10-04",
      done_date: null,
      sales_id: 0,
    };
    const db = createCrmDb({ contacts: [buildContact()], tasks: [task] });
    const dataProvider = createDataProvider({ db, latency: 0, silent: true });

    await dataProvider.create("contact_notes", {
      data: {
        ...note,
        next_action: { mode: "existing", task_id: task.id },
      },
    });

    const { data: notes } = await listRecords(dataProvider, "contact_notes");
    const { data: tasks } = await listRecords(dataProvider, "tasks");
    const { data: updatedContact } = await dataProvider.getOne("contacts", {
      id: 1,
    });
    expect(notes).toHaveLength(1);
    expect(tasks).toEqual([task]);
    expect(updatedContact.nb_tasks).toBe(0);
    expect(updatedContact.last_seen).not.toBe("2025-01-02T10:00:00.000Z");
  });

  it("rolls back the note, task and contact when the contact update fails", async () => {
    const contact = buildContact();
    const db = createCrmDb({ contacts: [contact] });
    const dataProvider = createDataProvider({ db, latency: 0, silent: true });
    const update = dataProvider.update.bind(dataProvider);
    vi.spyOn(dataProvider, "update").mockImplementation(
      async (resource, params) => {
        const result = await update(resource, params);
        if (resource === "contacts" && "last_seen" in params.data) {
          throw new Error("contact write failed");
        }
        return result;
      },
    );

    await expect(
      dataProvider.create("contact_notes", {
        data: {
          ...note,
          next_action: {
            mode: "create",
            text: "Rappeler le club",
            due_date: "2026-10-03",
          },
        },
      }),
    ).rejects.toThrow("contact write failed");

    const { data: notes } = await listRecords(dataProvider, "contact_notes");
    const { data: tasks } = await listRecords(dataProvider, "tasks");
    const { data: restoredContact } = await dataProvider.getOne("contacts", {
      id: 1,
    });
    expect(notes).toHaveLength(0);
    expect(tasks).toHaveLength(0);
    expect(restoredContact.last_seen).toBe("2025-01-02T10:00:00.000Z");
    expect(restoredContact.nb_tasks).toBe(0);
  });

  it("keeps historical note imports without next_action unchanged", async () => {
    const db = createCrmDb({ contacts: [buildContact()] });
    const dataProvider = createDataProvider({ db, latency: 0, silent: true });

    const { data: createdNote } = await dataProvider.create("contact_notes", {
      data: note,
    });

    expect(createdNote).toMatchObject(note);
    const { data: notes } = await listRecords(dataProvider, "contact_notes");
    const { data: tasks } = await listRecords(dataProvider, "tasks");
    const { data: unchangedContact } = await dataProvider.getOne("contacts", {
      id: 1,
    });
    expect(notes).toHaveLength(1);
    expect(tasks).toHaveLength(0);
    expect(unchangedContact.last_seen).toBe("2025-01-02T10:00:00.000Z");
  });

  it("rejects malformed actions and checklist writes before saving", async () => {
    const db = createCrmDb({ contacts: [buildContact()] });
    const dataProvider = createDataProvider({ db, latency: 0, silent: true });

    await expect(
      dataProvider.create("contact_notes", {
        data: {
          ...note,
          next_action: {
            mode: "create",
            text: "Rappeler",
            due_date: "2026-10-03",
            extra: true,
          },
        },
      }),
    ).rejects.toThrow("next_action is invalid");

    await expect(
      dataProvider.update("contacts", {
        id: 1,
        data: { client_checklist: ["same", "same"] },
        previousData: buildContact(),
      }),
    ).rejects.toThrow("client_checklist");

    const { data: notes } = await listRecords(dataProvider, "contact_notes");
    expect(notes).toHaveLength(0);
  });
});
