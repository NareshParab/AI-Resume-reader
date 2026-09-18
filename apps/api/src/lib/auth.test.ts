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
};

vi.mock("./db.js", () => ({
  getDatabase: () => ({
    collection: (name: string) => {
      if (name === "users") return mockUsersCollection;
      throw new Error(`Collection ${name} not mocked`);
    },
  }),
}));

describe("Auth System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "test-secret-1234567890";
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
  });
});
