import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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

// ─── Mock file extractor ──────────────────────────────────────────────────────

const mockExtractResumeText = vi.fn();

vi.mock("./fileExtractor.js", () => ({
  extractResumeText: (...args: unknown[]): unknown => mockExtractResumeText(...args),
}));

// ─── Mock AI scoring ──────────────────────────────────────────────────────────

const mockScoreCandidate = vi.fn();

vi.mock("./candidateScoring.js", () => ({
  scoreCandidate: (...args: unknown[]): unknown => mockScoreCandidate(...args),
}));

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const batchObjectId = new ObjectId("507f1f77bcf86cd799439099");
const resumeObjectId = new ObjectId("507f1f77bcf86cd799439098");
const resume2ObjectId = new ObjectId("507f1f77bcf86cd799439097");

const EXTRACTED_TEXT = "Jane Smith\nSkills: Python JavaScript SQL\nExperience: 3 years data engineering";

const successfulScore = {
  score: 7,
  reasoning: "Good match",
  matchedSkills: ["Python"],
  generatedAt: new Date().toISOString(),
  model: "test",
};

function makeBatch(totalCount = 1) {
  return {
    _id: batchObjectId,
    userId: "user-123",
    jobDescription: "Data Analyst role",
    status: "processing",
    totalCount,
    completedCount: 0,
    failedCount: 0,
    createdAt: new Date().toISOString(),
  };
}

const fakePdfPayload = {
  buffer: Buffer.from("%PDF-1.4 fake"),
  originalname: "resume.pdf",
  mimetype: "application/pdf",
};

const fakePdfPayload2 = {
  buffer: Buffer.from("%PDF-1.4 another fake"),
  originalname: "resume2.pdf",
  mimetype: "application/pdf",
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("processBatch — parsedProfile saved before scoring", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockExtractResumeText.mockResolvedValue(EXTRACTED_TEXT);
    mockBatchesCollection.findOne.mockResolvedValue(makeBatch());
    mockBatchesCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mockResumesCollection.insertOne.mockResolvedValue({ insertedId: resumeObjectId });
    mockResumesCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("saves parsedProfile to MongoDB before calling scoreCandidate", async () => {
    mockScoreCandidate.mockResolvedValue(successfulScore);

    const promise = processBatch(batchObjectId.toString(), [fakePdfPayload], "Data Analyst role");
    await vi.runAllTimersAsync();
    await promise;

    // updateOne should be called at least twice:
    //  1. { $set: { parsedProfile } }
    //  2. { $set: { candidateScore } }
    const resumeUpdates = mockResumesCollection.updateOne.mock.calls;
    const profileUpdate = resumeUpdates.find((call) => {
      const setObj = (call[1] as { $set: Record<string, unknown> }).$set;
      return "parsedProfile" in setObj && !("candidateScore" in setObj);
    });
    expect(profileUpdate).toBeDefined();
  });

  it("saves parsedProfile even when scoreCandidate throws", async () => {
    mockScoreCandidate.mockRejectedValue(new Error("AI unavailable"));

    const promise = processBatch(batchObjectId.toString(), [fakePdfPayload], "Data Analyst role");
    await vi.runAllTimersAsync();
    await promise;

    // parsedProfile update must have happened
    const resumeUpdates = mockResumesCollection.updateOne.mock.calls;
    const profileUpdate = resumeUpdates.find((call) => {
      const setObj = (call[1] as { $set: Record<string, unknown> }).$set;
      return "parsedProfile" in setObj;
    });
    expect(profileUpdate).toBeDefined();

    // candidateScore update must NOT have happened
    const scoreUpdate = resumeUpdates.find((call) => {
      const setObj = (call[1] as { $set: Record<string, unknown> }).$set;
      return "candidateScore" in setObj;
    });
    expect(scoreUpdate).toBeUndefined();
  });
});

describe("processBatch — per-file error handling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockBatchesCollection.findOne.mockResolvedValue(makeBatch());
    mockBatchesCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mockResumesCollection.insertOne.mockResolvedValue({ insertedId: resumeObjectId });
    mockResumesCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stores extractionError and increments failedCount when a DOCX file is corrupt", async () => {
    // Simulate extraction failure for this test
    mockExtractResumeText.mockRejectedValue(new Error("Invalid DOCX structure."));

    const corruptPayload = {
      buffer: Buffer.from("THIS IS NOT A VALID DOCX CONTENT AT ALL"),
      originalname: "bad.docx",
      mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    const promise = processBatch(batchObjectId.toString(), [corruptPayload], "Software Engineer role");
    await vi.runAllTimersAsync();
    await promise;

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

    // Batch finalised as completed with failedCount=1, completedCount=0
    const finalUpdate = mockBatchesCollection.updateOne.mock.calls.at(-1)?.[1] as {
      $set: { status: string; failedCount: number; completedCount: number };
    };
    expect(finalUpdate.$set.status).toBe("completed");
    expect(finalUpdate.$set.failedCount).toBe(1);
    expect(finalUpdate.$set.completedCount).toBe(0);
  });
});

describe("processBatch — mixed success/failure counts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockExtractResumeText.mockResolvedValue(EXTRACTED_TEXT);
    mockBatchesCollection.findOne.mockResolvedValue(makeBatch(2));
    mockBatchesCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
    mockResumesCollection.insertOne
      .mockResolvedValueOnce({ insertedId: resumeObjectId })
      .mockResolvedValueOnce({ insertedId: resume2ObjectId });
    mockResumesCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("completedCount=1, failedCount=1 when first succeeds and second scoring fails", async () => {
    // File 1 scoring succeeds; file 2 scoring always fails (non-retryable pattern not matched — will exhaust retries)
    mockScoreCandidate
      .mockResolvedValueOnce(successfulScore)
      .mockRejectedValue(new Error("[400 Bad Request] Invalid job description"));

    const promise = processBatch(
      batchObjectId.toString(),
      [fakePdfPayload, fakePdfPayload2],
      "Data Analyst role"
    );
    await vi.runAllTimersAsync();
    await promise;

    const finalUpdate = mockBatchesCollection.updateOne.mock.calls.at(-1)?.[1] as {
      $set: { status: string; completedCount: number; failedCount: number };
    };
    expect(finalUpdate.$set.status).toBe("completed");
    expect(finalUpdate.$set.completedCount).toBe(1);
    expect(finalUpdate.$set.failedCount).toBe(1);
  });

  it("parsedProfile is saved for BOTH files even when one scoring fails", async () => {
    mockScoreCandidate
      .mockResolvedValueOnce(successfulScore)
      .mockRejectedValue(new Error("[400 Bad Request] Invalid prompt"));

    const promise = processBatch(
      batchObjectId.toString(),
      [fakePdfPayload, fakePdfPayload2],
      "Data Analyst role"
    );
    await vi.runAllTimersAsync();
    await promise;

    // Two separate parsedProfile saves — one for each file
    const resumeUpdates = mockResumesCollection.updateOne.mock.calls;
    const profileSaves = resumeUpdates.filter((call) => {
      const setObj = (call[1] as { $set: Record<string, unknown> }).$set;
      return "parsedProfile" in setObj;
    });
    expect(profileSaves).toHaveLength(2);
  });
});
