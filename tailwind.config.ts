import type { Config } from "tailwindcss";

// Ember & Paper — docs/design/00-LEAD-ENGINE-FOUNDATIONS.md
// Colours resolve through the CSS variables in app/globals.css so light and
// dark are one class name, not two. Never reference a primitive here.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    // The scale is deliberate, not a doubling sequence — real layouts need the
    // awkward middle values. Tailwind's default spacing is replaced, not extended.
    spacing: {
      0: "0px",
      1: "2px",
      2: "4px",
      3: "8px",
      4: "12px",
      5: "16px",
      6: "20px",
      7: "24px",
      8: "32px",
      9: "40px",
      10: "56px",
      11: "72px",
      12: "96px",
    },
    screens: {
      sm: "600px",
      md: "900px",
      lg: "1200px",
      xl: "1440px",
    },
    // Flat, so classes read `bg-canvas` / `text-primary` / `border-rule`
    // rather than doubling the prefix.
    colors: {
      transparent: "transparent",
      current: "currentColor",

      canvas: "var(--bg-canvas)",
      surface: "var(--bg-surface)",
      sunk: "var(--bg-sunk)",
      hovered: "var(--bg-hover)",
      selected: "var(--bg-selected)",

      primary: "var(--text-primary)",
      secondary: "var(--text-secondary)",
      muted: "var(--text-muted)",
      faint: "var(--text-faint)",
      "on-accent": "var(--text-on-accent)",

      rule: {
        DEFAULT: "var(--rule-default)",
        soft: "var(--rule-soft)",
        strong: "var(--rule-strong)",
      },
      accent: {
        DEFAULT: "var(--accent-base)",
        hover: "var(--accent-hover)",
        tint: "var(--accent-tint)",
      },
      go: { DEFAULT: "var(--status-go)", tint: "var(--status-go-tint)" },
      hold: { DEFAULT: "var(--status-hold)", tint: "var(--status-hold-tint)" },
      stop: { DEFAULT: "var(--status-stop)", tint: "var(--status-stop-tint)" },
    },
    // Radius is by role. Never apply one radius everywhere.
    borderRadius: {
      none: "0",
      xs: "3px",
      sm: "5px",
      md: "8px",
      lg: "12px",
      xl: "20px",
      full: "999px",
    },
    // Three levels, not five. Depth is mostly the job of hairline rules.
    boxShadow: {
      none: "none",
      raised: "var(--elev-raised)",
      overlay: "var(--elev-overlay)",
    },
    fontFamily: {
      display: ["Fraunces", "Georgia", "Times New Roman", "serif"],
      sans: ["Instrument Sans", "Helvetica Neue", "Arial", "sans-serif"],
      mono: ["JetBrains Mono", "ui-monospace", "Menlo", "monospace"],
    },
    // Line-height falls as size rises. Never one value across the scale.
    fontSize: {
      "display-xl": ["44px", { lineHeight: "1.02", letterSpacing: "-0.022em", fontWeight: "700" }],
      "display-lg": ["32px", { lineHeight: "1.08", letterSpacing: "-0.018em", fontWeight: "700" }],
      "heading-lg": ["24px", { lineHeight: "1.22", letterSpacing: "-0.012em", fontWeight: "600" }],
      "heading-md": ["19px", { lineHeight: "1.3", letterSpacing: "-0.008em", fontWeight: "600" }],
      subhead: ["16px", { lineHeight: "1.4", fontWeight: "600" }],
      "body-lg": ["16px", { lineHeight: "1.62", fontWeight: "400" }],
      body: ["14.5px", { lineHeight: "1.6", fontWeight: "400" }],
      "body-sm": ["13px", { lineHeight: "1.55", letterSpacing: "0.004em", fontWeight: "400" }],
      label: ["11px", { lineHeight: "1.25", letterSpacing: "0.09em", fontWeight: "600" }],
      "data-lg": ["22px", { lineHeight: "1.1", letterSpacing: "-0.01em", fontWeight: "700" }],
      data: ["13.5px", { lineHeight: "1.3", fontWeight: "500" }],
      "data-sm": ["11.5px", { lineHeight: "1.3", letterSpacing: "0.01em", fontWeight: "400" }],
      caption: ["12px", { lineHeight: "1.45", letterSpacing: "0.006em", fontWeight: "400" }],
    },
    extend: {
      // Content caps at 1240; reading columns cap at 68ch regardless of container.
      maxWidth: { content: "1240px", prose: "68ch" },
      borderWidth: { hairline: "1px" },
    },
  },
  plugins: [],
};

export default config;
