// Local-only owner provisioning. Passwords come from stdin, never CLI args.
// printf '%s' 'temporary-password' | node --env-file=.env server/manage-auth.mjs prepare --sales-id 1 --email owner@example.com
import { db } from "./db.mjs";
import { hashPassword } from "./auth.mjs";

function option(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : (process.argv[index + 1] ?? null);
}

const command = process.argv[2];
const salesId = Number(option("--sales-id"));
const email = option("--email")?.trim().toLowerCase();
const password = (await new Response(process.stdin).text()).replace(
  /\r?\n$/,
  "",
);

if (
  !["prepare", "reset-owner"].includes(command) ||
  !Number.isInteger(salesId) ||
  !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email ?? "")
) {
  throw new Error(
    "Usage: <prepare|reset-owner> --sales-id <id> --email <email>; provide the password on stdin",
  );
}

const hash = await hashPassword(password);
const tx = await db.transaction("write");
try {
  const owner = await tx.execute({
    sql: "SELECT id FROM sales WHERE id = ?",
    args: [salesId],
  });
  if (owner.rows.length === 0)
    throw new Error("Selected sales profile does not exist");
  const credentials = await tx.execute(
    "SELECT sales_id FROM auth_credentials LIMIT 1",
  );
  if (command === "prepare" && credentials.rows.length > 0)
    throw new Error("Credentials already exist; use reset-owner explicitly");
  await tx.execute({
    sql: "UPDATE sales SET administrator = CASE WHEN id = ? THEN 1 ELSE 0 END",
    args: [salesId],
  });
  await tx.execute({
    sql: "UPDATE sales SET email = ?, disabled = 0 WHERE id = ?",
    args: [email, salesId],
  });
  await tx.execute({
    sql: `INSERT INTO auth_credentials (sales_id, email, password_hash, must_change_password, temporary_expires_at)
    VALUES (?, ?, ?, 0, NULL)
    ON CONFLICT(sales_id) DO UPDATE SET email = excluded.email, password_hash = excluded.password_hash,
      must_change_password = 0, temporary_expires_at = NULL,
      credential_version = auth_credentials.credential_version + 1, updated_at = excluded.updated_at`,
    args: [salesId, email, hash],
  });
  await tx.execute({
    sql: "DELETE FROM auth_sessions WHERE sales_id = ?",
    args: [salesId],
  });
  await tx.commit();
  process.stdout.write("Owner credentials prepared.\n");
} catch (error) {
  await tx.rollback();
  throw error;
} finally {
  db.close();
}
