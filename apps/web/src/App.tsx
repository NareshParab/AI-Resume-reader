import { useState, useEffect } from "react";
import type { HealthStatus, ApiResponse } from "@gcarbon/types";
import { APP_NAME, APP_VERSION } from "@gcarbon/config";
import { ResumeUpload } from "./components/ResumeUpload";

type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };

function useHealthCheck() {
  const [state, setState] = useState<FetchState<HealthStatus>>({
    status: "idle",
  });

  useEffect(() => {
    setState({ status: "loading" });

    fetch("/api/v1/health")
      .then(async (res) => {
        const json = (await res.json()) as ApiResponse<HealthStatus>;
        if (json.data) {
          // Display health data whether the overall status is ok, degraded, or down.
          // The backend sets success:false only when the DB is down, but the
          // structured data payload is still valid and should be rendered.
          setState({ status: "success", data: json.data });
        } else {
          setState({ status: "error", message: json.error ?? "Unknown error" });
        }
      })
      .catch((err: unknown) => {
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Network error",
        });
      });
  }, []);

  return state;
}

// ─── Status indicator ─────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: HealthStatus["status"] }) {
  const map = {
    ok: { label: "Operational", color: "bg-brand-500", dot: "animate-pulse" },
    degraded: { label: "Degraded", color: "bg-yellow-500", dot: "" },
    down: { label: "Down", color: "bg-red-500", dot: "" },
  } as const;

  const { label, color, dot } = map[status];

  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-sm font-medium">
      <span className={`w-2 h-2 rounded-full ${color} ${dot}`} />
      {label}
    </span>
  );
}

// ─── Health card ──────────────────────────────────────────────────────────────

function HealthCard() {
  const state = useHealthCheck();

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm p-6 w-full max-w-sm">
      <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-4">
        API Health
      </h2>

      {state.status === "loading" && (
        <div className="flex items-center gap-3 text-slate-400">
          <svg
            className="animate-spin h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v8H4z"
            />
          </svg>
          <span className="text-sm">Checking…</span>
        </div>
      )}

      {state.status === "error" && (
        <div className="text-red-400 text-sm">
          <span className="font-medium">Error: </span>
          {state.message}
        </div>
      )}

      {state.status === "success" && (
        <div className="space-y-3">
          <StatusBadge status={state.data.status} />
          <dl className="grid grid-cols-2 gap-2 text-sm mt-3">
            <dt className="text-slate-400">Version</dt>
            <dd className="text-slate-100 font-mono">{state.data.version}</dd>
            <dt className="text-slate-400">Uptime</dt>
            <dd className="text-slate-100 font-mono">
              {state.data.uptime}s
            </dd>
            <dt className="text-slate-400">Time</dt>
            <dd className="text-slate-100 font-mono text-xs">
              {new Date(state.data.timestamp).toLocaleTimeString()}
            </dd>
          </dl>
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-10 px-4 py-16 bg-slate-900">
      {/* Hero */}
      <header className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-brand-500/40 bg-brand-500/10 text-brand-400 text-xs font-semibold tracking-widest uppercase mb-2">
          <span>v{APP_VERSION}</span>
          <span className="w-1 h-1 rounded-full bg-brand-400" />
          <span>Monorepo Ready</span>
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-white">
          {APP_NAME}
        </h1>

        <p className="text-slate-400 text-lg max-w-md">
          AI-powered resume analysis. Clean monorepo. Ready to build.
        </p>
      </header>

      {/* Stack badges */}
      <div className="flex flex-wrap justify-center gap-2">
        {["React 18", "Vite", "TypeScript", "Express", "MongoDB", "Tailwind CSS"].map(
          (tag) => (
            <span
              key={tag}
              className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium"
            >
              {tag}
            </span>
          )
        )}
      </div>

      {/* Health check */}
      <HealthCard />

      {/* Resume Upload Module */}
      <div className="w-full max-w-4xl pt-8 border-t border-slate-800">
        <ResumeUpload />
      </div>

      {/* Footer */}
      <footer className="text-slate-600 text-xs mt-8">
        Frontend →{" "}
        <span className="font-mono text-slate-500">:5173</span> &nbsp;·&nbsp;
        API →{" "}
        <span className="font-mono text-slate-500">:4000</span>
      </footer>
    </div>
  );
}
