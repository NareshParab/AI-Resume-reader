import { describe, it, expect } from "vitest";

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import * as mammoth from "mammoth";
import { parseResumeText } from "./parser.js";
import type { ParsedProfile } from "@gcarbon/types";

import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/api/src/lib -> repo root -> test-resumes
const FIXTURES_DIR = path.resolve(__dirname, "../../../../test-resumes");

/**
 * Mirrors the exact extraction + cleanup pipeline used in
 * apps/api/src/routes/resumes.ts, so this test exercises the same text the
 * live API would actually hand to parseResumeText().
 */
async function extractText(fileName: string): Promise<string> {
  const filePath = path.join(FIXTURES_DIR, fileName);
  const buffer = fs.readFileSync(filePath);
  let text = "";
  if (fileName.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text: pdfText } = await extractPdfText(pdf, { mergePages: true });
    text = pdfText;
  } else if (fileName.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    text = result.value;
  }
  return text.replace(/[ \t]+/g, " ").replace(/\n\s*\n/g, "\n\n").trim();
}

/**
 * Core architecture rule for this project: the parser must extract factual
 * information and must never invent or hallucinate content. This helper
 * enforces that automatically for every non-null string field the parser
 * produces: it must appear, verbatim (case-insensitive), somewhere in the
 * raw extracted text it was derived from.
 */
function expectNoHallucination(rawText: string, profile: ParsedProfile) {
  const haystack = rawText.toLowerCase();
  const mustAppear = (label: string, value: string | null | undefined) => {
    if (value) {
      expect(
        haystack.includes(value.toLowerCase()),
        `${label} ("${value}") was not found verbatim in the extracted text`,
      ).toBe(true);
    }
  };

  mustAppear("fullName", profile.fullName);
  mustAppear("email", profile.email);
  mustAppear("location", profile.location);
  for (const skill of profile.skills) mustAppear("skill", skill);
  for (const edu of profile.education) {
    mustAppear("education.degree", edu.degree);
    mustAppear("education.institution", edu.institution);
  }
  for (const job of profile.workExperience) {
    mustAppear("workExperience.jobTitle", job.jobTitle);
    mustAppear("workExperience.company", job.company);
  }
}

describe("parseResumeText \u2014 Naresh_Parab_Data_Analyst_Resume_2026.pdf", () => {
  it("extracts identity fields with no hallucination", async () => {
    const text = await extractText("Naresh_Parab_Data_Analyst_Resume_2026.pdf");
    const profile = parseResumeText(text);

    expect(profile.fullName).toBe("NARESH PARAB");
    expect(profile.email).toBe("parabnaresh15@gmail.com");
    expect(profile.phone).toBe("+91 84460 72604");
    expect(profile.location).toBe("Pune, Maharashtra, India");
    expect(profile.skills).toEqual(
      expect.arrayContaining(["Python", "SQL", "Power BI", "Excel"]),
    );
    expect(profile.education.length).toBe(3);
    expect(profile.education[0]?.degree).toBe("Bachelor of Computer Applications (BCA)");
    // Regression guard for "(Expected)" graduation-year detection.
    expect(profile.education[0]?.expected).toBe(true);

    expectNoHallucination(text, profile);
  });
});

describe("parseResumeText \u2014 sample1.pdf", () => {
  // Previously blocked by a pdf-parse extraction defect (architecture
  // review #4e) — fixed by migrating to unpdf. Extraction now succeeds and
  // produces identical output to what was originally captured.
  it("extracts a simple, well-formed resume exactly", async () => {
    const text = await extractText("sample1.pdf");
    const profile = parseResumeText(text);

    expect(profile.fullName).toBe("John Doe");
    expect(profile.email).toBe("johndoe@email.com");
    expect(profile.phone).toBe("+1 555-123-4567");
    expect(profile.location).toBeNull();
    expect(profile.skills).toEqual(["JavaScript", "TypeScript", "MongoDB", "Docker", "AWS"]);

    expect(profile.education.length).toBe(1);
    expect(profile.education[0]?.institution).toBe("University of Technology");
    expect(profile.education[0]?.startYear).toBe("2016");
    expect(profile.education[0]?.endYear).toBe("2020");

    expect(profile.workExperience.length).toBe(1);
    expect(profile.workExperience[0]?.company).toBe("Acme Corp");
    expect(profile.workExperience[0]?.responsibilities.length).toBe(2);
    expect(profile.totalExperienceYears).toBeCloseTo(6.7, 1);

    expectNoHallucination(text, profile);
  });
});

describe("parseResumeText \u2014 sample2.docx", () => {
  it("extracts a well-formed DOCX resume exactly", async () => {
    const text = await extractText("sample2.docx");
    const profile = parseResumeText(text);

    expect(profile.fullName).toBe("Jane Smith");
    expect(profile.email).toBe("jane.smith@example.co.uk");
    expect(profile.location).toBe("London, UK");
    expect(profile.skills).toEqual(
      expect.arrayContaining(["Python", "TensorFlow", "Kubernetes"]),
    );

    expect(profile.workExperience.length).toBe(1);
    expect(profile.workExperience[0]?.company).toBe("DataWorks");
    expect(profile.workExperience[0]?.startDate).toBe("Jan 2018");
    expect(profile.workExperience[0]?.endDate).toBe("Dec 2023");
    expect(profile.totalExperienceYears).toBeCloseTo(5.9, 1);

    expectNoHallucination(text, profile);
  });
});

describe("parseResumeText \u2014 sample3.pdf (known section-boundary bug)", () => {
  // Previously blocked by a pdf-parse extraction defect — fixed by
  // migrating to unpdf. See the sample1.pdf comment above for context.
  it("extracts identity and work experience correctly", async () => {
    const text = await extractText("sample3.pdf");
    const profile = parseResumeText(text);

    expect(profile.fullName).toBe("Alice Johnson");
    expect(profile.workExperience.length).toBe(1);
    expect(profile.workExperience[0]?.company).toBe("Tech Solutions Inc.");

    expectNoHallucination(text, profile);
  });

  // FIXED (architecture review #4d): a "Technologies: ..." line with no
  // preceding section heading was previously misattributed to the
  // Education entry's field. Now correctly skipped instead — the content
  // has no proper Projects section to belong to in this fixture, so it is
  // dropped rather than misattributed, per the project's core rule against
  // inventing or misassigning extracted content.
  it("no longer misattributes a stray Technologies line to education.field", async () => {
    const text = await extractText("sample3.pdf");
    const profile = parseResumeText(text);

    expect(profile.education.length).toBe(1);
    expect(profile.education[0]?.field).toBeNull();
    expect(profile.education[0]?.degree).toBe("B.A. Information Systems");
    expect(profile.education[0]?.institution).toBe("State College");
  });
});

describe("parseResumeText \u2014 trivial placeholder fixtures", () => {
  it("valid.pdf: returns an empty profile without crashing or hallucinating", async () => {
    const text = await extractText("valid.pdf");
    const profile = parseResumeText(text);

    expect(profile.fullName).toBeNull();
    expect(profile.skills).toEqual([]);
    expect(profile.workExperience).toEqual([]);
    expect(profile.education).toEqual([]);
  });

  it("valid.docx: returns an empty profile without crashing or hallucinating", async () => {
    const text = await extractText("valid.docx");
    const profile = parseResumeText(text);

    expect(profile.fullName).toBeNull();
    expect(profile.skills).toEqual([]);
    expect(profile.workExperience).toEqual([]);
    expect(profile.education).toEqual([]);
  });
});
