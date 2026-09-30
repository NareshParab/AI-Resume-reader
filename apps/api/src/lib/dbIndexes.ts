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

  console.log("[DB] Indexes ensured: users.email (unique), resumes.batchId");
}
