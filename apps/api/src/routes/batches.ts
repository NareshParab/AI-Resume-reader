import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { extractResumeText } from "../lib/fileExtractor.js";
import { getDatabase } from "../lib/db.js";
import type { Resume, Batch } from "@gcarbon/types";
import { ObjectId } from "mongodb";
import { resumeIdParamSchema, resumeFileMetadataSchema, jobDescriptionSchema } from "@gcarbon/schemas";
import { processBatch } from "../lib/batchProcessor.js";
import { withTimeout } from "../lib/withTimeout.js";
import { requireAuth } from "../lib/auth.js";

export const batchesRouter = Router();

// Multer config: memory storage, max 5MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF and DOCX are allowed."));
    }
  },
});

function handleUpload(req: Request, res: Response, next: NextFunction) {
  upload.array("resumes", 20)(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            error: "File is too large. Maximum size is 5MB.",
          });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
          return res.status(400).json({
            success: false,
            error: "Too many files uploaded (maximum is 20) or invalid field name.",
          });
        }
        return res.status(400).json({ success: false, error: err.message });
      }
      if (err instanceof Error) {
        return res.status(400).json({ success: false, error: err.message });
      }
      return res.status(400).json({
        success: false,
        error: "Failed to process the uploaded files.",
      });
    }
    next();
  });
}

const EXTRACTION_TIMEOUT_MS = 15000;

batchesRouter.post("/", requireAuth, handleUpload, async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0 || files.length > 20) {
      return res.status(400).json({ success: false, error: "Must upload between 1 and 20 files." });
    }

    const body = req.body as Record<string, unknown>;
    const { jobDescription } = body;
    const jdResult = jobDescriptionSchema.safeParse(jobDescription);
    if (!jdResult.success) {
      return res.status(400).json({
        success: false,
        error: jdResult.error.issues[0]?.message ?? "Invalid job description.",
      });
    }

    for (const file of files) {
      const fileMetaResult = resumeFileMetadataSchema.safeParse(file);
      if (!fileMetaResult.success) {
        return res.status(400).json({
          success: false,
          error: fileMetaResult.error.issues[0]?.message ?? "Invalid file metadata.",
        });
      }
    }

    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ success: false, error: "Authentication required." });
    }

    const db = getDatabase();
    
    // Create batch document first to get its ID
    const batchDoc: Omit<Batch, "_id"> = {
      userId,
      jobDescription: jdResult.data,
      status: "processing",
      totalCount: files.length,
      completedCount: 0,
      failedCount: 0,
      createdAt: new Date().toISOString(),
    };
    
    const batchResult = await db.collection<Omit<Batch, "_id">>("batches").insertOne(batchDoc);
    const batchId = batchResult.insertedId.toString();

    // Process all files and save as resumes
    for (const file of files) {
      const label = file.mimetype === "application/pdf" ? "PDF parsing" : "DOCX parsing";
      const extractedText = await withTimeout(
        extractResumeText(file),
        EXTRACTION_TIMEOUT_MS,
        label
      );

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

      await db.collection<Omit<Resume, "_id">>("resumes").insertOne(resumeDoc);
    }

    // Respond immediately
    res.status(201).json({
      success: true,
      data: {
        batchId,
        totalCount: files.length,
      },
    });

    // Kick off batch processing without awaiting (fire-and-forget)
    processBatch(batchId).catch((err: unknown) => {
      console.error(`[Batch ${batchId}] Background processing failed:`, err);
    });

  } catch (error) {
    console.error("[Batch Upload Error]:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create batch",
    });
  }
});

batchesRouter.get("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params as { id: string };

    // Use existing regex validation from resumeIdParamSchema for batch ID
    const idResult = resumeIdParamSchema.safeParse({ id });
    if (!idResult.success) {
      return res.status(400).json({
        success: false,
        error: idResult.error.issues[0]?.message ?? "Invalid batch ID format.",
      });
    }

    const db = getDatabase();
    const batchesCollection = db.collection<Omit<Batch, "_id">>("batches");

    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return res.status(400).json({ success: false, error: "Invalid batch ID format." });
    }

    const batchDoc = await batchesCollection.findOne({ _id: objectId });
    if (!batchDoc || batchDoc.userId !== req.userId) {
      return res.status(404).json({ success: false, error: "Batch not found." });
    }

    const { _id: _, ...rest } = batchDoc;
    const batch: Batch = { ...rest, _id: id };

    // Fetch all resumes for this batch
    const resumesCollection = db.collection<Omit<Resume, "_id">>("resumes");
    const resumeDocs = await resumesCollection.find({ batchId: id }).toArray();

    const resumes = resumeDocs.map(({ _id, ...r }) => {
      return { ...r, _id: _id.toString() };
    });

    // Sort by candidateScore.score descending, unscored ones last
    resumes.sort((a, b) => {
      const scoreA = a.candidateScore?.score;
      const scoreB = b.candidateScore?.score;

      if (scoreA !== undefined && scoreB !== undefined) {
        return scoreB - scoreA;
      }
      if (scoreA !== undefined) {
        return -1; // a has score, b does not -> a comes first
      }
      if (scoreB !== undefined) {
        return 1; // b has score, a does not -> b comes first
      }
      return 0; // both have no score
    });

    res.status(200).json({
      success: true,
      data: {
        ...batch,
        resumes,
      }
    });
  } catch (error) {
    console.error("[Batch Get Error]:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to retrieve batch",
    });
  }
});
