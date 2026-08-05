// Bidirectional sync between a judge/club's `status` and their linked deal's
// Kanban `stage`. Hooked into the end of query.mjs's generic `update()` --
// mirrors how `cascadeDelete` keeps business logic on the backend rather
// than in SQL triggers.
//
// Anti-loop guarantee: every write in this module goes through raw
// `db.execute`, never through the generic `update()` of query.mjs. Since
// this module is only ever invoked from inside `update()`, a raw write here
// can never re-trigger it -- a change propagates exactly one hop and cannot
// ping-pong between a contact/company and its deal.
// See adr/ADR-7eef2240-TASK-002-deal-sync-raw-writes-anti-loop.md

const CASE_TYPE_BY_TABLE = { contacts: "judge", companies: "club" };

/** True when `data` genuinely carries `key` (even if the value is null). */
function hasOwn(data, key) {
  return data != null && Object.prototype.hasOwnProperty.call(data, key);
}

/** Turn a libSQL result into plain {col: value} objects (mirrors query.mjs). */
function toObjects({ columns, rows }) {
  return rows.map((r) => {
    const o = {};
    columns.forEach((c, i) => {
      o[c] = r[i];
    });
    return o;
  });
}

/** id of the most recent non-archived deal of `caseType` linked to `partyId`. */
async function findLinkedDealId(db, caseType, partyId) {
  const sql =
    caseType === "judge"
      ? `SELECT "id" FROM "deals"
         WHERE "case_type" = 'judge' AND "archived_at" IS NULL
           AND EXISTS (
             SELECT 1 FROM json_each(CASE WHEN json_valid("contact_ids") THEN "contact_ids" ELSE '[]' END)
             WHERE "value" = ?
           )
         ORDER BY "created_at" DESC LIMIT 1`
      : `SELECT "id" FROM "deals"
         WHERE "case_type" = 'club' AND "archived_at" IS NULL AND "company_id" = ?
         ORDER BY "created_at" DESC LIMIT 1`;
  const res = await db.execute({ sql, args: [partyId] });
  const row = toObjects(res)[0];
  return row ? row.id : null;
}

function partyName(table, party) {
  return table === "contacts"
    ? [party.first_name, party.last_name].filter(Boolean).join(" ")
    : party.name;
}

/**
 * Direction A: a contact's/company's `status` changed -> move its linked
 * deal to that stage, or create one if none exists yet. No-op when `data`
 * doesn't carry `status`.
 */
async function syncPartyStatusToDeal(db, table, data, updatedParty) {
  if (!hasOwn(data, "status")) return;
  const caseType = CASE_TYPE_BY_TABLE[table];
  if (!caseType) return;

  const status = data.status;
  const dealId = await findLinkedDealId(db, caseType, updatedParty.id);

  if (dealId != null) {
    await db.execute({
      sql: `UPDATE "deals" SET "stage" = ? WHERE "id" = ?`,
      args: [status, dealId],
    });
    return;
  }

  await db.execute({
    sql: `INSERT INTO "deals"
            ("name", "case_type", "stage", "sales_id", "amount", "contact_ids", "company_id")
          VALUES (?, ?, ?, ?, 0, ?, ?)`,
    args: [
      partyName(table, updatedParty),
      caseType,
      status,
      updatedParty.sales_id ?? null,
      caseType === "judge" ? JSON.stringify([updatedParty.id]) : "[]",
      caseType === "club" ? updatedParty.id : null,
    ],
  });
}

/**
 * Direction B: a deal's `stage` changed -> write it as `status` on the
 * linked contact (judge deal) or company (club deal). No-op when `data`
 * doesn't carry `stage`, or the deal has no linked party.
 */
async function syncDealStageToParty(db, data, updatedDeal) {
  if (!hasOwn(data, "stage")) return;
  const stage = data.stage;

  if (updatedDeal.case_type === "judge") {
    const contactId = updatedDeal.contact_ids?.[0];
    if (contactId == null) return;
    await db.execute({
      sql: `UPDATE "contacts" SET "status" = ? WHERE "id" = ?`,
      args: [stage, contactId],
    });
    return;
  }

  if (updatedDeal.case_type === "club") {
    if (updatedDeal.company_id == null) return;
    await db.execute({
      sql: `UPDATE "companies" SET "status" = ? WHERE "id" = ?`,
      args: [stage, updatedDeal.company_id],
    });
  }
}

/**
 * Hooked at the end of query.mjs's generic `update()`. Propagates a
 * contact/company `status` change to its linked deal's `stage` (Direction A),
 * or a deal `stage` change to its linked contact/company `status`
 * (Direction B). No-op for any other table, or when the written `data`
 * doesn't carry the relevant field.
 *
 * A sync failure is logged but never rethrown: the primary write this hook
 * piggybacks on has already succeeded by the time it runs, and must not be
 * failed by a follow-up sync error (e.g. an orphaned/archived link).
 */
export async function afterUpdate(db, table, data, updatedRow) {
  if (updatedRow == null) return;
  try {
    if (table === "contacts" || table === "companies") {
      await syncPartyStatusToDeal(db, table, data, updatedRow);
    } else if (table === "deals") {
      await syncDealStageToParty(db, data, updatedRow);
    }
  } catch (err) {
    console.error(`[dealSync] afterUpdate(${table})`, err);
  }
}
