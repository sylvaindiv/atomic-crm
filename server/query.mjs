import { prepareContactClubs, assertTenupId } from "./contact-clubs.mjs";
// CRUD + list query builders over libSQL, matching the react-admin DataProvider
// method surface. Rows are (de)serialized per the resource's json/bool columns.
import { db, requiredColumns, tableColumns } from "./db.mjs";
import { buildWhere, quoteId } from "./filter.mjs";
import { CASCADE, RESOURCES } from "./resources.mjs";

/** libSQL rows are array-like; build plain {col: value} objects reliably. */
function toObjects(result) {
  const { columns, rows } = result;
  return rows.map((r) => {
    const o = {};
    columns.forEach((c, i) => {
      o[c] = r[i];
    });
    return o;
  });
}

function serializeRow(cfg, row) {
  if (!row) return row;
  for (const k of cfg.json) {
    if (typeof row[k] === "string") {
      try {
        row[k] = JSON.parse(row[k]);
      } catch {
        /* leave the raw string if it isn't valid JSON */
      }
    }
  }
  for (const k of cfg.bool) {
    if (row[k] !== null && row[k] !== undefined) {
      row[k] = row[k] === 1 || row[k] === true;
    }
  }
  return row;
}

const serialize = (cfg, rows) => rows.map((r) => serializeRow(cfg, r));

function coerceId(id) {
  return /^\d+$/.test(String(id)) ? Number(id) : id;
}

/** Turn an incoming write payload into { columns, values } for known columns. */
function prepareWrite(cfg, data) {
  const known = new Set(tableColumns[cfg.table] ?? []);
  const columns = [];
  const values = [];
  for (const [key, raw] of Object.entries(data ?? {})) {
    if (key === "id" || key === "next_action" || !known.has(key)) continue;
    let value = raw;
    if (cfg.json.includes(key)) {
      value = raw === null || raw === undefined ? null : JSON.stringify(raw);
    } else if (cfg.bool.includes(key)) {
      value = raw === true || raw === 1 || raw === "true" ? 1 : 0;
    } else if (value === undefined) {
      value = null;
    }
    columns.push(key);
    values.push(value);
  }
  return { columns, values };
}

function assertChecklistWrite(cfg, data) {
  if (cfg.table === "contacts" && "client_checklist" in (data ?? {})) {
    const ids = data.client_checklist;
    if (
      !Array.isArray(ids) ||
      ids.some((id) => typeof id !== "string" || !id.trim()) ||
      new Set(ids).size !== ids.length
    ) {
      throw new Error("client_checklist must be a unique array of IDs");
    }
  }

  if (
    cfg.table === "configuration" &&
    data?.config?.clientChecklist !== undefined
  ) {
    const items = data.config.clientChecklist;
    if (
      !Array.isArray(items) ||
      items.some(
        (item) =>
          !item ||
          typeof item.value !== "string" ||
          !item.value.trim() ||
          typeof item.label !== "string" ||
          !item.label.trim(),
      ) ||
      new Set(items.map((item) => item.value)).size !== items.length
    ) {
      throw new Error("clientChecklist must contain unique IDs and labels");
    }
  }
}

function orderBy(sort) {
  const s = Array.isArray(sort) ? sort[0] : sort;
  if (!s?.field) return 'ORDER BY "id" ASC';
  const col = quoteId(s.field);
  const dir = String(s.order).toUpperCase() === "DESC" ? "DESC" : "ASC";
  // Mirror the previous "desc.nullslast" ordering.
  return dir === "DESC"
    ? `ORDER BY ${col} DESC NULLS LAST`
    : `ORDER BY ${col} ASC`;
}

function limitOffset(pagination) {
  const page = Number(pagination?.page ?? 1);
  const perPage = Number(pagination?.perPage ?? 25);
  return { limit: perPage, offset: (page - 1) * perPage };
}

function assertWritable(cfg) {
  if (cfg.readonly) {
    throw new Error(`Resource "${cfg.table}" is read-only`);
  }
}

