import { describe, it, expect, vi } from "vitest";
import { generateInsights } from "./aiAnalysis.js";
import type { ParsedProfile } from "@gcarbon/types";
import type { GoogleGenAI } from "@google/genai";

describe("generateInsights", () => {
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

  function createMockClient(textResponse: string | null, shouldThrow = false) {
    // We only need to mock what aiAnalysis uses: client.models.generateContent
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

  it("returns a correctly-shaped AiInsights object on a well-formed response", async () => {
    const validJson = JSON.stringify({
      summary: "A strong developer.",
      strengths: ["TypeScript", "Experience"],
      improvementSuggestions: ["Add more projects"],
    });

    const mockClient = createMockClient(validJson);
    const result = await generateInsights(mockProfile, mockClient);

    expect(result.summary).toBe("A strong developer.");
    expect(result.strengths).toEqual(["TypeScript", "Experience"]);
    expect(result.improvementSuggestions).toEqual(["Add more projects"]);
    expect(result.model).toBe("gemini-3.5-flash");
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("throws when the AI returns JSON that fails schema validation", async () => {
    const invalidJson = JSON.stringify({
      summary: "A strong developer.",
      // Missing strengths and improvementSuggestions
    });

    const mockClient = createMockClient(invalidJson);

    await expect(generateInsights(mockProfile, mockClient)).rejects.toThrow(
      /Failed to generate AI insights/
    );
  });

  it("throws a clear error when the API call fails or times out", async () => {
    const mockClient = createMockClient(null, true);

    await expect(generateInsights(mockProfile, mockClient)).rejects.toThrow(
      "Failed to generate AI insights: Network timeout"
    );
  });
});
