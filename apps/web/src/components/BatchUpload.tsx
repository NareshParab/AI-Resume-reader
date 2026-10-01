import { useState, useEffect, useRef, useCallback } from "react";
import type { ApiResponse, Resume, Batch } from "@gcarbon/types";

type BatchResponse = Batch & { resumes: Resume[] };

const MAX_FILES = 20;
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

function validateFiles(candidates: File[]): string | null {
  if (candidates.length === 0) return "Please select at least one file.";
  if (candidates.length > MAX_FILES) return `You may upload at most ${MAX_FILES.toString()} files.`;
  for (const f of candidates) {
    if (!ALLOWED_TYPES.has(f.type)) return `"${f.name}" is not a PDF or DOCX file.`;
    if (f.size > MAX_FILE_SIZE) return `"${f.name}" exceeds the 5 MB limit.`;
  }
  return null;
}

// ─── Score badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const [color, bg] =
    score >= 7 ? ["var(--ok-fg)",   "var(--ok-bg)"]
    : score >= 4 ? ["var(--warn-fg)", "var(--warn-bg)"]
    : ["var(--err-fg)", "var(--err-bg)"];

  return (
    <span
      className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-lg text-xs font-bold tabular-nums"
      style={{ color, background: bg, border: `1px solid ${color}` }}
    >
      {score}/10
    </span>
  );
}

// ─── Upload icon ──────────────────────────────────────────────────────────────

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="rgba(99,102,241,0.1)" />
      <path
        d="M20 26V18M20 18L17 21M20 18L23 21"
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 28h12"
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
}

// ─── BatchUpload ──────────────────────────────────────────────────────────────

