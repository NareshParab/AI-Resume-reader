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

// ─── Resume routes ────────────────────────────────────────────────────────────

export const resumeIdParamSchema = z.object({
  id: z
    .string()
    .regex(/^[a-fA-F0-9]{24}$/, "Resume ID must be a 24-character hexadecimal string."),
});

export const resumeFileMetadataSchema = z.object({
  originalname: z
    .string()
    .min(1, "Filename cannot be empty.")
    .max(255, "Filename is too long."),
  mimetype: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
});
