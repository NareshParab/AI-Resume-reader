import { extractText as extractPdfText, getDocumentProxy } from "unpdf";
import * as mammoth from "mammoth";

/** Minimal shape extractResumeText needs — satisfied by both multer File and plain buffer payloads. */
export interface FileInput {
  mimetype: string;
  buffer: Buffer;
}

export async function extractResumeText(file: FileInput): Promise<string> {
  let extractedText = "";

  // Extract text based on file type
  if (file.mimetype === "application/pdf") {
    const pdf = await getDocumentProxy(new Uint8Array(file.buffer));
    const { text } = await extractPdfText(pdf, { mergePages: true });
    extractedText = text;
  } else if (
    file.mimetype ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    extractedText = result.value;
  }

  // Clean up text
  extractedText = extractedText.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();

  return extractedText;
}
