import { Router } from "express";
import { ObjectId } from "mongodb";
import { randomBytes, createHash } from "crypto";
import { rateLimit } from "express-rate-limit";
import { getDatabase } from "../lib/db.js";
import { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema } from "@gcarbon/schemas";
import { hashPassword, verifyPassword, signToken, requireAuth } from "../lib/auth.js";
import { sendPasswordResetEmail } from "../lib/mailer.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many login attempts. Please try again in 15 minutes." },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many signup attempts. Please try again in an hour." },
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many password reset requests. Please try again in 15 minutes." },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many password reset attempts. Please try again in 15 minutes." },
});

// Raw DB document — _id is managed by MongoDB (ObjectId), passwordHash never leaves server
interface DbUser {
  email: string;
  passwordHash: string;
  createdAt: string;
}

interface DbPasswordResetToken {
  userId: ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

authRouter.post("/signup", signupLimiter, async (req, res) => {
  try {
    const parseResult = signupSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message ?? "Invalid signup data.",
      });
    }

    const { email, password } = parseResult.data;
    const db = getDatabase();
    const usersCollection = db.collection<DbUser>("users");

    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ success: false, error: "Email already in use." });
    }

    const passwordHash = await hashPassword(password);
    const newUser: Omit<DbUser, "_id"> = {
      email,
      passwordHash,
      createdAt: new Date().toISOString(),
    };

    const result = await usersCollection.insertOne(newUser);

    const token = signToken(result.insertedId.toHexString());

    res.cookie("authToken", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(201).json({
      success: true,
      data: { email },
    });
  } catch (error) {
    console.error("[Signup Error]:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  try {
    const parseResult = loginSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message ?? "Invalid login data.",
      });
    }

    const { email, password } = parseResult.data;
    const db = getDatabase();
    const usersCollection = db.collection<DbUser>("users");

    const user = await usersCollection.findOne({ email });
    if (!user) {
      return res.status(401).json({ success: false, error: "Invalid email or password." });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ success: false, error: "Invalid email or password." });
    }

    const token = signToken(user._id.toHexString());

    res.cookie("authToken", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      success: true,
      data: { email: user.email },
    });
  } catch (error) {
    console.error("[Login Error]:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

authRouter.get("/me", requireAuth, async (req, res) => {
  try {
    const db = getDatabase();
    const usersCollection = db.collection<DbUser>("users");

    let userId: ObjectId;
    try {
      userId = new ObjectId(req.userId);
    } catch {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    const user = await usersCollection.findOne({ _id: userId });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    res.status(200).json({
      success: true,
      data: { email: user.email },
    });
  } catch (error) {
    console.error("[Me Error]:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

authRouter.post("/logout", (_req, res) => {
  res.clearCookie("authToken");
  res.status(200).json({ success: true });
});

// Generic success message used for both known and unknown emails — prevents enumeration.
const FORGOT_PASSWORD_RESPONSE = "If an account exists for that email, a password reset link has been sent.";

authRouter.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  try {
    const parseResult = forgotPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      // Return generic response even on validation failure to prevent enumeration.
      return res.status(200).json({ success: true, message: FORGOT_PASSWORD_RESPONSE });
    }

    const normalizedEmail = parseResult.data.email.toLowerCase();
    const db = getDatabase();
    const usersCollection = db.collection<DbUser>("users");
    const tokensCollection = db.collection<DbPasswordResetToken>("passwordResetTokens");

    const user = await usersCollection.findOne({ email: normalizedEmail });

    if (user) {
      // Invalidate outstanding unused tokens — only the newest link remains valid.
      await tokensCollection.deleteMany({ userId: user._id, usedAt: null });

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await tokensCollection.insertOne({
        userId: user._id,
        tokenHash,
        expiresAt,
        usedAt: null,
        createdAt: new Date(),
      });

      const baseUrl = process.env.APP_BASE_URL ?? "http://localhost:5173";
      const resetUrl = `${baseUrl}?token=${rawToken}`;

      try {
        await sendPasswordResetEmail(normalizedEmail, resetUrl);
      } catch (emailErr) {
        // Log safe error — no raw token or credentials ever appear here.
        console.error(
          "[ForgotPassword] Failed to send reset email to user:",
          emailErr instanceof Error ? emailErr.message : "Unknown error"
        );
      }
    }

    // Always return the same response regardless of whether the account exists.
    return res.status(200).json({ success: true, message: FORGOT_PASSWORD_RESPONSE });
  } catch (error) {
    console.error("[ForgotPassword Error]:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

authRouter.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  try {
    const parseResult = resetPasswordSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: parseResult.error.issues[0]?.message ?? "Invalid request.",
      });
    }

    const { token, newPassword } = parseResult.data;
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const db = getDatabase();
    const tokensCollection = db.collection<DbPasswordResetToken>("passwordResetTokens");
    const usersCollection = db.collection<DbUser>("users");

    // Atomically mark the token used in one operation so concurrent requests
    // cannot both consume the same token. Only the first caller gets a non-null
    // result; subsequent callers see usedAt != null and fall through to the 400.
    const consumed = await tokensCollection.findOneAndUpdate(
      { tokenHash, expiresAt: { $gt: new Date() }, usedAt: null },
      { $set: { usedAt: new Date() } },
      { returnDocument: "before" }
    );

    if (!consumed) {
      return res.status(400).json({
        success: false,
        error: "This password reset link is invalid or has expired.",
      });
    }

    const passwordHash = await hashPassword(newPassword);

    await usersCollection.updateOne(
      { _id: consumed.userId },
      { $set: { passwordHash } }
    );

    // Clear the auth cookie. Note: stateless JWTs issued before this reset remain
    // technically valid until their 7-day expiry, but removing the cookie prevents
    // further use from the browser. Full revocation would require a token blacklist
    // or a tokenVersion field on the user document — not introduced here.
    res.clearCookie("authToken");

    return res.status(200).json({ success: true, message: "Your password has been reset. You can now log in with your new password." });
  } catch (error) {
    console.error("[ResetPassword Error]:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});
