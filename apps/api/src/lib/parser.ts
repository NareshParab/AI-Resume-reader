import type {
  ParsedProfile,
  WorkExperienceEntry,
  EducationEntry,
  ProjectEntry,
  SkillCategories,
} from "@gcarbon/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escapeRE(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function kwRegex(kw: string) {
  return new RegExp(`(?<![a-zA-Z])${escapeRE(kw)}(?![a-zA-Z])`, "i");
}

/** Split the raw (line-preserved) text into named sections */
function normalizeText(text: string): string[] {
  let normalized = text;
  // Replace unicode bullets (like ●) with standard bullet "-"
  normalized = normalized.replace(/[●\u2022\u25CF\u25AA\u2023\u25E6]/g, "- ");
  
  // Fix missing space/newline before Month Year (e.g. "LimitedApr 2026" -> "Limited\nApr 2026")
  normalized = normalized.replace(/([a-z])(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?=[a-z]*\s*\d{4}|\s*–)/gi, "$1\n$2");
  
  // Fix missing spaces before 4-digit years (e.g. "Board2023" -> "Board 2023")
  normalized = normalized.replace(/([a-zA-Z])(\d{4})(?!\d)/g, "$1 $2");
  
  return normalized.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
}

function extractSections(lines: string[]): Record<string, string[]> {
  const sectionPatterns: Array<{ name: string; re: RegExp }> = [
    { name: "summary",     re: /^(professional\s+)?summary\s*:?\s*$/i },
    { name: "skills",      re: /^(technical\s+)?skills\s*:?\s*$/i },
    { name: "experience",  re: /^(work\s+)?(experience|history|employment(\s+history)?)\s*:?\s*$/i },
    { name: "projects",    re: /^projects?\s*:?\s*$/i },
    { name: "education",   re: /^(education|academic\s+background|qualifications?)\s*:?\s*$/i },
    { name: "achievements",re: /^(achievements?|accomplishments?|awards?|extra.?curricular)\s*:?\s*$/i },
    { name: "languages",   re: /^languages?\s*:?\s*$/i },
    { name: "certifications", re: /^certifications?\s*:?\s*$/i },
  ];

  const sections: Record<string, string[]> = {};
  let current = "header";
  sections[current] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    let matched = false;
    for (const { name, re } of sectionPatterns) {
      if (re.test(trimmed)) {
        current = name;
        sections[current] = [];
        matched = true;
        break;
      }
    }
    if (!matched) {
      if (!sections[current]) sections[current] = [];
      (sections[current] as string[]).push(line);
    }
  }
  return sections;
}

// ─── Identity extraction ──────────────────────────────────────────────────────

