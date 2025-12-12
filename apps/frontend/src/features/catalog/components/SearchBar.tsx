"use client";

import { useEffect, useMemo, useState } from "react";

import { Loader2, Search, X } from "lucide-react";

import Link from "next/link";

import type { ProductSummary } from "@/features/products/types/product.types";
import { cn } from "@/lib/utils";
import { useProductSearch } from "@/features/products/hooks/useProductSearch";

interface SearchBarProps {
  value: string;
  onSearch: (value: string) => void;
  placeholder?: string;
}

const useDebouncedValue = (value: string, delay = 300) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
};

const RECENT_SEARCHES = ["Capsule", "Monochrome", "Atelier"].map((entry) => entry.toUpperCase());

export function SearchBar({ value, onSearch, placeholder }: SearchBarProps): JSX.Element {
  const [inputValue, setInputValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  const debouncedValue = useDebouncedValue(inputValue, 300);

  useEffect(() => {
    onSearch(debouncedValue);
  }, [debouncedValue, onSearch]);

  const { data, isFetching } = useProductSearch(debouncedValue, isFocused);
  const suggestions: ProductSummary[] = data?.items ?? [];
  const showSuggestions = isFocused && debouncedValue.trim().length >= 2;

  const highlightTerm = useMemo(() => debouncedValue.trim().toLowerCase(), [debouncedValue]);

  return (
    <div className="relative w-full max-w-xl">
      <div className="border-lumi-border/80 text-lumi-text flex items-center gap-3 rounded-full border bg-white/80 px-4 py-2 shadow-sm backdrop-blur">
        <Search className="text-lumi-text-secondary h-4 w-4" aria-hidden />
        <input
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => {
            window.setTimeout(() => setIsFocused(false), 120);
          }}
          className="placeholder:text-lumi-text-secondary w-full bg-transparent text-sm font-semibold uppercase tracking-[0.18em] outline-none"
          placeholder={placeholder ?? "SEARCH THE COLLECTION"}
        />
        {isFetching && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {inputValue && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setInputValue("");
              onSearch("");
            }}
            className="text-lumi-text-secondary hover:text-lumi-text transition"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {showSuggestions && (
        <div className="border-lumi-border/80 absolute left-0 right-0 top-12 z-20 rounded-2xl border bg-white/95 shadow-xl backdrop-blur">
          <div className="grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.24em]">
                Recent
              </p>
              <div className="flex flex-wrap gap-2">
                {RECENT_SEARCHES.map((entry) => (
                  <button
                    key={entry}
                    type="button"
                    onMouseDown={() => {
                      setInputValue(entry);
                      onSearch(entry);
                    }}
                    className="border-lumi-border bg-lumi-bg-secondary hover:border-lumi-text rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em]"
                  >
                    {entry}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.24em]">
                Suggestions
              </p>
              {suggestions.length === 0 ? (
                <p className="text-lumi-text-secondary text-xs uppercase tracking-[0.18em]">
                  Start typing to explore products
                </p>
              ) : (
                <ul className="space-y-2">
                  {suggestions.map((product) => (
                    <li key={product.id}>
                      <Link
                        href={`/products/${product.slug}`}
                        className="hover:bg-lumi-bg-secondary/80 flex items-center justify-between rounded-lg px-3 py-2 transition"
                      >
                        <span className="text-[11px] font-semibold uppercase tracking-[0.26em]">
                          {product.title}
                        </span>
                        <span className="text-lumi-text-secondary text-[10px] uppercase tracking-[0.18em]">
                          {highlightTerm ? `View ${highlightTerm}` : "View"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="border-lumi-border/80 border-t px-4 py-3 text-right">
            <Link
              href={{ pathname: "/products", query: { search: debouncedValue } }}
              className={cn(
                "text-lumi-text text-[11px] font-semibold uppercase tracking-[0.22em]",
                "hover:text-lumi-primary",
              )}
              onMouseDown={() => onSearch(debouncedValue)}
            >
              View all results
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
