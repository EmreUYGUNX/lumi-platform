"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export function SocialLoginButtons(): JSX.Element {
  return (
    <div className="space-y-3">
      <div className="text-lumi-text-secondary flex items-center gap-2 text-xs uppercase tracking-wide">
        <Separator className="flex-1" />
        <span className="shrink-0">veya</span>
        <Separator className="flex-1" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Button type="button" variant="outline" disabled className="w-full">
          Google (yakında)
        </Button>
        <Button type="button" variant="outline" disabled className="w-full">
          GitHub (yakında)
        </Button>
      </div>
    </div>
  );
}
