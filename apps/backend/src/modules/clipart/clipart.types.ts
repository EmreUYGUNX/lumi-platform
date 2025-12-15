import type { MoneyDTO } from "@lumi/shared/dto";

export interface ClipartAssetView {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tags: string[];
  isPaid: boolean;
  price: MoneyDTO;
  svg: string;
  thumbnailUrl?: string;
  usageCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClipartUploadFailure {
  filename: string;
  message: string;
}

export interface ClipartUploadResult {
  uploads: ClipartAssetView[];
  failures: ClipartUploadFailure[];
}
