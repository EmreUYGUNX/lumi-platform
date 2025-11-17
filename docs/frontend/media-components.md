# Media Components & Hooks

Media authoring is split across three reusable React components and a trio of TanStack Query hooks. This guide explains how they work together, the props that matter in enterprise scenarios, and the accessibility/operational guarantees the media system exposes.

## MediaImage

`MediaImage` is the canonical way to render Cloudinary-hosted media on the storefront. It accepts either a complete `MediaAsset` object (recommended) or a bare `publicId`/`src`.

- **Variants & art direction:** set `variant="thumbnail" | "medium" | "large"` or provide `artDirections` to override the default `<picture>` sources. The component automatically emits responsive breakpoints from the backend `transformations` map.
- **Performance:** when `priority` is true the component eagerly loads and calls `initMediaPerformanceTelemetry()` so the backend receives LCP samples. For non-priority images it lazily renders once the IntersectionObserver reports visibility (configurable through `observeVisibility` and `lazyRootMargin`).
- **Placeholders & fallback:** blur data URLs are derived from stored metadata or computed from the dominant color. If the image fails to load a labelled `ImagePlaceholder` is rendered to keep layout shifts minimal.

```tsx
import { MediaImage } from "@/features/media/components/MediaImage";

export function ProductHero({ asset }: { asset: MediaAsset }) {
  return (
    <MediaImage
      asset={asset}
      variant="large"
      priority
      display={{ maxWidth: 1920, defaultSize: "100vw" }}
      fallbackLabel="Product hero"
    />
  );
}
```

## MediaUploader

`MediaUploader` manages drag & drop, validation, optimistic previews, and multipart uploads. It enforces the same folder/mime limits as the backend and surfaces callbacks for orchestration.

- **Queue lifecycle:** up to five files upload concurrently. `onOptimisticAsset` receives placeholder assets so a gallery can show pending items, while `onOptimisticRevert` lets you drop those placeholders when an upload finishes or fails.
- **Events:** use `onUploadSuccess` to link uploaded assets with products, `onUploadFailure` to log incidents, and `onBulkDelete` (from the gallery) to hook into moderation flows.
- **Folder presets:** pass `folderOptions` to show human-readable destinations. Each option can expose its `maxSizeMb` so the component enforces banner vs. product size limits before the server does.

```tsx
<MediaUploader
  folderOptions={[
    { label: "Products", value: "lumi/products", maxSizeMb: 5 },
    { label: "Banners", value: "lumi/banners", maxSizeMb: 10 },
  ]}
  defaultFolder="lumi/products"
  tags={["product:cm2a0b1c2"]}
  visibility="public"
  authToken={adminToken}
  onOptimisticAsset={(asset) => optimisticStore.add(asset)}
  onOptimisticRevert={(id, asset) => optimisticStore.resolve(id, asset)}
/>
```

## MediaGallery

`MediaGallery` renders search/filter controls, a grid/list view, infinite scrolling, selection mode, and a lightbox with delete controls.

- **Filters:** pass the canonical `MediaListFilters` object. Changes flow upward via `onFiltersChange` so callers can sync the state with routing or React Query parameters.
- **Selection workflow:** toggling selection mode exposes checkboxes (`aria-label` per asset) and the `onBulkDelete` callback. Keyboard users can tab to each checkbox and press space to select.
- **Lightbox tooling:** the gallery integrates `yet-another-react-lightbox` plugins (zoom, thumbnails, download, fullscreen). When `isAdmin` is true a “Delete asset” button is rendered inside the lightbox controls.
- **Infinite scroll:** the sentinel div triggers `onLoadMore` through InterSectionObserver. Pair it with `useMediaList.fetchNextPage()` for endless catalogues.

```tsx
const filters = { folder: "lumi/products", sortBy: "date", sortDirection: "desc" } as const;
const mediaList = useMediaList(filters, { authToken: adminToken });

<MediaGallery
  assets={mediaList.data?.pages.flatMap((page) => page.items) ?? []}
  filters={filters}
  hasNextPage={mediaList.hasNextPage}
  isFetchingNextPage={mediaList.isFetchingNextPage}
  onFiltersChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
  onLoadMore={() => mediaList.fetchNextPage()}
  onBulkDelete={async (ids) => Promise.all(ids.map((id) => mediaDelete.mutateAsync({ id })))}
  isAdmin
/>;
```

## TanStack Query Hooks

- **`useMediaList(filters, options)`** wraps `useInfiniteQuery`. Provide the same filters you pass to `MediaGallery`; the hook automatically builds `page/perPage` parameters and exposes `fetchNextPage` for the sentinel. All queries share the `mediaKeys` namespace so invalidation stays scoped.
- **`useMediaUpload({ authToken })`** exposes `.upload(variables)` plus the standard mutation state. A DOM `AbortController` is wired through `variables.signal` so the uploader can cancel requests. `variables.onProgress` receives 0–100 percentages from the XHR progress event.
- **`useMediaDelete({ authToken })`** performs optimistic list updates. During `onMutate` it removes the asset from every cached infinite list and restores the cache on failure. Always call `.mutateAsync({ id })` inside try/catch to surface RBAC or conflict errors to the UI.

## Accessibility & Operational Notes

- **ARIA:** the uploader wraps the dropzone in `<section aria-label="Media uploader">` and labels the hidden file input as “Select media files”. Gallery checkboxes use per-asset labels (`Select {publicId}`) and the placeholder skeleton announces progress via `aria-live="polite"`.
- **Keyboard workflows:** all gallery controls are native `<button>` or `<input>` elements so they honour focus order. Selection mode uses space/enter to toggle, and the lightbox delete button is focusable even when plugins are open.
- **Error surfacing:** validation errors collected during drag/drop are rendered above the queue so screen readers announce them immediately. The uploader’s cancel buttons include descriptive text rather than icons only.
- **Telemetry:** whenever a `MediaImage` renders above-the-fold (`priority` is true) it initializes `initMediaPerformanceTelemetry` so the backend can aggregate `media_lcp_seconds`. Keep this wrapper instead of the raw Next `<Image>` to preserve observability.

## Storybook Coverage

Interactive stories live alongside the components:

- `apps/frontend/src/features/media/components/MediaImage.stories.tsx`
- `apps/frontend/src/features/media/components/MediaUploader.stories.tsx`
- `apps/frontend/src/features/media/components/MediaGallery.stories.tsx`

Use them to showcase art-direction variants, the drag & drop queue, and gallery states before handing flows to QA or documentation teams.
