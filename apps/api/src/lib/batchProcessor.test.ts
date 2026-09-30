import { describe, it, expect, vi, beforeEach } from "vitest";
import { ObjectId } from "mongodb";
import { processBatch } from "./batchProcessor.js";

// ─── Mock database ────────────────────────────────────────────────────────────

const mockBatchesCollection = {
  findOne: vi.fn(),
  updateOne: vi.fn(),
};

const mockResumesCollection = {
  insertOne: vi.fn(),
  updateOne: vi.fn(),
};

vi.mock("./db.js", () => ({
  getDatabase: () => ({
    collection: (name: string) => {
      if (name === "batches") return mockBatchesCollection;
      if (name === "resumes") return mockResumesCollection;
      throw new Error(`Collection ${name} not mocked`);
    },
  }),
}));

// ─── Mock AI scoring so the test doesn't hit the real API ────────────────────

vi.mock("./candidateScoring.js", () => ({
  scoreCandidate: vi.fn().mockResolvedValue({
    score: 75,
    reasoning: "Good match",
    matchedSkills: ["TypeScript"],
    generatedAt: new Date().toISOString(),
    model: "test",
  }),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("processBatch — per-file error handling", () => {
  const batchObjectId = new ObjectId("507f1f77bcf86cd799439099");
  const resumeObjectId = new ObjectId("507f1f77bcf86cd799439098");

  beforeEach(() => {
    vi.clearAllMocks();

    mockBatchesCollection.findOne.mockResolvedValue({
      _id: batchObjectId,
      userId: "user-123",
      jobDescription: "Software Engineer",
      status: "processing",
      totalCount: 1,
      completedCount: 0,
      failedCount: 0,
      createdAt: new Date().toISOString(),
    });
    mockBatchesCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mockResumesCollection.insertOne.mockResolvedValue({ insertedId: resumeObjectId });
    mockResumesCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  it("stores extractionError and increments failedCount when a DOCX file is corrupt", async () => {
    // A buffer that is not valid DOCX — mammoth will throw when parsing it
    const corruptPayload = {
      buffer: Buffer.from("THIS IS NOT A VALID DOCX CONTENT AT ALL"),
      originalname: "bad.docx",
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    await processBatch(batchObjectId.toString(), [corruptPayload], "Software Engineer role");

    // A resume doc should be inserted with extractionError set
    expect(mockResumesCollection.insertOne).toHaveBeenCalledOnce();
    const insertedDoc = mockResumesCollection.insertOne.mock.calls[0]?.[0] as {
      extractionError?: string;
      extractedText: string;
      filename: string;
    };
    expect(insertedDoc.filename).toBe("bad.docx");
    expect(insertedDoc.extractedText).toBe("");
    expect(insertedDoc.extractionError).toBeTruthy();

    // updateOne on resumes should NOT be called (no parse/score step for failed extraction)
    expect(mockResumesCollection.updateOne).not.toHaveBeenCalled();

    // Batch finalized as completed with failedCount=1, completedCount=0
    const finalUpdate = mockBatchesCollection.updateOne.mock.calls.at(-1)?.[1] as {
      $set: { status: string; failedCount: number; completedCount: number };
    };
    expect(finalUpdate.$set.status).toBe("completed");
    expect(finalUpdate.$set.failedCount).toBe(1);
    expect(finalUpdate.$set.completedCount).toBe(0);
  }, 15_000);
});
