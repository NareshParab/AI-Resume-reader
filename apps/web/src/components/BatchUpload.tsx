import { useState, useEffect, useRef } from "react";
import type { ApiResponse, Resume, Batch } from "@gcarbon/types";

// ─── Types ────────────────────────────────────────────────────────────────────

type BatchResponse = Batch & { resumes: Resume[] };

// ─── BatchUpload ──────────────────────────────────────────────────────────────

export function BatchUpload() {
  const [jobDescription, setJobDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [batchData, setBatchData] = useState<BatchResponse | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Cleanup poll on unmount ───────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // ─── Start polling when batchId is set ────────────────────────────────────
  useEffect(() => {
    if (!batchId) return;

    const poll = () => {
      fetch(`/api/v1/batches/${batchId}`)
        .then(async (res) => {
          const json = (await res.json()) as ApiResponse<BatchResponse>;
          if (res.ok && json.success && json.data) {
            setBatchData(json.data);
            if (json.data.status === "completed") {
              if (pollIntervalRef.current !== null) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
            }
          } else {
            setError(json.error ?? "Failed to fetch batch status.");
            if (pollIntervalRef.current !== null) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
          }
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : "Poll request failed.");
          if (pollIntervalRef.current !== null) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        });
    };

    // Immediate first fetch, then every 3s
    poll();
    pollIntervalRef.current = setInterval(poll, 3000);

    return () => {
      if (pollIntervalRef.current !== null) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [batchId]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length > 20) {
      setError("You may upload a maximum of 20 files at once.");
      // Reset input so user can re-select
      if (fileInputRef.current) fileInputRef.current.value = "";
      setFiles([]);
      return;
    }
    setError(null);
    setFiles(selected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (files.length === 0) {
      setError("Please select at least one file.");
      return;
    }
    if (files.length > 20) {
      setError("You may upload a maximum of 20 files at once.");
      return;
    }
    if (jobDescription.trim().length < 20) {
      setError("Job description must be at least 20 characters.");
      return;
    }

    setIsSubmitting(true);
    const formData = new FormData();
    formData.append("jobDescription", jobDescription.trim());
    for (const file of files) {
      formData.append("resumes", file);
    }

    try {
      const res = await fetch("/api/v1/batches", {
        method: "POST",
        body: formData,
      });
      const json = (await res.json()) as ApiResponse<{ batchId: string; totalCount: number }>;
      if (res.ok && json.success && json.data) {
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
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Render: results table ─────────────────────────────────────────────────
  if (batchData?.status === "completed") {
    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">
            Batch Results
            <span className="ml-3 text-sm font-normal text-green-400">
              ● Completed — {batchData.completedCount}/{batchData.totalCount} processed
              {batchData.failedCount > 0 && (
                <span className="text-red-400 ml-2">({batchData.failedCount} failed)</span>
              )}
            </span>
          </h2>
          <button
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors"
          >
            New batch
          </button>
        </div>

        {error && (
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 bg-slate-900/60">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-12">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-16">Score</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Reasoning</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider w-24">Exp (yrs)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Matched Skills (AI)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {batchData.resumes.map((resume, idx) => {
                const profile = resume.parsedProfile;
                const score = resume.candidateScore;
                return (
                  <tr key={resume._id ?? idx} className="hover:bg-slate-700/20 transition-colors">
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-700 text-slate-300 text-xs font-bold">
                        {idx + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {resume._id ? (
                        <a
                          href={`/?id=${resume._id}`}
                          className="text-brand-400 hover:text-brand-300 font-medium underline underline-offset-2 transition-colors"
                        >
                          {profile?.fullName ?? resume.filename}
                        </a>
                      ) : (
                        <span className="text-slate-200 font-medium">
                          {profile?.fullName ?? resume.filename}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {score ? (
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                          score.score >= 7
                            ? "bg-green-500/15 text-green-400 border border-green-500/30"
                            : score.score >= 4
                            ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
                            : "bg-red-500/15 text-red-400 border border-red-500/30"
                        }`}>
                          {score.score}/10
                        </span>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs leading-relaxed max-w-xs">
                      {score?.reasoning ?? <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-xs">
                      {profile?.totalExperienceYears != null
                        ? `~${profile.totalExperienceYears.toString()}`
                        : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(score?.matchedSkills.slice(0, 5) ?? []).map((skill, i) => (
                          <span
                            key={i}
                            className="px-1.5 py-0.5 rounded text-xs bg-slate-700 text-slate-300 border border-slate-600"
                          >
                            {skill}
                          </span>
                        ))}
                        {!score?.matchedSkills.length && (
                          <span className="text-slate-600 text-xs">—</span>
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
    );
  }

  // ─── Render: polling / processing ─────────────────────────────────────────
  if (batchId) {
    return (
      <div className="w-full max-w-4xl mx-auto">
        <div className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm p-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white">Batch Processing</h2>
            <button
              onClick={handleReset}
              className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors"
            >
              Cancel / New batch
            </button>
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          <div className="flex flex-col items-center gap-4 py-6">
            <svg className="animate-spin w-8 h-8 text-brand-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-slate-300 font-medium">
              {batchData
                ? `Processing… ${batchData.completedCount.toString()} / ${batchData.totalCount.toString()} complete`
                : "Submitting batch…"}
            </p>
            <p className="text-slate-500 text-xs">This takes 1-2 minutes — we deliberately pace requests to stay reliable on the free AI tier.</p>
            <p className="text-slate-500 text-xs">AI scoring is running sequentially. This may take a minute.</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render: upload form ───────────────────────────────────────────────────
  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm p-8">
        <h2 className="text-xl font-semibold text-white mb-6">Batch Resume Upload</h2>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-6">
          {/* Job description */}
          <div>
            <label
              htmlFor="batch-job-description"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Job Description
              <span className="text-slate-500 font-normal ml-1">(min 20 characters)</span>
            </label>
            <textarea
              id="batch-job-description"
              rows={5}
              className="w-full rounded-xl bg-slate-900 border border-slate-600 text-slate-200 text-sm px-4 py-3 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors resize-none"
              placeholder="Describe the role, required skills, and experience level…"
              value={jobDescription}
              onChange={(e) => { setJobDescription(e.target.value); }}
            />
          </div>

          {/* File input */}
          <div>
            <label
              htmlFor="batch-files"
              className="block text-sm font-medium text-slate-300 mb-2"
            >
              Resume Files
              <span className="text-slate-500 font-normal ml-1">(PDF or DOCX, max 20 files, 5MB each)</span>
            </label>
            <input
              id="batch-files"
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="block w-full text-sm text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-600 file:text-white hover:file:bg-brand-500 file:transition-colors file:cursor-pointer cursor-pointer"
              onChange={handleFileChange}
            />
            {files.length > 0 && (
              <p className="mt-2 text-xs text-slate-400">
                {files.length} file{files.length !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {/* Error banner — matches ResumeUpload.tsx styling exactly */}
          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            id="batch-submit"
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand-500/20"
          >
            {isSubmitting ? "Submitting…" : "Submit Batch"}
          </button>
        </form>
      </div>
    </div>
  );
}
