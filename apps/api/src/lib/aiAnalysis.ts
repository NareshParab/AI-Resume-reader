import { GoogleGenAI, Type } from "@google/genai";
import { aiInsightsSchema } from "@gcarbon/schemas";
import type { ParsedProfile, AiInsights } from "@gcarbon/types";

// gemini-2.5-flash became unavailable to new users and gemini-3.6-flash/
// gemini-3.7-flash were both returning 503 (overloaded) as of Sep 2026.
// gemini-3.5-flash is confirmed free-tier for this project (verified via
// Google AI Studio's Billing Tier: Free tier, no billing account linked).
// If this model becomes unavailable, check current free-tier model
// availability before picking a replacement — don't assume paid-tier-only
// models are free just because they're newer.
const MODEL_NAME = "gemini-3.5-flash";

export async function generateInsights(
  profile: ParsedProfile,
  client?: GoogleGenAI
): Promise<AiInsights> {
  let ai: GoogleGenAI;
  if (client) {
    ai = client;
  } else {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Failed to generate AI insights: GEMINI_API_KEY environment variable is not set.");
    }
    ai = new GoogleGenAI({ apiKey });
  }

  const prompt = `
You are an expert resume reviewer and career coach.
I am providing you with an already-extracted, structured resume profile as JSON.

CRITICAL INSTRUCTIONS:
1. Do not invent, hallucinate, or assume any factual claims, skills, or experience not explicitly present in the provided JSON.
2. Your task is strictly interpretation and opinion: provide a short professional summary, identify key strengths, and suggest concrete areas for improvement.
3. You must not extract facts. You are analyzing existing facts.
4. Return ONLY valid JSON matching the exact requested schema.

Resume Data:
${JSON.stringify(profile, null, 2)}
`;

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            strengths: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            improvementSuggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
          },
          required: ["summary", "strengths", "improvementSuggestions"],
        },
      },
    });

    if (!response.text) {
      throw new Error("AI returned an empty response.");
    }

    const parsedJson = JSON.parse(response.text) as unknown;
    const validated = aiInsightsSchema.parse(parsedJson);

    return {
      ...validated,
      generatedAt: new Date().toISOString(),
      model: MODEL_NAME,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to generate AI insights: ${error.message}`);
    }
    throw new Error("Failed to generate AI insights due to an unknown error.");
  }
}
