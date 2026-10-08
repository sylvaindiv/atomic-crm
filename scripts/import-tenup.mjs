import { createClient } from "@libsql/client";
import Papa from "papaparse";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const normalize = (value) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const phone = (value) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .replace(/^(0033|33)/, "0");
const identity = (first, last) =>
  normalize(`${first} ${last}`).split(" ").sort().join(" ");
const clubOverrides = new Map(
  Object.entries({
    "MONKEY PADEL": 35,
    "CAMARG’ANIM": 332,
    "ARENA SPORT CENTER": 333,
    "ALPILLES CLUB": 334,
    PADELIMITE: 335,
  }).map(([name, id]) => [normalize(name), id]),
);
const judgeOverrides = new Map(
  Object.entries({
    "Antoine Serres": 804,
    "Benaissa Kaddouri": 802,
    "Jamil Benjalleb": 803,
    "Lucas Bismuth": 451,
    "Colin Fouyat": 436,
    "Anthony Raphael": 437,
    "Vanessa Pourin": 494,
  }).map(([name, id]) => [identity(name, ""), id]),
);
const jsonFields = new Set([
  "company_ids",
  "email_jsonb",
  "phone_jsonb",
  "tags",
]);
const decode = (row) =>
  Object.fromEntries(
    Object.entries(row).map(([key, value]) => [
      key,
      jsonFields.has(key) && typeof value === "string"
        ? JSON.parse(value)
        : value,
    ]),
  );
const idsFor = (row) =>
  row.company_ids ?? (row.company_id == null ? [] : [row.company_id]);

export async function readSources(directory) {
  const result = {};
  for (const [key, filename, required] of [
    ["clubs", "clubs.csv", ["club_id", "nom"]],
    ["judges", "juges_arbitres.csv", ["juge_id", "id_tenup", "prenom", "nom"]],
    ["links", "club_juge_tournois.csv", ["club_id", "juge_id", "tournoi_id"]],
  ]) {
    const csv = Papa.parse(await readFile(join(directory, filename), "utf8"), {
      header: true,
      skipEmptyLines: true,
      delimiter: ";",
      transform: (value) => value.trim(),
    });
    if (
      csv.errors.length ||
      required.some((field) => !csv.meta.fields?.includes(field))
    )
      throw new Error(`Invalid CSV: ${filename}`);
    result[key] = csv.data;
  }
  for (const [rows, key] of [
    [result.clubs, "club_id"],
    [result.judges, "juge_id"],
  ]) {
    if (
      rows.some((row) => !row[key]) ||
      new Set(rows.map((row) => row[key])).size !== rows.length
    )
      throw new Error(`Missing or duplicate ${key}`);
  }
  return result;
}

