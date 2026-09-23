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
      } else {
        setError(json.error ?? `Failed to ${mode === "login" ? "log in" : "sign up"}.`);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMode = () => {
    setMode((currentMode) => currentMode === "login" ? "signup" : "login");
    setError(null);
  };

  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="rounded-2xl border border-slate-700 bg-slate-800/50 backdrop-blur-sm p-8">
        <div className="flex gap-2 p-1 rounded-xl bg-slate-800 border border-slate-700 w-fit mb-6">
          <button
            type="button"
            onClick={() => { setMode("login"); setError(null); }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "login"
                ? "bg-brand-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => { setMode("signup"); setError(null); }}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "signup"
                ? "bg-brand-600 text-white shadow"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Sign up
          </button>
        </div>

        <h2 className="text-xl font-semibold text-white mb-6">
          {mode === "login" ? "Log in to Resume AI" : "Create your account"}
        </h2>

        <form onSubmit={(event) => { void handleSubmit(event); }} className="space-y-6">
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium text-slate-300 mb-2">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-xl bg-slate-900 border border-slate-600 text-slate-200 text-sm px-4 py-3 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              value={email}
              onChange={(event) => { setEmail(event.target.value); }}
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-sm font-medium text-slate-300 mb-2">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="w-full rounded-xl bg-slate-900 border border-slate-600 text-slate-200 text-sm px-4 py-3 placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              value={password}
              onChange={(event) => { setPassword(event.target.value); }}
            />
          </div>

          {error && (
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-brand-500/20"
          >
            {isSubmitting ? "Submitting..." : mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>

        <button
          type="button"
          onClick={toggleMode}
          className="text-xs text-slate-400 hover:text-slate-200 underline underline-offset-2 transition-colors mt-5"
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </div>
    </div>
  );
}
