import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDatabase } from "../lib/db.js";
import { signupSchema, loginSchema } from "@gcarbon/schemas";
import { hashPassword, verifyPassword, signToken, requireAuth } from "../lib/auth.js";

export const authRouter = Router();

// Raw DB document — _id is managed by MongoDB (ObjectId), passwordHash never leaves server
interface DbUser {
  email: string;
  passwordHash: string;
  createdAt: string;
}

authRouter.post("/signup", async (req, res) => {
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

authRouter.post("/login", async (req, res) => {
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
