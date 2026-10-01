import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

const scrypt = promisify(scryptCallback);
const COOKIE = "atomic_crm_session";
const SCRYPT = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
const PASSWORD_MIN = 15;
const PASSWORD_MAX = 128;
const SESSION_MS = 12 * 60 * 60 * 1000;
const LIMITED_SESSION_MS = 15 * 60 * 1000;
const TEMPORARY_MS = 7 * 24 * 60 * 60 * 1000;

export const getAppOrigin = () =>
  process.env.APP_ORIGIN ??
  (process.env.NODE_ENV === "production"
    ? new URL(process.env.APP_URL ?? "https://crm.padel-arcade.fr").origin
    : "http://localhost:5173");

const iso = (date = new Date()) => date.toISOString();
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
const rowObject = (result) =>
  result.rows[0]
    ? Object.fromEntries(
        result.columns.map((column, index) => [column, result.rows[0][index]]),
      )
    : null;

export async function hashPassword(password) {
  assertPassword(password);
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, SCRYPT);
  return `${salt.toString("base64")}:${Buffer.from(hash).toString("base64")}`;
}

export async function verifyPassword(password, encoded) {
  if (typeof password !== "string" || typeof encoded !== "string") return false;
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = Buffer.from(
    await scrypt(password, Buffer.from(salt, "base64"), 64, SCRYPT),
  );
  const expectedBuffer = Buffer.from(expected, "base64");
  return (
    actual.length === expectedBuffer.length &&
    timingSafeEqual(actual, expectedBuffer)
  );
}

function assertPassword(password) {
  if (
    typeof password !== "string" ||
    password.length < PASSWORD_MIN ||
    password.length > PASSWORD_MAX
  ) {
    throw new Error(
      `Password must contain ${PASSWORD_MIN} to ${PASSWORD_MAX} characters`,
    );
  }
}

function jsonError(c, status, error) {
  return c.json({ error }, status);
}

function cookieOptions(limited = false) {
  return {
    httpOnly: true,
    sameSite: "Strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor((limited ? LIMITED_SESSION_MS : SESSION_MS) / 1000),
  };
}

function remoteAddress(c) {
  // Do not trust X-Forwarded-For. The Node adapter exposes the direct peer.
  return c.env?.incoming?.socket?.remoteAddress ?? "unknown";
}

function validEmail(value) {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
  );
}

function assertOrigin(c, appOrigin) {
  const origin = c.req.header("origin");
  if (!origin || origin !== appOrigin)
    throw new Error("Invalid request origin");
  if (
    !c.req.header("content-type")?.toLowerCase().startsWith("application/json")
  ) {
    throw new Error("Expected JSON request");
  }
}

async function getUserByCredentials(db, email) {
  const result = await db.execute({
    sql: `SELECT s.id, s.first_name, s.last_name, s.avatar, s.administrator, s.disabled,
      ac.email, ac.password_hash, ac.must_change_password, ac.temporary_expires_at, ac.credential_version
      FROM auth_credentials ac JOIN sales s ON s.id = ac.sales_id WHERE ac.email = ?`,
    args: [email],
  });
  return rowObject(result);
}

function publicUser(user) {
  return {
    id: user.id,
    first_name: user.first_name,
    last_name: user.last_name,
    avatar: user.avatar ? JSON.parse(user.avatar) : null,
    administrator: Boolean(user.administrator),
    disabled: Boolean(user.disabled),
  };
}

async function createSession(db, user) {
  const limited = Boolean(user.must_change_password);
  const token = randomBytes(32).toString("base64url");
  const expiresAt = iso(
    new Date(Date.now() + (limited ? LIMITED_SESSION_MS : SESSION_MS)),
  );
  await db.execute({
    sql: "INSERT INTO auth_sessions (token_hash, sales_id, credential_version, expires_at) VALUES (?, ?, ?, ?)",
    args: [tokenHash(token), user.id, user.credential_version, expiresAt],
  });
  return { token, limited };
}

