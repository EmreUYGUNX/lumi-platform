"use client";

import type { ReactElement } from "react";

import dynamic from "next/dynamic";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

const PanelSkeleton = (): ReactElement => (
  <Card className="border-lumi-border/60">
    <CardHeader>
      <CardTitle>
        <Skeleton className="h-5 w-40" />
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-3">
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-5/6" />
      <Skeleton className="h-6 w-2/3" />
    </CardContent>
  </Card>
);

export const AdminChartsPanel = dynamic(() => import("./panels/AdminChartsPanel"), {
  loading: () => <PanelSkeleton />,
  ssr: false,
});

export const RichTextEditorPanel = dynamic(() => import("./panels/RichTextEditorPanel"), {
  loading: () => <PanelSkeleton />,
  ssr: false,
});

export const ImageGalleryPanel = dynamic(() => import("./panels/ImageGalleryPanel"), {
  loading: () => <PanelSkeleton />,
});

export const MapCoveragePanel = dynamic(() => import("./panels/MapCoveragePanel"), {
  loading: () => <PanelSkeleton />,
  ssr: false,
});
