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
    <h5 className="text-xs font-bold text-muted uppercase tracking-widest mb-3 flex items-center gap-2">
      <span className="flex-1 border-t border-soft" />
      {children}
      <span className="flex-1 border-t border-soft" />
    </h5>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3 items-start py-1.5 border-b border-soft">
      <span className="w-24 shrink-0 text-xs font-semibold text-muted uppercase tracking-wide pt-0.5">
        {label}
      </span>
      <span className="text-sm text-body break-all">{value ?? "—"}</span>
    </div>
  );
}

function SkillPill({ label, className }: { label: string; className?: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${className ?? "border-default bg-surface-2 text-body"}`}>
      {label}
    </span>
  );
}

function SkillGroup({ heading, items, className }: { heading: string; items: string[]; className?: string }) {
  if (items.length === 0) return null;
  const pillClass = className;
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-muted mb-2">{heading}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s, i) => <SkillPill key={i} label={s} {...(pillClass !== undefined ? { className: pillClass } : {})} />)}
      </div>
    </div>
  );
}

function ExperienceCard({ entry, index }: { entry: WorkExperienceEntry; index: number }) {
  return (
    <div className="relative pl-5 before:absolute before:left-0 before:top-1 before:h-full before:border-l-2 before:border-soft">
      <div
        className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full border-2"
        style={{ background: "var(--accent)", borderColor: "var(--bg)" }}
      />
      <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-semibold text-ink">{index + 1}. {entry.jobTitle ?? "Unknown Role"}</span>
        {entry.company && (
          <span className="text-sm font-medium text-accent">— {entry.company}</span>
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
    <div className="p-4 rounded-xl bg-surface-2 border border-default">
      <p className="text-sm font-semibold text-ink mb-1.5">{index + 1}. {entry.title ?? "Untitled Project"}</p>
      {entry.technologies.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {entry.technologies.map((t, i) => (
            <span key={i} className="px-2 py-0.5 rounded text-xs font-medium bg-surface border border-default text-body">{t}</span>
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
    <div className="p-3 rounded-lg bg-surface border border-default">
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

// ─── Parsed profile panel ─────────────────────────────────────────────────────

function ParsedProfilePanel({ p }: { p: ParsedProfile }) {
  const sc = p.skillCategories;

  return (
    <div className="mt-6 rounded-2xl border border-default bg-surface shadow-panel overflow-hidden animate-slide-up">
      {/* Header — extracted fact, warm accent */}
      <div className="px-6 py-5 border-b border-default" style={{ background: "var(--accent-lite)" }}>
        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "var(--accent)" }}>
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
            <InfoRow label="Email" value={p.email} />
            <InfoRow label="Phone" value={p.phone} />
            <InfoRow label="Location" value={p.location} />
          </div>
        </section>

        {/* Summary */}
        {p.professionalSummary && (
          <section>
            <SectionHeading>Summary</SectionHeading>
            <p className="text-sm text-body leading-relaxed">{p.professionalSummary}</p>
          </section>
        )}

        {/* Skills — dictionary-based, unchanged logic */}
        {p.skills.length > 0 && (
          <section>
            <SectionHeading>Skills</SectionHeading>
            <SkillGroup heading="Programming" items={sc.programming} className="bg-blue-50 text-blue-700 border-blue-200" />
            <SkillGroup heading="Databases" items={sc.databases} className="bg-purple-50 text-purple-700 border-purple-200" />
            <SkillGroup heading="Python Libraries" items={sc.pythonLibraries} className="bg-yellow-50 text-yellow-700 border-yellow-200" />
            <SkillGroup heading="BI & Visualization" items={sc.biVisualization} className="bg-orange-50 text-orange-700 border-orange-200" />
            <SkillGroup heading="Analytics" items={sc.analytics} className="bg-teal-50 text-teal-700 border-teal-200" />
            <SkillGroup heading="Tools" items={sc.tools} className="bg-surface-2 text-body border-default" />
            <SkillGroup heading="AI-Assisted Analytics" items={sc.aiAssisted} className="bg-pink-50 text-pink-700 border-pink-200" />
          </section>
        )}

        {/* Experience */}
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

        {/* Projects */}
        {p.projects.length > 0 && (
          <section>
            <SectionHeading>Projects</SectionHeading>
            <div className="space-y-3">
              {p.projects.map((proj, i) => <ProjectCard key={i} entry={proj} index={i} />)}
            </div>
          </section>
        )}

        {/* Education */}
        {p.education.length > 0 && (
          <section>
            <SectionHeading>Education</SectionHeading>
            <div className="space-y-3">
              {p.education.map((edu, i) => <EducationCard key={i} entry={edu} />)}
            </div>
          </section>
        )}

        {/* Achievements */}
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

        {/* Languages */}
        {p.languages.length > 0 && (
          <section>
            <SectionHeading>Languages</SectionHeading>
            <div className="flex flex-wrap gap-2">
              {p.languages.map((l, i) => <SkillPill key={i} label={l} />)}
            </div>
          </section>
        )}

        {/* Certifications */}
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

// ─── AI Insights panel — visually distinct from extracted data ────────────────

function AiInsightsPanel({ insights }: { insights: NonNullable<Resume["aiInsights"]> }) {
  return (
    <div className="mt-6 rounded-2xl overflow-hidden animate-slide-up ai-section">
      <div className="flex items-center gap-2 mb-4">
        <span className="ai-badge">AI Generated</span>
        <p className="text-xs text-muted">Interpretation, not verified fact</p>
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
        <p className="text-xs text-muted">Generated by {insights.model} · {new Date(insights.generatedAt).toLocaleString()}</p>
      </div>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
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

  // Single-action: upload + parse + analyze in one pass
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

  const busyLabel =
    isUploading ? "Uploading…"
    : isParsing ? "Parsing…"
    : isAnalyzing ? "Generating insights…"
    : "";

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="rounded-2xl border border-default bg-surface shadow-panel p-8 flex items-center justify-center gap-3 text-muted">
          <Spinner />
          <span className="text-sm font-medium">Loading resume…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto animate-slide-up">
      <div className="rounded-2xl border border-default bg-surface shadow-panel p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-semibold text-ink">Upload Resume</h2>
          {result && (
            <button onClick={handleReset} className="text-xs text-muted hover:text-accent underline underline-offset-2 transition-colors">
              Upload a different resume
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
            className={[
              "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors select-none",
              isDragOver ? "drop-active" : "border-default hover:border-[var(--accent)]",
            ].join(" ")}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="sr-only"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center gap-3">
              <svg className="w-10 h-10 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {file ? (
                <p className="text-body text-sm font-medium">
                  {file.name}
                  <span className="text-muted font-normal ml-2">— click or drop to replace</span>
                </p>
              ) : (
                <>
                  <p className="text-body text-sm">
                    Drop your resume here or{" "}
                    <span className="text-accent underline underline-offset-2">browse</span>
                  </p>
                  <p className="text-muted text-xs">PDF or DOCX · max 5 MB</p>
                </>
              )}
            </div>
          </div>

          {/* Process button */}
          {file && !isBusy && !result && (
            <button
              onClick={() => { void handleProcess(); }}
              className="w-full px-6 py-3 text-white text-sm font-semibold rounded-xl transition-colors shadow-card"
              style={{ background: "var(--accent)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-h)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent)"; }}
            >
              Analyse Resume
            </button>
          )}

          {/* Progress during processing */}
          {isBusy && (
            <div className="flex items-center justify-center gap-3 py-4 text-body text-sm" role="status">
              <Spinner />
              <span>{busyLabel}</span>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-3 rounded-lg text-sm" role="alert"
              style={{ background: "var(--err-bg)", color: "var(--err-fg)", border: "1px solid var(--err-fg)" }}>
              {error}
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="mt-2 space-y-2 animate-fade-in">
              {/* Extraction stats */}
              <div className="flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--ok-fg)" }} />
                <h3 className="text-sm font-medium" style={{ color: "var(--ok-fg)" }}>Extraction complete</h3>
              </div>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-xl border border-default bg-surface-2">
                  <dt className="text-xs font-medium text-muted uppercase tracking-wider mb-1">Characters</dt>
                  <dd className="text-lg font-semibold text-ink">{result.charCount.toLocaleString()}</dd>
                </div>
                <div className="p-3 rounded-xl border border-default bg-surface-2">
                  <dt className="text-xs font-medium text-muted uppercase tracking-wider mb-1">Words</dt>
                  <dd className="text-lg font-semibold text-ink">{result.wordCount.toLocaleString()}</dd>
                </div>
                <div className="p-3 rounded-xl border border-default bg-surface-2 md:col-span-2">
                  <dt className="text-xs font-medium text-muted uppercase tracking-wider mb-1">File</dt>
                  <dd className="text-xs font-medium text-body truncate">{result.filename} · {result.fileType.split("/").pop()}</dd>
                </div>
              </dl>

              {result.parsedProfile && <ParsedProfilePanel p={result.parsedProfile} />}
              {result.aiInsights && <AiInsightsPanel insights={result.aiInsights} />}

              {/* Raw text */}
              <div className="border-t border-soft pt-4">
                <details>
                  <summary className="text-sm font-medium text-muted cursor-pointer hover:text-body transition-colors select-none">
                    View raw extracted text
                  </summary>
                  <div className="mt-4 p-4 rounded-xl border border-default bg-surface-2 text-xs text-muted h-48 overflow-y-auto whitespace-pre-wrap font-mono">
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
