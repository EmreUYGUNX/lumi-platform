"use client";

/* istanbul ignore file */
import { useCallback, useMemo, useState } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { useMediaDelete } from "../hooks/useMediaDelete";
import { useMediaList } from "../hooks/useMediaList";
import { useMediaUpdate } from "../hooks/useMediaUpdate";
import type { MediaAsset, MediaListFilters, MediaViewMode } from "../types/media.types";
import { formatFileSize } from "../utils/media-formatters";
import { MediaGallery } from "./MediaGallery";
import { MediaUploader } from "./MediaUploader";
import styles from "./media-manager.module.css";

/* istanbul ignore file */

const DEFAULT_FILTERS: MediaListFilters = {
  folder: undefined,
  tags: [],
  search: undefined,
  includeDeleted: false,
  resourceType: "image",
  sortBy: "date",
  sortDirection: "desc",
};

const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024 * 1024; // 5GB budget

interface MediaManagerShellProps {
  authToken?: string;
}

const MediaManagerShell = ({ authToken }: MediaManagerShellProps) => {
  const [filters, setFilters] = useState<MediaListFilters>(DEFAULT_FILTERS);
  const [viewMode, setViewMode] = useState<MediaViewMode>("grid");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [optimisticAssets, setOptimisticAssets] = useState<MediaAsset[]>([]);
  const [bulkTag, setBulkTag] = useState("featured");

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useMediaList(
    filters,
    {
      authToken,
    },
  );
  const deleteMutation = useMediaDelete({ authToken });
  const updateMutation = useMediaUpdate({ authToken });

  const assets = useMemo<MediaAsset[]>(() => {
    if (!data) {
      return [];
    }

    return data.pages.flatMap((page) => page.items ?? []);
  }, [data]);

  const usageBytes = useMemo(
    () => assets.reduce((total, asset) => total + asset.bytes, 0),
    [assets],
  );
  const usagePercent = Math.min(100, Math.round((usageBytes / STORAGE_LIMIT_BYTES) * 100));

  const orphanAssets = useMemo(
    () =>
      assets.filter(
        (asset) => asset.usage.products.length === 0 && asset.usage.variants.length === 0,
      ),
    [assets],
  );

  const handleFiltersChange = (partial: Partial<MediaListFilters>) => {
    setFilters((previous) => ({
      ...previous,
      ...partial,
    }));
    setSelectedIds([]);
  };

  const handleBulkDelete = useCallback(
    async (ids: string[]) => {
      // eslint-disable-next-line no-restricted-syntax -- Sequential deletion keeps optimistic cache updates predictable.
      for (const id of ids) {
        // eslint-disable-next-line no-await-in-loop -- Intentional to avoid saturating API and keep audit logging ordered.
        await deleteMutation.mutateAsync({ id });
      }
      setSelectedIds([]);
    },
    [deleteMutation],
  );

  const handleBulkTag = useCallback(async () => {
    const normalizedTag = bulkTag.trim();
    if (!normalizedTag) {
      return;
    }

    await Promise.all(
      selectedIds.map((id) =>
        updateMutation.mutateAsync({
          id,
          tags: [...new Set([...(filters.tags ?? []), normalizedTag])],
        }),
      ),
    );
  }, [bulkTag, filters.tags, selectedIds, updateMutation]);

  const handleOptimisticAsset = useCallback((asset: MediaAsset, queueId: string) => {
    setOptimisticAssets((current) => [
      ...current.filter((entry) => entry.placeholderId !== queueId),
      asset,
    ]);
  }, []);

  const handleOptimisticRevert = useCallback((queueId: string, asset?: MediaAsset) => {
    setOptimisticAssets((current) =>
      current.filter(
        (entry) =>
          entry.placeholderId !== queueId &&
          (!asset || entry.id !== asset.id) &&
          entry.placeholderId !== asset?.placeholderId,
      ),
    );
  }, []);

  const folderOptions = useMemo(
    () => [
      { label: "Products", value: "lumi/products", maxSizeMb: 5 },
      { label: "Banners", value: "lumi/banners", maxSizeMb: 10 },
      { label: "Editorial", value: "lumi/editorial", maxSizeMb: 5 },
    ],
    [],
  );

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <section className={styles.storageCard}>
          <header>
            <h3>Storage usage</h3>
            <span>{usagePercent}%</span>
          </header>
          <div className={styles.progress}>
            <span style={{ width: `${usagePercent}%` }} />
          </div>
          <p>
            {formatFileSize(usageBytes)} of {formatFileSize(STORAGE_LIMIT_BYTES)} used
          </p>
        </section>

        <section className={styles.filterCard}>
          <h3>Filters</h3>
          <label>
            <span>Resource</span>
            <select
              value={filters.resourceType}
              onChange={(event) =>
                handleFiltersChange({
                  resourceType: event.target.value as MediaListFilters["resourceType"],
                })
              }
            >
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="raw">Raw assets</option>
            </select>
          </label>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={filters.includeDeleted ?? false}
              onChange={(event) => handleFiltersChange({ includeDeleted: event.target.checked })}
            />
            Include deleted
          </label>
          <label>
            <span>Folder</span>
            <select
              value={filters.folder ?? ""}
              onChange={(event) => handleFiltersChange({ folder: event.target.value || undefined })}
            >
              <option value="">All</option>
              {folderOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        {orphanAssets.length > 0 && (
          <section className={styles.warning}>
            <h4>Orphaned assets detected</h4>
            <p>{orphanAssets.length} assets are not linked to any product.</p>
          </section>
        )}
      </aside>

      <main className={styles.main}>
        <MediaUploader
          folderOptions={folderOptions}
          defaultFolder={filters.folder}
          tags={filters.tags}
          authToken={authToken}
          onOptimisticAsset={handleOptimisticAsset}
          onOptimisticRevert={handleOptimisticRevert}
        />

        {selectedIds.length > 0 && (
          <div className={styles.bulkToolbar}>
            <span>{selectedIds.length} selected</span>
            <div className={styles.bulkActions}>
              <button
                type="button"
                onClick={() => handleBulkDelete(selectedIds)}
                disabled={deleteMutation.isPending}
              >
                Delete
              </button>
              <input
                value={bulkTag}
                onChange={(event) => setBulkTag(event.target.value)}
                placeholder="Tag"
              />
              <button
                type="button"
                onClick={handleBulkTag}
                disabled={updateMutation.isPending || !bulkTag}
              >
                Apply tag
              </button>
            </div>
          </div>
        )}

        <MediaGallery
          assets={assets}
          optimisticAssets={optimisticAssets}
          filters={filters}
          folderOptions={folderOptions}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          isAdmin
          viewMode={viewMode}
          selectedIds={selectedIds}
          onFiltersChange={handleFiltersChange}
          onLoadMore={fetchNextPage}
          onSelectionChange={setSelectedIds}
          onBulkDelete={handleBulkDelete}
          onViewModeChange={setViewMode}
          onDeleteAsset={(id) => deleteMutation.mutateAsync({ id })}
        />

        {isLoading && <p className={styles.loading}>Loading media…</p>}
      </main>
    </div>
  );
};

export interface MediaManagerProps {
  authToken?: string;
}

export function MediaManager({ authToken }: MediaManagerProps) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000,
            gcTime: 15 * 60 * 1000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <MediaManagerShell authToken={authToken} />
    </QueryClientProvider>
  );
}
