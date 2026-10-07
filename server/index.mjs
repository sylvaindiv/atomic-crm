// Atomic CRM backend — a thin data API over Turso/libSQL for the react-admin
// frontend, plus static hosting of the built SPA in production.
//
// Dev:  node --watch --env-file=.env server/index.mjs   (Vite proxies /api here)
// Prod: NODE_ENV=production node --env-file=.env server/index.mjs   (serves ./dist)
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";

import { db, initSchema, loadTableColumns } from "./db.mjs";
import {
  getAppOrigin,
  authGuard,
  authorizeDataRequest,
  mountAuth,
} from "./auth.mjs";
import { HANDLERS } from "./query.mjs";
import { RESOURCES } from "./resources.mjs";
import { mountColumnPreferences } from "./preferences.mjs";

const app = new Hono();

app.get("/api/health", (c) => c.json({ status: "ok" }));
mountAuth(app, { db });
mountColumnPreferences(app, db);

// Generic data endpoint: POST /api/:resource/:method with a JSON body matching
// the react-admin DataProvider params for that method.
app.post("/api/:resource/:method", async (c) => {
  const { resource, method } = c.req.param();
  const authError = await authGuard(c, db);
  if (authError) return authError;
  const cfg = RESOURCES[resource];
  if (!cfg) return c.json({ error: `Unknown resource: ${resource}` }, 404);
  const handler = HANDLERS[method];
  if (!handler) return c.json({ error: `Unknown method: ${method}` }, 404);

  if (!["getList", "getOne", "getMany", "getManyReference"].includes(method)) {
    const origin = c.req.header("origin");
    const appOrigin = getAppOrigin();
    if (
      origin !== appOrigin ||
      !c.req
        .header("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    ) {
      return c.json({ error: "Invalid request origin" }, 400);
    }
  }

  const authorizationError = authorizeDataRequest(c, resource, method);
  if (authorizationError) return authorizationError;

  const body = await c.req.json().catch(() => ({}));
  try {
    return c.json(await handler(cfg, body));
  } catch (err) {
    console.error(`[${resource}/${method}]`, err);
    return c.json({ error: err?.message ?? "Internal error" }, 400);
  }
});

// Serve the built frontend (production / single-process VPS deploy).
if (process.env.NODE_ENV === "production" || process.env.SERVE_STATIC === "1") {
  app.use("/*", serveStatic({ root: "./dist" }));
  // SPA fallback for client-side routes.
  app.get("/*", serveStatic({ path: "./dist/index.html" }));
}

await initSchema();
await loadTableColumns();

const port = Number(process.env.PORT ?? 3001);
serve({ fetch: app.fetch, port }, (info) => {
  // no-console only permits warn/error, so write the startup notice to stdout directly.
  process.stdout.write(
    `Atomic CRM API listening on http://localhost:${info.port}\n`,
  );
});
