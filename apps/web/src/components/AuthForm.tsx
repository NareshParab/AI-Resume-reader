import { useState } from "react";
import type { ApiResponse } from "@gcarbon/types";

type AuthMode = "login" | "signup";
type AuthView = AuthMode | "forgot" | "reset";

interface AuthFormProps {
  onAuthenticated: () => void;
}

function getInitialView(): AuthView {
  const params = new URLSearchParams(window.location.search);
  return params.has("token") ? "reset" : "login";
}

// ─── Shared input style helpers ───────────────────────────────────────────────

function inputStyle(hasError: boolean) {
  return {
    background: "var(--bg)",
    border: `1px solid ${hasError ? "var(--err-fg)" : "var(--border)"}`,
    outline: "none",
    color: "var(--ink)",
  } as React.CSSProperties;
}

function onFocusInput(e: React.FocusEvent<HTMLInputElement>, hasError: boolean) {
  if (!hasError) e.currentTarget.style.borderColor = "var(--accent)";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.12)";
}

function onBlurInput(e: React.FocusEvent<HTMLInputElement>, hasError: boolean) {
  if (!hasError) e.currentTarget.style.borderColor = "var(--border)";
  e.currentTarget.style.boxShadow = "none";
}

const INPUT_CLASS =
  "w-full rounded-xl text-sm px-4 py-3 text-ink placeholder-muted transition-all duration-200";

// ─── Error banner ─────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      className="flex items-start gap-2 p-3 rounded-xl text-sm"
      style={{
        background: "var(--err-bg)",
        color: "var(--err-fg)",
        border: "1px solid rgba(239,68,68,0.25)",
      }}
      role="alert"
    >
      <span className="mt-px shrink-0">⚠</span>
      <span>{message}</span>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ─── Back-to-login link ───────────────────────────────────────────────────────

