"use client";

import { useState } from "react";

import { Menu, X } from "lucide-react";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const publicNavLinks = [
  { href: "/", label: "Experience" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/login", label: "Login" },
] as const;

export function PublicHeader(): JSX.Element {
  const pathname = usePathname();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMenu = () => setMobileMenuOpen((open) => !open);

  return (
    <header className="supports-backdrop-blur:bg-lumi-bg/70 border-lumi-border/60 bg-lumi-bg/80 sticky top-0 z-40 border-b backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link
          href="/"
          className="gradient-text text-lg font-semibold tracking-tight"
          aria-label="Lumi Home"
        >
          Lumi Commerce
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          {publicNavLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "hover:text-lumi-primary text-sm font-semibold transition-colors",
                pathname === item.href ? "text-lumi-primary" : "text-lumi-text-secondary",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <Button asChild variant="ghost" className="text-sm font-semibold">
            <Link href="/register">Create account</Link>
          </Button>
          <Button asChild className="bg-lumi-primary hover:bg-lumi-primary-dark">
            <Link href="/login">Launch Console</Link>
          </Button>
        </div>

        <Button
          size="icon"
          variant="ghost"
          className="md:hidden"
          aria-label="Toggle navigation menu"
          onClick={toggleMenu}
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden">
          <div className="border-lumi-border/60 bg-lumi-bg-secondary/90 border-t px-4 pb-6 pt-2 backdrop-blur-lg">
            <nav className="flex flex-col gap-3">
              {publicNavLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
                    pathname === item.href
                      ? "bg-lumi-primary/10 text-lumi-primary"
                      : "text-lumi-text-secondary hover:bg-lumi-bg",
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="mt-4 flex flex-col gap-2">
              <Button asChild variant="outline" className="border-lumi-border">
                <Link href="/register">Create account</Link>
              </Button>
              <Button asChild>
                <Link href="/login">Launch Console</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
