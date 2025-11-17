"use client";

import type { ComponentProps } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MediaUploader } from "./MediaUploader";
import { folderOptions } from "./__stories__/media.fixtures";

interface Story {
  args: ComponentProps<typeof MediaUploader>;
}

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const withQueryClient = (StoryComponent: () => JSX.Element) => {
  const client = createQueryClient();
  return (
    <QueryClientProvider client={client}>
      <StoryComponent />
    </QueryClientProvider>
  );
};

const meta = {
  title: "Media/MediaUploader",
  component: MediaUploader,
  decorators: [withQueryClient],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

export const Default: Story = {
  args: {
    folderOptions,
    defaultFolder: folderOptions[0]?.value,
    tags: ["story:demo"],
    visibility: "public",
    authToken: "demo-token",
    onUploadSuccess: (asset) => {
      console.info("Uploaded asset", asset.publicId);
    },
    onUploadFailure: (_item, error) => {
      console.warn("Upload failure", error);
    },
  },
};

export const WithOptimisticCallbacks: Story = {
  args: {
    folderOptions,
    visibility: "internal",
    onOptimisticAsset: (asset) => {
      console.info("Optimistic asset queued", asset.publicId);
    },
    onOptimisticRevert: (queueId, asset) => {
      console.info("Optimistic asset resolved", { queueId, asset: asset?.publicId });
    },
  },
};
