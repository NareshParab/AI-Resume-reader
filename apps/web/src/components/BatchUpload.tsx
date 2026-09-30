import { useState, useEffect, useRef, useCallback } from "react";
import type { ApiResponse, Resume, Batch } from "@gcarbon/types";

type BatchResponse = Batch & { resumes: Resume[] };

const MAX_FILES = 20;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
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

// ─── Shared score badge ───────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const [color, bg] =
    score >= 7 ? ["var(--ok-fg)", "var(--ok-bg)"]
    : score >= 4 ? ["var(--warn-fg)", "var(--warn-bg)"]
    : ["var(--err-fg)", "var(--err-bg)"];

  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-xs font-bold border"
      style={{ color, background: bg, borderColor: color }}
    >
      {score}/10
    </span>
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

  // ─── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current !== null) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // ─── Resilient polling ─────────────────────────────────────────────────────
  // Network errors increment consecutiveFailures. After 5 in a row we stop.
  // A successful response resets the counter.
  useEffect(() => {
    if (!batchId) return;

    const poll = () => {
      fetch(`/api/v1/batches/${batchId}`)
        .then(async (res) => {
          if (res.status === 401) {
            // Session expired — stop polling, let user know
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
            setConsecutiveFailures(prev => {
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
          // Temporary network failure — don't stop polling yet
          setConsecutiveFailures(prev => {
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

  // ─── File selection helpers ────────────────────────────────────────────────

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

  // ─── Submit ────────────────────────────────────────────────────────────────

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

  // ─── Results view ──────────────────────────────────────────────────────────

  if (batchData !== null && (batchData.status === "completed" || batchData.status === "failed")) {
    const done = batchData;
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-ink">
            Batch Results
          </h2>
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-medium"
              style={{ color: done.status === "completed" ? "var(--ok-fg)" : "var(--err-fg)" }}
            >
              {done.status === "completed" ? "✓" : "⚠"}{" "}
              {done.completedCount}/{done.totalCount} processed
              {done.failedCount > 0 && ` · ${done.failedCount.toString()} failed`}
            </span>
            <button
              onClick={handleReset}
              className="text-xs text-muted hover:text-accent underline underline-offset-2 transition-colors"
            >
              New batch
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 rounded-lg text-sm" role="alert"
            style={{ background: "var(--err-bg)", color: "var(--err-fg)", border: "1px solid var(--err-fg)" }}>
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-default bg-surface shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default" style={{ background: "var(--bg-surface2)" }}>
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
              <tbody className="divide-y divide-[var(--border-soft)]">
                {done.resumes.map((resume, idx) => {
                  const profile = resume.parsedProfile;
                  const score = resume.candidateScore;
                  return (
                    <tr key={resume._id ?? idx} className="transition-colors hover:bg-surface-2">
                      <td className="px-4 py-3 text-center">
                        <span
                          className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold"
                          style={{ background: "var(--bg-surface2)", color: "var(--body)" }}
                        >
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-ink">
                        {profile?.fullName ?? resume.filename}
                        {resume.extractionError && (
                          <span className="ml-2 text-xs" style={{ color: "var(--err-fg)" }}>
                            (extraction failed)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {score ? <ScoreBadge score={score.score} /> : <span className="text-muted text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-body text-xs leading-relaxed max-w-xs">
                        {score?.reasoning ?? <span className="text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3 text-body text-xs">
                        {profile?.totalExperienceYears != null
                          ? `~${profile.totalExperienceYears.toString()} yr`
                          : <span className="text-muted">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {(score?.matchedSkills.slice(0, 5) ?? []).map((skill, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-xs border-default border bg-surface-2 text-body">
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

  // ─── Processing view ───────────────────────────────────────────────────────

  if (batchId) {
    const done = batchData?.completedCount ?? 0;
    const total = batchData?.totalCount ?? files.length;

    return (
      <div className="w-full max-w-4xl mx-auto animate-fade-in">
        <div className="rounded-2xl border border-default bg-surface shadow-panel p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-semibold text-ink">Processing…</h2>
            <button onClick={handleReset} className="text-xs text-muted hover:text-accent underline underline-offset-2">
              Cancel
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-lg text-sm mb-4" role="alert"
              style={{ background: "var(--err-bg)", color: "var(--err-fg)", border: "1px solid var(--err-fg)" }}>
              {error}
            </div>
          )}

          {consecutiveFailures > 0 && !error && (
            <div className="p-3 rounded-lg text-sm mb-4"
              style={{ background: "var(--warn-bg)", color: "var(--warn-fg)" }}>
              Network hiccup — retrying…
            </div>
          )}

          <div className="flex flex-col items-center gap-5 py-6 text-center">
            <svg className="animate-spin w-8 h-8" style={{ color: "var(--accent)" }} fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-body font-medium">
              {done}/{total} resumes complete
            </p>
            {total > 0 && (
              <div className="w-full max-w-xs rounded-full h-1.5 overflow-hidden" style={{ background: "var(--bg-surface2)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((done / total) * 100).toString()}%`, background: "var(--accent)" }}
                />
              </div>
            )}
            <p className="text-muted text-xs max-w-sm">
              AI scoring runs sequentially to stay within free-tier limits. This typically takes 1–2 minutes.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Upload form ───────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-4xl mx-auto animate-slide-up">
      <div className="rounded-2xl border border-default bg-surface shadow-panel p-8">
        <h2 className="font-display text-xl font-semibold text-ink mb-6">Batch Resume Upload</h2>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-5">
          {/* Job description */}
          <div>
            <label htmlFor="batch-job-description" className="block text-sm font-medium text-body mb-1.5">
              Job Description
              <span className="text-muted font-normal ml-1">(min 20 characters)</span>
            </label>
            <textarea
              id="batch-job-description"
              rows={5}
              className="w-full rounded-xl border border-default bg-ledger text-ink text-sm px-4 py-3 placeholder:text-muted focus:outline-none focus:border-[var(--accent)] transition-colors resize-none"
              placeholder="Describe the role, required skills, and experience level…"
              value={jobDescription}
              onChange={(e) => { setJobDescription(e.target.value); }}
            />
          </div>

          {/* Drop zone */}
          <div>
            <p className="block text-sm font-medium text-body mb-1.5">
              Resume Files
              <span className="text-muted font-normal ml-1">(PDF or DOCX · up to {MAX_FILES} files · 5 MB each)</span>
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
              className={[
                "rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors select-none",
                isDragOver ? "drop-active" : "border-default hover:border-[var(--accent)]",
              ].join(" ")}
            >
              {files.length > 0 ? (
                <p className="text-body text-sm font-medium">
                  {files.length} file{files.length !== 1 ? "s" : ""} selected
                  <span className="text-muted font-normal ml-2">— click or drop to replace</span>
                </p>
              ) : (
                <>
                  <p className="text-body text-sm">Drop resumes here or <span className="text-accent underline underline-offset-2">browse</span></p>
                  <p className="text-muted text-xs mt-1">PDF &amp; DOCX only</p>
                </>
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
            <div className="p-3 rounded-lg text-sm" role="alert"
              style={{ background: "var(--err-bg)", color: "var(--err-fg)", border: "1px solid var(--err-fg)" }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            id="batch-submit"
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 text-white text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-card"
            style={{ background: "var(--accent)" }}
            onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.background = "var(--accent-h)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent)"; }}
          >
            {isSubmitting ? "Submitting…" : `Analyse ${files.length > 0 ? files.length.toString() + " resume" + (files.length !== 1 ? "s" : "") : "Batch"}`}
          </button>
        </form>
      </div>
    </div>
  );
}
