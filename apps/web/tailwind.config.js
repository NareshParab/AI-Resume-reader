/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        ledger: {
          bg:            "#080B14",
          surface:       "#0F1629",
          "surface-2":   "#1A2540",
          border:        "rgba(255,255,255,0.07)",
          muted:         "#4B5680",
          ink:           "#F1F5F9",
          body:          "#94A3B8",
          accent:        "#6366F1",
          "accent-hover":"#818CF8",
          "accent-light":"rgba(99,102,241,0.1)",
          ai:            "#22D3EE",
          "ai-bg":       "rgba(34,211,238,0.06)",
          "ai-border":   "rgba(34,211,238,0.2)",
          success:       "#10B981",
          "success-bg":  "rgba(16,185,129,0.08)",
          danger:        "#F87171",
          "danger-bg":   "rgba(239,68,68,0.08)",
        },
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to:   { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(18px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.96)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        orbDrift: {
          from: { transform: "translateX(-50%) translateY(0) scale(1)",    opacity: "1"    },
          to:   { transform: "translateX(-50%) translateY(28px) scale(1.1)", opacity: "0.8" },
        },
        gradientShift: {
          "0%,100%": { backgroundPosition: "0% 50%" },
          "50%":     { backgroundPosition: "100% 50%" },
        },
        pulseDot: {
          "0%,100%": { opacity: "1" },
          "50%":     { opacity: "0.35" },
        },
      },
      animation: {
        "fade-in":    "fadeIn 0.35s ease-out both",
        "slide-up":   "slideUp 0.45s ease-out both",
        "slide-up-1": "slideUp 0.45s 0.1s ease-out both",
        "slide-up-2": "slideUp 0.45s 0.2s ease-out both",
        "slide-up-3": "slideUp 0.45s 0.32s ease-out both",
        "scale-in":   "scaleIn 0.25s ease-out both",
        "shimmer":    "shimmer 1.6s linear infinite",
        "orb-drift":  "orbDrift 10s ease-in-out infinite alternate",
        "pulse-dot":  "pulseDot 2s cubic-bezier(0.4,0,0.6,1) infinite",
        "gradient":   "gradientShift 5s ease infinite",
      },
      boxShadow: {
        card:  "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.25)",
        panel: "0 4px 24px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset",
        lift:  "0 8px 40px rgba(0,0,0,0.6)",
        glow:  "0 0 40px rgba(99,102,241,0.15), 0 4px 24px rgba(0,0,0,0.5)",
        "glow-sm": "0 0 20px rgba(99,102,241,0.2)",
        "glow-ai": "0 0 30px rgba(34,211,238,0.12)",
      },
    },
  },
  plugins: [],
};
