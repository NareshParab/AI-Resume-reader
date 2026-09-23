import { z } from "zod";

// ─── Auth routes ──────────────────────────────────────────────────────────────

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

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

// ─── AI analysis ──────────────────────────────────────────────────────────────

export const aiInsightsSchema = z.object({
  summary: z.string().min(1),
  strengths: z.array(z.string().min(1)).min(1),
  improvementSuggestions: z.array(z.string().min(1)).min(1),
});

// ─── Scoring ──────────────────────────────────────────────────────────────────

export const candidateScoreSchema = z.object({
  score: z.number().min(1).max(10),
  reasoning: z.string().min(1),
  matchedSkills: z.array(z.string().min(1)),
});

export const jobDescriptionSchema = z.string().min(20).max(5000);