/** Append-only audit trail for create/update writes (see db/schema.sql). */
async function logHistory(table, recordId, action, data, executor = db) {
  await executor.execute({
    sql: `INSERT INTO "record_history" ("table_name","record_id","action","data") VALUES (?,?,?,?)`,
    args: [table, String(recordId), action, JSON.stringify(data ?? null)],
  });
}

/**
 * Reject a write missing a value for a required column (NOT NULL, not the
 * primary key, no DEFAULT — see `requiredColumns` in server/db.mjs) with a
 * readable error, before the INSERT/UPDATE is built. On create every
 * required column must be present; on update a required column may simply
 * be omitted (partial update) but not explicitly cleared to null/undefined.
 */
function assertRequiredColumns(cfg, data, { requireAllPresent }) {
  const required = requiredColumns[cfg.table] ?? [];
  for (const col of required) {
    const present = Object.prototype.hasOwnProperty.call(data ?? {}, col);
    if (!present) {
      if (requireAllPresent) throw new Error(`${col} is required`);
      continue;
    }
    if (data[col] === null || data[col] === undefined) {
      throw new Error(`${col} is required`);
    }
  }
}

async function listWith(cfg, { filter, sort, pagination }, extra = []) {
  let effectiveFilter = filter;
  if (
    (cfg.table === "tasks" || cfg.table === "contact_notes") &&
    filter?.contact_type
  ) {
    const { contact_type, ...rest } = filter;
    effectiveFilter = rest;
    extra = [
      ...extra,
      {
        sql: `EXISTS (SELECT 1 FROM contacts owner WHERE owner.id = ${quoteId(cfg.table)}."contact_id" AND owner.contact_type = ?)`,
        args: [contact_type],
      },
    ];
  }
  const where = buildWhere(effectiveFilter, cfg, extra);
  const table = quoteId(cfg.table);

  const totalRes = await db.execute({
    sql: `SELECT count(*) AS n FROM ${table} ${where.sql}`,
    args: where.args,
  });
  const total = Number(toObjects(totalRes)[0].n);

  const { limit, offset } = limitOffset(pagination);
  const dataRes = await db.execute({
    sql: `SELECT * FROM ${table} ${where.sql} ${orderBy(sort)} LIMIT ? OFFSET ?`,
    args: [...where.args, limit, offset],
  });
  return { data: serialize(cfg, toObjects(dataRes)), total };
}

export function getList(cfg, params) {
  return listWith(cfg, params);
}

export function getManyReference(cfg, params) {
  if (params.target === "company_id" && cfg.table.startsWith("contacts")) {
    return listWith(cfg, {
      ...params,
      filter: { ...params.filter, "company_ids@cs": [coerceId(params.id)] },
    });
  }
  const extra = [
    { sql: `${quoteId(params.target)} = ?`, args: [coerceId(params.id)] },
  ];
  return listWith(cfg, params, extra);
}

export async function getOne(cfg, { id }, executor = db) {
  const res = await executor.execute({
    sql: `SELECT * FROM ${quoteId(cfg.table)} WHERE "id" = ?`,
    args: [coerceId(id)],
  });
  const rows = serialize(cfg, toObjects(res));
  if (rows.length === 0) throw new Error(`${cfg.table} #${id} not found`);
  return { data: rows[0] };
}

export async function getMany(cfg, { ids }) {
  const list = (ids ?? []).map(coerceId);
  if (list.length === 0) return { data: [] };
  const ph = list.map(() => "?").join(",");
  const res = await db.execute({
    sql: `SELECT * FROM ${quoteId(cfg.table)} WHERE "id" IN (${ph})`,
    args: list,
  });
  return { data: serialize(cfg, toObjects(res)) };
}

const isValidDate = (value) => {
  if (typeof value !== "string") return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
    );
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const date = new Date(value);
  return !Number.isNaN(date.valueOf()) && date.toISOString() === value;
};

