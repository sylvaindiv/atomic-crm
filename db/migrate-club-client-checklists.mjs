const CLUB_IDS = new Set(["stripe-connected", "advantage-system-configured"]);

const columns = async (tx, table) => {
  const { rows } = await tx.execute(`PRAGMA table_info("${table}")`);
  return rows.map((row) => row.name);
};

/** Upgrade legacy per-contact client progress into independent club/referee lists. */
export async function migrateClubClientChecklists(client) {
  const tx = await client.transaction("write");
  try {
    const companyColumns = await columns(tx, "companies");
    if (!companyColumns.includes("is_client")) {
      await tx.execute(
        "ALTER TABLE companies ADD COLUMN is_client INTEGER NOT NULL DEFAULT 0",
      );
    }
    if (!companyColumns.includes("client_checklist")) {
      await tx.execute(
        "ALTER TABLE companies ADD COLUMN client_checklist TEXT NOT NULL DEFAULT '[]'",
      );
    }
    const contactColumns = await columns(tx, "contacts");
    if (!contactColumns.includes("client_checklist")) {
      await tx.execute(
        "ALTER TABLE contacts ADD COLUMN client_checklist TEXT NOT NULL DEFAULT '[]'",
      );
    }
    await tx.execute(`CREATE TABLE IF NOT EXISTS club_referees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON UPDATE CASCADE ON DELETE CASCADE,
      contact_id INTEGER NOT NULL REFERENCES contacts(id) ON UPDATE CASCADE ON DELETE CASCADE,
      client_checklist TEXT NOT NULL DEFAULT '[]',
      UNIQUE(company_id, contact_id)
    )`);
    await tx.execute(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))",
    );
    const { rows: applied } = await tx.execute({
      sql: "SELECT name FROM schema_migrations WHERE name = ?",
      args: ["club-client-checklists-v1"],
    });
    if (applied.length) {
      await tx.commit();
      return { migrated: false, orphaned: [] };
    }

    const { rows: contacts } = await tx.execute(
      "SELECT id, company_id, status, client_checklist FROM contacts WHERE contact_type = 'referee'",
    );
    const { rows: configRows } = await tx.execute(
      "SELECT id, config FROM configuration WHERE id = 1",
    );
    let config = {};
    try {
      config = JSON.parse(configRows[0]?.config ?? "{}");
    } catch {
      config = {};
    }
    const oldSteps = Array.isArray(config.clientChecklist)
      ? config.clientChecklist
      : undefined;
    if (oldSteps) {
      config.clubChecklist ??= oldSteps.filter((step) =>
        CLUB_IDS.has(step.value),
      );
      config.refereeChecklist ??= oldSteps.filter(
        (step) => !CLUB_IDS.has(step.value),
      );
      await tx.execute({
        sql: "UPDATE configuration SET config = ? WHERE id = 1",
        args: [JSON.stringify(config)],
      });
    }

    const byCompany = new Map();
    const orphaned = [];
    for (const contact of contacts) {
      let selected = [];
      try {
        selected = JSON.parse(contact.client_checklist ?? "[]");
      } catch {
        /* retain malformed legacy data untouched */
      }
      if (contact.status === "client") {
        if (contact.company_id == null) orphaned.push(contact.id);
        else
          await tx.execute({
            sql: "UPDATE companies SET is_client = 1 WHERE id = ?",
            args: [contact.company_id],
          });
      }
      if (contact.company_id == null) continue;
      const refereeSteps = selected.filter((id) => !CLUB_IDS.has(id));
      const clubSteps = selected.filter((id) => CLUB_IDS.has(id));
      await tx.execute({
        sql: "INSERT OR IGNORE INTO club_referees (company_id, contact_id, client_checklist) VALUES (?, ?, ?)",
        args: [contact.company_id, contact.id, JSON.stringify(refereeSteps)],
      });
      const current = byCompany.get(contact.company_id) ?? new Set();
      clubSteps.forEach((id) => current.add(id));
      byCompany.set(contact.company_id, current);
    }
    for (const [companyId, ids] of byCompany) {
      await tx.execute({
        sql: "UPDATE companies SET client_checklist = ? WHERE id = ?",
        args: [JSON.stringify([...ids]), companyId],
      });
    }
    await tx.execute({
      sql: "INSERT INTO schema_migrations (name) VALUES (?)",
      args: ["club-client-checklists-v1"],
    });
    await tx.commit();
    return { migrated: true, orphaned };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}
