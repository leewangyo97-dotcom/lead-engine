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
      // Deliberately stops here. Figma's scale runs 0,4,8,12,16,24,32,40,48,64,
      // 80,128,160 while ours interleaves 2px and 20px, so the indices do not
      // line up. Adding the missing large steps as 13-17 was tried and reverted:
      // `h-14` had been resolving to Tailwind's default 56px, and defining key
      // 14 silently made the topbar 64px. Sizes above 96px use arbitrary values.
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
      // xs has no Figma counterpart: it is the pill radius for chips, which the
      // design draws at 3px inside components rather than as a scale step.
      xs: "4px",
      sm: "6px",
      md: "8px",
      lg: "12px",
      xl: "16px",
      full: "999px",
    },
    // Three levels, not five. Depth is mostly the job of hairline rules.
    boxShadow: {
      none: "none",
      raised: "var(--elev-raised)",
      overlay: "var(--elev-overlay)",
    },
    fontFamily: {
      // One family for every word, per the Pivora direction (globals.css).
      display: ["Geist", "Helvetica Neue", "Arial", "sans-serif"],
      sans: ["Geist", "Helvetica Neue", "Arial", "sans-serif"],
      mono: ["Geist Mono", "ui-monospace", "Menlo", "monospace"],
    },
    // Line-height falls as size rises. Never one value across the scale.
    fontSize: {
      "display-xl": ["40px", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "600" }],
      "display-lg": ["30px", { lineHeight: "1.1", letterSpacing: "-0.025em", fontWeight: "600" }],
      "heading-lg": ["22px", { lineHeight: "1.25", letterSpacing: "-0.02em", fontWeight: "600" }],
      "heading-md": ["17px", { lineHeight: "1.35", letterSpacing: "-0.012em", fontWeight: "600" }],
      subhead: ["15px", { lineHeight: "1.4", letterSpacing: "-0.006em", fontWeight: "550" }],
      "body-lg": ["15px", { lineHeight: "1.6", fontWeight: "400" }],
      body: ["14px", { lineHeight: "1.6", fontWeight: "400" }],
      "body-sm": ["13px", { lineHeight: "1.5", fontWeight: "400" }],
      // Section headings: sentence case, weight not tracking (no uppercase labels).
      label: ["13px", { lineHeight: "1.3", letterSpacing: "-0.003em", fontWeight: "600" }],
      "data-lg": ["24px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "600" }],
      data: ["13px", { lineHeight: "1.3", fontWeight: "500" }],
      "data-sm": ["12px", { lineHeight: "1.3", fontWeight: "450" }],
      caption: ["12px", { lineHeight: "1.45", fontWeight: "400" }],
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