export async function getSession(c, db) {
  const token = getCookie(c, COOKIE);
  if (!token) return null;
  const result = await db.execute({
    sql: `SELECT s.id, s.first_name, s.last_name, s.avatar, s.administrator, s.disabled,
      ac.email, ac.must_change_password, ac.credential_version, ss.expires_at
      FROM auth_sessions ss JOIN auth_credentials ac ON ac.sales_id = ss.sales_id
      JOIN sales s ON s.id = ss.sales_id
      WHERE ss.token_hash = ? AND ss.credential_version = ac.credential_version`,
    args: [tokenHash(token)],
  });
  const user = rowObject(result);
  if (!user || user.disabled || Date.parse(user.expires_at) <= Date.now()) {
    if (user)
      await db.execute({
        sql: "DELETE FROM auth_sessions WHERE token_hash = ?",
        args: [tokenHash(token)],
      });
    return null;
  }
  return user;
}

function sessionResponse(user) {
  return {
    user: publicUser(user),
    must_change_password: Boolean(user.must_change_password),
  };
}

async function checkLoginRate(db, email, address) {
  const result = await db.execute({
    sql: `SELECT
      SUM(CASE WHEN email = ? AND attempted_at > ? THEN 1 ELSE 0 END) AS email_attempts,
      SUM(CASE WHEN remote_address = ? AND attempted_at > ? THEN 1 ELSE 0 END) AS address_attempts
      FROM auth_login_attempts`,
    args: [
      email,
      iso(new Date(Date.now() - 15 * 60 * 1000)),
      address,
      iso(new Date(Date.now() - 5 * 60 * 1000)),
    ],
  });
  const row = rowObject(result) ?? {};
  return (
    Number(row.email_attempts ?? 0) < 5 &&
    Number(row.address_attempts ?? 0) < 30
  );
}

async function recordFailure(db, email, address) {
  await db.execute({
    sql: "INSERT INTO auth_login_attempts (email, remote_address) VALUES (?, ?)",
    args: [email, address],
  });
}

function currentSession(c) {
  return c.get("authUser") ?? null;
}

function requireUser(c) {
  const user = currentSession(c);
  if (!user) return null;
  return user;
}

function isOwner(user) {
  return Boolean(user?.administrator);
}

function parseJson(c) {
  return c.req.json().catch(() => null);
}

