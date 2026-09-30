import dotenv from "dotenv";
import { resolve, dirname } from "path";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { healthRouter } from "./routes/health.js";
import { resumesRouter } from "./routes/resumes.js";
import { authRouter } from "./routes/auth.js";
import { batchesRouter } from "./routes/batches.js";
import { API_PORT, API_BASE_PATH, CORS_ALLOWED_ORIGINS } from "@gcarbon/config";
import { closeDatabase } from "./lib/db.js";

// ─── Process-level safety net ──────────────────────────────────────────────────
// Some third-party parsing libraries (e.g. pdf-parse, wrapping an older pdf.js
// build) can throw exceptions asynchronously, outside any promise chain a
// route-level try/catch can see. Without these handlers, such an exception
// would crash the entire Node process — taking the API down for every
// concurrent user, not just the one request that triggered it. These handlers
// log the failure and keep the process alive instead.
process.on("uncaughtException", (err) => {
  console.error("[API] Uncaught exception (process kept alive):", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("[API] Unhandled promise rejection (process kept alive):", reason);
});

// ─── Environment validation ───────────────────────────────────────────────────
const isProd = process.env.NODE_ENV === "production";

if (!process.env.JWT_SECRET) {
  console.error("[API] FATAL: JWT_SECRET is not set. Refusing to start.");
  process.exit(1);
}
if (isProd && !process.env.MONGODB_URI) {
  console.error("[API] FATAL: MONGODB_URI is required in production. Refusing to start.");
  process.exit(1);
}
if (!process.env.GEMINI_API_KEY) {
  console.warn("[API] WARNING: GEMINI_API_KEY is not set — AI scoring will fail.");
}

const app = express();

// Trust first proxy hop (required on Render/Heroku for correct req.ip behind load balancer)
app.set("trust proxy", 1);

// ─── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN
      ? [process.env.CORS_ORIGIN]
      : [...CORS_ALLOWED_ORIGINS],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use(`${API_BASE_PATH}/health`, healthRouter);
app.use(`${API_BASE_PATH}/auth`, authRouter);
app.use(`${API_BASE_PATH}/resumes`, resumesRouter);
app.use(`${API_BASE_PATH}/batches`, batchesRouter);

if (process.env.NODE_ENV === "production") {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const webDistPath = path.join(__dirname, "../../web/dist");

  app.use(express.static(webDistPath));

  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(webDistPath, "index.html"));
  });
}

// ─── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error("[API Error]", err);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
);

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const port = Number(process.env.PORT ?? API_PORT);

const server = app.listen(port, () => {
  console.log(`🚀 Gcarbon API running on http://localhost:${port.toString()}`);
  console.log(`   Health:   http://localhost:${port.toString()}${API_BASE_PATH}/health`);
  console.log(`   Database: MongoDB`);
  console.log(`   DB Name:  ${process.env.MONGODB_DB_NAME ?? "gcarbon_resume_ai"}`);
  
  Promise.all([import("./lib/db.js"), import("./lib/dbIndexes.js")])
    .then(async ([{ connectDatabase, getDatabase }, { ensureIndexes }]) => {
      await connectDatabase();
      console.log(`[API] MongoDB connected successfully`);

      await ensureIndexes();

      // Recover any batches left in "processing" state from a previous crash/restart
      const db = getDatabase();
      const stuckResult = await db.collection("batches").updateMany(
        { status: "processing" },
        { $set: { status: "failed", failedReason: "Server restarted during processing" } }
      );
      if (stuckResult.modifiedCount > 0) {
        console.warn(`[API] Marked ${stuckResult.modifiedCount.toString()} stuck batch(es) as failed.`);
      }
    })
    .catch((e: unknown) => {
      console.error(`[API] Warning: Failed to connect to MongoDB on startup:`, e);
    });
});

// ─── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal: string) {
  console.log(`\n[API] Received ${signal} — shutting down gracefully…`);
  server.close(() => {
    closeDatabase()
      .then(() => {
        console.log("[API] MongoDB connection closed");
      })
      .catch((e: unknown) => {
        console.error("[API] Error closing MongoDB:", e);
      })
      .finally(() => {
        process.exit(0);
      });
  });
}

process.on("SIGTERM", () => { shutdown("SIGTERM"); });
process.on("SIGINT",  () => { shutdown("SIGINT"); });

export { app };
