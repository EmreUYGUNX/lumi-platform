import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import type { ProductionPaginationMeta } from "../types/production.types";

interface ProductionPaginationControlsProps {
  pagination: ProductionPaginationMeta;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50];

export function ProductionPaginationControls({
  pagination,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: ProductionPaginationControlsProps): JSX.Element {
  const { page, pageSize, totalItems, hasNextPage, hasPreviousPage } = pagination;

  const from = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems);

  return (
    <div className="border-lumi-border/70 flex flex-col gap-4 rounded-2xl border bg-white/70 p-4 shadow-sm backdrop-blur md:flex-row md:items-center md:justify-between">
      <div className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.2em]">
        Showing {from}-{to} of {totalItems} orders
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
        <div className="flex items-center gap-2">
          {pageSizeOptions.map((size) => (
            <Button
              key={size}
              variant={size === pageSize ? "default" : "outline"}
              className={cn(
                "h-9 min-w-[54px] text-[10px] uppercase tracking-[0.18em]",
                size === pageSize ? "bg-lumi-text text-white" : "border-lumi-border",
              )}
              onClick={() => onPageSizeChange(size)}
            >
              {size}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-9 w-9"
            disabled={!hasPreviousPage}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em]">Page {page}</span>
          <Button
            variant="outline"
            className="h-9 w-9"
            disabled={!hasNextPage}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
