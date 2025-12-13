"use client";

import { useMemo, useState } from "react";

import { Library, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ResponsiveImage } from "@/components/ui/image/ResponsiveImage";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import { useUserDesigns } from "../../hooks/useUserDesigns";
import type { CustomerDesignView, DesignListQuery } from "../../types/design.types";

type ClipartCategory = "shapes" | "icons" | "seasonal";

interface ClipartAsset {
  id: string;
  name: string;
  category: ClipartCategory;
  svg: string;
  isPaid: boolean;
}

const CLIPART_ASSETS: ClipartAsset[] = [
  {
    id: "clipart-star",
    name: "Star",
    category: "icons",
    isPaid: false,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path fill="#facc15" d="M48 6l12.6 25.5 28.2 4.1-20.4 19.9 4.8 28.1L48 70.9 22.8 83.7l4.8-28.1L7.2 35.6l28.2-4.1L48 6z"/></svg>`,
  },
  {
    id: "clipart-heart",
    name: "Heart",
    category: "icons",
    isPaid: true,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path fill="#fb7185" d="M48 86S10 61.8 10 34.2C10 21 20.6 10 33.7 10c7.1 0 13.8 3.3 18.3 8.7C56.5 13.3 63.2 10 70.3 10 83.4 10 94 21 94 34.2 94 61.8 56 86 56 86H48z"/></svg>`,
  },
  {
    id: "clipart-bolt",
    name: "Lightning",
    category: "seasonal",
    isPaid: false,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><path fill="#38bdf8" d="M54 2L18 56h24l-6 38 42-58H54z"/></svg>`,
  },
  {
    id: "clipart-circle",
    name: "Circle",
    category: "shapes",
    isPaid: false,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><circle cx="48" cy="48" r="38" fill="#a78bfa"/></svg>`,
  },
];

type TemplateCategory = "minimal" | "bold" | "sale";

interface DesignTemplate {
  id: string;
  name: string;
  category: TemplateCategory;
  previewLabel: string;
}

const TEMPLATES: DesignTemplate[] = [
  { id: "template-minimal", name: "Minimal Logo", category: "minimal", previewLabel: "Minimal" },
  { id: "template-bold", name: "Bold Statement", category: "bold", previewLabel: "Bold" },
  { id: "template-sale", name: "Sale Badge", category: "sale", previewLabel: "Sale" },
];

interface DesignLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDesign: (design: CustomerDesignView) => void;
  onSelectClipart?: (clipart: ClipartAsset) => void;
  onSelectTemplate?: (template: DesignTemplate) => void;
  className?: string;
}

const buildTagQuery = (value: string): string | undefined => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  const normalized = trimmed
    .replaceAll(/[^\da-z-]+/gu, "-")
    .replaceAll(/-+/gu, "-")
    .slice(0, 32);
  return normalized || undefined;
};

