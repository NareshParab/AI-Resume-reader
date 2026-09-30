/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // ── Ledger design system ──────────────────────────────────────────────
      fontFamily: {
        display: ['"Plus Jakarta Sans"', "system-ui", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // Warm parchment light mode
        ledger: {
          bg: "#FAF7F2",          // warm off-white
          surface: "#F3EFE8",     // card surface
          "surface-2": "#EDE8DF", // nested surfaces
          border: "#D8D0C4",      // warm divider
          muted: "#9E9488",       // subdued text
          ink: "#1C1917",         // stone-950 heading ink
          body: "#44403C",        // stone-700 body
          // Accent: warm amber-orange
          accent: "#C2621A",      // primary CTA
          "accent-hover": "#A85116",
          "accent-light": "#FFF1E5", // soft accent bg
          // AI-content distinction — cooler indigo tint
          ai: "#3730A3",          // indigo-800
          "ai-bg": "#EEF2FF",     // indigo-50
          "ai-border": "#C7D2FE", // indigo-200
          // Success / error
          success: "#15803D",
          "success-bg": "#F0FDF4",
          danger: "#B91C1C",
          "danger-bg": "#FEF2F2",
        },
        // Dark mode overrides declared in index.css via CSS vars
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        scaleIn: {
          from: { opacity: "0", transform: "scale(0.96)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-in":  "fadeIn 0.25s ease-out both",
        "slide-up": "slideUp 0.3s ease-out both",
        "shimmer":  "shimmer 1.6s linear infinite",
        "scale-in": "scaleIn 0.2s ease-out both",
      },
      boxShadow: {
        card:  "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
        panel: "0 4px 12px rgba(0,0,0,0.08)",
        lift:  "0 8px 24px rgba(0,0,0,0.12)",
      },
    },
  },
  plugins: [],
};
