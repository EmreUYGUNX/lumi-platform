"use client";

import { memo, useCallback, useMemo, useState } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const DEFAULT_VALUE =
  "Shipping handoffs are unified across dashboard and admin. Compose drop announcements, policy updates, or operator runbooks without blocking the core navigation path.";

type Toggle = "bold" | "italic" | "mono";

const ToggleButton = memo(
  ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "border-lumi-border/70 text-lumi-text-secondary hover:text-lumi-text inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-semibold transition",
        active && "bg-lumi-bg-secondary text-lumi-text",
      )}
      aria-pressed={active}
    >
      {label}
    </button>
  ),
);
ToggleButton.displayName = "ToggleButton";

export default function RichTextEditorPanel(): JSX.Element {
  const [value, setValue] = useState(DEFAULT_VALUE);
  const [toggles, setToggles] = useState<Record<Toggle, boolean>>({
    bold: true,
    italic: false,
    mono: false,
  });

  const onChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(event.target.value);
  }, []);

  const toggle = useCallback((key: Toggle) => {
    setToggles((previous) => {
      if (key === "bold") {
        return { ...previous, bold: !previous.bold };
      }
      if (key === "italic") {
        return { ...previous, italic: !previous.italic };
      }
      return { ...previous, mono: !previous.mono };
    });
  }, []);

  const metrics = useMemo(() => {
    const words = value.trim().split(/\s+/u).filter(Boolean).length;
    const characters = value.length;
    const lines = value.split(/\n/u).length;
    return { words, characters, lines };
  }, [value]);

  const textClassName = useMemo(
    () =>
      cn(
        "border-lumi-border/70 bg-lumi-bg-secondary/70 focus:border-lumi-primary focus:ring-lumi-primary/30 w-full resize-none rounded-xl border p-4 text-sm leading-relaxed shadow-inner outline-none transition focus:ring-2",
        toggles.bold && "font-semibold",
        toggles.italic && "italic",
        toggles.mono && "font-mono",
      ),
    [toggles.bold, toggles.italic, toggles.mono],
  );

  return (
    <Card className="border-lumi-border/70">
      <CardHeader className="space-y-1">
        <CardTitle>Rich text editor</CardTitle>
        <CardDescription>
          Deferred via <code>dynamic()</code> to keep the primary dashboard render path lean.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <ToggleButton label="Bold" active={toggles.bold} onClick={() => toggle("bold")} />
          <ToggleButton label="Italic" active={toggles.italic} onClick={() => toggle("italic")} />
          <ToggleButton label="Mono" active={toggles.mono} onClick={() => toggle("mono")} />
        </div>
        <textarea
          rows={5}
          value={value}
          onChange={onChange}
          className={textClassName}
          aria-label="Rich text editor"
        />
        <Separator className="bg-lumi-border/70" />
        <div className="text-lumi-text-secondary grid gap-2 text-xs sm:grid-cols-3">
          <p>
            <span className="text-lumi-text font-semibold">{metrics.words}</span> words
          </p>
          <p>
            <span className="text-lumi-text font-semibold">{metrics.characters}</span> characters
          </p>
          <p>
            <span className="text-lumi-text font-semibold">{metrics.lines}</span> lines
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