export function DesignLibrary({
  open,
  onOpenChange,
  onSelectDesign,
  onSelectClipart,
  onSelectTemplate,
  className,
}: DesignLibraryProps): JSX.Element {
  const [designSearch, setDesignSearch] = useState("");
  const [designPage, setDesignPage] = useState(1);
  const [designSort, setDesignSort] = useState<DesignListQuery["sort"]>("createdAt");
  const [designOrder, setDesignOrder] = useState<DesignListQuery["order"]>("desc");

  const tagQuery = useMemo(() => buildTagQuery(designSearch), [designSearch]);

  const designsQuery = useUserDesigns({
    page: designPage,
    perPage: 12,
    sort: designSort,
    order: designOrder,
    tag: tagQuery,
  });

  const pagination = designsQuery.data?.meta?.pagination;
  const canNext = Boolean(pagination?.hasNextPage);
  const canPrev = Boolean(pagination?.hasPreviousPage);

  const [clipartCategory, setClipartCategory] = useState<ClipartCategory | "all">("all");
  const [clipartSearch, setClipartSearch] = useState("");

  const filteredClipart = useMemo(() => {
    const query = clipartSearch.trim().toLowerCase();
    return CLIPART_ASSETS.filter((asset) => {
      if (clipartCategory !== "all" && asset.category !== clipartCategory) return false;
      if (!query) return true;
      return asset.name.toLowerCase().includes(query);
    });
  }, [clipartCategory, clipartSearch]);

  const [templateCategory, setTemplateCategory] = useState<TemplateCategory | "all">("all");
  const filteredTemplates = useMemo(
    () =>
      TEMPLATES.filter(
        (template) => templateCategory === "all" || template.category === templateCategory,
      ),
    [templateCategory],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "border-white/10 bg-black/80 text-white backdrop-blur",
          "max-w-5xl rounded-2xl",
          className,
        )}
      >
        <DialogHeader className="space-y-2">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-white/80">
            <Library className="h-4 w-4" />
            Design Library
          </DialogTitle>
          <p className="text-[11px] text-white/50">
            Add your saved designs, clipart, or templates to the canvas.
          </p>
        </DialogHeader>

        <Tabs defaultValue="designs" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-white/5">
            <TabsTrigger value="designs">My Designs</TabsTrigger>
            <TabsTrigger value="clipart">Clipart</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="designs" className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  value={designSearch}
                  onChange={(event) => {
                    setDesignSearch(event.target.value);
                    setDesignPage(1);
                  }}
                  placeholder="Filter by tag…"
                  className="h-10 rounded-xl border-white/10 bg-black/10 pl-10 text-[11px] text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={designSort === "createdAt" ? "secondary" : "ghost"}
                  className="h-10 rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
                  onClick={() => setDesignSort("createdAt")}
                >
                  Recent
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={designSort === "usageCount" ? "secondary" : "ghost"}
                  className="h-10 rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
                  onClick={() => setDesignSort("usageCount")}
                >
                  Popular
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={designOrder === "desc" ? "secondary" : "ghost"}
                  className="h-10 rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
                  onClick={() => setDesignOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
                >
                  {designOrder === "desc" ? "Newest" : "Oldest"}
                </Button>
              </div>
            </div>

            {designsQuery.isLoading && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton
                    key={`design-skeleton-${index}`}
                    className="h-36 rounded-2xl bg-white/5"
                  />
                ))}
              </div>
            )}

            {!designsQuery.isLoading && designsQuery.data?.data?.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-[11px] text-white/60">
                No designs found. Upload a design from the editor to see it here.
              </div>
            )}

            {designsQuery.data?.data && designsQuery.data.data.length > 0 && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {designsQuery.data.data.map((design) => (
                  <button
                    key={design.id}
                    type="button"
                    className="group overflow-hidden rounded-2xl border border-white/10 bg-black/10 text-left transition hover:border-white/25"
                    onClick={() => {
                      onSelectDesign(design);
                      onOpenChange(false);
                    }}
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-black/30">
                      <ResponsiveImage
                        src={design.thumbnailUrl}
                        alt={design.id}
                        width={320}
                        height={320}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                      />
                    </div>
                    <div className="space-y-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
                          {design.format.toUpperCase()}
                        </span>
                        {design.isPublic ? (
                          <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-100">
                            Public
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-white/10 text-white/70">
                            Private
                          </Badge>
                        )}
                      </div>
                      {design.tags.length > 0 && (
                        <p className="truncate text-[10px] uppercase tracking-[0.16em] text-white/45">
                          {design.tags.slice(0, 3).join(", ")}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
              <span className="text-[11px] text-white/60">
                Page {pagination?.page ?? designPage} / {pagination?.totalPages ?? "—"}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
                  disabled={!canPrev}
                  onClick={() => setDesignPage((prev) => Math.max(1, prev - 1))}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-9 rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
                  disabled={!canNext}
                  onClick={() => setDesignPage((prev) => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="clipart" className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 p-1">
                {(["all", "icons", "shapes", "seasonal"] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={clipartCategory === value ? "secondary" : "ghost"}
                    className="h-9 rounded-lg px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
                    onClick={() => setClipartCategory(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>

              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  value={clipartSearch}
                  onChange={(event) => setClipartSearch(event.target.value)}
                  placeholder="Search clipart…"
                  className="h-10 rounded-xl border-white/10 bg-black/10 pl-10 text-[11px] text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {filteredClipart.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-black/10 text-left transition hover:border-white/25"
                  onClick={() => {
                    onSelectClipart?.(asset);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex aspect-square items-center justify-center bg-black/30 p-6">
                    {/* eslint-disable-next-line @next/next/no-img-element -- Clipart previews are local inline SVG data. */}
                    <img
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(asset.svg)}`}
                      alt={asset.name}
                      className="h-full w-full object-contain transition duration-300 group-hover:scale-[1.04]"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
                      {asset.name}
                    </span>
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-[10px] uppercase tracking-[0.16em]",
                        asset.isPaid
                          ? "bg-amber-500/15 text-amber-100"
                          : "bg-white/10 text-white/70",
                      )}
                    >
                      {asset.isPaid ? "Paid" : "Free"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 p-1">
                {(["all", "minimal", "bold", "sale"] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={templateCategory === value ? "secondary" : "ghost"}
                    className="h-9 rounded-lg px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
                    onClick={() => setTemplateCategory(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>

              <p className="text-[11px] text-white/50">
                Hover a template to preview, click to load.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {filteredTemplates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  className="group overflow-hidden rounded-2xl border border-white/10 bg-black/10 text-left transition hover:border-white/25"
                  onClick={() => {
                    onSelectTemplate?.(template);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex aspect-[16/10] items-center justify-center bg-gradient-to-br from-white/10 via-white/5 to-black/30 p-5">
                    <span className="text-sm font-semibold uppercase tracking-[0.28em] text-white/70 transition group-hover:text-white">
                      {template.previewLabel}
                    </span>
                  </div>
                  <div className="px-3 py-2">
                    <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
                      {template.name}
                    </span>
                    <span className="block text-[10px] uppercase tracking-[0.16em] text-white/45">
                      {template.category}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
