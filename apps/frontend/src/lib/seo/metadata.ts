import type { Metadata } from "next";

import { env } from "@/lib/env";

const SITE_NAME = "Lumi";
const DEFAULT_TWITTER_CARD: Extract<NonNullable<Metadata["twitter"]>, { card?: string }>["card"] =
  "summary_large_image";
const DESCRIPTION_LIMIT = 155;

const normaliseWhitespace = (value: string): string => value.replaceAll(/\s+/gu, " ").trim();

const truncateDescription = (value: string): string => {
  const normalized = normaliseWhitespace(value);
  if (normalized.length <= DESCRIPTION_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, DESCRIPTION_LIMIT - 3).trimEnd()}...`;
};

export const siteUrl = env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/u, "");

export interface GenerateMetadataOptions {
  title: string;
  description: string;
  /**
   * Full URL or path segment to use for canonical and OpenGraph URLs.
   */
  url?: string;
  path?: string;
  image?: {
    url: string;
    width?: number;
    height?: number;
    alt?: string;
  };
  siteName?: string;
  twitterCard?: Extract<NonNullable<Metadata["twitter"]>, { card?: string }>["card"];
  robots?: Metadata["robots"];
}

export const buildAbsoluteUrl = (value?: string): string => {
  if (!value) {
    return siteUrl;
  }

  if (/^https?:\/\//iu.test(value)) {
    return value;
  }

  const normalizedPath = value.startsWith("/") ? value.slice(1) : value;
  return `${siteUrl}/${normalizedPath}`;
};

export const generateMetadata = ({
  title,
  description,
  url,
  path,
  image,
  siteName = SITE_NAME,
  twitterCard,
  robots,
}: GenerateMetadataOptions): Metadata => {
  const resolvedTitle = normaliseWhitespace(title);
  const resolvedDescription = truncateDescription(description);
  const canonical = buildAbsoluteUrl(url ?? path ?? "/");

  const openGraphImage = image
    ? [
        {
          url: buildAbsoluteUrl(image.url),
          width: image.width,
          height: image.height,
          alt: image.alt ?? resolvedTitle,
        },
      ]
    : undefined;

  return {
    title: resolvedTitle,
    description: resolvedDescription,
    alternates: {
      canonical,
    },
    openGraph: {
      title: resolvedTitle,
      description: resolvedDescription,
      url: canonical,
      siteName,
      images: openGraphImage,
    },
    twitter: {
      card: twitterCard ?? (openGraphImage ? DEFAULT_TWITTER_CARD : "summary"),
      title: resolvedTitle,
      description: resolvedDescription,
      images: openGraphImage?.map((entry) => entry.url),
    },
    robots,
  };
};
