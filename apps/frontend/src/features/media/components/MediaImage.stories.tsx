"use client";

import { MediaImage } from "./MediaImage";
import type { MediaImageProps } from "./MediaImage";
import { sampleAsset } from "./__stories__/media.fixtures";

interface Story {
  args: MediaImageProps;
  render?: (args: MediaImageProps) => JSX.Element;
}

const meta = {
  title: "Media/MediaImage",
  component: MediaImage,
  parameters: {
    layout: "centered",
  },
};

export default meta;

export const Default: Story = {
  args: {
    asset: sampleAsset,
    variant: "medium",
    loading: "lazy",
  },
};

export const ThumbnailVariant: Story = {
  args: {
    asset: sampleAsset,
    variant: "thumbnail",
    fallbackLabel: "Product thumbnail",
  },
};

export const PriorityHero: Story = {
  args: {
    asset: sampleAsset,
    variant: "large",
    priority: true,
    observeVisibility: false,
  },
};

export const CustomArtDirection: Story = {
  args: {
    asset: sampleAsset,
    artDirections: [
      {
        media: "(max-width: 768px)",
        width: 768,
        height: 512,
        crop: "fill",
      },
      {
        media: "(min-width: 769px)",
        width: 1440,
        height: 960,
        crop: "limit",
      },
    ],
    lazyRootMargin: "500px",
  },
};
