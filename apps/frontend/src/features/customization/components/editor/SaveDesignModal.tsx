"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Copy, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type PrivacyOption = "private" | "public";

const parseTags = (value: string): string[] =>
  value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

export interface SaveDesignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;

  name: string;
  onNameChange: (name: string) => void;

  tags: string[];
  onTagsChange: (tags: string[]) => void;

  isPublic: boolean;
  onIsPublicChange: (isPublic: boolean) => void;

  autoSaveEnabled: boolean;
  onAutoSaveEnabledChange: (enabled: boolean) => void;

  canSave: boolean;
  isSaving: boolean;
  statusLabel?: string;

  shareUrl?: string;

  onSave: () => void;
  className?: string;
}

export function SaveDesignModal({
  open,
  onOpenChange,
  name,
  onNameChange,
  tags,
  onTagsChange,
  isPublic,
  onIsPublicChange,
  autoSaveEnabled,
  onAutoSaveEnabledChange,
  canSave,
  isSaving,
  statusLabel,
  shareUrl,
  onSave,
  className,
}: SaveDesignModalProps): JSX.Element {
  const [tagInput, setTagInput] = useState(tags.join(", "));

  const privacyValue: PrivacyOption = isPublic ? "public" : "private";

  useEffect(() => {
    if (!open) return;
    setTagInput(tags.join(", "));
  }, [open, tags]);

  const resolvedStatus = useMemo(
    () => statusLabel ?? (isSaving ? "Saving…" : undefined),
    [isSaving, statusLabel],
  );

  const handlePrivacyChange = useCallback(
    (value: string) => {
      const next = value === "public";
      onIsPublicChange(next);
    },
    [onIsPublicChange],
  );

  const handleTagsBlur = useCallback(() => {
    const parsed = parseTags(tagInput);
    onTagsChange(parsed);
    setTagInput(parsed.join(", "));
  }, [onTagsChange, tagInput]);

  const handleCopyLink = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({ title: "Copied", description: "Share link copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Unable to copy link in this browser." });
    }
  }, [shareUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("max-w-lg border-white/10 bg-black/90 text-white shadow-2xl", className)}
      >
        <DialogHeader className="space-y-2">
          <DialogTitle className="text-lg font-semibold tracking-tight">Save design</DialogTitle>
          <DialogDescription className="text-sm text-white/60">
            Persist your current customization session. Auto-save can keep your work safe while you
            edit.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label
              htmlFor="design-name"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70"
            >
              Design name
            </Label>
            <Input
              id="design-name"
              value={name}
              className="h-10 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-white/40"
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Untitled design"
              maxLength={120}
              disabled={!canSave}
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Privacy
            </Label>
            <Select value={privacyValue} onValueChange={handlePrivacyChange} disabled={!canSave}>
              <SelectTrigger className="h-10 rounded-xl border-white/10 bg-black/20 text-white">
                <SelectValue placeholder="Select privacy" />
              </SelectTrigger>
              <SelectContent className="border-white/10 bg-black/95 text-white">
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="public">Public (share link)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label
              htmlFor="design-tags"
              className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70"
            >
              Tags
            </Label>
            <Input
              id="design-tags"
              value={tagInput}
              className="h-10 rounded-xl border-white/10 bg-black/20 text-white placeholder:text-white/40"
              onChange={(event) => setTagInput(event.target.value)}
              onBlur={handleTagsBlur}
              placeholder="holiday, logo, v1"
              disabled={!canSave}
            />
            <p className="text-[11px] text-white/45">Comma-separated (max 40 tags).</p>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                Auto-save
              </p>
              <p className="text-[11px] text-white/45">Save every minute and on tab close.</p>
            </div>
            <Switch
              checked={autoSaveEnabled}
              onCheckedChange={onAutoSaveEnabledChange}
              aria-label="Auto-save toggle"
              disabled={!canSave}
            />
          </div>

          {shareUrl && (
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-white/60" />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
                    Share link
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="h-8 gap-2 rounded-xl px-3"
                  onClick={() => {
                    handleCopyLink().catch(() => {});
                  }}
                >
                  <Copy className="h-4 w-4" />
                  Copy
                </Button>
              </div>
              <p className="mt-2 break-all text-[11px] text-white/55">{shareUrl}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <div className="mr-auto hidden items-center text-[11px] text-white/60 sm:flex">
            {resolvedStatus}
          </div>
          <Button
            type="button"
            variant="ghost"
            className="h-9 rounded-xl border border-white/10 bg-black/10 px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 hover:bg-white/10"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-9 rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
            disabled={!canSave || isSaving}
            onClick={onSave}
          >
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>

        <div className="mt-2 flex items-center justify-between text-[11px] text-white/60 sm:hidden">
          <span>{resolvedStatus}</span>
          <span>{tags.length > 0 ? `${tags.length} tags` : ""}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
