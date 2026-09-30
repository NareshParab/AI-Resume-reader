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
        className="rounded-2xl border border-default bg-surface shadow-panel p-8 animate-scale-in"
      >
        {/* Mode selector */}
        <div
          role="tablist"
          className="flex gap-1 p-1 rounded-xl bg-surface-2 border border-soft w-fit mb-6"
        >
          {(["login", "signup"] as AuthMode[]).map((m) => (
            <button
              key={m}
              role="tab"
              type="button"
              aria-selected={mode === m}
              onClick={() => { switchMode(m); }}
              className={[
                "px-5 py-2 rounded-lg text-sm font-medium transition-colors",
                mode === m ? "text-white shadow" : "text-muted hover:text-body",
              ].join(" ")}
              style={mode === m ? { background: "var(--accent)" } : {}}
            >
              {m === "login" ? "Log in" : "Sign up"}
            </button>
          ))}
        </div>

        <h2 className="font-display text-xl font-semibold text-ink mb-6">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h2>

        <form onSubmit={(event) => { void handleSubmit(event); }} className="space-y-4">
          {/* Email */}
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium text-body mb-1.5">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@example.com"
              className={[
                "w-full rounded-xl border text-sm px-4 py-3",
                "bg-ledger placeholder:text-muted text-ink",
                "focus:outline-none transition-colors",
                error ? "border-[var(--err-fg)]" : "border-default focus:border-[var(--accent)]",
              ].join(" ")}
              value={email}
              onChange={(event) => { setEmail(event.target.value); }}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium text-body mb-1.5">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "signup" ? "At least 8 characters" : ""}
              className={[
                "w-full rounded-xl border text-sm px-4 py-3",
                "bg-ledger placeholder:text-muted text-ink",
                "focus:outline-none transition-colors",
                error ? "border-[var(--err-fg)]" : "border-default focus:border-[var(--accent)]",
              ].join(" ")}
              value={password}
              onChange={(event) => { setPassword(event.target.value); }}
            />
          </div>

          {/* Error */}
          {error && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg text-sm"
              style={{ background: "var(--err-bg)", color: "var(--err-fg)", border: "1px solid var(--err-fg)" }}
              role="alert"
            >
              <span className="mt-px">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 text-white text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-card mt-2"
            style={{ background: "var(--accent)", opacity: isSubmitting ? 0.7 : 1 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-h)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "var(--accent)"; }}
          >
            {isSubmitting ? "Signing in…" : mode === "login" ? "Log in" : "Create account"}
          </button>
        </form>

        {/* Switch mode */}
        <p className="text-xs text-muted mt-5">
          {mode === "login" ? "No account yet?" : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() => { switchMode(mode === "login" ? "signup" : "login"); }}
            className="underline underline-offset-2 hover:text-accent transition-colors"
          >
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>
      </div>
    </div>
  );
}
