import { useState } from "react";
import type { ApiResponse } from "@gcarbon/types";

type AuthMode = "login" | "signup";

interface AuthFormProps {
  onAuthenticated: () => void;
}

export function AuthForm({ onAuthenticated }: AuthFormProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/v1/auth/${mode}`, {
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
        setError(json.error ?? `Failed to ${mode === "login" ? "log in" : "sign up"}.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError(null);
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div
        className="rounded-2xl p-8 animate-scale-in"
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          boxShadow: "0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 32px rgba(0,0,0,0.45)",
        }}
      >
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

        <form onSubmit={(event) => { void handleSubmit(event); }} className="space-y-4">
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
              className="w-full rounded-xl text-sm px-4 py-3 text-ink placeholder-muted transition-all duration-200"
              style={{
                background: "var(--bg)",
                border: `1px solid ${error ? "var(--err-fg)" : "var(--border)"}`,
                outline: "none",
                color: "var(--ink)",
              }}
              onFocus={(e) => {
                if (!error) e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.12)";
              }}
              onBlur={(e) => {
                if (!error) e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
              value={email}
              onChange={(event) => { setEmail(event.target.value); }}
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="auth-password"
              className="block text-xs font-semibold text-muted uppercase tracking-wider mb-2"
            >
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "signup" ? "At least 8 characters" : ""}
              className="w-full rounded-xl text-sm px-4 py-3 text-ink placeholder-muted transition-all duration-200"
              style={{
                background: "var(--bg)",
                border: `1px solid ${error ? "var(--err-fg)" : "var(--border)"}`,
                outline: "none",
                color: "var(--ink)",
              }}
              onFocus={(e) => {
                if (!error) e.currentTarget.style.borderColor = "var(--accent)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.12)";
              }}
              onBlur={(e) => {
                if (!error) e.currentTarget.style.borderColor = "var(--border)";
                e.currentTarget.style.boxShadow = "none";
              }}
              value={password}
              onChange={(event) => { setPassword(event.target.value); }}
            />
          </div>

          {/* Error */}
          {error && (
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
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 text-white text-sm font-semibold rounded-xl btn-gradient mt-2"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
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
      </div>
    </div>
  );
}
