import { realpathSync } from "node:fs";
import { join } from "node:path";
import { exec } from "./process.mjs";

// APP_DIR / CLAUDE_PROJECT_DIR override the detected root (used by hook tests).
function getRepo() {
  if (process.env.APP_DIR) return process.env.APP_DIR;
  if (process.env.CLAUDE_PROJECT_DIR) return process.env.CLAUDE_PROJECT_DIR;
  const top = exec("git", ["rev-parse", "--show-toplevel"]);
  if (top.status === 0 && top.stdout.trim()) return top.stdout.trim();
  return process.cwd();
}

export const REPO = getRepo();

export const CONFIG_DIR =
  process.env.CLAUDE_CONFIG_DIR || join(process.env.HOME || "/root", ".claude");

// Resolved, not the literal string: on macOS /tmp is a symlink to /private/tmp.
// realpathSync fixes this at the single source every other path in this
// module chain derives from.
function resolveTmpRoot() {
  const raw = process.env.CRM_TMP_ROOT || "/tmp";
  try {
    return realpathSync(raw);
  } catch {
    return raw; // path doesn't exist yet — fall back rather than throw at import time
  }
}
export const TMP_ROOT = resolveTmpRoot();

export function sanitizePath(p) {
  return String(p ?? "").replace(/\//g, "_");
}
