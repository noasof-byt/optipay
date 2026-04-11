import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── OptiPay Brand Palette (matched to logo) ───────────────────────────
      // Logo colors:
      //   Navy  (#1D3480) → "Opti" text + cart outline
      //   Sky   (#29ABE2) → "Pay" text + cards + arrow
      colors: {
        brand: {
          // Navy blue scale — primary brand (logo "Opti" + cart)
          50:  "#EEF0F9",
          100: "#D5DAEF",
          200: "#ABB5E0",
          300: "#7B8FD0",
          400: "#4D6ABF",
          500: "#2B4FAD",
          600: "#1D3A8C",
          700: "#1D3480",   // ← exact logo navy
          800: "#152669",
          900: "#0E1A4D",
          950: "#07102E",
          DEFAULT: "#1D3480",
        },
        sky: {
          // Sky blue scale — secondary brand (logo "Pay" + arrow + cards)
          50:  "#E8F6FD",
          100: "#C5E8F9",
          200: "#8DD0F3",
          300: "#55B9EC",
          400: "#29ABE2",   // ← exact logo sky blue
          500: "#1A8EC4",
          600: "#1475A3",
          700: "#0F5C82",
          800: "#0A4361",
          900: "#052A3D",
          DEFAULT: "#29ABE2",
        },
        accent: {
          // Greens (savings indicator)
          50:  "#ECFDF5",
          100: "#D1FAE5",
          200: "#A7F3D0",
          300: "#6EE7B7",
          400: "#34D399",
          500: "#059669",
          600: "#047857",
          700: "#065F46",
          800: "#064E3B",
          900: "#022C22",
          DEFAULT: "#059669",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted:   "#F4F7FD",
          border:  "#DDE4F0",
        },
        ink: {
          DEFAULT: "#111827",
          muted:   "#6B7280",
          faint:   "#9CA3AF",
        },
        danger: {
          DEFAULT: "#EF4444",
          light:   "#FEE2E2",
        },
        warning: {
          DEFAULT: "#F59E0B",
          light:   "#FEF3C7",
        },
        success: {
          DEFAULT: "#059669",
          light:   "#D1FAE5",
        },
      },
      // ── Typography — Hebrew-first ─────────────────────────────────────────
      fontFamily: {
        sans: [
          "Rubik",
          "Assistant",
          "Heebo",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        "2xs": ["0.65rem", { lineHeight: "1rem" }],
      },
      // ── Spacing — mobile-first safe areas ────────────────────────────────
      spacing: {
        "safe-bottom": "env(safe-area-inset-bottom)",
        "safe-top":    "env(safe-area-inset-top)",
        "nav":         "4.5rem",
      },
      // ── Border Radius — rounded native-app feel ───────────────────────────
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      // ── Shadows (navy-tinted) ─────────────────────────────────────────────
      boxShadow: {
        card:   "0 2px 12px 0 rgba(29, 52, 128, 0.08)",
        float:  "0 8px 32px 0 rgba(29, 52, 128, 0.18)",
        nav:    "0 -2px 16px 0 rgba(17, 24, 39, 0.08)",
        sky:    "0 4px 16px 0 rgba(41, 171, 226, 0.25)",
      },
      // ── Animations ────────────────────────────────────────────────────────
      keyframes: {
        "slide-up": {
          "0%":   { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)",    opacity: "1" },
        },
        "fade-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "pulse-green": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(5, 150, 105, 0.4)" },
          "50%":       { boxShadow: "0 0 0 8px rgba(5, 150, 105, 0)" },
        },
        "pulse-sky": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(41, 171, 226, 0.4)" },
          "50%":       { boxShadow: "0 0 0 8px rgba(41, 171, 226, 0)" },
        },
      },
      animation: {
        "slide-up":    "slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in":     "fade-in 0.2s ease-out",
        "pulse-green": "pulse-green 2s infinite",
        "pulse-sky":   "pulse-sky 2s infinite",
      },
    },
  },
  plugins: [],
};

export default config;
