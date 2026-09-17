import { MongoClient, type Db } from "mongodb";
import { DEFAULT_MONGODB_DB_NAME, DEFAULT_MONGODB_URI } from "@gcarbon/config";

// evaluated lazily
function getUri() { return process.env.MONGODB_URI ?? DEFAULT_MONGODB_URI; }
function getDbName() { return process.env.MONGODB_DB_NAME ?? DEFAULT_MONGODB_DB_NAME; }

let client: MongoClient | null = null;
let database: Db | null = null;
let connectPromise: Promise<Db> | null = null;

/** Connect once and reuse the MongoDB client across requests. */
export async function connectDatabase(): Promise<Db> {
  if (database) return database;
  if (connectPromise) return connectPromise;

  connectPromise = (async () => {
    try {
      client = new MongoClient(getUri(), {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
      });

      await client.connect();
      const db = client.db(getDbName());
      await db.command({ ping: 1 });
      database = db;
      return database;
    } catch (err) {
      client = null;
      connectPromise = null;
      throw err;
    }
  })();

  return connectPromise;
}

export function getDatabase(): Db {
  if (!database) {
    throw new Error("MongoDB is not connected. Call connectDatabase() first.");
  }
  return database;
}

/** Lightweight connectivity check — returns latency in ms. */
export async function pingDatabase(): Promise<number> {
  const start = Date.now();
  const db = await connectDatabase();
  await db.command({ ping: 1 });
  return Date.now() - start;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    database = null;
    connectPromise = null;
  }
}