export function BatchUpload() {
  const [jobDescription, setJobDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchData, setBatchData] = useState<BatchResponse | null>(null);
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current !== null) clearInterval(pollIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (!batchId) return;

    const poll = () => {
      fetch(`/api/v1/batches/${batchId}`)
        .then(async (res) => {
          if (res.status === 401) {
            if (pollIntervalRef.current !== null) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setError("Your session expired. Please refresh and log in again.");
            return;
          }
          const json = (await res.json()) as ApiResponse<BatchResponse>;
          if (res.ok && json.success && json.data) {
            setConsecutiveFailures(0);
            setBatchData(json.data);
            if (json.data.status === "completed" || json.data.status === "failed") {
              if (pollIntervalRef.current !== null) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
            }
          } else {
            setConsecutiveFailures((prev) => {
              const next = prev + 1;
              if (next >= 5) {
                if (pollIntervalRef.current !== null) {
                  clearInterval(pollIntervalRef.current);
                  pollIntervalRef.current = null;
                }
                setError("Lost contact with the server after several attempts. Please refresh.");
              }
              return next;
            });
          }
        })
        .catch(() => {
          setConsecutiveFailures((prev) => {
            const next = prev + 1;
            if (next >= 5) {
              if (pollIntervalRef.current !== null) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              setError("Lost contact with the server after several attempts. Please refresh.");
            }
            return next;
          });
        });
    };

    poll();
    pollIntervalRef.current = setInterval(poll, 3000);

    return () => {
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [batchId]);

  const applyFiles = useCallback((candidates: File[]) => {
    const validationError = validateFiles(candidates);
    if (validationError) {
      setError(validationError);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setError(null);
    setFiles(candidates);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyFiles(Array.from(e.target.files ?? []));
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    applyFiles(Array.from(e.dataTransfer.files));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => { setIsDragOver(false); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validateFiles(files);
    if (validationError) { setError(validationError); return; }
    if (jobDescription.trim().length < 20) {
      setError("Job description must be at least 20 characters.");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("jobDescription", jobDescription.trim());
    for (const file of files) formData.append("resumes", file);

    try {
      const res = await fetch("/api/v1/batches", { method: "POST", body: formData });
      const json = (await res.json()) as ApiResponse<{ batchId: string; totalCount: number }>;
      if (res.ok && json.success && json.data) {
        setConsecutiveFailures(0);
        setBatchId(json.data.batchId);
      } else {
        setError(json.error ?? "Failed to create batch.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setBatchId(null);
    setBatchData(null);
    setFiles([]);
    setJobDescription("");
    setError(null);
    setConsecutiveFailures(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Results view ────────────────────────────────────────────────────────────

  if (batchData !== null && (batchData.status === "completed" || batchData.status === "failed")) {
    const done = batchData;
    const isSuccess = done.status === "completed";

    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{
                background: isSuccess ? "var(--ok-bg)" : "var(--err-bg)",
                color: isSuccess ? "var(--ok-fg)" : "var(--err-fg)",
                border: `1px solid ${isSuccess ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
              }}
            >
              {isSuccess ? "✓" : "⚠"}
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">Batch Results</h2>
              <p className="text-xs text-muted">
                {done.completedCount}/{done.totalCount} processed
                {done.failedCount > 0 && ` · ${done.failedCount.toString()} failed`}
              </p>
            </div>
          </div>
          <button
            onClick={handleReset}
            className="text-xs font-medium px-4 py-2 rounded-lg transition-colors"
            style={{ border: "1px solid var(--border)", color: "var(--body)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.color = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--body)"; }}
          >
            + New batch
          </button>
        </div>

        {error && (
          <div
            className="p-3 rounded-xl text-sm"
            role="alert"
            style={{ background: "var(--err-bg)", color: "var(--err-fg)", border: "1px solid rgba(239,68,68,0.25)" }}
          >
            {error}
          </div>
        )}

        {/* Results table */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="border-b"
                  style={{ background: "var(--bg-surface2)", borderColor: "var(--border)" }}
                >
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider w-10">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Candidate</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider w-16">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">Reasoning</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider w-20">Exp.</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted uppercase tracking-wider">
                    Matched Skills
                    <span className="ai-badge ml-2">AI</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {done.resumes.map((resume, idx) => {
                  const profile = resume.parsedProfile;
                  const score = resume.candidateScore;
                  return (
                    <tr
                      key={resume._id ?? idx}
                      className="border-b transition-colors"
                      style={{ borderColor: "var(--border-soft)" }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface2)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                          style={{ background: "var(--bg-surface2)", color: "var(--muted)" }}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-ink">
                        {profile?.fullName ?? resume.filename}
                        {resume.extractionError && (
                          <span className="ml-2 text-xs font-normal" style={{ color: "var(--err-fg)" }}>
                            (extraction failed)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {score ? <ScoreBadge score={score.score} /> : <span className="text-muted text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs leading-relaxed max-w-xs" style={{ color: "var(--body)" }}>
                        {score?.reasoning ?? <span className="text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums" style={{ color: "var(--body)" }}>
                        {profile?.totalExperienceYears != null
                          ? `~${profile.totalExperienceYears.toString()}yr`
                          : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(score?.matchedSkills.slice(0, 5) ?? []).map((skill, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.5 rounded text-xs"
                              style={{
                                background: "rgba(99,102,241,0.08)",
                                color: "var(--accent-h)",
                                border: "1px solid rgba(99,102,241,0.2)",
                              }}
                            >
                              {skill}
                            </span>
                          ))}
                          {!score?.matchedSkills.length && (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ─── Processing view ──────────────────────────────────────────────────────────

  if (batchId) {
    const processed = (batchData?.completedCount ?? 0) + (batchData?.failedCount ?? 0);
    const total = batchData?.totalCount ?? files.length;
    const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
    const failedCount = batchData?.failedCount ?? 0;

    return (
      <div className="w-full max-w-4xl mx-auto animate-fade-in">
        <div
          className="rounded-2xl p-8"
          style={{
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
          }}
        >
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              {/* Animated AI orb */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{
                  background: "rgba(34,211,238,0.08)",
                  border: "1px solid rgba(34,211,238,0.25)",
                  boxShadow: "0 0 20px rgba(34,211,238,0.1)",
                  animation: "pulseDot 1.8s ease-in-out infinite",
                }}
              >
                <svg width="16" height="16" fill="none" viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.5" stroke="var(--ai-fg)" strokeWidth="1.3" />
                  <path d="M5.5 8l2 2 3-3.5" stroke="var(--ai-fg)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-ink">AI Processing…</h2>
                <p className="text-xs text-muted">
                  {processed}/{total} processed{failedCount > 0 ? ` · ${failedCount.toString()} failed` : ""}
                </p>
              </div>
            </div>
            <button
              onClick={handleReset}
              className="text-xs text-muted hover:text-accent transition-colors"
            >
              Cancel
            </button>
          </div>

          {error && (
            <div
              className="p-3 rounded-xl text-sm mb-5"
              role="alert"
              style={{ background: "var(--err-bg)", color: "var(--err-fg)", border: "1px solid rgba(239,68,68,0.25)" }}
            >
              {error}
            </div>
          )}

          {consecutiveFailures > 0 && !error && (
            <div
              className="p-3 rounded-xl text-sm mb-5"
              style={{ background: "var(--warn-bg)", color: "var(--warn-fg)", border: "1px solid rgba(245,158,11,0.25)" }}
            >
              Network hiccup — retrying…
            </div>
          )}

          {/* Progress */}
          <div className="space-y-3">
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ background: "var(--bg-surface2)", height: "3px" }}
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${pct.toString()}%`,
                  background: "linear-gradient(90deg, var(--grad-start), var(--grad-end))",
                  boxShadow: "0 0 8px rgba(99,102,241,0.6)",
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <span>AI scoring candidates…</span>
              <span className="tabular-nums font-medium" style={{ color: "var(--accent)" }}>{pct}%</span>
            </div>
          </div>

          <p className="text-xs text-muted mt-5 text-center">
            Runs sequentially to stay within free-tier limits. Typically 1–2 min per resume.
          </p>
        </div>
      </div>
    );
  }

  // ─── Upload form ──────────────────────────────────────────────────────────────

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
        <div className="mb-7">
          <h2 className="font-display text-xl font-bold text-ink">Batch Resume Upload</h2>
          <p className="text-xs text-muted mt-1">Upload up to {MAX_FILES} resumes and rank them against a job description.</p>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">

          {/* Job description */}
          <div>
            <label
              htmlFor="batch-job-description"
              className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2"
            >
              Job Description
              <span className="normal-case font-normal ml-2 text-muted/70">(min 20 chars)</span>
            </label>
            <textarea
              id="batch-job-description"
              rows={5}
              className="w-full rounded-xl text-sm px-4 py-3 resize-none transition-all duration-200"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--ink)",
                outline: "none",
              }}
              placeholder="Describe the role, required skills, and experience level…"
              value={jobDescription}
              onChange={(e) => { setJobDescription(e.target.value); }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Drop zone */}
          <div>
            <p className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2">
              Resume Files
              <span className="normal-case font-normal ml-2 text-muted/70">
                (PDF or DOCX · up to {MAX_FILES} files · 5 MB each)
              </span>
            </p>
            <div
              role="button"
              tabIndex={0}
              aria-label="Drop resumes here or click to browse"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => { fileInputRef.current?.click(); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
              className={`upload-zone p-8 text-center ${isDragOver ? "drop-active" : ""}`}
            >
              {files.length > 0 ? (
                <div className="flex flex-col items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: "var(--ok-bg)", border: "1px solid rgba(16,185,129,0.3)" }}
                  >
                    <svg width="18" height="18" fill="none" viewBox="0 0 18 18" aria-hidden="true">
                      <path d="M5 9l3 3 5-5.5" stroke="var(--ok-fg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-ink">
                    {files.length} file{files.length !== 1 ? "s" : ""} selected
                  </p>
                  <p className="text-xs text-muted">Click or drop to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <UploadIcon className="w-10 h-10" />
                  <div>
                    <p className="text-sm font-medium text-body">
                      Drop resumes here or{" "}
                      <span className="text-accent underline underline-offset-2 cursor-pointer">browse files</span>
                    </p>
                    <p className="text-xs text-muted mt-1">PDF &amp; DOCX only</p>
                  </div>
                </div>
              )}
            </div>
            <input
              id="batch-files"
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={handleFileChange}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              className="p-3 rounded-xl text-sm"
              role="alert"
              style={{ background: "var(--err-bg)", color: "var(--err-fg)", border: "1px solid rgba(239,68,68,0.25)" }}
            >
              ⚠ {error}
            </div>
          )}

          {/* Submit */}
          <button
            id="batch-submit"
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3.5 text-sm font-semibold rounded-xl btn-gradient"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Submitting…
              </span>
            ) : (
              files.length > 0
                ? `Analyse ${files.length.toString()} resume${files.length !== 1 ? "s" : ""}`
                : "Analyse Batch"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
