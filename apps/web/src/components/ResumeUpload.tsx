import { useState, useRef, useEffect, useCallback } from "react";
import type {
  Resume,
  ApiResponse,
  ParsedProfile,
  WorkExperienceEntry,
  EducationEntry,
  ProjectEntry,
} from "@gcarbon/types";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// ─── Design primitives ────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h5
      className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2"
      style={{ color: "var(--muted)" }}
    >
      <span className="flex-1 border-t" style={{ borderColor: "var(--border-soft)" }} />
      {children}
      <span className="flex-1 border-t" style={{ borderColor: "var(--border-soft)" }} />
    </h5>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div
      className="flex gap-3 items-start py-1.5 border-b"
      style={{ borderColor: "var(--border-soft)" }}
    >
      <span className="w-24 shrink-0 text-xs font-semibold text-muted uppercase tracking-wide pt-0.5">
        {label}
      </span>
      <span className="text-sm text-body break-all">{value ?? "—"}</span>
    </div>
  );
}

function SkillPill({ label, pillStyle }: { label: string; pillStyle?: React.CSSProperties | undefined }) {
  const defaultStyle: React.CSSProperties = {
    background: "var(--bg-surface2)",
    color: "var(--body)",
    border: "1px solid var(--border)",
  };
  return (
    <span
      className="px-2.5 py-1 rounded-md text-xs font-medium"
      style={pillStyle ?? defaultStyle}
    >
      {label}
    </span>
  );
}

interface SkillGroupProps {
  heading: string;
  items: string[];
  pillStyle?: React.CSSProperties | undefined;
}

function SkillGroup({ heading, items, pillStyle }: SkillGroupProps) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-muted mb-2">{heading}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s, i) => (
          <SkillPill key={i} label={s} {...(pillStyle !== undefined ? { pillStyle } : {})} />
        ))}
      </div>
    </div>
  );
}

