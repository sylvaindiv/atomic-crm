// Daily task-digest email: query the tasks due today, render a monochrome
// HTML email, and send it through the Resend REST API (plain `fetch`, no
// SDK). Scheduled once a day at 09:00 local wall-clock time from this
// long-lived Node process (plain `setTimeout`/`setInterval`, no cron lib).
//
// Follows query.mjs's shape: plain functions taking an injectable `db`,
// unit-tested with a fake `{ execute: vi.fn() }`. `db.mjs` is only imported
// lazily (inside `sendDailyDigest`, when no `db` override is supplied) so
// this module -- and its tests -- never require TURSO_DATABASE_URL to be
// set just to load.

const FROM = "CRM Padel Arcade <crm@appnotif.fr>";
const DEFAULT_TO = "contact@numero28consulting.fr";
const SEND_HOUR = 9; // 09:00 local wall-clock time, per process.env.TZ
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// This module's tests run inside the "app" Vitest project, which executes in
// a real browser (no Node `process` global) even though the code itself is
// backend-only. Read `process.env` through this guard so importing/exercising
// the module never throws there; real Node runs (server, scheduler, manual
// self-check below) still see the real values.
// ponytail: browser-safe env guard, drop once server/*.test.mjs gets its own Node vitest project
const env = typeof process === "undefined" ? {} : process.env;
const isNode = typeof process !== "undefined";

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

/**
 * Tasks due today (not done yet), joined to their contact's name. Mirrors
 * the client-side `isDueToday` predicate (tasksPredicate.ts) in SQL: due
 * today means `due_date` falls within [today, tomorrow) and `done_date`
 * is still unset.
 */
export async function getTasksDueToday(db) {
  const sql = `
    SELECT
      t."type" AS type,
      t."text" AS text,
      t."due_date" AS due_date,
      c."first_name" AS contact_first_name,
      c."last_name" AS contact_last_name
    FROM "tasks" t
    JOIN "contacts" c ON c."id" = t."contact_id"
    WHERE t."done_date" IS NULL
      AND t."due_date" >= date('now')
      AND t."due_date" < date('now', '+1 day')
    ORDER BY t."due_date"
  `;
  const res = await db.execute(sql);
  return toObjects(res);
}

/** Escape a string for safe inclusion in HTML markup (task text is user-supplied). */
function escapeHtml(value) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(value ?? "").replace(/[&<>"']/g, (ch) => map[ch]);
}

/** "call" -> "Call" — the raw task `type` is already a short human word. */
function capitalize(value) {
  const s = String(value ?? "");
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Renders the digest as a self-contained, table-based, inline-styled email
 * (no <style> block, no web fonts) so it survives Gmail/Outlook clipping.
 */
export function renderDigestEmail(tasks) {
  const todayLabel = capitalize(
    new Intl.DateTimeFormat("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date()),
  );
  const dashboardUrl = env.APP_URL ?? "https://crm.padel-arcade.fr/#/";
  const subject = `${tasks.length} tâche${tasks.length > 1 ? "s" : ""} à faire aujourd'hui — CRM Padel Arcade`;

  const rows = tasks
    .map((t) => {
      const contactName = [t.contact_first_name, t.contact_last_name]
        .filter(Boolean)
        .join(" ");
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.4;color:#111111;">
            <strong>${escapeHtml(capitalize(t.type))}</strong> — ${escapeHtml(t.text)}
            <div style="color:#666666;font-size:12px;margin-top:2px;">${escapeHtml(contactName)}</div>
          </td>
        </tr>`;
    })
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background-color:#f4f4f5;font-family:-apple-system,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background-color:#ffffff;border:1px solid #e5e5e5;border-radius:8px;padding:32px;">
            <tr>
              <td style="padding-bottom:16px;border-bottom:2px solid #111111;">
                <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:18px;font-weight:bold;color:#111111;">CRM Padel Arcade</div>
                <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:13px;color:#666666;margin-top:4px;">${escapeHtml(todayLabel)}</div>
              </td>
            </tr>
            <tr>
              <td>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                  ${rows}
                </table>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:24px;">
                <a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background-color:#111111;color:#ffffff;text-decoration:none;font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:14px;font-weight:bold;padding:12px 24px;border-radius:6px;">Ouvrir le dashboard</a>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-top:24px;">
                <div style="font-family:-apple-system,Helvetica,Arial,sans-serif;font-size:11px;color:#999999;">CRM Padel Arcade — récapitulatif automatique quotidien</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, html };
}

/**
 * Queries the tasks due today and, if any, sends the digest through the
 * Resend REST API. No-ops (with a log line, no network call) when nothing
 * is due. Throws on a non-2xx Resend response -- callers must handle it.
 *
 * `db` is only for tests (an injected fake); production callers (the
 * scheduler and the manual self-check below) omit it and get the real
 * client, imported lazily so this module never needs TURSO_DATABASE_URL
 * just to load.
 */
export async function sendDailyDigest({
  fetchImpl = fetch,
  to = DEFAULT_TO,
  db,
} = {}) {
  const resolvedDb = db ?? (await import("./db.mjs")).db;
  const tasks = await getTasksDueToday(resolvedDb);

  if (tasks.length === 0) {
    if (isNode) {
      process.stdout.write("[dailyDigest] No task due today, skipping send.\n");
    }
    return;
  }

  const { subject, html } = renderDigestEmail(tasks);
  const res = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

/** Milliseconds until the next SEND_HOUR:00 local wall-clock time. */
function msUntilNextRun(now = new Date()) {
  const next = new Date(now);
  next.setHours(SEND_HOUR, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

/**
 * Schedules `sendDailyDigest` for the next 09:00 local time, then every 24h
 * after that. A send failure is logged, never crashes the process.
 */
export function startDailyDigestScheduler() {
  const runDigest = () => {
    sendDailyDigest().catch((err) => {
      console.error("[dailyDigest] send failed", err);
    });
  };
  setTimeout(() => {
    runDigest();
    setInterval(runDigest, ONE_DAY_MS);
  }, msUntilNextRun());
}

// Manual send: `node --env-file=.env server/dailyDigest.mjs [to]`
if (isNode && import.meta.url === `file://${process.argv[1]}`) {
  const manualTo = process.argv[2];
  sendDailyDigest(manualTo ? { to: manualTo } : {})
    .then(() => process.stdout.write("[dailyDigest] Sent.\n"))
    .catch((err) => {
      console.error("[dailyDigest] send failed", err);
      process.exitCode = 1;
    });
}
