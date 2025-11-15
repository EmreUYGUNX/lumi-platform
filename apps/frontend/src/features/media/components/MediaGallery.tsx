"use client";

/* istanbul ignore file */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Lightbox from "yet-another-react-lightbox";
import Download from "yet-another-react-lightbox/plugins/download";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

import type {
  MediaAsset,
  MediaFolderOption,
  MediaListFilters,
  MediaViewMode,
} from "../types/media.types";
import { formatFileSize, formatIsoDate, normaliseTagInput } from "../utils/media-formatters";
import { MediaImage } from "./MediaImage";
import styles from "./media-gallery.module.css";

/* istanbul ignore file */

interface MediaGalleryProps {
  assets: MediaAsset[];
  optimisticAssets?: MediaAsset[];
  filters: MediaListFilters;
  folderOptions?: MediaFolderOption[];
  viewMode?: MediaViewMode;
  selectedIds?: string[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  isAdmin?: boolean;
  onFiltersChange?: (filters: Partial<MediaListFilters>) => void;
  onLoadMore?: () => void;
  onSelectionChange?: (ids: string[]) => void;
  onBulkDelete?: (ids: string[]) => Promise<void> | void;
  onViewModeChange?: (mode: MediaViewMode) => void;
  onDeleteAsset?: (assetId: string) => Promise<void> | void;
}

const SORT_OPTIONS = [
  { label: "Newest", value: "date:desc", field: "date", direction: "desc" },
  { label: "Oldest", value: "date:asc", field: "date", direction: "asc" },
  { label: "Size (large-first)", value: "size:desc", field: "size", direction: "desc" },
  { label: "Size (small-first)", value: "size:asc", field: "size", direction: "asc" },
  { label: "Name (A-Z)", value: "name:asc", field: "name", direction: "asc" },
  { label: "Name (Z-A)", value: "name:desc", field: "name", direction: "desc" },
];

const parseSort = (value: string) => {
  const [field, direction] = value.split(":") as ["date" | "size" | "name", "asc" | "desc"];
  return { field, direction };
};

const mergeAssets = (optimistic?: MediaAsset[], persisted?: MediaAsset[]): MediaAsset[] => {
  const optimisticEntries = optimistic?.filter((asset) => asset.isOptimistic) ?? [];
  const persistedEntries = persisted ?? [];

  return [...optimisticEntries, ...persistedEntries];
};

export function MediaGallery({
  assets,
  optimisticAssets,
  filters,
  folderOptions,
  viewMode = "grid",
  selectedIds,
  hasNextPage,
  isFetchingNextPage,
  isAdmin,
  onFiltersChange,
  onLoadMore,
  onSelectionChange,
  onBulkDelete,
  onViewModeChange,
  onDeleteAsset,
}: MediaGalleryProps) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [internalSelection, setInternalSelection] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isLightboxOpen, setLightboxOpen] = useState(false);
  const [tagQuery, setTagQuery] = useState(filters.tags?.join(", ") ?? "");
  const [searchQuery, setSearchQuery] = useState(filters.search ?? "");
  const [isDeleting, setDeleting] = useState(false);
  const tagDebounceRef = useRef<NodeJS.Timeout>();
  const searchDebounceRef = useRef<NodeJS.Timeout>();
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const mergedAssets = useMemo(
    () => mergeAssets(optimisticAssets, assets),
    [optimisticAssets, assets],
  );

  const sortedAssets = useMemo(() => {
    const items = [...mergedAssets];
    const direction = filters.sortDirection === "asc" ? 1 : -1;

    items.sort((a, b) => {
      switch (filters.sortBy) {
        case "size": {
          return (a.bytes - b.bytes) * direction;
        }
        case "name": {
          return a.publicId.localeCompare(b.publicId) * direction;
        }
        default: {
          return (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * direction;
        }
      }
    });

    return items;
  }, [mergedAssets, filters.sortBy, filters.sortDirection]);

  useEffect(() => {
    setTagQuery(filters.tags?.join(", ") ?? "");
  }, [filters.tags]);

  useEffect(() => {
    setSearchQuery(filters.search ?? "");
  }, [filters.search]);

  useEffect(
    () => () => {
      if (tagDebounceRef.current) {
        clearTimeout(tagDebounceRef.current);
      }
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    },
    [],
  );

  const selection = selectedIds ?? internalSelection;

  const setSelection = (ids: string[]) => {
    if (onSelectionChange) {
      onSelectionChange(ids);
      return;
    }
    setInternalSelection(ids);
  };

  const toggleSelectionMode = () => {
    setSelectionMode((previous) => {
      if (previous) {
        setSelection([]);
      }
      return !previous;
    });
  };

  const handleCardSelection = (assetId: string) => {
    const exists = selection.includes(assetId);
    const updated = exists ? selection.filter((id) => id !== assetId) : [...selection, assetId];
    setSelection(updated);
  };

  const currentSort = `${filters.sortBy}:${filters.sortDirection}`;

  const handleSortChange = (value: string) => {
    const { field, direction } = parseSort(value);
    onFiltersChange?.({
      sortBy: field,
      sortDirection: direction,
    });
  };

  const handleTagChange = (value: string) => {
    setTagQuery(value);
    if (tagDebounceRef.current) {
      clearTimeout(tagDebounceRef.current);
    }
    tagDebounceRef.current = setTimeout(() => {
      onFiltersChange?.({
        tags: normaliseTagInput(value),
      });
    }, 400);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      const trimmedValue = value.trim();
      onFiltersChange?.({ search: trimmedValue.length > 0 ? trimmedValue : undefined });
    }, 400);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isFetchingNextPage && onLoadMore) {
            onLoadMore();
          }
        });
      },
      {
        rootMargin: "400px",
      },
    );

    const element = sentinelRef.current;
    if (hasNextPage && onLoadMore && element) {
      observer.observe(element);
    }

    return () => observer.disconnect();
  }, [hasNextPage, onLoadMore, isFetchingNextPage]);

  const slides = useMemo(
    () =>
      sortedAssets.map((asset) => ({
        src: asset.transformations?.large ?? asset.secureUrl ?? asset.url,
        alt: asset.tags?.join(", ") ?? asset.publicId,
      })),
    [sortedAssets],
  );

  const handleCardClick = (asset: MediaAsset, index: number) => {
    if (selectionMode) {
      handleCardSelection(asset.id);
      return;
    }

    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  const selectedCount = selection.length;

  const handleBulkDelete = async () => {
    if (selectedCount === 0 || !onBulkDelete) {
      return;
    }
    setDeleting(true);
    try {
      await onBulkDelete(selection);
      setSelection([]);
    } finally {
      setDeleting(false);
    }
  };

  const handleLightboxDelete = useCallback(async () => {
    if (!isAdmin || !onDeleteAsset) {
      return;
    }
    const asset = sortedAssets.find((_, index) => index === lightboxIndex);
    if (!asset) {
      return;
    }

    setDeleting(true);
    try {
      await onDeleteAsset(asset.id);
      setLightboxOpen(false);
    } finally {
      setDeleting(false);
    }
  }, [sortedAssets, lightboxIndex, isAdmin, onDeleteAsset]);

  return (
    <section className={styles.root} data-view-mode={viewMode}>
      <header className={styles.toolbar}>
        <div className={styles.filters}>
          <label>
            Folder
            <select
              value={filters.folder ?? ""}
              onChange={(event) => onFiltersChange?.({ folder: event.target.value || undefined })}
            >
              <option value="">All folders</option>
              {(folderOptions ?? []).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Tags
            <input
              value={tagQuery}
              onChange={(event) => handleTagChange(event.target.value)}
              placeholder="e.g. product:abc"
            />
          </label>
          <label>
            Search
            <input
              value={searchQuery}
              onChange={(event) => handleSearchChange(event.target.value)}
              placeholder="Filename or metadata"
            />
          </label>
          <label>
            Sort
            <select value={currentSort} onChange={(event) => handleSortChange(event.target.value)}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            onClick={() => onViewModeChange?.(viewMode === "grid" ? "list" : "grid")}
          >
            View: {viewMode === "grid" ? "Grid" : "List"}
          </button>
          <button type="button" onClick={toggleSelectionMode}>
            {selectionMode ? "Exit selection" : "Select items"}
          </button>
          {selectionMode && (
            <button
              type="button"
              disabled={selectedCount === 0 || !onBulkDelete || isDeleting}
              onClick={handleBulkDelete}
            >
              Bulk delete ({selectedCount})
            </button>
          )}
        </div>
      </header>

      <div className={styles.gallery} data-mode={viewMode}>
        {sortedAssets.map((asset, index) => {
          const isSelected = selection.includes(asset.id);
          return (
            <article
              key={asset.id}
              className={styles.card}
              data-selected={isSelected}
              onClick={() => handleCardClick(asset, index)}
            >
              {selectionMode && (
                <input
                  type="checkbox"
                  aria-label={`Select ${asset.publicId}`}
                  checked={isSelected}
                  onChange={() => handleCardSelection(asset.id)}
                  onClick={(event) => event.stopPropagation()}
                  className={styles.checkbox}
                />
              )}
              <div className={styles.imageWrapper}>
                <MediaImage asset={asset} variant="thumbnail" />
                <div className={styles.hoverMeta}>
                  <p>{asset.publicId}</p>
                  <p>{formatFileSize(asset.bytes)}</p>
                </div>
              </div>
              <div className={styles.cardMeta}>
                <p className={styles.cardTitle}>{asset.folder ?? "Uncategorised"}</p>
                <p className={styles.tags}>{asset.tags?.slice(0, 3).join(", ") || "No tags"}</p>
                <p className={styles.timestamp}>{formatIsoDate(asset.updatedAt)}</p>
              </div>
            </article>
          );
        })}
      </div>

      {hasNextPage && (
        <div ref={sentinelRef} className={styles.sentinel}>
          {isFetchingNextPage ? "Loading more assets…" : "Scroll to load more"}
        </div>
      )}

      {isLightboxOpen && slides.length > 0 && (
        <Lightbox
          open={isLightboxOpen}
          close={() => setLightboxOpen(false)}
          slides={slides}
          index={lightboxIndex}
          plugins={[Download, Fullscreen, Zoom, Thumbnails]}
          render={{
            controls: () =>
              isAdmin ? (
                <button
                  type="button"
                  className={styles.deleteButton}
                  onClick={handleLightboxDelete}
                  disabled={isDeleting}
                >
                  Delete asset
                </button>
              ) : undefined,
          }}
        />
      )}
    </section>
  );
}
