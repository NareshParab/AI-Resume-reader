import { GoogleGenAI, Type } from "@google/genai";
import { candidateScoreSchema } from "@gcarbon/schemas";
import type { ParsedProfile, CandidateScore } from "@gcarbon/types";
import { withTimeout } from "./withTimeout.js";

const MODEL_NAME = "gemini-3.5-flash";

export async function scoreCandidate(
  profile: ParsedProfile,
  jobDescription: string,
  client?: GoogleGenAI
): Promise<CandidateScore> {
  let ai: GoogleGenAI;
  if (client) {
    ai = client;
  } else {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Failed to score candidate: GEMINI_API_KEY environment variable is not set.");
    }
    ai = new GoogleGenAI({ apiKey });
  }

  const prompt = `
You are an expert technical recruiter and hiring manager.
I am providing you with a job description and an already-extracted, structured candidate resume profile as JSON.

CRITICAL INSTRUCTIONS:
1. Score the candidate from 1 to 10 on how well they match the job description.
2. Provide a concise reasoning for the score.
3. Do not invent, hallucinate, or assume any factual claims, skills, or experience not explicitly present in the provided JSON profile.
4. Return ONLY valid JSON matching the exact requested schema.

Job Description:
${jobDescription}

Candidate Profile:
${JSON.stringify(profile, null, 2)}
`;

  try {
    const response = await withTimeout(
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              reasoning: { type: Type.STRING },
            },
            required: ["score", "reasoning"],
          },
        },
      }),
      30000,
      "Candidate scoring"
    );

    if (!response.text) {
      throw new Error("AI returned an empty response.");
    }

    const parsedJson = JSON.parse(response.text) as unknown;
    const validated = candidateScoreSchema.parse(parsedJson);

    return {
      ...validated,
      generatedAt: new Date().toISOString(),
      model: MODEL_NAME,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to score candidate: ${error.message}`);
    }
    throw new Error("Failed to score candidate due to an unknown error.");
  }
}
