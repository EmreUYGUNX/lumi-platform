"use client";

import { useState } from "react";

import { Menu, X } from "lucide-react";
import type { Route } from "next";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { MiniCart } from "@/features/cart/components/MiniCart";
import { cn } from "@/lib/utils";

const homeRoute = "/" as Route;

const publicNavLinks = [
  { href: homeRoute, label: "Experience" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/login", label: "Login" },
] as const;

export function PublicHeader(): JSX.Element {
  const pathname = usePathname();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleMenu = () => setMobileMenuOpen((open) => !open);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-white/10 bg-black/60 backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between">
        <Link
          href={homeRoute}
          className="text-lg font-semibold tracking-tight text-white"
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
                "text-sm font-semibold transition-colors hover:text-white",
                pathname === item.href ? "text-white" : "text-white/70",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 md:flex">
          <MiniCart />
          <Button
            asChild
            variant="ghost"
            className="text-sm font-semibold text-white hover:bg-white/10 hover:text-white"
          >
            <Link href="/register">Create account</Link>
          </Button>
          <Button asChild className="bg-lumi-primary hover:bg-lumi-primary-dark">
            <Link href="/login">Launch Console</Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <MiniCart />
          <Button
            size="icon"
            variant="ghost"
            aria-label="Toggle navigation menu"
            onClick={toggleMenu}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
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
