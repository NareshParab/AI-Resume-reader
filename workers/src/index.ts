import "dotenv/config";
import { APP_NAME, APP_VERSION } from "@gcarbon/config";
import type { WorkerInfo } from "@gcarbon/types";

// ─── Worker entrypoint ────────────────────────────────────────────────────────
// This is the base worker scaffold.  Job queues, processors, and AI pipelines
// will be wired in here as the project evolves.

const worker: WorkerInfo = {
  id: `worker-${process.pid.toString()}`,
  status: "idle",
  startedAt: new Date().toISOString(),
};

console.log(`🔧 ${APP_NAME} Worker v${APP_VERSION} started`);
console.log(`   ID:      ${worker.id}`);
console.log(`   Status:  ${worker.status}`);
console.log(`   Started: ${worker.startedAt}`);

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("Worker received SIGTERM – shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("Worker received SIGINT – shutting down gracefully");
  process.exit(0);
});

// Keep the process alive (placeholder for future job loop)
setInterval(() => {
  // Heartbeat – replace with job polling once queue is wired up
}, 30_000);
