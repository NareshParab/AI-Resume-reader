import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { extractResumeText } from "../lib/fileExtractor.js";
import { getDatabase } from "../lib/db.js";
import type { Resume } from "@gcarbon/types";
import { ObjectId } from "mongodb";
import { parseResumeText } from "../lib/parser.js";
import { generateInsights } from "../lib/aiAnalysis.js";
import { resumeIdParamSchema, resumeFileMetadataSchema } from "@gcarbon/schemas";

export const resumesRouter = Router();

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
  upload.single("resume")(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            success: false,
            error: "File is too large. Maximum size is 5MB.",
          });
        }
        return res.status(400).json({ success: false, error: err.message });
      }
      if (err instanceof Error) {
        return res.status(400).json({ success: false, error: err.message });
      }
      return res.status(400).json({
        success: false,
        error: "Failed to process the uploaded file.",
      });
    }
    next();
  });
}

const EXTRACTION_TIMEOUT_MS = 15000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms.toString()}ms`));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
}

resumesRouter.post("/upload", handleUpload, async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: "No file uploaded." });
    }

    const fileMetaResult = resumeFileMetadataSchema.safeParse(file);
    if (!fileMetaResult.success) {
      return res.status(400).json({
        success: false,
        error: fileMetaResult.error.issues[0]?.message ?? "Invalid file metadata.",
      });
    }

    const label = file.mimetype === "application/pdf" ? "PDF parsing" : "DOCX parsing";
    const extractedText = await withTimeout(
      extractResumeText(file),
      EXTRACTION_TIMEOUT_MS,
      label
    );

    const charCount = extractedText.length;
    const wordCount = extractedText.split(" ").filter((w) => w.length > 0).length;

    const resumeDoc: Omit<Resume, "_id"> = {
      filename: file.originalname,
      fileType: file.mimetype,
      extractedText,
      charCount,
      wordCount,
      uploadedAt: new Date().toISOString(),
    };

    const db = getDatabase();
    const result = await db.collection<Omit<Resume, "_id">>("resumes").insertOne(resumeDoc);

    const createdResume: Resume = {
      ...resumeDoc,
      _id: result.insertedId.toString(),
    };

    res.status(201).json({
      success: true,
      data: createdResume,
    });
  } catch (error) {
    console.error("[Resume Upload Error]:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to process resume",
    });
  }
});

resumesRouter.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const idResult = resumeIdParamSchema.safeParse({ id });
    if (!idResult.success) {
      return res.status(400).json({
        success: false,
        error: idResult.error.issues[0]?.message ?? "Invalid resume ID format.",
      });
    }

    const db = getDatabase();
    const resumesCollection = db.collection<Omit<Resume, "_id">>("resumes");

    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return res.status(400).json({ success: false, error: "Invalid resume ID format." });
    }

    const resumeDoc = await resumesCollection.findOne({ _id: objectId });
    if (!resumeDoc) {
      return res.status(404).json({ success: false, error: "Resume not found." });
    }

    const { _id: _, ...rest } = resumeDoc;
    const resume: Resume = { ...rest, _id: id };

    res.status(200).json({ success: true, data: resume });
  } catch (error) {
    console.error("[Resume Get Error]:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to retrieve resume",
    });
  }
});

resumesRouter.post("/:id/parse", async (req, res) => {
  try {
    const { id } = req.params;

    const idResult = resumeIdParamSchema.safeParse({ id });
    if (!idResult.success) {
      return res.status(400).json({
        success: false,
        error: idResult.error.issues[0]?.message ?? "Invalid resume ID format.",
      });
    }

    const db = getDatabase();
    // Typed collection to avoid 'any'
    const resumesCollection = db.collection<Omit<Resume, "_id">>("resumes");

    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return res.status(400).json({ success: false, error: "Invalid resume ID format." });
    }

    const resumeDoc = await resumesCollection.findOne({ _id: objectId });
    if (!resumeDoc) {
      return res.status(404).json({ success: false, error: "Resume not found." });
    }

    // if already parsed, return it
    if (resumeDoc.parsedProfile) {
      return res.status(200).json({
        success: true,
        data: { ...resumeDoc, _id: id }
      });
    }

    const parsedProfile = parseResumeText(resumeDoc.extractedText);

    await resumesCollection.updateOne(
      { _id: objectId },
      { $set: { parsedProfile } }
    );

    const { _id: _, ...rest } = resumeDoc;
    const updatedResume: Resume = {
      ...rest,
      parsedProfile,
      _id: id,
    };

    res.status(200).json({ success: true, data: updatedResume });
  } catch (error) {
    console.error("[Resume Parse Error]:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse resume",
    });
  }
});

resumesRouter.post("/:id/analyze", async (req, res) => {
  try {
    const { id } = req.params;

    const idResult = resumeIdParamSchema.safeParse({ id });
    if (!idResult.success) {
      return res.status(400).json({
        success: false,
        error: idResult.error.issues[0]?.message ?? "Invalid resume ID format.",
      });
    }

    const db = getDatabase();
    const resumesCollection = db.collection<Omit<Resume, "_id">>("resumes");

    let objectId;
    try {
      objectId = new ObjectId(id);
    } catch {
      return res.status(400).json({ success: false, error: "Invalid resume ID format." });
    }

    const resumeDoc = await resumesCollection.findOne({ _id: objectId });
    if (!resumeDoc) {
      return res.status(404).json({ success: false, error: "Resume not found." });
    }

    if (!resumeDoc.parsedProfile) {
      return res.status(400).json({
        success: false,
        error: "Resume must be parsed before it can be analyzed. Call /:id/parse first.",
      });
    }

    const aiInsights = await withTimeout(
      generateInsights(resumeDoc.parsedProfile),
      30000,
      "AI analysis"
    );

    await resumesCollection.updateOne(
      { _id: objectId },
      { $set: { aiInsights } }
    );

    const { _id: _, ...rest } = resumeDoc;
    const updatedResume: Resume = {
      ...rest,
      aiInsights,
      _id: id,
    };

    res.status(200).json({ success: true, data: updatedResume });
  } catch (error) {
    console.error("[Resume Analyze Error]:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to analyze resume",
    });
  }
});