export function mountAuth(app, { db, appOrigin = getAppOrigin() }) {
  app.use("/api/*", async (c, next) => {
    c.header("Cache-Control", "no-store");
    await next();
  });
  app.use("/api/auth/*", async (c, next) => {
    const user = await getSession(c, db);
    if (user) c.set("authUser", user);
    await next();
  });

  app.post("/api/auth/login", async (c) => {
    try {
      assertOrigin(c, appOrigin);
      const body = await parseJson(c);
      const email = body?.email?.trim()?.toLowerCase();
      if (!validEmail(email) || typeof body?.password !== "string")
        return jsonError(c, 400, "Invalid credentials");
      const address = remoteAddress(c);
      if (!(await checkLoginRate(db, email, address)))
        return jsonError(c, 429, "Too many login attempts");
      const user = await getUserByCredentials(db, email);
      if (
        !user ||
        user.disabled ||
        !(await verifyPassword(body.password, user.password_hash))
      ) {
        await recordFailure(db, email, address);
        return jsonError(c, 401, "Invalid credentials");
      }
      if (
        user.temporary_expires_at &&
        Date.parse(user.temporary_expires_at) <= Date.now()
      )
        return jsonError(c, 401, "Invalid credentials");
      const session = await createSession(db, user);
      setCookie(c, COOKIE, session.token, cookieOptions(session.limited));
      return c.json(sessionResponse(user));
    } catch (error) {
      return jsonError(c, 400, error.message);
    }
  });

  app.get("/api/auth/me", async (c) => {
    const user = await getSession(c, db);
    return user
      ? c.json(sessionResponse(user))
      : jsonError(c, 401, "Unauthorized");
  });

  app.post("/api/auth/logout", async (c) => {
    try {
      assertOrigin(c, appOrigin);
      const token = getCookie(c, COOKIE);
      if (token)
        await db.execute({
          sql: "DELETE FROM auth_sessions WHERE token_hash = ?",
          args: [tokenHash(token)],
        });
      deleteCookie(c, COOKIE, cookieOptions());
      return c.json({ ok: true });
    } catch (error) {
      return jsonError(c, 400, error.message);
    }
  });

  app.post("/api/auth/password", async (c) => {
    try {
      assertOrigin(c, appOrigin);
      const user = requireUser(c);
      if (!user) return jsonError(c, 401, "Unauthorized");
      const body = await parseJson(c);
      assertPassword(body?.newPassword);
      const credentials = await db.execute({
        sql: "SELECT password_hash FROM auth_credentials WHERE sales_id = ?",
        args: [user.id],
      });
      const current = rowObject(credentials);
      if (
        !current ||
        !(await verifyPassword(body?.currentPassword, current.password_hash))
      )
        return jsonError(c, 401, "Invalid credentials");
      if (await verifyPassword(body.newPassword, current.password_hash))
        return jsonError(c, 400, "New password must differ");
      const hash = await hashPassword(body.newPassword);
      const tx = await db.transaction("write");
      try {
        await tx.execute({
          sql: "UPDATE auth_credentials SET password_hash = ?, must_change_password = 0, temporary_expires_at = NULL, credential_version = credential_version + 1, updated_at = ? WHERE sales_id = ?",
          args: [hash, iso(), user.id],
        });
        await tx.execute({
          sql: "DELETE FROM auth_sessions WHERE sales_id = ?",
          args: [user.id],
        });
        await tx.commit();
      } catch (error) {
        await tx.rollback();
        throw error;
      }
      const refreshed = await getUserByCredentials(db, user.email ?? "");
      const session = await createSession(db, refreshed);
      setCookie(c, COOKIE, session.token, cookieOptions(false));
      return c.json(sessionResponse({ ...refreshed, must_change_password: 0 }));
    } catch (error) {
      return jsonError(c, 400, error.message);
    }
  });

  app.post("/api/auth/users", async (c) => {
    try {
      assertOrigin(c, appOrigin);
      const owner = requireUser(c);
      if (!owner) return jsonError(c, 401, "Unauthorized");
      if (!isOwner(owner)) return jsonError(c, 403, "Forbidden");
      const body = await parseJson(c);
      const email = body?.email?.trim()?.toLowerCase();
      if (
        !validEmail(email) ||
        typeof body?.first_name !== "string" ||
        typeof body?.last_name !== "string"
      )
        return jsonError(c, 400, "Invalid user");
      const tx = await db.transaction("write");
      try {
        const sale = rowObject(
          await tx.execute({
            sql: "INSERT INTO sales (email, first_name, last_name, avatar, administrator, disabled) VALUES (?, ?, ?, ?, 0, ?) RETURNING *",
            args: [
              email,
              body.first_name,
              body.last_name,
              body.avatar ? JSON.stringify(body.avatar) : null,
              body.password ? 0 : 1,
            ],
          }),
        );
        if (body.password !== undefined) {
          const hash = await hashPassword(body.password);
          await tx.execute({
            sql: "INSERT INTO auth_credentials (sales_id, email, password_hash, must_change_password, temporary_expires_at) VALUES (?, ?, ?, 1, ?)",
            args: [
              sale.id,
              email,
              hash,
              iso(new Date(Date.now() + TEMPORARY_MS)),
            ],
          });
        }
        await tx.commit();
        return c.json(
          {
            user: publicUser(sale),
            must_change_password: Boolean(body.password),
          },
          201,
        );
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    } catch (error) {
      return jsonError(c, 400, error.message);
    }
  });

  app.patch("/api/auth/users/:id", async (c) => {
    try {
      assertOrigin(c, appOrigin);
      const actor = requireUser(c);
      if (!actor) return jsonError(c, 401, "Unauthorized");
      const targetId = Number(c.req.param("id"));
      if (!Number.isInteger(targetId)) return jsonError(c, 400, "Invalid user");
      const body = await parseJson(c);
      const owner = isOwner(actor);
      if (!owner && actor.id !== targetId)
        return jsonError(c, 403, "Forbidden");
      const allowed = owner
        ? ["first_name", "last_name", "avatar", "email", "disabled"]
        : ["first_name", "last_name", "avatar"];
      const fields = Object.fromEntries(
        Object.entries(body ?? {}).filter(([key]) => allowed.includes(key)),
      );
      if (Object.keys(fields).length === 0)
        return jsonError(c, 400, "No allowed changes");
      if (
        fields.email !== undefined &&
        !validEmail(fields.email?.trim()?.toLowerCase())
      )
        return jsonError(c, 400, "Invalid email");
      if (targetId === actor.id && fields.disabled)
        return jsonError(c, 400, "Owner cannot disable itself");
      if (fields.avatar !== undefined)
        fields.avatar =
          fields.avatar === null ? null : JSON.stringify(fields.avatar);
      if (fields.email !== undefined)
        fields.email = fields.email.trim().toLowerCase();
      const tx = await db.transaction("write");
      try {
        const columns = Object.keys(fields);
        const values = Object.values(fields);
        const sale = rowObject(
          await tx.execute({
            sql: `UPDATE sales SET ${columns.map((field) => `"${field}" = ?`).join(", ")} WHERE id = ? RETURNING *`,
            args: [...values, targetId],
          }),
        );
        if (!sale) throw new Error("User not found");
        if (fields.email !== undefined) {
          await tx.execute({
            sql: "UPDATE auth_credentials SET email = ?, credential_version = credential_version + 1, updated_at = ? WHERE sales_id = ?",
            args: [fields.email, iso(), targetId],
          });
        }
        if (fields.disabled !== undefined || fields.email !== undefined)
          await tx.execute({
            sql: "DELETE FROM auth_sessions WHERE sales_id = ?",
            args: [targetId],
          });
        await tx.commit();
        return c.json({ user: publicUser(sale) });
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    } catch (error) {
      return jsonError(c, 400, error.message);
    }
  });

  app.post("/api/auth/users/:id/password", async (c) => {
    try {
      assertOrigin(c, appOrigin);
      const owner = requireUser(c);
      if (!owner) return jsonError(c, 401, "Unauthorized");
      if (!isOwner(owner)) return jsonError(c, 403, "Forbidden");
      const targetId = Number(c.req.param("id"));
      if (!Number.isInteger(targetId) || targetId === owner.id)
        return jsonError(c, 400, "Invalid user");
      const body = await parseJson(c);
      assertPassword(body?.newPassword);
      const hash = await hashPassword(body.newPassword);
      const tx = await db.transaction("write");
      try {
        const sale = rowObject(
          await tx.execute({
            sql: "SELECT id, email FROM sales WHERE id = ?",
            args: [targetId],
          }),
        );
        if (!sale) throw new Error("User not found");
        await tx.execute({
          sql: "INSERT INTO auth_credentials (sales_id, email, password_hash, must_change_password, temporary_expires_at) VALUES (?, ?, ?, 1, ?) ON CONFLICT(sales_id) DO UPDATE SET password_hash = excluded.password_hash, must_change_password = 1, temporary_expires_at = excluded.temporary_expires_at, credential_version = auth_credentials.credential_version + 1, updated_at = excluded.updated_at",
          args: [
            targetId,
            sale.email,
            hash,
            iso(new Date(Date.now() + TEMPORARY_MS)),
          ],
        });
        await tx.execute({
          sql: "DELETE FROM auth_sessions WHERE sales_id = ?",
          args: [targetId],
        });
        await tx.commit();
        return c.json({ ok: true });
      } catch (error) {
        await tx.rollback();
        throw error;
      }
    } catch (error) {
      return jsonError(c, 400, error.message);
    }
  });
}

export async function authGuard(c, db) {
  const user = await getSession(c, db);
  if (!user) return jsonError(c, 401, "Unauthorized");
  if (user.must_change_password)
    return jsonError(c, 403, "PASSWORD_CHANGE_REQUIRED");
  c.set("authUser", user);
  return null;
}

export function authorizeDataRequest(c, resource, method) {
  const readMethod = [
    "getList",
    "getOne",
    "getMany",
    "getManyReference",
  ].includes(method);
  const identity = c.get("authUser");
  if (resource === "sales" && !readMethod) {
    return jsonError(c, 403, "Sales mutations must use the account API");
  }
  if (resource === "configuration" && !identity.administrator && !readMethod) {
    return jsonError(c, 403, "Forbidden");
  }
  return null;
}
