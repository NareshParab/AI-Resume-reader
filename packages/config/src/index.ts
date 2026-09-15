// ─── Application-wide configuration constants ─────────────────────────────────

export const APP_NAME = "Gcarbon Resume AI" as const;
export const APP_VERSION = "0.1.0" as const;

export const API_PORT = 4000 as const;
export const WEB_PORT = 5173 as const;

export const API_BASE_PATH = "/api/v1" as const;

export const CORS_ALLOWED_ORIGINS = [
  `http://localhost:${WEB_PORT}`,
  `http://127.0.0.1:${WEB_PORT}`,
] as const;

// ─── Database ─────────────────────────────────────────────────────────────────

/** Default MongoDB URI used when env var is not provided. */
export const DEFAULT_MONGODB_URI = "mongodb://127.0.0.1:27017" as const;

/** Default database name for local development. */
export const DEFAULT_MONGODB_DB_NAME = "gcarbon_resume_ai" as const;
