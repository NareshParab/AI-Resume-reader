import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { ObjectId } from "mongodb";
import { batchesRouter } from "../routes/batches.js";

// ─── Mock database ────────────────────────────────────────────────────────────

const mockBatchesCollection = {
  insertOne: vi.fn(),
  findOne: vi.fn(),
  updateMany: vi.fn(),
  updateOne: vi.fn(),
};

const mockResumesCollection = {
  insertOne: vi.fn(),
  find: vi.fn(() => ({ toArray: vi.fn().mockResolvedValue([]) })),
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

// ─── Mock auth (inject userId without a real JWT) ────────────────────────────

vi.mock("./auth.js", () => ({
  requireAuth: (
    req: express.Request,
    _res: express.Response,
    next: express.NextFunction
  ) => {
    req.userId = "user-123";
    next();
  },
}));

// ─── Mock batchProcessor — track whether processBatch was called, control delay ─

let processBatchResolve: (() => void) | null = null;
const processBatchStarted = vi.fn();

vi.mock("./batchProcessor.js", () => ({
  processBatch: (...args: unknown[]) => {
    processBatchStarted(args);
    // Returns a promise that we control from tests
    return new Promise<void>((resolve) => {
      processBatchResolve = resolve;
    });
  },
}));

// ─── App setup ────────────────────────────────────────────────────────────────

function buildApp() {
  const app = express();
  app.use(cookieParser());
  app.use("/api/batches", batchesRouter);
  return app;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal valid PDF buffer (1-byte, multer won't inspect contents). */
function fakePdfBuffer() {
  return Buffer.from("%PDF-1.4 fake content");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Batch route — POST /api/batches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    processBatchResolve = null;
    process.env.JWT_SECRET = "test-secret-1234567890";

    // insertOne returns a mock ObjectId each call
    mockBatchesCollection.insertOne.mockResolvedValue({
      insertedId: new ObjectId("507f1f77bcf86cd799439011"),
    });
    mockResumesCollection.insertOne.mockResolvedValue({
      insertedId: new ObjectId("507f1f77bcf86cd799439012"),
    });
  });

  it("responds 201 before extraction completes", async () => {
    const app = buildApp();

    // processBatch is mocked to hang until we release it — the route should
    // still respond 201 immediately, before processBatchResolve() is called
    const response = await request(app)
      .post("/api/batches")
      .field("jobDescription", "We are looking for a senior software engineer.")
      .attach("resumes", fakePdfBuffer(), {
        filename: "resume.pdf",
        contentType: "application/pdf",
      });

    const body = response.body as { success: boolean; data: { batchId: string; totalCount: number } };
    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data.batchId).toBeTruthy();
    expect(body.data.totalCount).toBe(1);

    // processBatch was kicked off (fire-and-forget) but NOT awaited
    expect(processBatchStarted).toHaveBeenCalledOnce();

    // Release the background processor — should not affect the already-sent 201
    if (processBatchResolve) processBatchResolve();
  });

  it("returns 201 with correct batchId when multiple files are uploaded", async () => {
    const app = buildApp();

    const response = await request(app)
      .post("/api/batches")
      .field("jobDescription", "Looking for a data analyst with SQL experience.")
      .attach("resumes", fakePdfBuffer(), {
        filename: "resume1.pdf",
        contentType: "application/pdf",
      })
      .attach("resumes", fakePdfBuffer(), {
        filename: "resume2.pdf",
        contentType: "application/pdf",
      });

    const body2 = response.body as { data: { totalCount: number } };
    expect(response.status).toBe(201);
    expect(body2.data.totalCount).toBe(2);

    // processBatch called with (batchId, filePayloads, jobDescription)
    const callArgs = processBatchStarted.mock.calls[0]?.[0] as unknown[];
    expect(callArgs).toHaveLength(3);
    const filePayloads = callArgs[1] as { originalname: string; mimetype: string }[];
    expect(filePayloads).toHaveLength(2);
    expect(filePayloads[0]?.originalname).toBe("resume1.pdf");
    expect(filePayloads[1]?.originalname).toBe("resume2.pdf");

    if (processBatchResolve) processBatchResolve();
  });
});

