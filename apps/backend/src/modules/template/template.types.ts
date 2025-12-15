import type { MoneyDTO } from "@lumi/shared/dto";

export interface DesignTemplateSummaryView {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags: string[];
  isPaid: boolean;
  price: MoneyDTO;
  thumbnailUrl?: string;
  previewUrl?: string;
  isPublished: boolean;
  isFeatured: boolean;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DesignTemplateView extends DesignTemplateSummaryView {
  canvasData: unknown;
}
