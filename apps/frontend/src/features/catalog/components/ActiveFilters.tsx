import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface FilterChip {
  label: string;
  onRemove: () => void;
}

interface ActiveFiltersProps {
  chips: FilterChip[];
  onClearAll?: () => void;
}

export function ActiveFilters({ chips, onClearAll }: ActiveFiltersProps): JSX.Element | null {
  if (chips.length === 0) {
    return <></>;
  }

  return (
    <div className="border-lumi-border/70 flex flex-wrap items-center gap-3 rounded-2xl border bg-white/70 px-4 py-3 shadow-sm backdrop-blur">
      {chips.map((chip) => (
        <Badge
          key={chip.label}
          variant="outline"
          className="flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em]"
        >
          {chip.label}
          <button
            type="button"
            onClick={chip.onRemove}
            aria-label={`Remove ${chip.label}`}
            className="text-lumi-text-secondary hover:text-lumi-text transition"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {onClearAll && (
        <Button
          variant="ghost"
          className="text-[11px] uppercase tracking-[0.2em]"
          onClick={onClearAll}
        >
          Clear All
        </Button>
      )}
    </div>
  );
}
