import { useState, useRef, useEffect } from "react";
import type {
  Resume,
  ApiResponse,
  ParsedProfile,
  WorkExperienceEntry,
  EducationEntry,
  ProjectEntry,
} from "@gcarbon/types";

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h5 className="text-xs font-bold text-brand-400 uppercase tracking-widest mb-3 flex items-center gap-2">
      <span className="flex-1 border-t border-slate-700/60" />
      {children}
      <span className="flex-1 border-t border-slate-700/60" />
    </h5>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-3 items-start py-1.5 border-b border-slate-800">
      <span className="w-24 shrink-0 text-xs font-semibold text-slate-500 uppercase tracking-wide pt-0.5">
        {label}
      </span>
      <span className="text-sm text-slate-200 break-all">{value ?? "—"}</span>
    </div>
  );
}

function SkillPill({ label, color }: { label: string; color: string }) {
  return (
    <span className={`px-2.5 py-1 rounded-md text-xs font-medium border ${color}`}>
      {label}
    </span>
  );
}

function SkillGroup({
  heading,
  items,
  color,
}: {
  heading: string;
  items: string[];
  color: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-400 mb-2">{heading}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((s, i) => (
          <SkillPill key={i} label={s} color={color} />
        ))}
      </div>
    </div>
  );
}

