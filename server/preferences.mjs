import { authGuard, getAppOrigin } from "./auth.mjs";

const resources = new Set(["companies", "contacts", "partners"]);

export function validColumnPreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (Object.keys(value).sort().join() !== "hidden,order,widths") return false;
  const ids = (items) =>
    Array.isArray(items) &&
    items.length <= 100 &&
    items.every(
      (id) => typeof id === "string" && /^[a-zA-Z_][\w.]{0,99}$/.test(id),
    ) &&
    new Set(items).size === items.length;
  return (
    ids(value.order) &&
    ids(value.hidden) &&
    value.widths &&
    typeof value.widths === "object" &&
    !Array.isArray(value.widths) &&
    Object.keys(value.widths).length <= 100 &&
    Object.entries(value.widths).every(
      ([id, width]) =>
        /^[a-zA-Z_][\w.]{0,99}$/.test(id) &&
        typeof width === "number" &&
        Number.isFinite(width) &&
        width >= 60 &&
        width <= 2000,
    )
  );
}

export function mountColumnPreferences(app, db) {
  app.get("/api/preferences/columns/:resource", async (c) => {
    const denied = await authGuard(c, db);
    if (denied) return denied;
    const resource = c.req.param("resource");
    if (!resources.has(resource))
      return c.json({ error: "Unknown resource" }, 404);
    const result = await db.execute({
      sql: "SELECT settings FROM column_preferences WHERE sales_id = ? AND resource = ?",
      args: [c.get("authUser").id, resource],
    });
    return c.json({
      settings: result.rows[0] ? JSON.parse(result.rows[0].settings) : null,
    });
  });

  app.put("/api/preferences/columns/:resource", async (c) => {
    const denied = await authGuard(c, db);
    if (denied) return denied;
    const resource = c.req.param("resource");
    if (!resources.has(resource))
      return c.json({ error: "Unknown resource" }, 404);
    if (
      c.req.header("origin") !== getAppOrigin() ||
      !c.req
        .header("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      return c.json({ error: "Invalid request origin" }, 400);
    const settings = await c.req.json().catch(() => null);
    if (!validColumnPreferences(settings))
      return c.json({ error: "Invalid preferences" }, 400);
    await db.execute({
      sql: "INSERT INTO column_preferences (sales_id, resource, settings) VALUES (?, ?, ?) ON CONFLICT(sales_id, resource) DO UPDATE SET settings = excluded.settings",
      args: [c.get("authUser").id, resource, JSON.stringify(settings)],
    });
    return c.json({ settings });
  });
}
