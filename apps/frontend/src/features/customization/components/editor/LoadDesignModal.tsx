"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type * as fabric from "fabric";
import { ArrowDownAZ, ArrowUpAZ, ClockArrowDown, ClockArrowUp, Trash2 } from "lucide-react";
import { useQueries } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ResponsiveImage } from "@/components/ui/image/ResponsiveImage";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

import { sessionKeys } from "../../hooks/session.keys";
import type { LoadDesignResult } from "../../hooks/useLoadDesign";
import { useLoadDesign } from "../../hooks/useLoadDesign";
import type { DesignSessionSummaryView } from "../../types/session.types";
import { designSessionViewSchema, savedDesignSessionDataSchema } from "../../types/session.types";

type SortOption = "date_desc" | "date_asc" | "name_asc" | "name_desc";

const sortLabel: Record<SortOption, string> = {
  date_desc: "Last edited (newest)",
  date_asc: "Last edited (oldest)",
  name_asc: "Name (A → Z)",
  name_desc: "Name (Z → A)",
};

const resolveSortIcon = (value: SortOption) => {
  if (value === "date_asc") return ClockArrowUp;
  if (value === "date_desc") return ClockArrowDown;
  if (value === "name_desc") return ArrowDownAZ;
  return ArrowUpAZ;
};

const extractName = (sessionId: string, sessionData: unknown): string => {
  const parsed = savedDesignSessionDataSchema.safeParse(sessionData);
  const name = parsed.success ? parsed.data.lumiEditor?.name : undefined;
  const trimmed = typeof name === "string" ? name.trim() : "";
  return trimmed.length > 0 ? trimmed : `Design ${sessionId.slice(-4).toUpperCase()}`;
};

const relativeTimeFormatter =
  typeof Intl !== "undefined" && "RelativeTimeFormat" in Intl
    ? new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
    : undefined;

const formatLastEdited = (value: string): string => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;

  if (!relativeTimeFormatter) {
    return new Date(timestamp).toLocaleString();
  }

  const diffSeconds = Math.round((timestamp - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);

  if (absSeconds < 60) return relativeTimeFormatter.format(diffSeconds, "second");

  const diffMinutes = Math.round(diffSeconds / 60);
  const absMinutes = Math.abs(diffMinutes);
  if (absMinutes < 60) return relativeTimeFormatter.format(diffMinutes, "minute");

  const diffHours = Math.round(diffMinutes / 60);
  const absHours = Math.abs(diffHours);
  if (absHours < 24) return relativeTimeFormatter.format(diffHours, "hour");

  const diffDays = Math.round(diffHours / 24);
  return relativeTimeFormatter.format(diffDays, "day");
};

const normalizeSearch = (value: string): string => value.trim().toLowerCase();

const compareStrings = (a: string, b: string) =>
  a.localeCompare(b, undefined, { sensitivity: "base" });

const compareDates = (a: string, b: string) => {
  const aTime = Date.parse(a);
  const bTime = Date.parse(b);
  if (Number.isFinite(aTime) && Number.isFinite(bTime)) {
    return aTime - bTime;
  }
  return compareStrings(a, b);
};

export interface LoadDesignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvas?: fabric.Canvas;
  productId?: string;
  designArea?: string;
  className?: string;
  onLoaded?: (result: LoadDesignResult) => void;
}