function ExperienceCard({ entry, index }: { entry: WorkExperienceEntry; index: number }) {
  return (
    <div className="relative pl-5 before:absolute before:left-0 before:top-1 before:h-full before:border-l-2 before:border-slate-700">
      <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-brand-500 border-2 border-slate-900" />
      <div className="mb-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span className="text-sm font-semibold text-white">
          {index + 1}. {entry.jobTitle ?? "Unknown Role"}
        </span>
        {entry.company && (
          <span className="text-sm text-brand-400 font-medium">— {entry.company}</span>
        )}
      </div>
      {(entry.startDate ?? entry.endDate ?? entry.duration) && (
        <p className="text-xs text-slate-400 mb-2">
          {[entry.startDate, entry.endDate].filter(Boolean).join(" – ")}
          {entry.duration ? ` · ${entry.duration}` : ""}
        </p>
      )}
      {entry.responsibilities.length > 0 && (
        <ul className="space-y-1">
          {entry.responsibilities.map((r, i) => (
            <li key={i} className="text-xs text-slate-300 flex gap-2">
              <span className="text-brand-500 shrink-0">▸</span>
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
    <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
      <p className="text-sm font-semibold text-white mb-1.5">
        {index + 1}. {entry.title ?? "Untitled Project"}
      </p>
      {entry.technologies.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {entry.technologies.map((t, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded text-xs font-medium bg-slate-700 text-slate-300 border border-slate-600"
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {entry.description && (
        <p className="text-xs text-slate-400 leading-relaxed">{entry.description}</p>
      )}
    </div>
  );
}

function EducationCard({ entry }: { entry: EducationEntry }) {
  return (
    <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700/50">
      <p className="text-sm font-semibold text-white">{entry.degree ?? "Unknown Degree"}</p>
      {entry.field && (
        <p className="text-xs text-brand-400 font-medium mt-0.5">
          Specialization: {entry.field}
        </p>
      )}
      {entry.institution && (
        <p className="text-xs text-slate-400 mt-0.5">{entry.institution}</p>
      )}
      {(entry.startYear ?? entry.endYear) && (
        <p className="text-xs text-slate-500 mt-1">
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
    <div className="mt-8 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
      {/* Header banner */}
      <div className="bg-gradient-to-r from-brand-600/30 to-brand-500/10 px-6 py-5 border-b border-slate-700">
        <p className="text-xs font-bold text-brand-400 uppercase tracking-widest mb-1">
          Structured Candidate Profile
        </p>
        <p className="text-2xl font-bold text-white tracking-tight">
          {p.fullName ?? "Unknown Candidate"}
        </p>
      </div>

      <div className="p-6 space-y-8">

        {/* ── Contact ── */}
        <section>
          <SectionHeading>Contact</SectionHeading>
          <div className="space-y-0.5">
            <InfoRow label="Email"    value={p.email} />
            <InfoRow label="Phone"    value={p.phone} />
            <InfoRow label="Location" value={p.location} />
          </div>
        </section>

        {/* ── Summary ── */}
        {p.professionalSummary && (
          <section>
            <SectionHeading>Summary</SectionHeading>
            <p className="text-sm text-slate-300 leading-relaxed">{p.professionalSummary}</p>
          </section>
        )}

        {/* ── Skills ── */}
        {p.skills.length > 0 && (
          <section>
            <SectionHeading>Skills</SectionHeading>
            <SkillGroup heading="Programming" items={sc.programming} color="bg-blue-500/10 text-blue-300 border-blue-500/20" />
            <SkillGroup heading="Databases" items={sc.databases} color="bg-purple-500/10 text-purple-300 border-purple-500/20" />
            <SkillGroup heading="Python Libraries" items={sc.pythonLibraries} color="bg-yellow-500/10 text-yellow-300 border-yellow-500/20" />
            <SkillGroup heading="BI &amp; Visualization" items={sc.biVisualization} color="bg-orange-500/10 text-orange-300 border-orange-500/20" />
            <SkillGroup heading="Analytics" items={sc.analytics} color="bg-teal-500/10 text-teal-300 border-teal-500/20" />
            <SkillGroup heading="Tools" items={sc.tools} color="bg-green-500/10 text-green-300 border-green-500/20" />
            <SkillGroup heading="AI-Assisted Analytics" items={sc.aiAssisted} color="bg-pink-500/10 text-pink-300 border-pink-500/20" />
          </section>
        )}

        {/* ── Experience ── */}
        {p.workExperience.length > 0 && (
          <section>
            <SectionHeading>Experience</SectionHeading>
            {p.totalExperienceYears !== null && (
              <p className="text-xs text-slate-400 mb-4">
                Total: ~{p.totalExperienceYears} year{p.totalExperienceYears !== 1 ? "s" : ""}
              </p>
            )}
            <div className="space-y-6">
              {p.workExperience.map((e, i) => (
                <ExperienceCard key={i} entry={e} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* ── Projects ── */}
        {p.projects.length > 0 && (
          <section>
            <SectionHeading>Projects</SectionHeading>
            <div className="space-y-3">
              {p.projects.map((proj, i) => (
                <ProjectCard key={i} entry={proj} index={i} />
              ))}
            </div>
          </section>
        )}

        {/* ── Education ── */}
        {p.education.length > 0 && (
          <section>
            <SectionHeading>Education</SectionHeading>
            <div className="space-y-3">
              {p.education.map((edu, i) => (
                <EducationCard key={i} entry={edu} />
              ))}
            </div>
          </section>
        )}

        {/* ── Achievements ── */}
        {p.achievements.length > 0 && (
          <section>
            <SectionHeading>Achievements</SectionHeading>
            <ul className="space-y-2">
              {p.achievements.map((a, i) => (
                <li key={i} className="flex gap-2 text-sm text-slate-300">
                  <span className="text-brand-500 shrink-0 font-bold">{i + 1}.</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ── Languages ── */}
        {p.languages.length > 0 && (
          <section>
            <SectionHeading>Languages</SectionHeading>
            <div className="flex flex-wrap gap-2">
              {p.languages.map((l, i) => (
                <SkillPill key={i} label={l} color="bg-slate-700 text-slate-300 border-slate-600" />
              ))}
            </div>
          </section>
        )}

        {/* ── Certifications ── */}
        {p.certifications.length > 0 && (
          <section>
            <SectionHeading>Certifications</SectionHeading>
            <ul className="space-y-1">
              {p.certifications.map((c, i) => (
                <li key={i} className="text-sm text-slate-300 flex gap-2">
                  <span className="text-brand-500">✓</span> {c}
                </li>
              ))}
            </ul>
          </section>
        )}

      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ResumeUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Resume | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // On mount, check for ?id= in the URL and load that resume.
  useEffect(() => {
    const idParam = new URLSearchParams(window.location.search).get("id");
    if (!idParam) return;
    setIsLoading(true);
    setError(null);
    fetch(`/api/v1/resumes/${idParam}`)
      .then(async (response) => {
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
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const handleReset = () => {
    setResult(null);
    setFile(null);
    setError(null);
    window.history.replaceState(null, "", window.location.pathname);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setError(null);
    setResult(null);
    const formData = new FormData();
    formData.append("resume", file);
    try {
      const response = await fetch("/api/v1/resumes/upload", {
        method: "POST",
        body: formData,
      });
      const json = (await response.json()) as ApiResponse<Resume>;
      if (response.ok && json.success && json.data) {
        setResult(json.data);
        if (json.data._id) {
          window.history.replaceState(null, "", `?id=${json.data._id}`);
        }
      } else {
        setError(json.error ?? "Failed to upload resume.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleParse = async () => {
    if (!result?._id) return;
    setIsParsing(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/resumes/${result._id}/parse`,
        { method: "POST" }
      );
      const json = (await response.json()) as ApiResponse<Resume>;
      if (response.ok && json.success && json.data) {
        setResult(json.data);
        if (json.data._id) {
          window.history.replaceState(null, "", `?id=${json.data._id}`);
        }
      } else {
        setError(json.error ?? "Failed to parse resume.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred during parsing."
      );
    } finally {
      setIsParsing(false);
    }
  };

  const handleAnalyze = async () => {
    if (!result?._id) return;
    setIsAnalyzing(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/v1/resumes/${result._id}/analyze`,
        { method: "POST" }
      );
      const json = (await response.json()) as ApiResponse<Resume>;
      if (response.ok && json.success && json.data) {
        setResult(json.data);
        if (json.data._id) {
          window.history.replaceState(null, "", `?id=${json.data._id}`);
        }
      } else {
        setError(json.error ?? "Failed to analyze resume.");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred during analysis."
      );
    } finally {
      setIsAnalyzing(false);
    }
  };

  // While loading a resume from a URL ?id= param, show a spinner.
  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm p-8 flex items-center justify-center gap-3 text-slate-400">
          <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm font-medium">Loading resume…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* Upload zone */}
      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Upload Resume</h2>
          {result && (
            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors"
            >
              Upload a different resume
            </button>
          )}
        </div>

        <div className="space-y-6">
          <div
            className="border-2 border-dashed border-slate-600 rounded-xl p-8 text-center hover:border-brand-500 hover:bg-slate-700/30 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
            />
            <div className="flex flex-col items-center gap-3">
              <svg className="w-10 h-10 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <div className="text-slate-300">
                <span className="font-semibold text-brand-400">Click to upload</span> or drag and drop
              </div>
              <p className="text-xs text-slate-500">PDF or DOCX (MAX. 5MB)</p>
            </div>
          </div>

          {file && (
            <div className="flex items-center justify-between p-4 rounded-lg bg-slate-900 border border-slate-700">
              <div className="flex items-center gap-3 overflow-hidden">
                <svg className="w-6 h-6 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm font-medium text-slate-200 truncate">{file.name}</span>
              </div>
              <button
                onClick={() => { void handleUpload(); }}
                disabled={isUploading}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUploading ? "Uploading..." : "Process Resume"}
              </button>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {result && (
            <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Extraction stats */}
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <h3 className="text-sm font-medium text-green-400">Extraction Complete</h3>
              </div>
              <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700">
                  <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Characters</dt>
                  <dd className="text-lg font-semibold text-slate-100">{result.charCount.toLocaleString()}</dd>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700">
                  <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">Words</dt>
                  <dd className="text-lg font-semibold text-slate-100">{result.wordCount.toLocaleString()}</dd>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-700 md:col-span-2">
                  <dt className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-1">File</dt>
                  <dd className="text-xs font-medium text-slate-300 truncate">{result.filename} · {result.fileType.split("/").pop()}</dd>
                </div>
              </dl>

              {/* Actions & Results */}
              <div className="flex justify-center gap-4 pt-2 mb-4">
                {!result.parsedProfile ? (
                  <button
                    onClick={() => { void handleParse(); }}
                    disabled={isParsing}
                    className="px-8 py-3 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-brand-500/20 flex items-center gap-2"
                  >
                    {isParsing ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Analyzing Profile…
                      </>
                    ) : (
                      "Parse Resume"
                    )}
                  </button>
                ) : !result.aiInsights ? (
                  <button
                    onClick={() => { void handleAnalyze(); }}
                    disabled={isAnalyzing}
                    className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl disabled:opacity-50 transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2"
                  >
                    {isAnalyzing ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                        Generating Insights…
                      </>
                    ) : (
                      "Generate AI Insights"
                    )}
                  </button>
                ) : null}
              </div>

              {result.parsedProfile && (
                <ParsedProfilePanel p={result.parsedProfile} />
              )}
              {result.aiInsights && (
                <div className="mt-8 rounded-2xl bg-slate-900 border border-purple-500/30 shadow-2xl shadow-purple-500/10 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                  <div className="bg-gradient-to-r from-purple-900/40 to-purple-800/20 px-6 py-5 border-b border-purple-500/30">
                    <p className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-1">
                      AI Insights
                    </p>
                    <p className="text-sm text-slate-400">
                      AI-generated interpretation, not extracted fact.
                    </p>
                  </div>
                  <div className="p-6 space-y-6">
                    <section>
                      <SectionHeading>Summary</SectionHeading>
                      <p className="text-sm text-slate-300 leading-relaxed">{result.aiInsights.summary}</p>
                    </section>
                    {result.aiInsights.strengths.length > 0 && (
                      <section>
                        <SectionHeading>Strengths</SectionHeading>
                        <ul className="space-y-2">
                          {result.aiInsights.strengths.map((s, i) => (
                            <li key={i} className="flex gap-2 text-sm text-slate-300">
                              <span className="text-green-500 shrink-0 font-bold">✓</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                    {result.aiInsights.improvementSuggestions.length > 0 && (
                      <section>
                        <SectionHeading>Areas for Improvement</SectionHeading>
                        <ul className="space-y-2">
                          {result.aiInsights.improvementSuggestions.map((s, i) => (
                            <li key={i} className="flex gap-2 text-sm text-slate-300">
                              <span className="text-orange-500 shrink-0 font-bold">↑</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    )}
                  </div>
                </div>
              )}

              {/* Raw text collapsible */}
              <div className="border-t border-slate-700/50 pt-4">
                <details className="group">
                  <summary className="text-sm font-medium text-slate-400 cursor-pointer hover:text-slate-200 transition-colors select-none">
                    View Raw Extracted Text
                  </summary>
                  <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-400 h-48 overflow-y-auto whitespace-pre-wrap font-mono">
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