/** Extract from the header block only: name, email, phone, location */
function extractIdentity(headerLines: string[]) {
  let fullName: string | null = null;
  let email: string | null = null;
  let phone: string | null = null;
  let location: string | null = null;

  const emailRe = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/;
  // Phone: supports +91 84460 72604, +1 555-123-4567, (444) 987-6543, 111-222-3333, etc.
  const phoneRe = /(\+?\d{1,3}[\s.-]?)?(\(?\d{3,5}\)?[\s.-]?\d{3,5}(?:[\s.-]?\d{3,5})?(?:[\s.-]?\d{1,4})?)/;
  // Location heuristic: "City, State" or "City, Country"
  const locationRe = /^([A-Z][a-zA-Z\s]+,\s*[A-Z][a-zA-Z\s]+(?:,\s*[A-Z][a-zA-Z\s]+)?)$/;

  // Collect candidates for the name — ALL-CAPS lines or Title-Case lines in header
  const nameCandidates: string[] = [];

  // Expand any pipe-separated lines (e.g. "email | phone | city")
  const expandedLines: string[] = [];
  for (const line of headerLines) {
    if (line.includes("|")) {
      expandedLines.push(...line.split("|").map(s => s.trim()));
    } else {
      expandedLines.push(line);
    }
  }

  for (const line of expandedLines) {
    const t = line.trim();
    if (!t) continue;

    const emailMatch = t.match(emailRe);
    if (emailMatch && !email) { email = emailMatch[1] ?? null; continue; }

    const phoneMatch = t.match(phoneRe);
    if (phoneMatch && !phone) {
      // Make sure this isn't just part of a longer number (e.g., year ranges)
      const raw = phoneMatch[0].replace(/\D/g, "");
      if (raw.length >= 7) { phone = phoneMatch[0].trim(); continue; }
    }

    // Location: City, State / City, Country patterns
    if (!location && locationRe.test(t) && t.split(",").length >= 2) {
      location = t; 
      console.log('Location matched:', t);
      continue;
    }

    // Name candidate: all-caps word(s) at start of header, or typical Title Case
    // Note: only before we have found email (name is usually above contact line)
    if (!email && !phone) {
      // All-caps 2+ words (e.g., "NARESH PARAB")
      if (/^[A-Z][A-Z\s]+$/.test(t) && t.split(/\s+/).length >= 2 && t.length < 60) {
        console.log('Name candidate all caps:', t);
        nameCandidates.push(t);
      }
      // Title case 2+ words (e.g., "John Doe")
      else if (/^[A-Z][a-z]+(\s+[A-Z][a-z]+){1,3}$/.test(t) && t.length < 50) {
        console.log('Name candidate title case:', t);
        nameCandidates.push(t);
      }
    }
  }

  // Name: prefer the first all-caps candidate, then first title-case
  if (nameCandidates.length > 0) {
    const allCaps = nameCandidates.find(n => /^[A-Z][A-Z\s]+$/.test(n));
    fullName = allCaps ?? nameCandidates[0] ?? null;
  }

  return { fullName, email, phone, location };
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function extractSummary(summaryLines: string[], headerLines: string[]): string | null {
  const lines = summaryLines.length > 0 ? summaryLines : [];

  // If there's no dedicated summary section, look for a paragraph in the header
  // that doesn't look like contact info
  if (lines.length === 0) {
    const emailRe = /[@]/;
    const phoneRe = /\d{7,}/;
    const paraLines = headerLines.filter(l => {
      const t = l.trim();
      return t.length > 40 && !emailRe.test(t) && !phoneRe.test(t);
    });
    if (paraLines.length > 0) return paraLines.join(" ").trim();
  }

  const text = lines.filter(l => l.trim()).join(" ").trim();
  return text.length > 10 ? text : null;
}

// ─── Skills ───────────────────────────────────────────────────────────────────

// Comprehensive dictionaries — preserving canonical casing for display
const SKILL_DICT: Record<keyof SkillCategories, string[]> = {
  programming: [
    "Python", "SQL", "C", "C++", "C#", "Java", "JavaScript", "TypeScript",
    "R", "Go", "Rust", "PHP", "Swift", "Kotlin", "Ruby", "Scala", "MATLAB",
  ],
  databases: [
    "MySQL", "PostgreSQL", "MongoDB", "SQLite", "Oracle", "SQL Server",
    "Redis", "Cassandra", "DynamoDB", "MariaDB", "MS SQL",
  ],
  pythonLibraries: [
    "Pandas", "NumPy", "Matplotlib", "Seaborn", "Scikit-learn",
    "TensorFlow", "Keras", "PyTorch", "NLTK", "SpaCy", "Plotly",
    "SciPy", "Statsmodels", "OpenCV", "Requests", "BeautifulSoup",
    "FastAPI", "Flask", "Django", "Streamlit",
  ],
  biVisualization: [
    "Power BI", "DAX", "Power Query", "Excel", "Tableau", "Looker",
    "Google Data Studio", "Qlik", "Metabase", "Grafana", "Superset",
    "Matplotlib", "Seaborn", "Plotly",
  ],
  analytics: [
    "Data Analysis", "Data Analytics", "Statistical Analysis",
    "Exploratory Data Analysis", "EDA", "Data Visualization",
    "Machine Learning", "Deep Learning", "NLP", "A/B Testing",
    "Regression", "Classification", "Clustering", "Forecasting",
  ],
  tools: [
    "Git", "GitHub", "VS Code", "Jupyter", "Jupyter Notebook",
    "Google Colab", "Docker", "Kubernetes", "AWS", "Azure", "GCP",
    "Linux", "Bash", "Postman", "Jira", "Slack", "Notion",
    "PyCharm", "Anaconda", "SSMS",
  ],
  aiAssisted: [
    "Generative AI", "Prompt Engineering", "ChatGPT", "Claude",
    "AI-Assisted Research", "AI-Assisted Analytics",
    "Large Language Models", "LLM", "Copilot",
  ],
  other: [],
};

function extractSkills(_skillsLines: string[], fullText: string): {
  skills: string[];
  skillCategories: SkillCategories;
  programmingLanguages: string[];
  frameworksAndLibraries: string[];
  toolsAndTechnologies: string[];
} {
  const categories: SkillCategories = {
    programming: [], databases: [], pythonLibraries: [],
    biVisualization: [], analytics: [], tools: [], aiAssisted: [], other: [],
  };

  // Always search full text — skill section may be pipe/comma inline, and
  // skills appear throughout the resume (in project tech lines etc.)
  const searchText = fullText;

  for (const [cat, kwList] of Object.entries(SKILL_DICT) as [keyof SkillCategories, string[]][]) {
    for (const kw of kwList) {
      if (kwRegex(kw).test(searchText)) {
        if (!categories[cat].includes(kw)) {
          categories[cat].push(kw);
        }
      }
    }
  }

  const allSkills = [
    ...categories.programming,
    ...categories.databases,
    ...categories.pythonLibraries,
    ...categories.biVisualization,
    ...categories.tools,
    ...categories.aiAssisted,
    ...categories.analytics,
    ...categories.other,
  ];

  // Deduplicate by lower-case
  const seen = new Set<string>();
  const unique = allSkills.filter(s => {
    const k = s.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    skills: unique,
    skillCategories: categories,
    programmingLanguages: categories.programming,
    frameworksAndLibraries: [...categories.pythonLibraries, ...categories.biVisualization],
    toolsAndTechnologies: [...categories.databases, ...categories.tools],
  };
}

// ─── Experience ───────────────────────────────────────────────────────────────

// Matches "Month YYYY" or bare "YYYY"
const DATE_PATTERN = /(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+\d{4}|\d{4}/i;
// Full date range: "Apr 2026 – Present", "2020 - 2023"
const DATE_RANGE_RE = new RegExp(
  `(${DATE_PATTERN.source})\\s*(?:–|-|to)\\s*(${DATE_PATTERN.source}|present|current)`,
  "i"
);
// Month-only range: "Apr – Jun 2025" or "Dec 2024 – Jan 2025" (already covered by DATE_RANGE_RE)
// Handles "Month – Month YYYY" where the year applies to both sides
const MONTH_RANGE_RE = /^(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s*(?:–|-|to)\s*(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{4})(?:\s*\(.*?\))?$/i;
// Bullet characters used in PDFs and text resumes (includes Unicode filled circle ●)
const BULLET_RE = /^[-\u2022\u25CF*\u25AA]\s*/;
// Single date: "Dec 2024" or "2024"
const SINGLE_DATE_RE = /^((?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+)?\d{4}(?:\s*\(.*?\))?$/i;
const DURATION_RE = /\(?(\d+\s*(?:month|year)s?(?:\s*\d+\s*(?:month|year)s?)?)\)?/i;

function parseExperienceBlock(lines: string[]): WorkExperienceEntry[] {
  const entries: WorkExperienceEntry[] = [];

  // Collect non-empty lines
  const nonEmpty = lines.filter(l => l.trim());

  // Strategy: group by detecting "Title — Company" or "Title at Company" or date-range lines
  // We look for anchor lines that contain a date range, and build entries backwards from there
  const blocks: string[][] = [];
  let currentBlock: string[] = [];

  for (const line of nonEmpty) {
    const t = line.trim();
    const isBullet = BULLET_RE.test(t);

    if (!isBullet && currentBlock.length > 0) {
      const hasBullets = currentBlock.some(l => BULLET_RE.test(l.trim()));
      const isHeading = /^(.+?)\s*(?:—|-{1,2}|@|\bat\b)\s*(.+)$/.test(t);
      
      // A new job block starts when we encounter a non-bullet line that appears AFTER bullets
      // OR if we encounter a new heading line (containing a separator) when we already have bullets/dates
      if (hasBullets || (isHeading && currentBlock.some(l => /\b\d{4}\b/.test(l)))) {
        blocks.push(currentBlock);
        currentBlock = [t];
        continue;
      }
    }
    currentBlock.push(t);
  }
  if (currentBlock.length > 0) blocks.push(currentBlock);

  for (const block of blocks) {
    const entry: WorkExperienceEntry = {
      jobTitle: null, company: null,
      startDate: null, endDate: null, duration: null,
      responsibilities: [],
    };

    for (const line of block) {
      const t = line.trim();

      // Bullet responsibility (handles PDF ● and text -/•/*)
      if (BULLET_RE.test(t)) {
        entry.responsibilities.push(t.replace(BULLET_RE, "").trim());
        continue;
      }

      // Full date range: "Apr 2026 – Present" — may appear inline with title/company
      const dateMatch = t.match(DATE_RANGE_RE);
      if (dateMatch) {
        if (!entry.startDate) entry.startDate = dateMatch[1] ?? null;
        if (!entry.endDate) entry.endDate = dateMatch[2] ?? null;
        // Strip the date portion from line and parse remaining as title/company if not yet set
        if (!entry.jobTitle) {
          const beforeDate = t.slice(0, dateMatch.index ?? 0).trim();
          if (beforeDate) {
            const titleCompany = beforeDate.match(/^(.+?)\s*(?:—|-{1,2}|@|\bat\b)\s*(.+)$/);
            if (titleCompany) {
              entry.jobTitle = (titleCompany[1] ?? "").trim() || null;
              entry.company = (titleCompany[2] ?? "").trim() || null;
            } else {
              entry.jobTitle = beforeDate;
            }
          }
        }
        continue;
      }

      // Month-only range: "Apr – Jun 2025"
      const monthRange = t.match(MONTH_RANGE_RE);
      if (monthRange) {
        if (!entry.startDate) entry.startDate = `${monthRange[1]} ${monthRange[3]}`;
        if (!entry.endDate) entry.endDate = `${monthRange[2]} ${monthRange[3]}`;
        // Strip date portion and parse remaining as title/company if not yet set
        if (!entry.jobTitle) {
          const beforeDate = t.slice(0, monthRange.index ?? 0).trim();
          if (beforeDate) {
            const titleCompany = beforeDate.match(/^(.+?)\s*(?:—|-{1,2}|@|\bat\b)\s*(.+)$/);
            if (titleCompany) {
              entry.jobTitle = (titleCompany[1] ?? "").trim() || null;
              entry.company = (titleCompany[2] ?? "").trim() || null;
            } else {
              entry.jobTitle = beforeDate;
            }
          }
        }
        continue;
      }

      // Single date: "Dec 2024" or "Dec 2024 (1 month)" — standalone date-only line
      const singleDate = t.match(SINGLE_DATE_RE);
      if (singleDate && !entry.startDate && !entry.endDate) {
        const datePart = t.replace(/\s*\(.*\)/, "").trim();
        entry.endDate = datePart;
        const durMatch = t.match(DURATION_RE);
        if (durMatch && !entry.duration) entry.duration = durMatch[1] ?? null;
        continue;
      }

      // Duration standalone (e.g., "(1 month)")
      const durMatch = t.match(DURATION_RE);
      if (durMatch && !entry.duration) {
        entry.duration = durMatch[1] ?? null;
      }

      // Title — Company (separator variants: —, -, @, at)
      const titleCompany = t.match(/^(.+?)\s*(?:—|-{1,2}|@|\bat\b)\s*(.+)$/);
      if (titleCompany && !entry.jobTitle) {
        entry.jobTitle = (titleCompany[1] ?? "").trim() || null;
        entry.company  = (titleCompany[2] ?? "").trim() || null;
        continue;
      }

      // If we don't have a title yet, first non-bullet, non-date line is the title
      if (!entry.jobTitle) {
        entry.jobTitle = t;
        continue;
      }
      if (!entry.company && !dateMatch && !entry.responsibilities.length) {
        entry.company = t;
      }
    }

    if (entry.jobTitle || entry.company || entry.responsibilities.length > 0) {
      entries.push(entry);
    }
  }

  return entries;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

function parseProjectsBlock(lines: string[]): ProjectEntry[] {
  const entries: ProjectEntry[] = [];
  const nonEmpty = lines.filter(l => l.trim());

  // Projects are usually numbered "1." or start with a title line, followed by tech line, then bullets
  const projectBlocks: string[][] = [];
  let cur: string[] = [];

  for (const line of nonEmpty) {
    const t = line.trim();
    const isBullet = /^[-•*▪]/.test(t);
    const isNumbered = /^\d+[.)]\s+/.test(t);
    
    // Explicit title line: Title | Technologies — GitHub
    const isExplicitTitle = !isBullet && /\|/.test(t) && t.length > 10;
    
    // New project block: numbered line or a capitalized non-bullet line after a block that already has content
    const isNewTitle = !isBullet && !isNumbered && /^[A-Z0-9]/.test(t) && cur.length > 0 &&
      cur.some(l => /^(?:technologies?|tools?)/i.test(l.trim()) || /^[-•*▪]/.test(l.trim()));
      
    if (isNumbered || isExplicitTitle || isNewTitle) {
      if (cur.length > 0) projectBlocks.push(cur);
      cur = [t];
    } else {
      cur.push(t);
    }
  }
  if (cur.length > 0) projectBlocks.push(cur);

  for (const block of projectBlocks) {
    const entry: ProjectEntry = { title: null, technologies: [], description: null };
    const descLines: string[] = [];

    for (const line of block) {
      const t = line.replace(/^\d+[.)]\s+/, "").trim();
      if (!t) continue;

      // Technologies line: "Technologies: X, Y, Z" or "Tools: X, Y"
      const techMatch = t.match(/^(?:technologies?|tools?|tech\s+stack)\s*:?\s*(.+)/i);
      if (techMatch) {
        entry.technologies = (techMatch[1] ?? "").split(/[,|]/).map((s: string) => s.trim()).filter(Boolean);
        continue;
      }

      if (!entry.title) { 
        const titleTechMatch = t.match(/^(.+?)\s*\|\s*(.+?)(?:\s*(?:—|-|–)\s*GitHub)?$/i);
        if (titleTechMatch && titleTechMatch[2] && titleTechMatch[1]) {
          entry.title = (titleTechMatch[1] as string).trim();
          entry.technologies = (titleTechMatch[2] as string).split(/[,|]/).map((s: string) => s.trim()).filter(Boolean);
          continue;
        }
        entry.title = t; 
        continue; 
      }

      if (/^[-•*▪]/.test(t)) {
        descLines.push(t.replace(/^[-•*▪]\s*/, "").trim());
      } else {
        descLines.push(t);
      }
    }

    entry.description = descLines.join(" ").trim() || null;
    if (entry.title) entries.push(entry);
  }

  return entries;
}

// ─── Education ────────────────────────────────────────────────────────────────

function parseEducationBlock(lines: string[]): EducationEntry[] {
  const entries: EducationEntry[] = [];

  // Normalize lines is now handled in normalizeText
  const nonEmpty = lines.filter(l => l.trim());

  // Education blocks are separated by blank lines or degree keywords
  const degreeKw = /\b(bachelor|master|b\.?sc|m\.?sc|b\.?e|m\.?e|b\.?tech|m\.?tech|bca|mca|b\.?a|m\.?a|ph\.?d|hsc|ssc|12th|10th|diploma|certificate|higher secondary|secondary school|matriculation)\b/i;

  const blocks: string[][] = [];
  let cur: string[] = [];

  for (const line of nonEmpty) {
    const t = line.trim();
    if (degreeKw.test(t) && cur.length > 0) {
      blocks.push(cur);
      cur = [t];
    } else {
      cur.push(t);
    }
  }
  if (cur.length > 0) blocks.push(cur);

  for (const block of blocks) {
    const entry: EducationEntry = {
      degree: null, field: null, institution: null,
      startYear: null, endYear: null, expected: false,
    };

    for (const line of block) {
      const t = line.trim();
      if (!t) continue;

      const expectedMatch = /expected|pursuing/i.test(t);

      // Strip year range from the line and process the remainder
      const yearRange = t.match(/(\d{4})\s*(?:–|-|to)\s*(\d{4})/);
      let remainder = t;
      if (yearRange) {
        if (!entry.startYear) {
          entry.startYear = yearRange[1] ?? null;
          entry.endYear = yearRange[2] ?? null;
          entry.expected = expectedMatch;
        }
        // Strip the year range (and trailing "(Expected)" etc.) from remainder
        remainder = t
          .replace(yearRange[0], "")
          .replace(/\(?\s*expected\s*\)?/i, "")
          .replace(/\(?\s*pursuing\s*\)?/i, "")
          .trim()
          .replace(/[,—\-]+$/, "")
          .trim();
        if (!remainder) continue; // nothing left on this line
      }

      // Check for single year in the remainder (no range found)
      if (!yearRange) {
        const singleYear = remainder.match(/\b(\d{4})\b/);
        if (singleYear && !entry.endYear) {
          entry.endYear = singleYear[1] ?? null;
          entry.expected = expectedMatch;
          // Strip the year from remainder
          remainder = remainder
            .replace(singleYear[0], "")
            .replace(/\(?\s*expected\s*\)?/i, "")
            .replace(/\(?\s*pursuing\s*\)?/i, "")
            .trim()
            .replace(/[,—\-]+$/, "")
            .trim();
          if (!remainder) continue;
        }
      }

      // Now process the remainder for specialization / degree / institution
      const r = remainder;

      // Specialization: "Specialization in Data Science" or "Specialization: Data Science"
      const specMatch = r.match(/(?:specialization|specialisation|major)\s+(?:in\s+)?:?\s*(.+)/i);
      if (specMatch) {
        if (!entry.field) entry.field = (specMatch[1] ?? "").trim().replace(/[,—\-]+$/, "").trim() || null;
        // Also parse the part before "Specialization" as degree
        const beforeSpec = r.slice(0, r.toLowerCase().indexOf("specializ")).trim().replace(/[—\-]+$/, "").trim();
        if (beforeSpec && !entry.degree && degreeKw.test(beforeSpec)) {
          entry.degree = beforeSpec;
        }
        continue;
      }

      // Degree line (contains degree keyword)
      if (!entry.degree && degreeKw.test(r)) {
        // Check if line also contains institution keywords — split if so
        const instKeyword = /university|college|school|institute|board/i;
        if (instKeyword.test(r)) {
          // Try to split: degree part vs institution part (usually separated by comma)
          const commaIdx = r.search(/,\s*(?=[A-Z])/);
          if (commaIdx > 0) {
            const degPart = r.slice(0, commaIdx).trim();
            const instPart = r.slice(commaIdx + 1).trim();
            if (degreeKw.test(degPart)) entry.degree = degPart;
            if (!entry.institution && instKeyword.test(instPart)) entry.institution = instPart;
          } else {
            entry.degree = r;
          }
        } else {
          entry.degree = r;
        }
        continue;
      }

      // Institution (contains "University", "College", "School", "Institute", "Board")
      if (!entry.institution && /university|college|school|institute|board/i.test(r)) {
        entry.institution = r; continue;
      }

      // Fallback: first unmatched remainder → degree or field
      if (!entry.degree) entry.degree = r;
      else if (!entry.field) entry.field = r;
    }

    if (entry.degree || entry.institution) entries.push(entry);
  }

  return entries;
}

// ─── Achievements ─────────────────────────────────────────────────────────────

function parseAchievements(lines: string[]): string[] {
  return lines
    .map(l => l.trim().replace(/^[-•*▪\d.)\s]+/, "").trim())
    .filter(l => l.length > 5);
}

// ─── Total experience years ───────────────────────────────────────────────────

function calcTotalExperience(entries: WorkExperienceEntry[]): number | null {
  if (entries.length === 0) return null;
  let totalMonths = 0;
  const now = new Date();

  for (const e of entries) {
    let start: Date | null = null;
    let end: Date | null = null;

    const parseDate = (s: string | null): Date | null => {
      if (!s) return null;
      if (/present|current/i.test(s)) return now;
      const full = new Date(s);
      if (!isNaN(full.getTime())) return full;
      const yearMatch = s.match(/\b(\d{4})\b/);
      if (yearMatch) return new Date(`Jan ${yearMatch[1]}`);
      return null;
    };

    start = parseDate(e.startDate);
    end = parseDate(e.endDate);

    if (start && end) {
      const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      totalMonths += Math.max(0, months);
    }
  }

  return totalMonths > 0 ? Math.round((totalMonths / 12) * 10) / 10 : null;
}

// ─── Main exported function ───────────────────────────────────────────────────

export function parseResumeText(text: string): ParsedProfile {
  const empty: ParsedProfile = {
    fullName: null, email: null, phone: null, location: null,
    professionalSummary: null,
    skills: [], skillCategories: {
      programming: [], databases: [], pythonLibraries: [],
      biVisualization: [], analytics: [], tools: [], aiAssisted: [], other: [],
    },
    programmingLanguages: [], frameworksAndLibraries: [], toolsAndTechnologies: [],
    education: [], certifications: [],
    workExperience: [], totalExperienceYears: null,
    projects: [], achievements: [], languages: [],
  };

  if (!text || text.trim().length === 0) return empty;

  // Normalize text to fix PDF extraction artifacts before sectioning
  const lines = normalizeText(text);
  const sections = extractSections(lines);

  const profile: ParsedProfile = { ...empty };

  // 1. Identity (header only)
  const identity = extractIdentity(sections.header ?? []);
  profile.fullName = identity.fullName;
  profile.email = identity.email;
  profile.phone = identity.phone;
  profile.location = identity.location;

  // 2. Professional Summary
  profile.professionalSummary = extractSummary(
    sections.summary ?? [],
    sections.header ?? []
  );

  // 3. Skills — search skills section first, then fallback to full text
  const skillResult = extractSkills(sections.skills ?? [], text);
  profile.skills = skillResult.skills;
  profile.skillCategories = skillResult.skillCategories;
  profile.programmingLanguages = skillResult.programmingLanguages;
  profile.frameworksAndLibraries = skillResult.frameworksAndLibraries;
  profile.toolsAndTechnologies = skillResult.toolsAndTechnologies;

  // 4. Work Experience
  profile.workExperience = parseExperienceBlock(sections.experience ?? []);

  // 5. Projects
  profile.projects = parseProjectsBlock(sections.projects ?? []);

  // 6. Education
  profile.education = parseEducationBlock(sections.education ?? []);

  // 7. Achievements
  profile.achievements = parseAchievements(sections.achievements ?? []);

  // 8. Languages
  profile.languages = parseAchievements(sections.languages ?? []);

  // 9. Certifications
  profile.certifications = parseAchievements(sections.certifications ?? []);

  // 10. Total experience years
  profile.totalExperienceYears = calcTotalExperience(profile.workExperience);

  return profile;
}
