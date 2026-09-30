import { useState, useEffect } from "react";
import type { HealthStatus, ApiResponse } from "@gcarbon/types";
import { APP_NAME, APP_VERSION } from "@gcarbon/config";
import { ResumeUpload } from "./components/ResumeUpload";
import { BatchUpload } from "./components/BatchUpload";
import { AuthForm } from "./components/AuthForm";

type FetchState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T }
  | { status: "error"; message: string };

function useHealthCheck() {
  const [state, setState] = useState<FetchState<HealthStatus>>({ status: "idle" });

  useEffect(() => {
    setState({ status: "loading" });

    fetch("/api/v1/health")
      .then(async (res) => {
        const json = (await res.json()) as ApiResponse<HealthStatus>;
        if (json.data) {
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

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: HealthStatus["status"] }) {
  const map = {
    ok:       { label: "Operational", dot: "bg-[var(--ok-fg)] animate-pulse" },
    degraded: { label: "Degraded",    dot: "bg-[var(--warn-fg)]" },
    down:     { label: "Down",        dot: "bg-[var(--err-fg)]" },
  } as const;

  const { label, dot } = map[status];

  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface border border-default text-sm font-medium text-ink">
      <span className={`w-2 h-2 rounded-full ${dot}`} />
      {label}
    </span>
  );
}

// ─── Health card ──────────────────────────────────────────────────────────────

function HealthCard() {
  const state = useHealthCheck();

  return (
    <div className="rounded-2xl border border-default bg-surface shadow-card p-5 w-full max-w-xs animate-slide-up">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-4">
        API Status
      </p>

      {state.status === "loading" && (
        <div className="space-y-2">
          <div className="skeleton h-5 w-28" />
          <div className="skeleton h-4 w-40 mt-2" />
        </div>
      )}

      {state.status === "error" && (
        <p className="text-sm" style={{ color: "var(--err-fg)" }}>
          {state.message}
        </p>
      )}

      {state.status === "success" && (
        <div className="space-y-3">
          <StatusBadge status={state.data.status} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-1">
            <dt className="text-muted">Version</dt>
            <dd className="font-mono text-ink">{state.data.version}</dd>
            <dt className="text-muted">Uptime</dt>
            <dd className="font-mono text-ink">{state.data.uptime}s</dd>
            <dt className="text-muted">Database</dt>
            <dd className="font-mono text-ink">{state.data.services.database.status}</dd>
          </dl>
        </div>
      )}
    </div>
  );
}

// ─── Tab toggle ───────────────────────────────────────────────────────────────

type Tab = "single" | "batch";

function TabToggle() {
  const [activeTab, setActiveTab] = useState<Tab>("single");

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        className="flex gap-1 p-1 rounded-xl bg-surface border border-default w-fit"
      >
        {(["single", "batch"] as Tab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            id={tab === "single" ? "tab-single-resume" : "tab-batch-upload"}
            onClick={() => { setActiveTab(tab); }}
            className={[
              "px-5 py-2 rounded-lg text-sm font-medium transition-colors",
              activeTab === tab
                ? "text-white shadow"
                : "text-muted hover:text-body",
            ].join(" ")}
            style={activeTab === tab ? { background: "var(--accent)" } : {}}
          >
            {tab === "single" ? "Single Resume" : "Batch Upload"}
          </button>
        ))}
      </div>

      {activeTab === "single" ? <ResumeUpload /> : <BatchUpload />}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = () => {
    setIsCheckingAuth(true);
    fetch("/api/v1/auth/me")
      .then((response) => {
        if (response.status === 401) {
          setIsAuthenticated(false);
        } else {
          setIsAuthenticated(response.ok);
        }
      })
      .catch(() => {
        setIsAuthenticated(false);
      })
      .finally(() => {
        setIsCheckingAuth(false);
      });
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const handleLogout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    setIsAuthenticated(false);
  };

  if (isCheckingAuth) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)", color: "var(--muted)" }}
      >
        <div className="flex items-center gap-3 text-sm">
          <span className="w-4 h-4 rounded-full skeleton" />
          Checking session…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      {/* ── Navigation bar ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-20 border-b border-default bg-surface/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-display font-semibold text-ink tracking-tight">
            {APP_NAME}
          </span>
          <div className="flex items-center gap-4">
            <span className="text-xs text-muted font-mono">v{APP_VERSION}</span>
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => { void handleLogout(); }}
                className="text-xs text-muted hover:text-accent underline underline-offset-2 transition-colors"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-10 flex flex-col gap-10">
        {/* Hero */}
        <header className="text-center space-y-3 animate-fade-in">
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-ink tracking-tight">
            Resume Intelligence
          </h1>
          <p className="text-body text-lg max-w-md mx-auto">
            Upload resumes, describe the role, and let the AI rank every candidate
            against what actually matters.
          </p>
        </header>

        {/* Health card */}
        <div className="flex justify-center">
          <HealthCard />
        </div>

        {/* Auth / app area */}
        {!isAuthenticated ? (
          <div className="animate-slide-up">
            <AuthForm onAuthenticated={checkAuth} />
          </div>
        ) : (
          <div className="w-full border-t border-soft pt-8 animate-slide-up">
            <TabToggle />
          </div>
        )}
      </main>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="border-t border-default py-5 text-center text-xs text-muted">
        Gcarbon Resume AI — AI-powered candidate screening
      </footer>
    </div>
  );
}