function BackToLogin({ onClick }: { onClick: () => void }) {
  return (
    <p className="text-xs text-muted mt-5 text-center">
      <button
        type="button"
        onClick={onClick}
        className="underline underline-offset-2 transition-colors hover:text-accent"
        style={{ color: "var(--body)" }}
      >
        ← Back to login
      </button>
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const [view, setView] = useState<AuthView>(getInitialView);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchView = (next: AuthView) => {
    setView(next);
    setError(null);
    setInfo(null);
  };

  // ─── Login / Signup ──────────────────────────────────────────────────────────

  const handleLoginSignup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/v1/auth/${view}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = (await response.json()) as ApiResponse<{ email: string }>;
      if (response.ok && json.success) {
        onAuthenticated();
      } else if (response.status === 401) {
        setError("Incorrect email or password.");
      } else {
        setError(json.error ?? `Failed to ${view === "login" ? "log in" : "sign up"}.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Forgot password ──────────────────────────────────────────────────────────

  const handleForgotPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = (await response.json()) as ApiResponse<never>;
      if (response.ok && json.success) {
        setInfo(json.message ?? "If an account exists for that email, you'll receive a password reset link.");
      } else if (response.status === 429) {
        setError("Too many requests. Please wait 15 minutes before trying again.");
      } else {
        setError(json.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Reset password ───────────────────────────────────────────────────────────

  const handleResetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") ?? "";
    try {
      const response = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const json = (await response.json()) as ApiResponse<never>;
      if (response.ok && json.success) {
        // Strip token from URL so a page refresh doesn't re-show the reset form.
        window.history.replaceState({}, "", window.location.pathname);
        setInfo(json.message ?? "Your password has been reset. You can now log in.");
        setTimeout(() => { switchView("login"); }, 2500);
      } else {
        setError(json.error ?? "Could not reset password. The link may be invalid or expired.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Card wrapper (shared) ────────────────────────────────────────────────────

  const card = (children: React.ReactNode) => (
    <div className="w-full max-w-sm mx-auto">
      <div
        className="rounded-2xl p-8 animate-scale-in"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.45)",
        }}
      >
        {children}
      </div>
    </div>
  );

  // ─── Forgot password view ─────────────────────────────────────────────────────

  if (view === "forgot") {
    return card(
      <>
        <h2 className="font-display text-xl font-bold text-ink mb-2">Forgot password?</h2>
        <p className="text-sm text-muted mb-6">
          Enter your email and we'll send you a reset link if an account exists.
        </p>

        {info ? (
          <>
            <div
              className="p-3 rounded-xl text-sm mb-5"
              style={{
                background: "rgba(34,197,94,0.08)",
                color: "var(--ai-fg)",
                border: "1px solid rgba(34,197,94,0.2)",
              }}
              role="status"
            >
              {info}
            </div>
            <BackToLogin onClick={() => { switchView("login"); }} />
          </>
        ) : (
          <form onSubmit={(e) => { void handleForgotPassword(e); }} className="space-y-4">
            <div>
              <label
                htmlFor="forgot-email"
                className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2"
              >
                Email
              </label>
              <input
                id="forgot-email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className={INPUT_CLASS}
                style={inputStyle(!!error)}
                onFocus={(e) => { onFocusInput(e, !!error); }}
                onBlur={(e) => { onBlurInput(e, !!error); }}
                value={email}
                onChange={(e) => { setEmail(e.target.value); }}
              />
            </div>

            {error && <ErrorBanner message={error} />}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 text-white text-sm font-semibold rounded-xl btn-gradient mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  Sending…
                </span>
              ) : (
                "Send reset link"
              )}
            </button>

            <BackToLogin onClick={() => { switchView("login"); }} />
          </form>
        )}
      </>
    );
  }

  // ─── Reset password view ──────────────────────────────────────────────────────

  if (view === "reset") {
    const params = new URLSearchParams(window.location.search);
    const hasToken = params.has("token");

    return card(
      <>
        <h2 className="font-display text-xl font-bold text-ink mb-6">Set new password</h2>

        {!hasToken ? (
          <>
            <ErrorBanner message="This password reset link is invalid or has expired. Please request a new one." />
            <BackToLogin onClick={() => { switchView("forgot"); }} />
          </>
        ) : info ? (
          <>
            <div
              className="p-3 rounded-xl text-sm mb-5"
              style={{
                background: "rgba(34,197,94,0.08)",
                color: "var(--ai-fg)",
                border: "1px solid rgba(34,197,94,0.2)",
              }}
              role="status"
            >
              {info}
            </div>
            <p className="text-xs text-muted text-center">Redirecting to login…</p>
          </>
        ) : (
          <form onSubmit={(e) => { void handleResetPassword(e); }} className="space-y-4">
            <div>
              <label
                htmlFor="reset-password"
                className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2"
              >
                New password
              </label>
              <input
                id="reset-password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="At least 8 characters"
                className={INPUT_CLASS}
                style={inputStyle(!!error)}
                onFocus={(e) => { onFocusInput(e, !!error); }}
                onBlur={(e) => { onBlurInput(e, !!error); }}
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); }}
              />
            </div>

            {error && <ErrorBanner message={error} />}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-3 text-white text-sm font-semibold rounded-xl btn-gradient mt-2"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner />
                  Resetting…
                </span>
              ) : (
                "Reset password"
              )}
            </button>

            <BackToLogin onClick={() => { switchView("login"); }} />
          </form>
        )}
      </>
    );
  }

  // ─── Login / Signup view ──────────────────────────────────────────────────────

  const mode = view;

  const switchMode = (next: AuthMode) => {
    switchView(next);
    setEmail("");
    setPassword("");
  };

  return card(
    <>
      {/* Mode selector */}
      <div
        role="tablist"
        className="flex gap-1 p-1 rounded-xl w-fit mb-7"
        style={{ background: "var(--bg-surface2)", border: "1px solid var(--border-soft)" }}
      >
        {(["login", "signup"] as AuthMode[]).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => { switchMode(m); }}
            className={[
              "px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-200",
              mode === m ? "text-white shadow-md" : "text-muted hover:text-body",
            ].join(" ")}
            style={
              mode === m
                ? { background: "linear-gradient(135deg, var(--grad-start), var(--grad-end))" }
                : {}
            }
          >
            {m === "login" ? "Log in" : "Sign up"}
          </button>
        ))}
      </div>

      <h2 className="font-display text-xl font-bold text-ink mb-6">
        {mode === "login" ? "Welcome back" : "Create your account"}
      </h2>

      <form onSubmit={(event) => { void handleLoginSignup(event); }} className="space-y-4">
        {/* Email */}
        <div>
          <label
            htmlFor="auth-email"
            className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2"
          >
            Email
          </label>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={INPUT_CLASS}
            style={inputStyle(!!error)}
            onFocus={(e) => { onFocusInput(e, !!error); }}
            onBlur={(e) => { onBlurInput(e, !!error); }}
            value={email}
            onChange={(event) => { setEmail(event.target.value); }}
          />
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              htmlFor="auth-password"
              className="block text-xs font-semibold text-muted uppercase tracking-wider"
            >
              Password
            </label>
            {mode === "login" && (
              <button
                type="button"
                onClick={() => { switchView("forgot"); }}
                className="text-xs transition-colors hover:text-accent"
                style={{ color: "var(--muted)" }}
              >
                Forgot password?
              </button>
            )}
          </div>
          <input
            id="auth-password"
            type="password"
            required
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder={mode === "signup" ? "At least 8 characters" : ""}
            className={INPUT_CLASS}
            style={inputStyle(!!error)}
            onFocus={(e) => { onFocusInput(e, !!error); }}
            onBlur={(e) => { onBlurInput(e, !!error); }}
            value={password}
            onChange={(event) => { setPassword(event.target.value); }}
          />
        </div>

        {error && <ErrorBanner message={error} />}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-6 py-3 text-white text-sm font-semibold rounded-xl btn-gradient mt-2"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner />
              {mode === "login" ? "Signing in…" : "Creating account…"}
            </span>
          ) : (
            mode === "login" ? "Log in" : "Create account"
          )}
        </button>
      </form>

      {/* Switch mode */}
      <p className="text-xs text-muted mt-5 text-center">
        {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => { switchMode(mode === "login" ? "signup" : "login"); }}
          className="underline underline-offset-2 transition-colors hover:text-accent"
          style={{ color: "var(--body)" }}
        >
          {mode === "login" ? "Sign up" : "Log in"}
        </button>
      </p>
    </>
  );
}