function assertNextAction(data) {
  const action = data.next_action;
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new Error("next_action is invalid");
  }
  const keys = Object.keys(action).sort().join(",");
  if (action.mode === "create") {
    if (
      keys !== "due_date,mode,text" ||
      typeof action.text !== "string" ||
      !action.text.trim() ||
      !isValidDate(action.due_date)
    ) {
      throw new Error(
        "next_action create requires non-empty text and a valid due_date",
      );
    }
    return;
  }
  if (action.mode === "existing") {
    if (keys !== "mode,task_id" || !/^[1-9]\d*$/.test(String(action.task_id))) {
      throw new Error("next_action existing requires a valid task_id");
    }
    return;
  }
  throw new Error("next_action mode is invalid");
}

function assertNoteForNextAction(data) {
  if (!/^[1-9]\d*$/.test(String(data.contact_id))) {
    throw new Error("contact_id is required");
  }
  if (
    !(typeof data.text === "string" && data.text.trim()) &&
    !(Array.isArray(data.attachments) && data.attachments.length > 0)
  ) {
    throw new Error("A note requires text or an attachment");
  }
  assertNextAction(data);
}

async function createWithNextAction(cfg, data) {
  if (cfg.table !== "contact_notes") {
    throw new Error(
      "next_action is only supported when creating a contact note",
    );
  }
  assertNoteForNextAction(data);
  assertRequiredColumns(cfg, data, { requireAllPresent: true });

  const tx = await db.transaction("write");
  try {
    const contactId = coerceId(data.contact_id);
    const contactRes = await tx.execute({
      sql: `SELECT "id" FROM "contacts" WHERE "id" = ?`,
      args: [contactId],
    });
    if (toObjects(contactRes).length === 0) {
      throw new Error(`contacts #${data.contact_id} not found`);
    }

    let existingTask;
    if (data.next_action.mode === "existing") {
      const taskId = coerceId(data.next_action.task_id);
      const taskRes = await tx.execute({
        sql: `SELECT * FROM "tasks" WHERE "id" = ?`,
        args: [taskId],
      });
      existingTask = toObjects(taskRes)[0];
      if (
        !existingTask ||
        String(existingTask.contact_id) !== String(contactId) ||
        existingTask.done_date !== null ||
        typeof existingTask.text !== "string" ||
        !existingTask.text.trim() ||
        !isValidDate(existingTask.due_date)
      ) {
        throw new Error(
          "Selected task is not an open valid task for this contact",
        );
      }
    }

    const { next_action, ...noteData } = data;
    const result = await create(cfg, { data: noteData }, tx);
    if (next_action.mode === "create") {
      await create(
        RESOURCES.tasks,
        {
          data: {
            contact_id: contactId,
            type: "none",
            text: next_action.text.trim(),
            due_date: next_action.due_date,
            done_date: null,
            sales_id: data.sales_id ?? null,
          },
        },
        tx,
      );
    }

    const contactData = { last_seen: new Date().toISOString() };
    if (data.status !== undefined) {
      contactData.status = data.status;
    }
    await update(RESOURCES.contacts, { id: contactId, data: contactData }, tx);
    await tx.commit();
    return result;
  } catch (error) {
    try {
      await tx.rollback();
    } catch {
      // Preserve the original write error if rollback also fails.
    }
    throw error;
  }
}

