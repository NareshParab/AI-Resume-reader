// ─── API Response envelope ────────────────────────────────────────────────────

export interface User {
  _id?: string;
  email: string;
  createdAt: string;
}


export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export type ServiceStatus = "ok" | "degraded" | "down";

export interface ServiceCheck {
  status: ServiceStatus;
  latencyMs?: number;
  error?: string;
}

export interface HealthStatus {
  status: ServiceStatus;
  version: string;
  timestamp: string;
  uptime: number;
  services: {
    api: ServiceCheck;
    database: ServiceCheck;
  };
}

// ─── Worker ───────────────────────────────────────────────────────────────────

export type WorkerStatus = "idle" | "busy" | "error";

export interface WorkerInfo {
  id: string;
  status: WorkerStatus;
  startedAt: string;
}

// ─── Resumes ──────────────────────────────────────────────────────────────────

export interface WorkExperienceEntry {
  jobTitle: string | null;
  company: string | null;
  startDate: string | null;
  endDate: string | null;
  duration: string | null;
  responsibilities: string[];
}

export interface EducationEntry {
  degree: string | null;
  field: string | null;
  institution: string | null;
  startYear: string | null;
  endYear: string | null;
  expected: boolean;
}

export interface ProjectEntry {
  title: string | null;
  technologies: string[];
  description: string | null;
}

export interface SkillCategories {
  programming: string[];
  databases: string[];
  pythonLibraries: string[];
  biVisualization: string[];
  analytics: string[];
  tools: string[];
  aiAssisted: string[];
  other: string[];
}

export interface ParsedProfile {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  professionalSummary: string | null;
  skills: string[];
  skillCategories: SkillCategories;
  programmingLanguages: string[];
  frameworksAndLibraries: string[];
  toolsAndTechnologies: string[];
  education: EducationEntry[];
  certifications: string[];
  workExperience: WorkExperienceEntry[];
  totalExperienceYears: number | null;
  projects: ProjectEntry[];
  achievements: string[];
  languages: string[];
}

export interface AiInsights {
  summary: string;
  strengths: string[];
  improvementSuggestions: string[];
  generatedAt: string;
  model: string;
}

export interface CandidateScore {
  score: number;
  reasoning: string;
  matchedSkills: string[];
  generatedAt: string;
  model: string;
}

export interface Batch {
  _id?: string;
  userId?: string;
  jobDescription: string;
  status: "processing" | "completed";
  totalCount: number;
  completedCount: number;
  failedCount: number;
  createdAt: string;
}

export interface Resume {
  _id?: string;
  userId?: string;
  batchId?: string;
  filename: string;
  fileType: string;
  extractedText: string;
  charCount: number;
  wordCount: number;
  uploadedAt: string;
  parsedProfile?: ParsedProfile;
  aiInsights?: AiInsights;
  candidateScore?: CandidateScore;
}