export function planImport(snapshot, sources, salesId) {
  const companies = snapshot.companies.map((row) => ({ ...decode(row) }));
  const contacts = snapshot.contacts.map((row) => ({ ...decode(row) }));
  const report = {
    actions: [],
    exclusions: [],
    ambiguities: [],
    divergences: [],
    matches: [],
    expectedPairs: [],
    sources,
  };
  let nextCompany =
    Math.max(
      0,
      ...companies.map((r) => r.id),
      snapshot.sequences?.companies ?? 0,
    ) + 1;
  let nextContact =
    Math.max(
      0,
      ...contacts.map((r) => r.id),
      snapshot.sequences?.contacts ?? 0,
    ) + 1;
  const clubIds = new Map();
  const judgeIds = new Map();
  const match = (rows, tenupId, candidates, override, source) => {
    const byId = rows.filter(
      (row) => row.tenup_id != null && row.tenup_id === tenupId,
    );
    const matches = new Map(
      [...byId, ...candidates].map((row) => [row.id, row]),
    );
    if (override != null) {
      const approved = rows.find((row) => row.id === override);
      if (
        !approved ||
        byId.some((row) => row.id !== override) ||
        (approved.tenup_id && approved.tenup_id !== tenupId) ||
        candidates.some((row) => row.id !== override)
      ) {
        report.ambiguities.push({
          source,
          reason: "Approved mapping conflicts with current records",
          candidates: [...matches.keys()],
          override,
        });
        return false;
      }
      return approved;
    }
    if (
      matches.size > 1 ||
      [...matches.values()].some(
        (row) => row.tenup_id && row.tenup_id !== tenupId,
      )
    ) {
      report.ambiguities.push({
        source,
        reason: "Multiple or conflicting matches",
        candidates: [...matches.keys()],
      });
      return false;
    }
    return [...matches.values()][0];
  };
  const write = (table, row, patch, source) => {
    const changes = Object.fromEntries(
      Object.entries(patch).filter(
        ([key, value]) =>
          JSON.stringify(row[key] ?? null) !== JSON.stringify(value ?? null),
      ),
    );
    if (Object.keys(changes).length) {
      report.actions.push({
        table,
        id: row.id,
        action: row._new ? "create" : "update",
        data: changes,
        source,
      });
      Object.assign(row, changes);
    }
    delete row._new;
  };
  const fill = (row, fields, source) => {
    const patch = {};
    for (const [key, value] of Object.entries(fields)) {
      if (!value) continue;
      if (row[key] == null || row[key] === "") patch[key] = value;
      else if (normalize(row[key]) !== normalize(value))
        report.divergences.push({
          source,
          field: key,
          existing: row[key],
          incoming: value,
        });
    }
    return patch;
  };
  for (const source of sources.clubs) {
    let row = match(
      companies,
      source.club_id,
      companies.filter((row) => normalize(row.name) === normalize(source.nom)),
      clubOverrides.get(normalize(source.nom)),
      source,
    );
    if (row === false) continue;
    if (!row) {
      row = { id: nextCompany++, _new: true };
      companies.push(row);
    } else
      report.matches.push({
        table: "companies",
        id: row.id,
        source: source.club_id,
      });
    write(
      "companies",
      row,
      {
        ...fill(
          row,
          {
            name: source.nom,
            address: source.adresse,
            zipcode: source.code_postal,
            city: source.ville,
            phone_number: source.telephone,
          },
          source,
        ),
        tenup_id: source.club_id,
        ...(row._new ? { sales_id: salesId } : {}),
      },
      source,
    );
    clubIds.set(source.club_id, row.id);
  }
  for (const source of sources.judges) {
    if (!source.prenom || !source.nom) {
      report.exclusions.push({ source, reason: "Missing identity" });
      continue;
    }
    const key = identity(source.prenom, source.nom);
    const candidates = contacts.filter(
      (row) =>
        identity(row.first_name, row.last_name) === key ||
        (source.email &&
          (row.email_jsonb ?? []).some(
            (item) => item.email?.toLowerCase() === source.email.toLowerCase(),
          )),
    );
    let row = match(
      contacts,
      source.id_tenup || null,
      candidates,
      judgeOverrides.get(key),
      source,
    );
    if (row === false) continue;
    if (row?.contact_type === "partner") {
      report.ambiguities.push({
        source,
        reason: "Matches a partner",
        id: row.id,
      });
      continue;
    }
    if (!row) {
      row = { id: nextContact++, _new: true };
      contacts.push(row);
    } else
      report.matches.push({
        table: "contacts",
        id: row.id,
        source: source.juge_id,
      });
    const links = sources.links.filter(
      (link) => link.juge_id === source.juge_id,
    );
    if (links.some((link) => !clubIds.has(link.club_id))) {
      report.ambiguities.push({
        source,
        reason: "Unresolved club association",
      });
      continue;
    }
    const company_ids = [
      ...new Set([
        ...idsFor(row),
        ...links.map((link) => clubIds.get(link.club_id)),
      ]),
    ];
    const patch = {
      ...fill(
        row,
        { first_name: source.prenom, last_name: source.nom },
        source,
      ),
      company_ids,
      company_id: company_ids[0] ?? null,
    };
    if (source.id_tenup) patch.tenup_id = source.id_tenup;
    if (row._new)
      Object.assign(patch, {
        contact_type: "referee",
        sales_id: salesId,
        first_seen: new Date().toISOString(),
        tags: [],
        email_jsonb: [],
        phone_jsonb: [],
      });
    for (const [field, value, key, compare] of [
      ["email_jsonb", source.email, "email", (v) => v.toLowerCase()],
      ["phone_jsonb", source.telephone, "number", phone],
    ]) {
      if (
        value &&
        !(row[field] ?? []).some(
          (item) => compare(item[key]) === compare(value),
        )
      )
        patch[field] = [...(row[field] ?? []), { [key]: value, type: "Work" }];
    }
    const sharedPhones = source.telephone
      ? contacts
          .filter(
            (other) =>
              other.id !== row.id &&
              (other.phone_jsonb ?? []).some(
                (item) => phone(item.number) === phone(source.telephone),
              ),
          )
          .map((other) => other.id)
      : [];
    if (sharedPhones.length)
      report.divergences.push({
        source,
        field: "shared_phone",
        candidates: sharedPhones,
      });
    if (key === identity("Vanessa", "Pourin")) {
      if (row.id !== 494 || row.status !== "mort") {
        report.ambiguities.push({
          source,
          reason: "Vanessa identity/status differs from approval",
        });
        continue;
      }
      Object.assign(patch, { first_name: "Vanessa", last_name: "POURIN" });
    }
    write("contacts", row, patch, source);
    judgeIds.set(source.juge_id, row.id);
    for (const club of new Set(links.map((link) => clubIds.get(link.club_id))))
      report.expectedPairs.push([row.id, club]);
  }
  for (const link of sources.links)
    if (
      !sources.judges.some((j) => j.juge_id === link.juge_id) ||
      !sources.clubs.some((c) => c.club_id === link.club_id)
    )
      report.ambiguities.push({
        source: link,
        reason: "Unknown source reference",
      });
  report.counts = {
    clubsCreated: report.actions.filter(
      (a) => a.table === "companies" && a.action === "create",
    ).length,
    judgesCreated: report.actions.filter(
      (a) => a.table === "contacts" && a.action === "create",
    ).length,
    clubsReused: report.matches.filter((a) => a.table === "companies").length,
    judgesReused: report.matches.filter((a) => a.table === "contacts").length,
    judges: judgeIds.size,
    pairs: report.expectedPairs.length,
    excluded: report.exclusions.length,
    modifications: report.actions.length,
    ambiguities: report.ambiguities.length,
  };
  return report;
}

