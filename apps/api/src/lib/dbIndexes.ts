import { getDatabase } from "./db.js";

/**
 * Ensures the required MongoDB indexes exist.
 * Safe to call on every startup — createIndex is idempotent.
 */
export async function ensureIndexes(): Promise<void> {
  const db = getDatabase();

  // users.email — unique constraint prevents duplicate accounts
  await db.collection("users").createIndex(
    { email: 1 },
    { unique: true, name: "users_email_unique" }
  );

  // resumes.batchId — speeds up the per-batch resume fetch in GET /batches/:id
  await db.collection("resumes").createIndex(
    { batchId: 1 },
    { name: "resumes_batchId" }
  );

  // passwordResetTokens.tokenHash — lookup during password reset
  await db.collection("passwordResetTokens").createIndex(
    { tokenHash: 1 },
    { name: "prt_tokenHash" }
  );

  // passwordResetTokens.expiresAt — TTL; MongoDB auto-deletes expired tokens
  await db.collection("passwordResetTokens").createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: "prt_expiresAt_ttl" }
  );

  console.log("[DB] Indexes ensured: users.email (unique), resumes.batchId, passwordResetTokens.tokenHash, passwordResetTokens.expiresAt (TTL)");
}
