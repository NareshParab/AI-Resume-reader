import { useState, useEffect } from "react";

import { APP_NAME, APP_VERSION } from "@gcarbon/config";
import { ResumeUpload } from "./components/ResumeUpload";
import { BatchUpload } from "./components/BatchUpload";
import { AuthForm } from "./components/AuthForm";

// ─── Tab toggle ───────────────────────────────────────────────────────────────

type Tab = "single" | "batch";

function TabToggle() {
  const [activeTab, setActiveTab] = useState<Tab>("single");

  return (
    <div className="space-y-8">
      <div
        role="tablist"
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
        }}
      >
        {(["single", "batch"] as Tab[]).map((tab) => (
          <button
            key={tab}
            role="tab"
            type="button"
            aria-selected={activeTab === tab}
            id={tab === "single" ? "tab-single-resume" : "tab-batch-upload"}
            onClick={() => { setActiveTab(tab); }}
            className={[
              "px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
              activeTab === tab
                ? "text-white shadow-md"
                : "text-muted hover:text-body",
            ].join(" ")}
            style={
              activeTab === tab
                ? { background: "linear-gradient(135deg, var(--grad-start), var(--grad-end))" }
                : {}
            }
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
      .catch(() => { setIsAuthenticated(false); })
      .finally(() => { setIsCheckingAuth(false); });
  };

  useEffect(() => { checkAuth(); }, []);

  const handleLogout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    setIsAuthenticated(false);
  };

  if (isCheckingAuth) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg)" }}
      >
        <div className="flex items-center gap-3 text-sm text-muted">
          <span className="w-4 h-4 rounded-full skeleton" />
          Checking session…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>

      {/* ── Navigation ──────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-20 border-b"
        style={{
          background: "rgba(8, 11, 20, 0.75)",
          borderColor: "var(--border)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0"
              style={{ background: "linear-gradient(135deg, var(--grad-start), var(--grad-end))" }}
            >
              G
            </div>
            <span className="font-display font-semibold text-ink tracking-tight text-sm leading-none">
              {APP_NAME}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-xs font-mono text-muted">
              v{APP_VERSION}
            </span>
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => { void handleLogout(); }}
                className="text-xs text-muted hover:text-accent transition-colors px-3 py-1.5 rounded-lg"
                style={{ border: "1px solid var(--border)" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-10 flex flex-col gap-12">

        {/* Hero */}
        <header className="relative text-center py-14 sm:py-20 overflow-hidden rounded-2xl">
          {/* Background orb */}
          <div className="hero-orb" aria-hidden="true" />
          {/* Grid pattern */}
          <div className="hero-grid" aria-hidden="true" />

          <div className="relative z-10 flex flex-col items-center gap-6 animate-fade-in">

            {/* Eyebrow label */}
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-widest"
              style={{
                color: "var(--accent)",
                background: "rgba(99, 102, 241, 0.08)",
                border: "1px solid rgba(99, 102, 241, 0.22)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse-dot"
                style={{ background: "var(--accent)" }}
              />
              AI-Powered Candidate Screening
            </div>

            {/* Headline */}
            <div className="space-y-0">
              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-ink leading-none">
                Resume
              </h1>
              <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-none gradient-text">
                Intelligence
              </h1>
            </div>

            {/* Subheading */}
            <p className="text-body text-base sm:text-lg max-w-sm mx-auto leading-relaxed animate-slide-up-1">
              Upload resumes, describe the role — AI ranks every candidate against what actually matters.
            </p>

            {/* Flow indicators */}
            <div
              className="flex items-center gap-2 sm:gap-4 text-xs font-medium animate-slide-up-2"
              style={{ color: "var(--muted)" }}
            >
              <span className="flex items-center gap-1.5" style={{ color: "var(--body)" }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <rect x="1.5" y="2" width="10" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M3.5 5.5h6M3.5 8h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                Upload
              </span>
              <span aria-hidden="true" style={{ opacity: 0.35 }}>→</span>
              <span className="flex items-center gap-1.5" style={{ color: "var(--ai-fg)" }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M4.5 6.5L6 8l3-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                AI Analysis
              </span>
              <span aria-hidden="true" style={{ opacity: 0.35 }}>→</span>
              <span className="flex items-center gap-1.5" style={{ color: "var(--ok-fg)" }}>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M4 6.5l2 2L9 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Candidate Score
              </span>
            </div>
          </div>
        </header>

        {/* Auth / Upload */}
        {!isAuthenticated ? (
          <div className="animate-slide-up-3">
            <AuthForm onAuthenticated={checkAuth} />
          </div>
        ) : (
          <div
            className="w-full border-t animate-slide-up"
            style={{ borderColor: "var(--border)", paddingTop: "2.5rem" }}
          >
            <TabToggle />
          </div>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer
        className="border-t py-5 text-center text-xs text-muted"
        style={{ borderColor: "var(--border)" }}
      >
        Gcarbon Resume AI — AI-powered candidate screening
      </footer>
    </div>
  );
}
