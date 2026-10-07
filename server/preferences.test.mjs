import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { Hono } from "hono";
import {
  mountColumnPreferences,
  validColumnPreferences,
} from "./preferences.mjs";

test("column preferences validate bounded stable IDs and widths", () => {
  assert.equal(
    validColumnPreferences({
      order: ["name"],
      hidden: [],
      widths: { name: 180 },
    }),
    true,
  );
  assert.equal(
    validColumnPreferences({ order: ["name", "name"], hidden: [], widths: {} }),
    false,
  );
  assert.equal(
    validColumnPreferences({ order: [], hidden: [], widths: { name: -1 } }),
    false,
  );
  assert.equal(
    validColumnPreferences({ order: [], hidden: [], widths: {}, sales_id: 2 }),
    false,
  );
});

test("routes require a session and keep preferences scoped to its user", async () => {
  const saved = new Map();
  const db = {
    async execute({ sql, args }) {
      if (sql.includes("FROM auth_sessions")) {
        const id =
          args[0] === createHash("sha256").update("a").digest("hex") ? 1 : 2;
        const columns = [
          "id",
          "disabled",
          "expires_at",
          "must_change_password",
        ];
        return { columns, rows: [[id, 0, "2099-01-01T00:00:00Z", 0]] };
      }
      if (sql.startsWith("SELECT settings")) {
        const value = saved.get(`${args[0]}:${args[1]}`);
        return { rows: value ? [{ settings: value }] : [] };
      }
      if (sql.startsWith("INSERT INTO column_preferences")) {
        saved.set(`${args[0]}:${args[1]}`, args[2]);
        return { rows: [] };
      }
      throw new Error(sql);
    },
  };
  const app = new Hono();
  mountColumnPreferences(app, db);
  const path = "/api/preferences/columns/companies";
  assert.equal((await app.request(path)).status, 401);
  const headers = {
    cookie: "atomic_crm_session=a",
    origin: "http://localhost:5173",
    "content-type": "application/json",
  };
  const settings = { order: ["name"], hidden: ["city"], widths: { name: 180 } };
  assert.equal(
    (
      await app.request(path, {
        method: "PUT",
        headers,
        body: JSON.stringify(settings),
      })
    ).status,
    200,
  );
  assert.deepEqual(await (await app.request(path, { headers })).json(), {
    settings,
  });
  assert.deepEqual(
    await (
      await app.request(path, {
        headers: { ...headers, cookie: "atomic_crm_session=b" },
      })
    ).json(),
    { settings: null },
  );
  assert.equal(
    (
      await app.request(path, {
        method: "PUT",
        headers: { ...headers, origin: "https://evil.test" },
        body: JSON.stringify(settings),
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await app.request(path, {
        method: "PUT",
        headers,
        body: JSON.stringify({ ...settings, sales_id: 2 }),
      })
    ).status,
    400,
  );
  assert.equal(
    (await app.request("/api/preferences/columns/sales", { headers })).status,
    404,
  );
});
