/* eslint-disable import/no-extraneous-dependencies */
import aspectRatio from "@tailwindcss/aspect-ratio";
import containerQueries from "@tailwindcss/container-queries";
import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";
import type { Config } from "tailwindcss";

const withOpacity = (variable: string): string => `hsl(var(${variable}) / <alpha-value>)`;

const spacingScale: Record<string, string> = {
  "0": "var(--lumi-space-0)",
  "0.5": "var(--lumi-space-0-5)",
  "1": "var(--lumi-space-1)",
  "1.5": "var(--lumi-space-1-5)",
  "2": "var(--lumi-space-2)",
  "2.5": "var(--lumi-space-2-5)",
  "3": "var(--lumi-space-3)",
  "3.5": "var(--lumi-space-3-5)",
  "4": "var(--lumi-space-4)",
  "5": "var(--lumi-space-5)",
  "6": "var(--lumi-space-6)",
  "7": "var(--lumi-space-7)",
  "8": "var(--lumi-space-8)",
  "9": "var(--lumi-space-9)",
  "10": "var(--lumi-space-10)",
  "12": "var(--lumi-space-12)",
  "14": "var(--lumi-space-14)",
  "16": "var(--lumi-space-16)",
  "20": "var(--lumi-space-20)",
  "24": "var(--lumi-space-24)",
  "28": "var(--lumi-space-28)",
  "32": "var(--lumi-space-32)",
};

const config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      lumi: {
        primary: withOpacity("--lumi-primary-hsl"),
        "primary-dark": withOpacity("--lumi-primary-dark-hsl"),
        "primary-light": withOpacity("--lumi-primary-light-hsl"),
        secondary: withOpacity("--lumi-secondary-hsl"),
        accent: withOpacity("--lumi-accent-hsl"),
        background: withOpacity("--lumi-bg-hsl"),
        "background-secondary": withOpacity("--lumi-bg-secondary-hsl"),
        text: withOpacity("--lumi-text-hsl"),
        "text-secondary": withOpacity("--lumi-text-secondary-hsl"),
        border: withOpacity("--lumi-border-hsl"),
        success: withOpacity("--lumi-success-hsl"),
        warning: withOpacity("--lumi-warning-hsl"),
        error: withOpacity("--lumi-error-hsl"),
        info: withOpacity("--lumi-info-hsl"),
        muted: withOpacity("--lumi-muted-hsl"),
        highlight: withOpacity("--lumi-highlight-hsl"),
      },
    },
    extend: {
      container: {
        center: true,
        padding: {
          DEFAULT: "1.5rem",
          sm: "1.5rem",
          lg: "2rem",
          xl: "2.5rem",
          "2xl": "3rem",
        },
      },
      spacing: spacingScale,
      fontFamily: {
        sans: ["var(--lumi-font-sans)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        heading: [
          "var(--lumi-font-heading)",
          "General Sans",
          "SF Pro Display",
          "system-ui",
          "sans-serif",
        ],
        mono: ["var(--lumi-font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      screens: {
        xs: "360px",
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1536px",
      },
      borderRadius: {
        none: "0",
        xs: "var(--lumi-radius-xs)",
        sm: "var(--lumi-radius-sm)",
        DEFAULT: "var(--lumi-radius-md)",
        lg: "var(--lumi-radius-lg)",
        xl: "var(--lumi-radius-xl)",
        full: "9999px",
      },
      boxShadow: {
        sm: "var(--lumi-shadow-sm)",
        DEFAULT: "var(--lumi-shadow-md)",
        lg: "var(--lumi-shadow-lg)",
        xl: "var(--lumi-shadow-xl)",
        glow: "var(--lumi-shadow-glow)",
      },
      backgroundImage: {
        "gradient-lumi":
          "linear-gradient(125deg, hsl(var(--lumi-primary-hsl)) 0%, hsl(var(--lumi-secondary-hsl)) 50%, hsl(var(--lumi-accent-hsl)) 100%)",
        "glass-radial":
          "radial-gradient(circle at top, rgba(255,255,255,0.25), rgba(255,255,255,0))",
      },
      transitionTimingFunction: {
        standard: "var(--lumi-easing-standard)",
        emphasis: "var(--lumi-easing-emphasis)",
        delicate: "var(--lumi-easing-delicate)",
      },
      transitionDuration: {
        fast: "var(--lumi-transition-fast)",
        DEFAULT: "var(--lumi-transition-base)",
        slow: "var(--lumi-transition-slow)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
          "100%": { transform: "translateY(0px)" },
        },
      },
      animation: {
        "fade-up": "fade-up var(--lumi-transition-base) var(--lumi-easing-emphasis) forwards",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [forms, typography, aspectRatio, containerQueries],
} satisfies Config;

export default config;