export async function create(cfg, { data }, executor = db) {
  if (
    executor === db &&
    Object.prototype.hasOwnProperty.call(data ?? {}, "next_action")
  ) {
    return createWithNextAction(cfg, data);
  }
  if (executor === db && cfg.table === "contacts") {
    const tx = await db.transaction("write");
    try {
      const result = await create(cfg, { data }, tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
  assertTenupId(data);
  if (cfg.table === "contacts")
    data = await prepareContactClubs(data, null, executor);
  assertWritable(cfg);
  assertChecklistWrite(cfg, data);
  assertRequiredColumns(cfg, data, { requireAllPresent: true });
  const { columns, values } = prepareWrite(cfg, data);
  const table = quoteId(cfg.table);
  const sql =
    columns.length === 0
      ? `INSERT INTO ${table} DEFAULT VALUES RETURNING *`
      : `INSERT INTO ${table} (${columns.map(quoteId).join(",")}) VALUES (${columns
          .map(() => "?")
          .join(",")}) RETURNING *`;
  const res = await executor.execute({ sql, args: values });
  const row = serialize(cfg, toObjects(res))[0];
  await logHistory(cfg.table, row.id, "create", row, executor);
  return { data: row };
}

export async function update(cfg, { id, data }, executor = db) {
  if (
    executor === db &&
    cfg.table === "contacts" &&
    ["company_ids", "company_id", "contact_type"].some((key) => key in data)
  ) {
    const tx = await db.transaction("write");
    try {
      const result = await update(cfg, { id, data }, tx);
      await tx.commit();
      return result;
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
  assertTenupId(data);
  if (
    cfg.table === "contacts" &&
    ["company_ids", "company_id", "contact_type"].some((key) => key in data)
  ) {
    const previous = (await getOne(cfg, { id }, executor)).data;
    data = await prepareContactClubs(data, previous, executor);
  }
  assertWritable(cfg);
  assertChecklistWrite(cfg, data);
  assertRequiredColumns(cfg, data, { requireAllPresent: false });
  const { columns, values } = prepareWrite(cfg, data);
  if (columns.length === 0) return getOne(cfg, { id }, executor);
  const assignments = columns.map((c) => `${quoteId(c)} = ?`).join(",");
  const res = await executor.execute({
    sql: `UPDATE ${quoteId(cfg.table)} SET ${assignments} WHERE "id" = ? RETURNING *`,
    args: [...values, coerceId(id)],
  });
  const rows = serialize(cfg, toObjects(res));
  if (rows.length === 0) throw new Error(`${cfg.table} #${id} not found`);
  await logHistory(cfg.table, rows[0].id, "update", data, executor);
  return { data: rows[0] };
}

export async function updateMany(cfg, { ids, data }) {
  assertWritable(cfg);
  const list = (ids ?? []).map(coerceId);
  const tx = await db.transaction("write");
  try {
    for (const id of list) await update(cfg, { id, data }, tx);
    await tx.commit();
    return { data: list };
  } catch (error) {
    await tx.rollback();
    throw error;
  }
}

/** Recursively delete child rows for the ON DELETE CASCADE relationships. */
async function cascadeDelete(table, ids) {
  const children = CASCADE[table];
  if (!children || ids.length === 0) return;
  const ph = ids.map(() => "?").join(",");
  for (const [childTable, fk] of children) {
    const res = await db.execute({
      sql: `SELECT "id" FROM ${quoteId(childTable)} WHERE ${quoteId(fk)} IN (${ph})`,
      args: ids,
    });
    const childIds = toObjects(res).map((r) => r.id);
    if (childIds.length === 0) continue;
    await cascadeDelete(childTable, childIds);
    const cph = childIds.map(() => "?").join(",");
    await db.execute({
      sql: `DELETE FROM ${quoteId(childTable)} WHERE "id" IN (${cph})`,
      args: childIds,
    });
  }
}

export async function del(cfg, { id }) {
  assertWritable(cfg);
  const realId = coerceId(id);
  await cascadeDelete(cfg.table, [realId]);
  const res = await db.execute({
    sql: `DELETE FROM ${quoteId(cfg.table)} WHERE "id" = ? RETURNING *`,
    args: [realId],
  });
  return { data: serialize(cfg, toObjects(res))[0] ?? { id: realId } };
}

export async function deleteMany(cfg, { ids }) {
  assertWritable(cfg);
  const list = (ids ?? []).map(coerceId);
  if (list.length === 0) return { data: [] };
  await cascadeDelete(cfg.table, list);
  const ph = list.map(() => "?").join(",");
  await db.execute({
    sql: `DELETE FROM ${quoteId(cfg.table)} WHERE "id" IN (${ph})`,
    args: list,
  });
  return { data: list };
}

export const HANDLERS = {
  getList,
  getOne,
  getMany,
  getManyReference,
  create,
  update,
  updateMany,
  delete: del,
  deleteMany,
};

export { RESOURCES };
