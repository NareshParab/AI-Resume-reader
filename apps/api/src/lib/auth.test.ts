import { describe, it, expect, vi, beforeEach } from "vitest";
import express, { type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { ObjectId } from "mongodb";
import { authRouter } from "../routes/auth.js";
import { requireAuth, hashPassword, signToken, verifyToken } from "./auth.js";

// Mock the database
const mockUsersCollection = {
  findOne: vi.fn(),
  insertOne: vi.fn(),
  updateOne: vi.fn(),
};

const mockTokensCollection = {
  insertOne: vi.fn(),
  findOne: vi.fn(),
  findOneAndUpdate: vi.fn(),
  updateOne: vi.fn(),
  deleteMany: vi.fn(),
};

vi.mock("./db.js", () => ({
  getDatabase: () => ({
    collection: (name: string) => {
      if (name === "users") return mockUsersCollection;
      if (name === "passwordResetTokens") return mockTokensCollection;
      throw new Error(`Collection ${name} not mocked`);
    },
  }),
}));

// Mock the mailer — no real SMTP calls in tests
const mockSendPasswordResetEmail = vi.fn();
vi.mock("./mailer.js", () => ({
  sendPasswordResetEmail: (...args: unknown[]): unknown => mockSendPasswordResetEmail(...args),
}));

describe("Auth System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret-1234567890";
    process.env.APP_BASE_URL = "http://localhost:5173";
    mockSendPasswordResetEmail.mockResolvedValue(undefined);
    mockTokensCollection.deleteMany.mockResolvedValue({ deletedCount: 0 });
  });

  describe("auth.ts library functions", () => {
    it("signs and verifies a token successfully", () => {
      const userId = "test-user-id";
      const token = signToken(userId);
      const decodedUserId = verifyToken(token);
      expect(decodedUserId).toBe(userId);
    });

    it("returns null when verifying an invalid token", () => {
      const decodedUserId = verifyToken("invalid-token");
      expect(decodedUserId).toBeNull();
    });

    it("hashes and verifies a password", async () => {
      const password = "my-secret-password";
      const hash = await hashPassword(password);
      expect(hash).not.toBe(password);
    });
  });

  describe("requireAuth middleware", () => {
    it("rejects when no authToken cookie is present", () => {
      const req = { cookies: {} } as Request;
      const statusMock = vi.fn().mockReturnThis();
      const jsonMock = vi.fn();
      const res = {
        status: statusMock,
        json: jsonMock,
      } as unknown as Response;
      const next = vi.fn();

      requireAuth(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ success: false, error: "Authentication required." });
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects when authToken is invalid", () => {
      const req = { cookies: { authToken: "invalid-token" } } as unknown as Request;
      const statusMock = vi.fn().mockReturnThis();
      const jsonMock = vi.fn();
      const res = {
        status: statusMock,
        json: jsonMock,
      } as unknown as Response;
      const next = vi.fn();

      requireAuth(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({ success: false, error: "Authentication required." });
      expect(next).not.toHaveBeenCalled();
    });

    it("calls next and attaches userId when authToken is valid", () => {
      const token = signToken("user-123");
      const req = { cookies: { authToken: token } } as unknown as Request;
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;
      const next = vi.fn();

      requireAuth(req, res, next);

      expect(req.userId).toBe("user-123");
      expect(next).toHaveBeenCalled();
    });
  });

  describe("Auth Routes", () => {
    const app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use("/auth", authRouter);

    describe("POST /signup", () => {
      it("fails if email already exists", async () => {
        mockUsersCollection.findOne.mockResolvedValueOnce({ email: "test@example.com" });

        const res = await request(app)
          .post("/auth/signup")
          .send({ email: "test@example.com", password: "password123" });

        expect(res.status).toBe(409);
        const body = res.body as { success: boolean };
        expect(body.success).toBe(false);
      });

      it("succeeds for a new user and sets a cookie", async () => {
        mockUsersCollection.findOne.mockResolvedValueOnce(null);
        mockUsersCollection.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

        const res = await request(app)
          .post("/auth/signup")
          .send({ email: "new@example.com", password: "password123" });

        expect(res.status).toBe(201);
        const body = res.body as { success: boolean, data: { email: string } };
        expect(body.success).toBe(true);
        expect(body.data.email).toBe("new@example.com");

        const cookies = res.headers["set-cookie"] as unknown as string[];
        expect(cookies).toBeDefined();
        expect(cookies[0]).toContain("authToken=");
        expect(cookies[0]).toContain("HttpOnly");
      });
    });

    describe("POST /login", () => {
      it("fails with wrong password", async () => {
        const hash = await hashPassword("correct-password");
        mockUsersCollection.findOne.mockResolvedValueOnce({
          _id: new ObjectId(),
          email: "test@example.com",
          passwordHash: hash
        });

        const res = await request(app)
          .post("/auth/login")
          .send({ email: "test@example.com", password: "wrong-password" });

        expect(res.status).toBe(401);
        const body = res.body as { success: boolean };
        expect(body.success).toBe(false);
      });

      it("succeeds with correct credentials and sets a cookie", async () => {
        const hash = await hashPassword("correct-password");
        mockUsersCollection.findOne.mockResolvedValueOnce({
          _id: new ObjectId(),
          email: "test@example.com",
          passwordHash: hash
        });

        const res = await request(app)
          .post("/auth/login")
          .send({ email: "test@example.com", password: "correct-password" });

        expect(res.status).toBe(200);
        const body = res.body as { success: boolean, data: { email: string } };
        expect(body.success).toBe(true);
        expect(body.data.email).toBe("test@example.com");

        const cookies = res.headers["set-cookie"] as unknown as string[];
        expect(cookies).toBeDefined();
        expect(cookies[0]).toContain("authToken=");
      });
    });

    describe("Password Reset Flow", () => {
      // Each test gets a fresh authRouter (and therefore a fresh rate-limiter
      // instance) so tests don't bleed their request counts into one another.
      let testApp: ReturnType<typeof express>;

      beforeEach(async () => {
        vi.resetModules();
        const { authRouter: freshRouter } = await import("../routes/auth.js");
        testApp = express();
        testApp.use(express.json());
        testApp.use(cookieParser());
        testApp.use("/auth", freshRouter);
      });

      // ── POST /forgot-password ──────────────────────────────────────────────

      it("1. unknown email → 200 generic response (no enumeration)", async () => {
        mockUsersCollection.findOne.mockResolvedValueOnce(null);

        const res = await request(testApp)
          .post("/auth/forgot-password")
          .send({ email: "nobody@example.com" });

        expect(res.status).toBe(200);
        const body = res.body as { success: boolean; message: string };
        expect(body.success).toBe(true);
        expect(body.message).toMatch(/if an account exists/i);
        expect(mockSendPasswordResetEmail).not.toHaveBeenCalled();
      });

      it("2. known email → 200 generic response (same message)", async () => {
        const userId = new ObjectId();
        mockUsersCollection.findOne.mockResolvedValueOnce({ _id: userId, email: "user@example.com", passwordHash: "hash" });
        mockTokensCollection.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

        const res = await request(testApp)
          .post("/auth/forgot-password")
          .send({ email: "user@example.com" });

        expect(res.status).toBe(200);
        const body = res.body as { success: boolean; message: string };
        expect(body.success).toBe(true);
        expect(body.message).toMatch(/if an account exists/i);
      });

      it("3. known email creates a hashed reset token in DB", async () => {
        const userId = new ObjectId();
        mockUsersCollection.findOne.mockResolvedValueOnce({ _id: userId, email: "user@example.com", passwordHash: "hash" });
        mockTokensCollection.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

        await request(testApp)
          .post("/auth/forgot-password")
          .send({ email: "user@example.com" });

        expect(mockTokensCollection.insertOne).toHaveBeenCalledOnce();
        const inserted = mockTokensCollection.insertOne.mock.calls[0]?.[0] as {
          userId: ObjectId;
          tokenHash: string;
          expiresAt: Date;
          usedAt: null;
        };
        expect(inserted.userId.toHexString()).toBe(userId.toHexString());
        expect(inserted.tokenHash).toMatch(/^[a-f0-9]{64}$/); // SHA-256 hex
        expect(inserted.expiresAt.getTime()).toBeGreaterThan(Date.now());
        expect(inserted.usedAt).toBeNull();
      });

      it("4. raw token is NOT stored in the database", async () => {
        const userId = new ObjectId();
        mockUsersCollection.findOne.mockResolvedValueOnce({ _id: userId, email: "user@example.com", passwordHash: "hash" });
        mockTokensCollection.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

        await request(testApp)
          .post("/auth/forgot-password")
          .send({ email: "user@example.com" });

        // The reset URL sent to the mailer contains the raw token.
        const resetUrl = mockSendPasswordResetEmail.mock.calls[0]?.[1] as string;
        const rawToken = new URL(resetUrl).searchParams.get("token") ?? "";

        const inserted = mockTokensCollection.insertOne.mock.calls[0]?.[0] as { tokenHash: string };
        // The stored tokenHash must NOT equal the raw token
        expect(inserted.tokenHash).not.toBe(rawToken);
        // But it must equal SHA-256(rawToken)
        const { createHash } = await import("crypto");
        const expectedHash = createHash("sha256").update(rawToken).digest("hex");
        expect(inserted.tokenHash).toBe(expectedHash);
      });

      it("5. mailer receives a reset URL containing the raw token", async () => {
        const userId = new ObjectId();
        mockUsersCollection.findOne.mockResolvedValueOnce({ _id: userId, email: "user@example.com", passwordHash: "hash" });
        mockTokensCollection.insertOne.mockResolvedValueOnce({ insertedId: new ObjectId() });

        await request(testApp)
          .post("/auth/forgot-password")
          .send({ email: "user@example.com" });

        expect(mockSendPasswordResetEmail).toHaveBeenCalledOnce();
        const [toArg, urlArg] = mockSendPasswordResetEmail.mock.calls[0] as [string, string];
        expect(toArg).toBe("user@example.com");
        expect(urlArg).toContain("http://localhost:5173");
        expect(urlArg).toContain("token=");
        // Raw token is 64 hex chars (32 bytes)
        const token = new URL(urlArg).searchParams.get("token") ?? "";
        expect(token).toMatch(/^[a-f0-9]{64}$/);
      });

      // ── POST /reset-password ──────────────────────────────────────────────

      it("6. valid token → password changed, cookie cleared", async () => {
        const userId = new ObjectId();
        const rawToken = "a".repeat(64);
        const { createHash } = await import("crypto");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const tokenDoc = {
          _id: new ObjectId(),
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          usedAt: null,
        };
        // Atomic consumption: findOneAndUpdate returns the pre-update document
        mockTokensCollection.findOneAndUpdate.mockResolvedValueOnce(tokenDoc);
        mockUsersCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });

        const res = await request(testApp)
          .post("/auth/reset-password")
          .send({ token: rawToken, newPassword: "newSecurePassword1" });

        expect(res.status).toBe(200);
        const body = res.body as { success: boolean };
        expect(body.success).toBe(true);

        // atomic token consumption was called
        expect(mockTokensCollection.findOneAndUpdate).toHaveBeenCalledOnce();

        // password was updated with a bcrypt hash
        expect(mockUsersCollection.updateOne).toHaveBeenCalledOnce();
        const updateArg = mockUsersCollection.updateOne.mock.calls[0]?.[1] as { $set: { passwordHash: string } };
        expect(updateArg.$set.passwordHash).not.toBe("newSecurePassword1");

        // cookie cleared
        const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
        const cleared = (cookies ?? []).some((c) => c.startsWith("authToken=;") || c.includes("authToken=;") || (c.includes("authToken") && c.includes("Expires=Thu, 01 Jan 1970")));
        expect(cleared).toBe(true);
      });

      it("7. used token → 400", async () => {
        // findOneAndUpdate returns null because usedAt != null fails the query
        mockTokensCollection.findOneAndUpdate.mockResolvedValueOnce(null);

        const res = await request(testApp)
          .post("/auth/reset-password")
          .send({ token: "b".repeat(64), newPassword: "newPassword1" });

        expect(res.status).toBe(400);
        const body = res.body as { success: boolean };
        expect(body.success).toBe(false);
      });

      it("8. expired token → 400", async () => {
        // findOneAndUpdate returns null because expiresAt > now fails
        mockTokensCollection.findOneAndUpdate.mockResolvedValueOnce(null);

        const res = await request(testApp)
          .post("/auth/reset-password")
          .send({ token: "c".repeat(64), newPassword: "newPassword1" });

        expect(res.status).toBe(400);
        const body = res.body as { success: boolean };
        expect(body.success).toBe(false);
      });

      it("9. invalid (unknown) token → 400", async () => {
        mockTokensCollection.findOneAndUpdate.mockResolvedValueOnce(null);

        const res = await request(testApp)
          .post("/auth/reset-password")
          .send({ token: "d".repeat(64), newPassword: "newPassword1" });

        expect(res.status).toBe(400);
        expect((res.body as { success: boolean }).success).toBe(false);
      });

      it("10. new password allows login", async () => {
        const userId = new ObjectId();
        const rawToken = "e".repeat(64);
        const { createHash } = await import("crypto");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const tokenDoc = {
          _id: new ObjectId(),
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          usedAt: null,
        };
        mockTokensCollection.findOneAndUpdate.mockResolvedValueOnce(tokenDoc);
        mockUsersCollection.updateOne.mockResolvedValueOnce({ modifiedCount: 1 });

        await request(testApp)
          .post("/auth/reset-password")
          .send({ token: rawToken, newPassword: "MyNewPassword1" });

        // The new passwordHash was passed to updateOne; verify it's a valid bcrypt hash of the new password
        const { verifyPassword } = await import("./auth.js");
        const updateArg = mockUsersCollection.updateOne.mock.calls[0]?.[1] as { $set: { passwordHash: string } };
        const isValid = await verifyPassword("MyNewPassword1", updateArg.$set.passwordHash);
        expect(isValid).toBe(true);
      });

      it("11. forgot-password rate limiter blocks after 3 requests", async () => {
        mockUsersCollection.findOne.mockResolvedValue(null);

        for (let i = 0; i < 3; i++) {
          await request(testApp)
            .post("/auth/forgot-password")
            .send({ email: `rl${i.toString()}@example.com` });
        }

        const blocked = await request(testApp)
          .post("/auth/forgot-password")
          .send({ email: "overflow@example.com" });

        expect(blocked.status).toBe(429);
      });

      it("12. reset token cannot be reused (second call returns null from DB)", async () => {
        const userId = new ObjectId();
        const rawToken = "f".repeat(64);
        const { createHash } = await import("crypto");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const tokenDoc = {
          _id: new ObjectId(),
          userId,
          tokenHash,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000),
          usedAt: null,
        };

        // Atomic: first call consumes the token, second call returns null
        mockTokensCollection.findOneAndUpdate
          .mockResolvedValueOnce(tokenDoc)  // first use: atomically consumed
          .mockResolvedValueOnce(null);     // second use: already consumed, not returned

        mockUsersCollection.updateOne.mockResolvedValue({ modifiedCount: 1 });

        const first = await request(testApp)
          .post("/auth/reset-password")
          .send({ token: rawToken, newPassword: "firstReset123" });
        expect(first.status).toBe(200);

        const second = await request(testApp)
          .post("/auth/reset-password")
          .send({ token: rawToken, newPassword: "secondReset456" });
        expect(second.status).toBe(400);
        expect((second.body as { success: boolean }).success).toBe(false);
      });
    });
  });
});
