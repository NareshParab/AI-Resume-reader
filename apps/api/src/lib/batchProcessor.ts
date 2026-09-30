import { getDatabase } from "./db.js";
import { extractResumeText } from "./fileExtractor.js";
import { parseResumeText } from "./parser.js";
import { scoreCandidate } from "./candidateScoring.js";
import { withRetry } from "./withRetry.js";
import { withTimeout } from "./withTimeout.js";
import { ObjectId } from "mongodb";
import type { Resume, Batch } from "@gcarbon/types";

/** Minimal file data captured from multer before the request handler returns. */
export interface FilePayload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

const EXTRACTION_TIMEOUT_MS = 15_000;

// scoreCandidate prompt includes both the job description AND the full profile
// JSON, making it larger than generateInsights. 120 s gives headroom over the
// observed ~54 s for generateInsights while still protecting against hangs.
const SCORING_TIMEOUT_MS = 120_000;

// Gemini free-tier rate-limit windows reset after ~60 s. Use longer backoffs
// than the default withRetry values so retries have a real chance of succeeding.
const BATCH_RETRY_DELAYS = [60_000, 120_000] as const;

// 20 s between files keeps the effective request rate well below free-tier RPM
// limits regardless of how quickly scoreCandidate itself returns.
const INTER_FILE_DELAY_MS = 20_000;

/**
 * Full async pipeline: extract text, parse, and score each file in the batch.
 * Called fire-and-forget from the route handler after the 201 response is sent.
 * Per-file failures increment failedCount without aborting the whole batch.
 *
 * parsedProfile is written to MongoDB before AI scoring starts so that
 * extraction work is never silently discarded when scoring fails.
 */
export async function processBatch(
  batchId: string,
  files: FilePayload[],
  jobDescription: string
): Promise<void> {
  const db = getDatabase();
  const batchesCollection = db.collection<Omit<Batch, "_id">>("batches");
  const resumesCollection = db.collection<Omit<Resume, "_id">>("resumes");

  const batchObjectId = new ObjectId(batchId);

  const batch = await batchesCollection.findOne({ _id: batchObjectId });
  if (!batch) {
    console.error(`[BatchProcessor] Batch ${batchId} not found.`);
    return;
  }

  const userId = batch.userId ?? "";
  let completedCount = 0;
  let failedCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;

    // Pace requests to stay within free-tier AI limits
    if (i > 0) await delay(INTER_FILE_DELAY_MS);

    // ── Step 1: Extract text ──────────────────────────────────────────────────
    let extractedText: string;
    try {
      const label = file.mimetype === "application/pdf" ? "PDF parsing" : "DOCX parsing";
      extractedText = await withTimeout(
        extractResumeText({ buffer: file.buffer, mimetype: file.mimetype }),
        EXTRACTION_TIMEOUT_MS,
        label
      );
    } catch (extractErr) {
      // Save a minimal doc so the batch result can show which file failed
      const failedDoc: Omit<Resume, "_id"> = {
        userId,
        batchId,
        filename: file.originalname,
        fileType: file.mimetype,
        extractedText: "",
        charCount: 0,
        wordCount: 0,
        uploadedAt: new Date().toISOString(),
        extractionError: extractErr instanceof Error ? extractErr.message : "Extraction failed",
      };
      await resumesCollection.insertOne(failedDoc);
      failedCount++;
      await batchesCollection.updateOne({ _id: batchObjectId }, { $set: { failedCount } });
      console.error(`[BatchProcessor] Extraction failed for ${file.originalname}:`, extractErr);
      continue;
    }

    // ── Step 2: Save resume doc ───────────────────────────────────────────────
    const charCount = extractedText.length;
    const wordCount = extractedText.split(" ").filter((w) => w.length > 0).length;
    const resumeDoc: Omit<Resume, "_id"> = {
      userId,
      batchId,
      filename: file.originalname,
      fileType: file.mimetype,
      extractedText,
      charCount,
      wordCount,
      uploadedAt: new Date().toISOString(),
    };
    const insertResult = await resumesCollection.insertOne(resumeDoc);

    // ── Step 3: Parse and persist profile ────────────────────────────────────
    // parseResumeText is synchronous and never throws. Saving the profile
    // immediately ensures it is not lost if the subsequent AI scoring step fails.
    const parsedProfile = parseResumeText(extractedText);
    await resumesCollection.updateOne(
      { _id: insertResult.insertedId },
      { $set: { parsedProfile } }
    );

    // ── Step 4: AI candidate scoring ─────────────────────────────────────────
    try {
      const candidateScore = await withRetry(
        () => withTimeout(
          scoreCandidate(parsedProfile, jobDescription),
          SCORING_TIMEOUT_MS,
          "Candidate scoring"
        ),
        [...BATCH_RETRY_DELAYS]
      );

      await resumesCollection.updateOne(
        { _id: insertResult.insertedId },
        { $set: { candidateScore } }
      );

      completedCount++;
      await batchesCollection.updateOne({ _id: batchObjectId }, { $set: { completedCount } });
      console.log(`[BatchProcessor] Scored ${file.originalname} successfully.`);
    } catch (err) {
      // parsedProfile is already saved above — only scoring failed
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[BatchProcessor] AI scoring failed for "${file.originalname}": ${errMsg}`
      );
      failedCount++;
      await batchesCollection.updateOne({ _id: batchObjectId }, { $set: { failedCount } });
    }
  }

  await batchesCollection.updateOne(
    { _id: batchObjectId },
    { $set: { status: "completed", completedCount, failedCount } }
  );

  console.log(
    `[BatchProcessor] Batch ${batchId} completed: ${completedCount.toString()} success, ${failedCount.toString()} failed.`
  );
}