export async function readSnapshot(client) {
  const snapshot = {};
  for (const table of ["companies", "contacts", "sales"])
    snapshot[table] = (await client.execute(`SELECT * FROM ${table}`)).rows.map(
      (row) => ({ ...row }),
    );
  snapshot.sequences = Object.fromEntries(
    (await client.execute("SELECT name,seq FROM sqlite_sequence")).rows.map(
      (row) => [row.name, Number(row.seq)],
    ),
  );
  return snapshot;
}

export async function applyPlan(tx, report) {
  if (report.ambiguities.length)
    throw new Error("Ambiguities must be resolved before applying");
  for (const action of report.actions) {
    const fields = Object.keys(action.data);
    const values = Object.entries(action.data).map(([key, value]) =>
      jsonFields.has(key) ? JSON.stringify(value) : value,
    );
    const quoted = fields.map((field) => `"${field}"`);
    await tx.execute({
      sql:
        action.action === "create"
          ? `INSERT INTO ${action.table} (id,${quoted}) VALUES (?,${fields.map(() => "?")})`
          : `UPDATE ${action.table} SET ${quoted.map((field) => `${field}=?`)} WHERE id=?`,
      args:
        action.action === "create"
          ? [action.id, ...values]
          : [...values, action.id],
    });
    await tx.execute({
      sql: "INSERT INTO record_history(table_name,record_id,action,data) VALUES(?,?,?,?)",
      args: [
        action.table,
        String(action.id),
        action.action,
        JSON.stringify({ ...action.data, import_source: action.source }),
      ],
    });
  }
  for (const [id, club] of report.expectedPairs) {
    const { rows } = await tx.execute({
      sql: "SELECT id FROM contacts WHERE id=? AND EXISTS (SELECT 1 FROM json_each(company_ids) WHERE value=?)",
      args: [id, club],
    });
    if (rows.length !== 1) throw new Error(`Missing association ${id}/${club}`);
  }
  if ((await tx.execute("PRAGMA foreign_key_check")).rows.length)
    throw new Error("Foreign key integrity failure");
}

async function main() {
  const { values } = parseArgs({
    options: {
      source: { type: "string" },
      report: { type: "string", default: ".context/tenup-import/report.json" },
      apply: { type: "boolean", default: false },
    },
  });
  if (!values.source || !process.env.TURSO_DATABASE_URL)
    throw new Error(
      "Supply --source and TURSO_DATABASE_URL (dry-run by default)",
    );
  const sources = await readSources(values.source);
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const reportPath = resolve(values.report);
  await mkdir(resolve(reportPath, ".."), { recursive: true, mode: 0o700 });
  const tx = values.apply ? await client.transaction("write") : null;
  try {
    const snapshot = await readSnapshot(tx ?? client);
    const sales = snapshot.sales.filter(
      (row) => normalize(row.first_name) === "sylvain" && !row.disabled,
    );
    if (sales.length !== 1)
      throw new Error("Expected one active Sylvain in sales");
    const report = planImport(snapshot, sources, sales[0].id);
    await writeFile(reportPath, JSON.stringify(report, null, 2), {
      mode: 0o600,
    });
    process.stdout.write(JSON.stringify(report.counts) + "\n");
    if (tx) {
      if (
        !(await tx.execute("PRAGMA table_info(contacts)")).rows.some(
          (r) => r.name === "company_ids",
        )
      )
        throw new Error("Migrate multi-clubs before applying");
      // Save every table from the same locked snapshot before any import write.
      const backup = {};
      backup.schema = (
        await tx.execute(
          "SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL",
        )
      ).rows.map((row) => ({ ...row }));
      backup.tables = {};
      for (const entry of backup.schema.filter((r) => r.type === "table"))
        backup.tables[entry.name] = (
          await tx.execute(
            `SELECT * FROM "${entry.name.replaceAll('"', '""')}"`,
          )
        ).rows.map((row) => ({ ...row }));
      await writeFile(reportPath + ".backup.json", JSON.stringify(backup), {
        mode: 0o600,
        flag: "wx",
      });
      await applyPlan(tx, report);
      const again = planImport(await readSnapshot(tx), sources, sales[0].id);
      if (again.actions.length || again.ambiguities.length)
        throw new Error("Second run is not a no-op");
      await tx.commit();
      await writeFile(
        reportPath + ".applied.json",
        JSON.stringify({
          counts: report.counts,
          appliedAt: new Date().toISOString(),
          secondRun: again.counts,
        }),
        { mode: 0o600 },
      );
    }
  } catch (error) {
    if (tx && !tx.closed) await tx.rollback();
    throw error;
  } finally {
    client.close();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
