import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  authGuard,
  authorizeDataRequest,
  hashPassword,
  mountAuth,
} from "./auth.mjs";

const ORIGIN = "http://localhost:5173";
let directory;
let db;
let app;

const request = (path, init = {}) =>
  app.request(path, {
    ...init,
    headers: {
      origin: ORIGIN,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "atomic-crm-auth-"));
  db = createClient({ url: `file:${join(directory, "auth.db")}` });
  await db.executeMultiple(
    await readFile(new URL("../db/schema.sql", import.meta.url), "utf8"),
  );
  await db.execute({
    sql: "INSERT INTO sales (id, email, first_name, last_name, administrator, disabled) VALUES (1, ?, ?, ?, 1, 0)",
    args: ["owner@example.test", "Owner", "Test"],
  });
  const passwordHash = await hashPassword("temporary owner password");
  await db.execute({
    sql: "INSERT INTO auth_credentials (sales_id, email, password_hash, must_change_password) VALUES (1, ?, ?, 0)",
    args: ["owner@example.test", passwordHash],
  });
  app = new Hono();
  mountAuth(app, { db, appOrigin: ORIGIN });
  app.post("/api/sales/:method", async (c) => {
    const error = await authGuard(c, db);
    if (error) return error;
    return (
      authorizeDataRequest(c, "sales", c.req.param("method")) ??
      c.json({ ok: true })
    );
  });
});

afterEach(async () => {
  vi.unstubAllEnvs();
  db.close();
  await rm(directory, { recursive: true, force: true });
});

describe("auth API", () => {
  it("accepts the production app origin without APP_ORIGIN and rejects localhost", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_ORIGIN", undefined);
    vi.stubEnv("APP_URL", undefined);
    app = new Hono();
    mountAuth(app, { db });

    expect(
      (await request("/api/auth/logout", { method: "POST", body: "{}" }))
        .status,
    ).toBe(400);
    const production = await app.request("/api/auth/logout", {
      method: "POST",
      headers: {
        origin: "https://crm.padel-arcade.fr",
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect(production.status).toBe(200);
  });

  it("refuses anonymous CRM access and accepts a completed owner session", async () => {
    expect(
      (await request("/api/sales/getList", { method: "POST", body: "{}" }))
        .status,
    ).toBe(401);

    const login = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "owner@example.test",
        password: "temporary owner password",
      }),
    });
    expect(login.status).toBe(200);
    expect((await login.json()).must_change_password).toBe(false);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    expect(
      (
        await request("/api/sales/getList", {
          method: "POST",
          body: "{}",
          headers: { cookie },
        })
      ).status,
    ).toBe(200);
  });

  it("limits a temporary password to its mandatory replacement then revokes its old session", async () => {
    const create = await request("/api/auth/users", {
      method: "POST",
      headers: { cookie: await ownerCookie() },
      body: JSON.stringify({
        email: "user@example.test",
        first_name: "User",
        last_name: "Test",
        password: "temporary user password",
      }),
    });
    expect(create.status).toBe(201);
    const userId = (await create.json()).user.id;
    const login = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "user@example.test",
        password: "temporary user password",
      }),
    });
    const oldCookie = login.headers.get("set-cookie").split(";")[0];
    expect(
      (
        await request("/api/sales/getList", {
          method: "POST",
          body: "{}",
          headers: { cookie: oldCookie },
        })
      ).status,
    ).toBe(403);
    const changed = await request("/api/auth/password", {
      method: "POST",
      headers: { cookie: oldCookie },
      body: JSON.stringify({
        currentPassword: "temporary user password",
        newPassword: "a changed password long enough",
      }),
    });
    expect(changed.status).toBe(200);
    expect(
      (await request("/api/auth/me", { headers: { cookie: oldCookie } }))
        .status,
    ).toBe(401);
    expect(
      (
        await request(`/api/auth/users/${userId}/password`, {
          method: "POST",
          headers: { cookie: await ownerCookie() },
          body: JSON.stringify({ newPassword: "another temporary password" }),
        })
      ).status,
    ).toBe(200);
  });

  it("never allows generic sales mutations", async () => {
    const response = await request("/api/sales/update", {
      method: "POST",
      body: "{}",
      headers: { cookie: await ownerCookie() },
    });
    expect(response.status).toBe(403);
  });

  it("keeps a disabled user disabled when the owner resets their password", async () => {
    const create = await request("/api/auth/users", {
      method: "POST",
      headers: { cookie: await ownerCookie() },
      body: JSON.stringify({
        email: "disabled@example.test",
        first_name: "Disabled",
        last_name: "User",
        password: "temporary disabled password",
      }),
    });
    const userId = (await create.json()).user.id;
    await request(`/api/auth/users/${userId}`, {
      method: "PATCH",
      headers: { cookie: await ownerCookie() },
      body: JSON.stringify({ disabled: true }),
    });

    const reset = await request(`/api/auth/users/${userId}/password`, {
      method: "POST",
      headers: { cookie: await ownerCookie() },
      body: JSON.stringify({ newPassword: "another temporary password" }),
    });
    expect(reset.status).toBe(200);
    const user = await db.execute({
      sql: "SELECT disabled FROM sales WHERE id = ?",
      args: [userId],
    });
    expect(user.rows[0][0]).toBe(1);
    const login = await request("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: "disabled@example.test",
        password: "another temporary password",
      }),
    });
    expect(login.status).toBe(401);
  });
});

async function ownerCookie() {
  const login = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: "owner@example.test",
      password: "temporary owner password",
    }),
  });
  return login.headers.get("set-cookie").split(";")[0];
}
