"use client";

import type { Route } from "next";

import Link, { type LinkProps } from "next/link";

import { cn } from "@/lib/utils";

type LinkHref = LinkProps<Route>["href"];

type Tone = "light" | "dark";

interface CtaLinkProps {
  href: LinkHref;
  label: string;
  tone?: Tone;
  className?: string;
}

export function CtaLink({ href, label, tone = "dark", className }: CtaLinkProps): JSX.Element {
  const underlineColor =
    tone === "light"
      ? "after:bg-white/85 text-white hover:text-white"
      : "after:bg-lumi-text text-lumi-text hover:text-lumi-primary";

  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.3em]",
        "relative after:absolute after:-bottom-1 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:transition-transform after:duration-500 group-hover:after:scale-x-100",
        underlineColor,
        className,
      )}
      aria-label={label}
    >
      <span>{label}</span>
      <span className="block h-[1px] w-5 translate-y-[8px] bg-current opacity-50 transition-all duration-500 group-hover:w-7" />
    </Link>
  );
}
