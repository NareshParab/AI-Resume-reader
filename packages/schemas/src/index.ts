import { z } from "zod";

// ─── Health schema ────────────────────────────────────────────────────────────

export const healthStatusSchema = z.object({
  status: z.enum(["ok", "degraded", "down"]),
  version: z.string(),
  timestamp: z.string().datetime(),
  uptime: z.number().nonnegative(),
});

export type HealthStatus = z.infer<typeof healthStatusSchema>;

// ─── API Response wrapper ─────────────────────────────────────────────────────

export const apiResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    message: z.string().optional(),
  });
