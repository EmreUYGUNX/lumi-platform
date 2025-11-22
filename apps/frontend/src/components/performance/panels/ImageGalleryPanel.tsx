"use client";

import { memo, useMemo } from "react";

import Image, { type ImageLoader } from "next/image";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  buildBlurPlaceholder,
  buildSizesAttribute,
  createCloudinaryLoader,
} from "@/lib/cloudinary";
import { cloudinaryImageLoader } from "@/lib/image-loader";

import styles from "./ImageGallery.module.css";

interface GalleryItem {
  id: string;
  title: string;
  publicId: string;
  width: number;
  height: number;
  tag: string;
  priority?: boolean;
  tone?: "primary" | "secondary";
}

const blurPrimary = buildBlurPlaceholder("#3B82F6");
const blurSecondary = buildBlurPlaceholder("#8B5CF6");

const GalleryTile = memo(({ item, loader }: { item: GalleryItem; loader: ImageLoader }) => {
  const blur = item.tone === "secondary" ? blurSecondary : blurPrimary;

  return (
    <figure className={styles.tile}>
      <Image
        loader={loader}
        src={item.publicId}
        alt={item.title}
        width={item.width}
        height={item.height}
        sizes={buildSizesAttribute("gallery")}
        placeholder="blur"
        blurDataURL={blur}
        priority={item.priority}
        loading={item.priority ? undefined : "lazy"}
        className="h-full w-full object-cover"
      />
      <figcaption className={styles.caption}>
        <span className="text-lumi-text">{item.title}</span>
        <span className={styles.tag}>{item.tag}</span>
      </figcaption>
    </figure>
  );
});
GalleryTile.displayName = "GalleryTile";

export default function ImageGalleryPanel(): JSX.Element {
  const fallbackBaseUrl = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    ? undefined
    : "https://res.cloudinary.com/demo/image/upload";

  const loader = useMemo<ImageLoader>(
    () =>
      fallbackBaseUrl
        ? createCloudinaryLoader({ baseUrl: fallbackBaseUrl })
        : cloudinaryImageLoader,
    [fallbackBaseUrl],
  );

  const items = useMemo<GalleryItem[]>(
    () => [
      {
        id: "lookbook",
        title: "Adaptive lookbook",
        publicId: "samples/ecommerce/leather-bag-gray",
        width: 900,
        height: 620,
        tag: "Above the fold",
        priority: true,
      },
      {
        id: "workflow",
        title: "Workflow orchestration",
        publicId: "samples/ecommerce/analog-classic",
        width: 900,
        height: 620,
        tag: "Lazy loaded",
        tone: "secondary",
      },
      {
        id: "media",
        title: "Media automation",
        publicId: "samples/ecommerce/violin-case",
        width: 900,
        height: 620,
        tag: "Lazy loaded",
      },
    ],
    [],
  );

  return (
    <Card className="border-lumi-border/70">
      <CardHeader className="space-y-1">
        <CardTitle>Responsive image gallery</CardTitle>
        <CardDescription>
          Cloudinary-backed <code>next/image</code> tiles with LQIP placeholders, lazy loading, and
          tailored sizes for every breakpoint.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={styles.galleryGrid}>
          {items.map((item) => (
            <GalleryTile key={item.id} item={item} loader={loader} />
          ))}
        </div>
        <Separator className="bg-lumi-border/70" />
        <p className="text-lumi-text-secondary text-sm leading-relaxed">
          Priority is reserved for above-fold media only; all other tiles rely on{" "}
          <code>loading</code>
          {'="lazy"'} and Cloudinary breakpoints to stay under the 180KB initial bundle ceiling.
        </p>
      </CardContent>
    </Card>
  );
}
