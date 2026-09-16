import dotenv from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../../../.env") });
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { healthRouter } from "./routes/health.js";
import { resumesRouter } from "./routes/resumes.js";
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

const app = express();

// ─── Security middleware ───────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env["CORS_ORIGIN"]
      ? [process.env["CORS_ORIGIN"]]
      : [...CORS_ALLOWED_ORIGINS],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use(`${API_BASE_PATH}/health`, healthRouter);
app.use(`${API_BASE_PATH}/resumes`, resumesRouter);

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
const port = Number(process.env["PORT"] ?? API_PORT);

const server = app.listen(port, async () => {
  console.log(`🚀 Gcarbon API running on http://localhost:${port}`);
  console.log(`   Health:   http://localhost:${port}${API_BASE_PATH}/health`);
  console.log(`   Database: MongoDB`);
  console.log(`   DB Name:  ${process.env["MONGODB_DB_NAME"] ?? "gcarbon_resume_ai"}`);
  
  try {
    const { connectDatabase } = await import("./lib/db.js");
    await connectDatabase();
    console.log(`[API] MongoDB connected successfully`);
  } catch (e) {
    console.error(`[API] Warning: Failed to connect to MongoDB on startup:`, e);
  }
});

// ─── Graceful shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`\n[API] Received ${signal} — shutting down gracefully…`);
  server.close(async () => {
    try {
      await closeDatabase();
      console.log("[API] MongoDB connection closed");
    } catch (e) {
      console.error("[API] Error closing MongoDB:", e);
    }
    process.exit(0);
  });
}

process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
process.on("SIGINT",  () => { void shutdown("SIGINT"); });

export { app };
