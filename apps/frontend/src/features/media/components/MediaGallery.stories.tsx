"use client";

import type { ComponentProps } from "react";

import { MediaGallery } from "./MediaGallery";
import { defaultFilters, folderOptions, sampleAssets } from "./__stories__/media.fixtures";

interface Story {
  args: ComponentProps<typeof MediaGallery>;
}

const meta = {
  title: "Media/MediaGallery",
  component: MediaGallery,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

const baseArgs: ComponentProps<typeof MediaGallery> = {
  assets: sampleAssets,
  optimisticAssets: [],
  filters: defaultFilters,
  folderOptions,
  hasNextPage: true,
  isFetchingNextPage: false,
  isAdmin: true,
  onFiltersChange: (filters) => {
    console.info("Filters changed", filters);
  },
  onLoadMore: () => {
    console.info("Load more triggered");
  },
  onBulkDelete: async (ids: string[]) => {
    console.info("Bulk delete requested", ids);
  },
  onDeleteAsset: async (id: string) => {
    console.info("Single delete requested", id);
  },
};

export const GridView: Story = {
  args: baseArgs,
};

export const ListView: Story = {
  args: {
    ...baseArgs,
    viewMode: "list",
    filters: {
      ...defaultFilters,
      sortBy: "name",
      sortDirection: "asc",
    },
    selectedIds: [sampleAssets[0]?.id ?? ""],
    onSelectionChange: (ids: string[]) => {
      console.info("Selection changed", ids);
    },
  },
};