function ExperienceCard({ entry, index }: { entry: WorkExperienceEntry; index: number }) {
  return (
    <div
      className="relative pl-5"
      style={{
        borderLeft: "2px solid var(--border)",
        paddingBottom: "0.25rem",
      }}
    >
      <div
        className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full border-2"
        style={{ background: "var(--accent)", borderColor: "var(--bg-surface)" }}
      />
      <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-semibold text-ink">
          {index + 1}. {entry.jobTitle ?? "Unknown Role"}
        </span>
        {entry.company && (
          <span className="text-sm font-medium" style={{ color: "var(--accent)" }}>
            — {entry.company}
          </span>
        )}
      </div>
      {(entry.startDate ?? entry.endDate ?? entry.duration) && (
        <p className="text-xs text-muted mb-2">
          {[entry.startDate, entry.endDate].filter(Boolean).join(" – ")}
          {entry.duration ? ` · ${entry.duration}` : ""}
        </p>
      )}
      {entry.responsibilities.length > 0 && (
        <ul className="space-y-1">
          {entry.responsibilities.map((r, i) => (
            <li key={i} className="text-xs text-body flex gap-2">
              <span className="text-accent shrink-0">▸</span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectCard({ entry, index }: { entry: ProjectEntry; index: number }) {
  return (
    <div
      className="p-4 rounded-xl"
      style={{
        background: "var(--bg-surface2)",
        border: "1px solid var(--border)",
      }}
    >
      <p className="text-sm font-semibold text-ink mb-1.5">
        {index + 1}. {entry.title ?? "Untitled Project"}
      </p>
      {entry.technologies.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {entry.technologies.map((t, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                background: "var(--bg-surface)",
                color: "var(--body)",
                border: "1px solid var(--border)",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {entry.description && (
        <p className="text-xs text-muted leading-relaxed">{entry.description}</p>
      )}
    </div>
  );
}

function EducationCard({ entry }: { entry: EducationEntry }) {
  return (
    <div
      className="p-3 rounded-lg"
      style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-sm font-semibold text-ink">{entry.degree ?? "Unknown Degree"}</p>
      {entry.field && (
        <p className="text-xs font-medium mt-0.5" style={{ color: "var(--accent)" }}>
          {entry.field}
        </p>
      )}
      {entry.institution && <p className="text-xs text-muted mt-0.5">{entry.institution}</p>}
      {(entry.startYear ?? entry.endYear) && (
        <p className="text-xs text-muted mt-1">
          {[entry.startYear, entry.endYear].filter(Boolean).join(" – ")}
          {entry.expected ? " (Expected)" : ""}
        </p>
      )}
    </div>
  );
}

// ─── Skill palette — dark-mode appropriate ────────────────────────────────────

const SKILL_STYLES: Record<string, React.CSSProperties> = {
  programming: {
    background: "rgba(99,102,241,0.08)",
    color: "#818CF8",
    border: "1px solid rgba(99,102,241,0.22)",
  },
  databases: {
    background: "rgba(139,92,246,0.08)",
    color: "#A78BFA",
    border: "1px solid rgba(139,92,246,0.22)",
  },
  python: {
    background: "rgba(234,179,8,0.07)",
    color: "#FCD34D",
    border: "1px solid rgba(234,179,8,0.18)",
  },
  bi: {
    background: "rgba(249,115,22,0.07)",
    color: "#FDBA74",
    border: "1px solid rgba(249,115,22,0.18)",
  },
  analytics: {
    background: "rgba(20,184,166,0.07)",
    color: "#5EEAD4",
    border: "1px solid rgba(20,184,166,0.18)",
  },
  ai: {
    background: "rgba(34,211,238,0.07)",
    color: "#67E8F9",
    border: "1px solid rgba(34,211,238,0.18)",
  },
};

// ─── Parsed profile panel ─────────────────────────────────────────────────────

function ParsedProfilePanel({ p }: { p: ParsedProfile }) {
  const sc = p.skillCategories;

  return (
    <div
      className="mt-6 rounded-2xl overflow-hidden animate-slide-up"
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
      }}
    >
      {/* Header */}
      <div
        className="px-6 py-5 border-b"
        style={{
          background: "rgba(99,102,241,0.06)",
          borderColor: "rgba(99,102,241,0.12)",
        }}
      >
        <p
          className="text-xs font-bold uppercase tracking-widest mb-1"
          style={{ color: "var(--accent)" }}
        >
          Extracted Profile
        </p>
        <p className="text-2xl font-display font-bold text-ink tracking-tight">
          {p.fullName ?? "Unknown Candidate"}
        </p>
      </div>

      <div className="p-6 space-y-7">
        {/* Contact */}
        <section>
          <SectionHeading>Contact</SectionHeading>
          <div className="space-y-0.5">
            <InfoRow label="Email"    value={p.email} />
            <InfoRow label="Phone"    value={p.phone} />
            <InfoRow label="Location" value={p.location} />
          </div>
        </section>

        {p.professionalSummary && (
          <section>
            <SectionHeading>Summary</SectionHeading>
            <p className="text-sm text-body leading-relaxed">{p.professionalSummary}</p>
          </section>
        )}

        {p.skills.length > 0 && (
          <section>
            <SectionHeading>Skills</SectionHeading>
            <SkillGroup heading="Programming"          items={sc.programming}     pillStyle={SKILL_STYLES.programming} />
            <SkillGroup heading="Databases"            items={sc.databases}        pillStyle={SKILL_STYLES.databases}   />
            <SkillGroup heading="Python Libraries"     items={sc.pythonLibraries}  pillStyle={SKILL_STYLES.python}      />
            <SkillGroup heading="BI & Visualization"   items={sc.biVisualization}  pillStyle={SKILL_STYLES.bi}          />
            <SkillGroup heading="Analytics"            items={sc.analytics}        pillStyle={SKILL_STYLES.analytics}   />
            <SkillGroup heading="Tools"                items={sc.tools} />
            <SkillGroup heading="AI-Assisted Analytics" items={sc.aiAssisted}      pillStyle={SKILL_STYLES.ai}          />
          </section>
        )}

        {p.workExperience.length > 0 && (
          <section>
            <SectionHeading>Experience</SectionHeading>
            {p.totalExperienceYears !== null && (
              <p className="text-xs text-muted mb-4">
                Total: ~{p.totalExperienceYears} year{p.totalExperienceYears !== 1 ? "s" : ""}
              </p>
            )}
            <div className="space-y-6">
              {p.workExperience.map((e, i) => <ExperienceCard key={i} entry={e} index={i} />)}
            </div>
          </section>
        )}

        {p.projects.length > 0 && (
          <section>
            <SectionHeading>Projects</SectionHeading>
            <div className="space-y-3">
              {p.projects.map((proj, i) => <ProjectCard key={i} entry={proj} index={i} />)}
            </div>
          </section>
        )}

        {p.education.length > 0 && (
          <section>
            <SectionHeading>Education</SectionHeading>
            <div className="space-y-3">
              {p.education.map((edu, i) => <EducationCard key={i} entry={edu} />)}
            </div>
          </section>
        )}

        {p.achievements.length > 0 && (
          <section>
            <SectionHeading>Achievements</SectionHeading>
            <ul className="space-y-2">
              {p.achievements.map((a, i) => (
                <li key={i} className="flex gap-2 text-sm text-body">
                  <span className="text-accent shrink-0 font-bold">{i + 1}.</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {p.languages.length > 0 && (
          <section>
            <SectionHeading>Languages</SectionHeading>
            <div className="flex flex-wrap gap-2">
              {p.languages.map((l, i) => <SkillPill key={i} label={l} />)}
            </div>
          </section>
        )}

        {p.certifications.length > 0 && (
          <section>
            <SectionHeading>Certifications</SectionHeading>
            <ul className="space-y-1">
              {p.certifications.map((c, i) => (
                <li key={i} className="text-sm text-body flex gap-2">
                  <span style={{ color: "var(--ok-fg)" }}>✓</span> {c}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── AI Insights panel ────────────────────────────────────────────────────────

function AiInsightsPanel({ insights }: { insights: NonNullable<Resume["aiInsights"]> }) {
  return (
    <div className="mt-6 rounded-2xl overflow-hidden animate-slide-up ai-section">
      <div className="flex items-center gap-3 mb-5">
        <span className="ai-badge">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
            <circle cx="4" cy="4" r="3" fill="currentColor" opacity="0.7" />
          </svg>
          AI Generated
        </span>
        <p className="text-xs text-muted">Interpretation only — not verified fact</p>
      </div>

      <div className="space-y-5">
        {insights.summary && (
          <section>
            <SectionHeading>AI Summary</SectionHeading>
            <p className="text-sm text-body leading-relaxed">{insights.summary}</p>
          </section>
        )}
        {insights.strengths.length > 0 && (
          <section>
            <SectionHeading>Strengths</SectionHeading>
            <ul className="space-y-2">
              {insights.strengths.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-body">
                  <span style={{ color: "var(--ok-fg)" }} className="shrink-0 font-bold">✓</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {insights.improvementSuggestions.length > 0 && (
          <section>
            <SectionHeading>Areas for Improvement</SectionHeading>
            <ul className="space-y-2">
              {insights.improvementSuggestions.map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-body">
                  <span style={{ color: "var(--warn-fg)" }} className="shrink-0 font-bold">↑</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="text-xs text-muted pt-1">
          Generated by {insights.model} · {new Date(insights.generatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// ─── Processing step indicator ────────────────────────────────────────────────

function ProcessingStep({
  label,
  active,
  done,
}: {
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all duration-300"
        style={{
          background: done
            ? "var(--ok-bg)"
            : active
            ? "rgba(99,102,241,0.1)"
            : "var(--bg-surface2)",
          border: `1px solid ${done ? "rgba(16,185,129,0.35)" : active ? "rgba(99,102,241,0.3)" : "var(--border)"}`,
          boxShadow: active ? "0 0 12px rgba(99,102,241,0.2)" : "none",
        }}
      >
        {done ? (
          <svg width="10" height="10" fill="none" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M2.5 5l2 2 3-3.5" stroke="var(--ok-fg)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : active ? (
          <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="4" />
            <path className="opacity-80" fill="var(--accent)" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--muted)" }} />
        )}
      </div>
      <span
        className="text-sm font-medium transition-colors duration-300"
        style={{
          color: done ? "var(--ok-fg)" : active ? "var(--ink)" : "var(--muted)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResumeUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Resume | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const idParam = new URLSearchParams(window.location.search).get("id");
    if (!idParam) return;
    setIsLoading(true);
    setError(null);
    fetch(`/api/v1/resumes/${idParam}`)
      .then(async (response) => {
        if (response.status === 401) {
          setError("Your session expired. Please refresh and log in again.");
          window.history.replaceState(null, "", window.location.pathname);
          return;
        }
        const json = (await response.json()) as ApiResponse<Resume>;
        if (response.ok && json.success && json.data) {
          setResult(json.data);
        } else {
          setError("Could not load resume — it may not exist.");
          window.history.replaceState(null, "", window.location.pathname);
        }
      })
      .catch(() => {
        setError("Could not load resume — it may not exist.");
        window.history.replaceState(null, "", window.location.pathname);
      })
      .finally(() => { setIsLoading(false); });
  }, []);

  const handleReset = () => {
    setResult(null);
    setFile(null);
    setError(null);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const applyFile = useCallback((candidate: File | null) => {
    if (!candidate) return;
    if (!ALLOWED_TYPES.has(candidate.type)) {
      setError("Only PDF and DOCX files are accepted.");
      return;
    }
    if (candidate.size > MAX_FILE_SIZE) {
      setError(`"${candidate.name}" exceeds the 5 MB limit.`);
      return;
    }
    setError(null);
    setResult(null);
    setFile(candidate);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyFile(e.target.files?.[0] ?? null);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    applyFile(e.dataTransfer.files[0] ?? null);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => { setIsDragOver(false); };

  const handleProcess = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("resume", file);

    try {
      // Step 1: upload
      const uploadRes = await fetch("/api/v1/resumes/upload", { method: "POST", body: formData });
      if (uploadRes.status === 401) { setError("Session expired — please log in again."); return; }
      const uploadJson = (await uploadRes.json()) as ApiResponse<Resume>;
      if (!uploadRes.ok || !uploadJson.success || !uploadJson.data) {
        setError(uploadJson.error ?? "Failed to upload resume.");
        return;
      }
      const uploaded = uploadJson.data;
      setResult(uploaded);
      const resumeId = uploaded._id;
      if (!resumeId) { setError("Upload succeeded but no resume ID was returned."); return; }
      window.history.replaceState(null, "", `?id=${resumeId}`);

      // Step 2: parse
      setIsUploading(false);
      setIsParsing(true);
      const parseRes = await fetch(`/api/v1/resumes/${resumeId}/parse`, { method: "POST" });
      if (parseRes.status === 401) { setError("Session expired — please log in again."); return; }
      const parseJson = (await parseRes.json()) as ApiResponse<Resume>;
      if (parseRes.ok && parseJson.success && parseJson.data) {
        setResult(parseJson.data);
      } else {
        setError(parseJson.error ?? "Parsing failed.");
        return;
      }

      // Step 3: analyze
      setIsParsing(false);
      setIsAnalyzing(true);
      const analyzeRes = await fetch(`/api/v1/resumes/${resumeId}/analyze`, { method: "POST" });
      if (analyzeRes.status === 401) { setError("Session expired — please log in again."); return; }
      const analyzeJson = (await analyzeRes.json()) as ApiResponse<Resume>;
      if (analyzeRes.ok && analyzeJson.success && analyzeJson.data) {
        setResult(analyzeJson.data);
      } else {
        setError(analyzeJson.error ?? "AI analysis failed.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsUploading(false);
      setIsParsing(false);
      setIsAnalyzing(false);
    }
  };

  const isBusy = isUploading || isParsing || isAnalyzing;

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div
          className="rounded-2xl p-8 flex items-center justify-center gap-3 text-muted"
          style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}
        >
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm font-medium">Loading resume…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto animate-slide-up">
      <div
        className="rounded-2xl p-8"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
        }}
      >
        <div className="flex items-center justify-between mb-7">
          <div>
            <h2 className="font-display text-xl font-bold text-ink">Upload Resume</h2>
            <p className="text-xs text-muted mt-0.5">PDF or DOCX · max 5 MB</p>
          </div>
          {result && (
            <button
              onClick={handleReset}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
              style={{ border: "1px solid var(--border)", color: "var(--body)" }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--body)"; }}
            >
              Upload different
            </button>
          )}
        </div>

        <div className="space-y-5">
          {/* Drop zone */}
          <div
            role="button"
            tabIndex={0}
            aria-label="Drop your resume here or click to browse"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => { fileInputRef.current?.click(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
            className={`upload-zone p-10 text-center ${isDragOver ? "drop-active" : ""}`}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="sr-only"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center gap-4">
              {file ? (
                <>
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center"
                    style={{
                      background: "var(--ok-bg)",
                      border: "1px solid rgba(16,185,129,0.3)",
                    }}
                  >
                    <svg width="20" height="20" fill="none" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M4 10l4 4 8-8" stroke="var(--ok-fg)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-ink">{file.name}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB — click or drop to replace
                    </p>
                  </div>
                </>
              ) : (
                <>
                  {/* Upload icon */}
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)" }}
                  >
                    <svg width="22" height="22" fill="none" viewBox="0 0 22 22" aria-hidden="true">
                      <path
                        d="M11 14V6M11 6L8 9M11 6L14 9"
                        stroke="var(--accent)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M4 17h14"
                        stroke="var(--accent)"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        opacity="0.5"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-body">
                      Drop your resume here or{" "}
                      <span className="text-accent underline underline-offset-2 cursor-pointer">
                        browse
                      </span>
                    </p>
                    <p className="text-xs text-muted mt-1">PDF or DOCX · max 5 MB</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Process steps + button */}
          {file && !result && (
            <div className="space-y-4">
              {isBusy && (
                <div
                  className="rounded-xl px-5 py-4 space-y-3"
                  style={{
                    background: "var(--bg-surface2)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <ProcessingStep label="Extracting text"           active={isUploading} done={!isUploading && (isParsing || isAnalyzing)} />
                  <ProcessingStep label="Parsing profile"           active={isParsing}   done={!isParsing && isAnalyzing} />
                  <ProcessingStep label="Generating AI insights"    active={isAnalyzing} done={false} />
                </div>
              )}

              {!isBusy && (
                <button
                  onClick={() => { void handleProcess(); }}
                  className="w-full px-6 py-3.5 text-sm font-semibold rounded-xl btn-gradient"
                >
                  Analyse Resume
                </button>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="p-3 rounded-xl text-sm"
              role="alert"
              style={{
                background: "var(--err-bg)",
                color: "var(--err-fg)",
                border: "1px solid rgba(239,68,68,0.25)",
              }}
            >
              ⚠ {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="mt-2 space-y-2 animate-fade-in">
              {/* Extraction stats */}
              <div className="flex items-center gap-2 mb-4">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ background: "var(--ok-fg)" }}
                />
                <span className="text-sm font-semibold" style={{ color: "var(--ok-fg)" }}>
                  Extraction complete
                </span>
              </div>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Characters", value: result.charCount.toLocaleString() },
                  { label: "Words",      value: result.wordCount.toLocaleString() },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="p-3 rounded-xl"
                    style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}
                  >
                    <dt className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">{label}</dt>
                    <dd className="text-lg font-bold text-ink tabular-nums">{value}</dd>
                  </div>
                ))}
                <div
                  className="p-3 rounded-xl md:col-span-2"
                  style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}
                >
                  <dt className="text-xs font-semibold text-muted uppercase tracking-wider mb-1">File</dt>
                  <dd className="text-xs font-medium text-body truncate">
                    {result.filename} · {result.fileType.split("/").pop()}
                  </dd>
                </div>
              </dl>

              {result.parsedProfile && <ParsedProfilePanel p={result.parsedProfile} />}
              {result.aiInsights && <AiInsightsPanel insights={result.aiInsights} />}

              {/* Raw text */}
              <div className="border-t pt-4" style={{ borderColor: "var(--border-soft)" }}>
                <details>
                  <summary
                    className="text-sm font-medium text-muted cursor-pointer select-none transition-colors hover:text-body"
                  >
                    View raw extracted text
                  </summary>
                  <div
                    className="mt-4 p-4 rounded-xl text-xs text-muted h-48 overflow-y-auto whitespace-pre-wrap font-mono"
                    style={{ background: "var(--bg-surface2)", border: "1px solid var(--border)" }}
                  >
                    {result.extractedText}
                  </div>
                </details>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
