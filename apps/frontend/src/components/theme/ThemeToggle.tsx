"use client";

import { useEffect, useState } from "react";

import { useTheme } from "next-themes";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps): JSX.Element {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={className} aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";
  const buttonClasses = [
    "glass-panel",
    "inline-flex",
    "items-center",
    "gap-3",
    "rounded-full",
    "px-4",
    "py-2",
    "text-sm",
    "text-lumi-text",
    "shadow-lg",
    "transition-all",
    "duration-fast",
    "hover:shadow-glow",
    "focus-visible:outline",
    "focus-visible:outline-2",
    "focus-visible:outline-offset-2",
    "focus-visible:outline-lumi-primary",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={buttonClasses}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-pressed={isDark}
      aria-label="Toggle color theme"
    >
      <span
        className="bg-gradient-lumi text-lumi-background shadow-glow inline-flex h-10 w-10 items-center justify-center rounded-full"
        aria-hidden
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </span>
      <span className="flex flex-col text-left">
        <span className="text-lumi-text-secondary text-xs uppercase">Theme</span>
        <span className="text-sm font-medium">{isDark ? "Dark" : "Light"} mode</span>
      </span>
    </button>
  );
}

function SunIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2m-3.07-7.07-1.41 1.41M6.34 17.66l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-5 w-5"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
}
