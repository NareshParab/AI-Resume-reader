import { Router } from "express";
import type { HealthStatus, ServiceCheck, ServiceStatus } from "@gcarbon/types";
import { APP_VERSION } from "@gcarbon/config";
import { pingDatabase } from "../lib/db.js";

export const healthRouter = Router();

const startTime = Date.now();

async function checkDatabase(): Promise<ServiceCheck> {
  try {
    const latencyMs = await pingDatabase();
    return { status: "ok", latencyMs };
  } catch (err) {
    return {
      status: "down",
      error: err instanceof Error ? err.message : "Unknown MongoDB error",
    };
  }
}

function aggregateStatus(checks: ServiceCheck[]): ServiceStatus {
  if (checks.some((c) => c.status === "down")) return "down";
  if (checks.some((c) => c.status === "degraded")) return "degraded";
  return "ok";
}

/** GET /api/v1/health */
healthRouter.get("/", async (_req, res) => {
  const database = await checkDatabase();
  const apiCheck: ServiceCheck = { status: "ok" };
  const services = { api: apiCheck, database };
  const overallStatus = aggregateStatus(Object.values(services));

  const health: HealthStatus = {
    status: overallStatus,
    version: APP_VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    services,
  };

  res.status(overallStatus === "down" ? 503 : 200).json({
    success: overallStatus !== "down",
    data: health,
  });
});
