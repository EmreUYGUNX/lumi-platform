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

import { useClipartAssets } from "../../hooks/useClipartAssets";
import { useDesignTemplates } from "../../hooks/useDesignTemplates";
import { useUserDesigns } from "../../hooks/useUserDesigns";
import type { ClipartAssetView } from "../../types/clipart.types";
import type { CustomerDesignView, DesignListQuery } from "../../types/design.types";
import type { DesignTemplateSummaryView } from "../../types/templates.types";

interface DesignLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectDesign: (design: CustomerDesignView) => void;
  onSelectClipart?: (clipart: ClipartAssetView) => void;
  onSelectTemplate?: (template: DesignTemplateSummaryView) => void;
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

  const [clipartCategory, setClipartCategory] = useState<string | "all">("all");
  const [clipartSearch, setClipartSearch] = useState("");

  const clipartQuery = useClipartAssets({
    page: 1,
    perPage: 200,
    sort: "popularity",
    order: "desc",
  });

  const clipartCategories = useMemo(() => {
    const categories = new Set<string>();
    (clipartQuery.data?.items ?? []).forEach((asset) => {
      const category = asset.category?.trim();
      if (category) categories.add(category);
    });
    return ["all", ...[...categories].sort((left, right) => left.localeCompare(right))];
  }, [clipartQuery.data?.items]);

  const filteredClipart = useMemo(() => {
    const query = clipartSearch.trim().toLowerCase();
    return (clipartQuery.data?.items ?? []).filter((asset) => {
      if (clipartCategory !== "all" && asset.category !== clipartCategory) return false;
      if (!query) return true;
      const name = asset.name.toLowerCase();
      if (name.includes(query)) return true;
      return asset.tags.some((tag) => tag.toLowerCase().includes(query));
    });
  }, [clipartCategory, clipartQuery.data?.items, clipartSearch]);

  const [templateCategory, setTemplateCategory] = useState<string | "all">("all");
  const [templateSearch, setTemplateSearch] = useState("");

  const templatesQuery = useDesignTemplates({
    page: 1,
    perPage: 100,
    sort: "popularity",
    order: "desc",
  });

  const templateCategories = useMemo(() => {
    const categories = new Set<string>();
    (templatesQuery.data?.items ?? []).forEach((template) => {
      const category = template.category?.trim();
      if (category) categories.add(category);
    });
    return ["all", ...[...categories].sort((left, right) => left.localeCompare(right))];
  }, [templatesQuery.data?.items]);

  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    return (templatesQuery.data?.items ?? []).filter((template) => {
      if (templateCategory !== "all" && template.category !== templateCategory) return false;
      if (!query) return true;
      const name = template.name.toLowerCase();
      if (name.includes(query)) return true;
      return template.tags.some((tag) => tag.toLowerCase().includes(query));
    });
  }, [templateCategory, templateSearch, templatesQuery.data?.items]);

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
                {clipartCategories.map((value) => (
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

            {clipartQuery.isLoading && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton
                    key={`clipart-skeleton-${index}`}
                    className="h-36 rounded-2xl bg-white/5"
                  />
                ))}
              </div>
            )}

            {!clipartQuery.isLoading && filteredClipart.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-[11px] text-white/60">
                No clipart found. Try a different tag or category.
              </div>
            )}

            {!clipartQuery.isLoading && filteredClipart.length > 0 && (
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
            )}
          </TabsContent>

          <TabsContent value="templates" className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/10 p-1">
                {templateCategories.map((value) => (
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

              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                <Input
                  value={templateSearch}
                  onChange={(event) => setTemplateSearch(event.target.value)}
                  placeholder="Search templates…"
                  className="h-10 rounded-xl border-white/10 bg-black/10 pl-10 text-[11px] text-white"
                />
              </div>
            </div>

            {templatesQuery.isLoading && (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton
                    key={`template-skeleton-${index}`}
                    className="h-32 rounded-2xl bg-white/5"
                  />
                ))}
              </div>
            )}

            {!templatesQuery.isLoading && filteredTemplates.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-[11px] text-white/60">
                No templates found. Try a different tag or category.
              </div>
            )}

            {!templatesQuery.isLoading && filteredTemplates.length > 0 && (
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
                    <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-white/10 via-white/5 to-black/30">
                      <ResponsiveImage
                        src={template.previewUrl ?? template.thumbnailUrl ?? ""}
                        alt={template.name}
                        width={520}
                        height={320}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                        loading="lazy"
                        fallbackLabel={template.name.slice(0, 2).toUpperCase()}
                      />
                      <div className="absolute inset-0 bg-black/25 opacity-0 transition group-hover:opacity-100" />
                    </div>
                    <div className="space-y-1 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
                          {template.name}
                        </span>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[10px] uppercase tracking-[0.16em]",
                            template.isPaid
                              ? "bg-amber-500/15 text-amber-100"
                              : "bg-white/10 text-white/70",
                          )}
                        >
                          {template.isPaid ? "Paid" : "Free"}
                        </Badge>
                      </div>
                      {template.category && (
                        <span className="block text-[10px] uppercase tracking-[0.16em] text-white/45">
                          {template.category}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
