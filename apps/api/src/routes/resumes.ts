import { Router } from "express";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParseLib = require("pdf-parse");
const pdfParse = pdfParseLib.default || pdfParseLib;
import * as mammoth from "mammoth";
import { getDatabase } from "../lib/db.js";
import type { Resume } from "@gcarbon/types";
import { ObjectId } from "mongodb";
import { parseResumeText } from "../lib/parser.js";

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

resumesRouter.post("/upload", upload.single("resume"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ success: false, error: "No file uploaded." });
    }

    let extractedText = "";

    // Extract text based on file type
    if (file.mimetype === "application/pdf") {
      const pdfData = await pdfParse(file.buffer);
      extractedText = pdfData.text;
    } else if (
      file.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      extractedText = result.value;
    }

    // Clean up text
    extractedText = extractedText.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();

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

resumesRouter.post("/:id/parse", async (req, res) => {
  try {
    const { id } = req.params;
    const db = getDatabase();
    // Use 'any' type for the collection so we don't trip over strict typing with _id vs string
    const resumesCollection = db.collection("resumes");

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

    const updatedResume: Resume = {
      ...(resumeDoc as any),
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
