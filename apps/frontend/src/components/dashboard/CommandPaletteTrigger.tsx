"use client";

import { useMemo, useState } from "react";

import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const shortcuts = [
  "Create new product",
  "Open analytics",
  "Invite teammate",
  "Contact support",
] as const;

export function CommandPaletteTrigger(): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    return shortcuts.filter((item) => item.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  return (
    <>
      <Button variant="outline" className="flex items-center gap-2" onClick={() => setOpen(true)}>
        <Search className="h-4 w-4" />
        Command (⌘K)
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-lumi-bg text-lumi-text">
          <DialogHeader>
            <DialogTitle>Quick command palette</DialogTitle>
            <DialogDescription>Phase 7 will wire these actions to live APIs.</DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Type a command..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
          <ul className="space-y-2">
            {matches.map((item) => (
              <li key={item}>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => setOpen(false)}
                >
                  {item}
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </>
  );
}
