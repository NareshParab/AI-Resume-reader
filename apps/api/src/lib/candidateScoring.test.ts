import { describe, it, expect, vi } from "vitest";
import { scoreCandidate } from "./candidateScoring.js";
import type { ParsedProfile } from "@gcarbon/types";
import type { GoogleGenAI } from "@google/genai";

describe("scoreCandidate", () => {
  const mockProfile: ParsedProfile = {
    fullName: "Jane Doe",
    email: "jane@example.com",
    phone: null,
    location: null,
    professionalSummary: null,
    skills: ["TypeScript"],
    skillCategories: {
      programming: ["TypeScript"],
      databases: [],
      pythonLibraries: [],
      biVisualization: [],
      analytics: [],
      tools: [],
      aiAssisted: [],
      other: [],
    },
    programmingLanguages: [],
    frameworksAndLibraries: [],
    toolsAndTechnologies: [],
    education: [],
    certifications: [],
    workExperience: [],
    totalExperienceYears: 5,
    projects: [],
    achievements: [],
    languages: [],
  };

  const mockJobDescription = "We need a senior TypeScript developer with 5+ years of experience.";

  function createMockClient(textResponse: string | null, shouldThrow = false) {
    return {
      models: {
        generateContent: vi.fn().mockImplementation(() => {
          if (shouldThrow) {
            return Promise.reject(new Error("Network timeout"));
          }
          return Promise.resolve({ text: textResponse });
        }),
      },
    } as unknown as GoogleGenAI;
  }

  it("returns a correctly-shaped CandidateScore object on a well-formed response", async () => {
    const validJson = JSON.stringify({
      score: 8,
      reasoning: "Candidate has the required TypeScript experience.",
    });

    const mockClient = createMockClient(validJson);
    const result = await scoreCandidate(mockProfile, mockJobDescription, mockClient);

    expect(result.score).toBe(8);
    expect(result.reasoning).toBe("Candidate has the required TypeScript experience.");
    expect(result.model).toBe("gemini-3.5-flash");
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("throws when the AI returns JSON that fails schema validation", async () => {
    const invalidJson = JSON.stringify({
      score: 11, // Over the max of 10
      reasoning: "Candidate is amazing.",
    });

    const mockClient = createMockClient(invalidJson);

    await expect(scoreCandidate(mockProfile, mockJobDescription, mockClient)).rejects.toThrow(
      /Failed to score candidate/
    );
  });

  it("throws a clear error when the API call fails or times out", async () => {
    const mockClient = createMockClient(null, true);

    await expect(scoreCandidate(mockProfile, mockJobDescription, mockClient)).rejects.toThrow(
      "Failed to score candidate: Network timeout"
    );
  });
});
