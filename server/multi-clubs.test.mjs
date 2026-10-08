import { beforeAll, afterAll, describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
let db, q, R;
const dir = mkdtempSync(join(tmpdir(), "clubs-query-"));
beforeAll(async () => {
  vi.stubEnv("TURSO_DATABASE_URL", `file:${dir}/test.db`);
  const module = await import("./db.mjs");
  db = module.db;
  await module.initSchema();
  await module.loadTableColumns();
  q = await import("./query.mjs");
  R = q.RESOURCES;
  await db.execute(
    "INSERT INTO companies(id,name) VALUES(1,'A'),(2,'B'),(3,'C')",
  );
});
afterAll(() => {
  db?.close();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});
describe("multi-clubs API", () => {
  it("queries secondary memberships once, enforces bulk validation atomically and detaches without deleting history", async () => {
    const a = (
      await q.create(R.contacts, {
        data: { first_name: "A", company_ids: [1, 2], contact_type: "referee" },
      })
    ).data;
    const b = (
      await q.create(R.contacts, {
        data: { first_name: "B", company_ids: [1], contact_type: "partner" },
      })
    ).data;
    await q.create(R.contact_notes, {
      data: { contact_id: a.id, text: "Keep" },
    });
    await q.create(R.tasks, { data: { contact_id: a.id, text: "Keep" } });
    expect(
      (
        await q.getList(R.contacts_summary, { filter: { company_id: 2 } })
      ).data.map((r) => r.id),
    ).toEqual([a.id]);
    expect(
      (
        await q.getManyReference(R.contacts, { target: "company_id", id: 2 })
      ).data.map((r) => r.id),
    ).toEqual([a.id]);
    expect(
      (await q.getList(R.contacts_summary, { filter: { company_id: [1, 2] } }))
        .total,
    ).toBe(2);
    await expect(
      q.updateMany(R.contacts, {
        ids: [a.id, b.id],
        data: { company_ids: [2, 3] },
      }),
    ).rejects.toThrow("only one");
    expect((await q.getOne(R.contacts, { id: a.id })).data.company_ids).toEqual(
      [1, 2],
    );
    await q.updateMany(R.contacts, {
      ids: [a.id, b.id],
      data: { company_id: 3 },
    });
    expect((await q.getOne(R.contacts, { id: a.id })).data.company_ids).toEqual(
      [3, 2],
    );
    expect((await q.getOne(R.contacts, { id: b.id })).data.company_ids).toEqual(
      [3],
    );
    await q.update(R.contacts, {
      id: b.id,
      data: { company_id: 2, company_ids: [3] },
    });
    expect((await q.getOne(R.contacts, { id: b.id })).data.company_ids).toEqual(
      [2],
    );
    await q.update(R.contacts, { id: b.id, data: { company_id: 3 } });
    await q.deleteMany(R.companies, { ids: [3] });
    expect((await q.getOne(R.contacts, { id: a.id })).data.company_ids).toEqual(
      [2],
    );
    expect((await q.getOne(R.contacts, { id: b.id })).data.company_ids).toEqual(
      [],
    );
    expect((await q.getList(R.contact_notes, {})).total).toBe(1);
    expect((await q.getList(R.tasks, {})).total).toBe(1);
  });
  it("enforces textual unique TenUp IDs and rejects unknown clubs for all writes", async () => {
    await expect(
      q.create(R.contacts, { data: { next_action: { mode: "invalid" } } }),
    ).rejects.toThrow("only supported");
    await q.create(R.contacts, { data: { tenup_id: "001" } });
    await expect(
      q.create(R.contacts, { data: { tenup_id: "001" } }),
    ).rejects.toThrow();
    await expect(
      q.create(R.contacts, { data: { tenup_id: 2 } }),
    ).rejects.toThrow();
    await expect(
      q.create(R.contacts, { data: { company_ids: [999] } }),
    ).rejects.toThrow();
  });
});