export function LoadDesignModal({
  open,
  onOpenChange,
  canvas,
  productId,
  designArea,
  className,
  onLoaded,
}: LoadDesignModalProps): JSX.Element {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("date_desc");

  const query = useMemo(
    () => ({
      productId,
      order: sort === "date_asc" ? ("asc" as const) : ("desc" as const),
      perPage: 24,
    }),
    [productId, sort],
  );

  const loader = useLoadDesign({ query });
  const { listSessions, deleteDesign, loadMutation } = loader;

  const sessions = loader.sessionSummaries;

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return () => {};
    if (!sentinelRef.current) return () => {};

    const sentinel = sentinelRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (!listSessions.hasNextPage) return;
        if (listSessions.isFetchingNextPage) return;
        listSessions.fetchNextPage().catch(() => {});
      },
      { root: sentinel.parentElement, rootMargin: "120px" },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [listSessions, open]);

  const detailQueryConfigs = useMemo(
    () =>
      open
        ? sessions.map((session) => ({
            queryKey: sessionKeys.detail(session.id),
            queryFn: async () => {
              const response = await apiClient.get(`/sessions/${session.id}`, {
                dataSchema: designSessionViewSchema,
              });
              return response.data.sessionData;
            },
            enabled: open,
            staleTime: 60_000,
            gcTime: 300_000,
          }))
        : [],
    [open, sessions],
  );

  const detailQueries = useQueries({ queries: detailQueryConfigs });

  const sessionNames = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach((session) => {
      map.set(session.id, `Design ${session.id.slice(-4).toUpperCase()}`);
    });

    detailQueries.forEach((queryResult, index) => {
      const session = sessions[index];
      if (!session) return;
      if (!queryResult.data) return;
      map.set(session.id, extractName(session.id, queryResult.data));
    });

    return map;
  }, [detailQueries, sessions]);

  const filteredSessions = useMemo(() => {
    const term = normalizeSearch(search);
    const filteredByArea = designArea
      ? sessions.filter((session) => session.designArea === designArea)
      : sessions;

    const withNames = filteredByArea.map((session) => ({
      session,
      name: sessionNames.get(session.id) ?? `Design ${session.id.slice(-4).toUpperCase()}`,
    }));

    const filtered = term
      ? withNames.filter((entry) => entry.name.toLowerCase().includes(term))
      : withNames;

    return [...filtered].sort((a, b) => {
      if (sort === "name_asc") return compareStrings(a.name, b.name);
      if (sort === "name_desc") return compareStrings(b.name, a.name);
      if (sort === "date_asc") return compareDates(a.session.lastEditedAt, b.session.lastEditedAt);
      return compareDates(b.session.lastEditedAt, a.session.lastEditedAt);
    });
  }, [designArea, search, sessions, sessionNames, sort]);

  const handleLoad = useCallback(
    async (session: DesignSessionSummaryView) => {
      if (!canvas) return;
      const result = await loader.loadDesign({ sessionId: session.id, canvas });
      onLoaded?.(result);
      onOpenChange(false);
    },
    [canvas, loader, onLoaded, onOpenChange],
  );

  const handleDelete = useCallback(
    async (sessionId: string) => {
      await deleteDesign.mutateAsync(sessionId);
    },
    [deleteDesign],
  );

  const SortIcon = resolveSortIcon(sort);

  const isBusy = listSessions.isLoading || listSessions.isFetching;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-w-3xl border-white/10 bg-black/90 text-white", className)}>
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-lg font-semibold tracking-tight">Load design</DialogTitle>
          <DialogDescription className="text-sm text-white/60">
            Pick a saved design session to restore your canvas. You can search, sort, and delete
            sessions.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex-1">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-white/40"
              placeholder="Search designs…"
              disabled={isBusy}
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={sort}
              onValueChange={(value) => setSort(value as SortOption)}
              disabled={isBusy}
            >
              <SelectTrigger className="h-10 w-full min-w-[220px] rounded-xl border-white/10 bg-black/20 text-white sm:w-[260px]">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-black/95 text-white">
                {Object.entries(sortLabel).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/20 sm:flex">
              <SortIcon className="h-4 w-4 text-white/70" />
            </div>
          </div>
        </div>

        <div className="max-h-[60vh] overflow-y-auto rounded-2xl border border-white/10 bg-black/10">
          {listSessions.isLoading && (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-3"
                >
                  <Skeleton className="h-14 w-14 rounded-xl bg-white/5" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-40 bg-white/5" />
                    <Skeleton className="h-3 w-28 bg-white/5" />
                  </div>
                  <Skeleton className="h-8 w-16 rounded-xl bg-white/5" />
                </div>
              ))}
            </div>
          )}

          {!listSessions.isLoading && filteredSessions.length === 0 && (
            <div className="p-8 text-center">
              <p className="text-sm font-medium text-white/80">No saved designs found.</p>
              <p className="mt-1 text-[11px] text-white/50">
                Save a design session to see it here.
              </p>
            </div>
          )}

          {!listSessions.isLoading && filteredSessions.length > 0 && (
            <ul className="divide-y divide-white/10">
              {filteredSessions.map(({ session, name }) => (
                <li key={session.id} className="group flex items-center gap-3 p-4">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black/20">
                    <ResponsiveImage
                      src={session.thumbnailUrl ?? session.previewUrl ?? ""}
                      alt={name}
                      width={56}
                      height={56}
                      className="h-full w-full object-cover"
                    />
                  </div>

                  <button
                    type="button"
                    className="flex flex-1 flex-col text-left"
                    onClick={() => {
                      handleLoad(session).catch(() => {});
                    }}
                    disabled={!canvas || loadMutation.isPending}
                  >
                    <span className="text-sm font-semibold text-white/90">{name}</span>
                    <span className="mt-1 text-[11px] text-white/50">
                      {formatLastEdited(session.lastEditedAt)} ·{" "}
                      {session.isPublic ? "Public" : "Private"}
                    </span>
                  </button>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-xl border border-white/10 bg-black/20 text-white/70 hover:bg-white/10 hover:text-white"
                    onClick={() => {
                      handleDelete(session.id).catch(() => {});
                    }}
                    disabled={deleteDesign.isPending}
                    aria-label="Delete design"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <div ref={sentinelRef} className="h-10" />
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-xl border border-white/10 bg-black/10 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 hover:bg-white/10"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          <div className="ml-auto flex items-center gap-2 text-[11px] text-white/60">
            {listSessions.isFetchingNextPage ? "Loading more…" : ""}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
