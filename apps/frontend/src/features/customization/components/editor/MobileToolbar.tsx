"use client";

import { useCallback, useMemo, useState } from "react";

import {
  Copy,
  Image as ImageIcon,
  Layers,
  MousePointer2,
  Redo2,
  SlidersHorizontal,
  Trash2,
  Type,
  Undo2,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

import type { CanvasTool } from "./CanvasToolbar";

type MobilePanel = "tool" | "properties" | "layers";

interface ToolConfig {
  tool: CanvasTool;
  label: string;
  Icon: typeof MousePointer2;
  opensPanel: boolean;
}

const TOOL_CONFIGS: readonly ToolConfig[] = [
  { tool: "select", label: "Select", Icon: MousePointer2, opensPanel: false },
  { tool: "text", label: "Text", Icon: Type, opensPanel: true },
  { tool: "image", label: "Image", Icon: ImageIcon, opensPanel: true },
  { tool: "library", label: "Library", Icon: Layers, opensPanel: false },
];

export interface MobileToolbarProps {
  activeTool: CanvasTool;
  onToolChange: (tool: CanvasTool) => void;

  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;

  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelected: () => void;
  onDuplicateSelected: () => void;

  toolPanel: React.ReactNode;
  propertiesPanel: React.ReactNode;
  layersPanel: React.ReactNode;

  readOnly?: boolean;
  className?: string;
}

const TOOLBAR_BUTTON_CLASS =
  "h-14 w-14 shrink-0 rounded-2xl border border-white/10 bg-black/10 text-white/80 hover:bg-white/10";

export function MobileToolbar({
  activeTool,
  onToolChange,
  hasSelection,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onDeleteSelected,
  onDuplicateSelected,
  toolPanel,
  propertiesPanel,
  layersPanel,
  readOnly = false,
  className,
}: MobileToolbarProps): JSX.Element {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [panel, setPanel] = useState<MobilePanel>("tool");

  const openPanel = useCallback((nextPanel: MobilePanel) => {
    setPanel(nextPanel);
    setSheetOpen(true);
  }, []);

  const handleToolPress = useCallback(
    (tool: CanvasTool) => {
      onToolChange(tool);

      const config = TOOL_CONFIGS.find((entry) => entry.tool === tool);
      if (config?.opensPanel) {
        openPanel("tool");
        return;
      }

      setSheetOpen(false);
    },
    [onToolChange, openPanel],
  );

  const headerLabel = useMemo(() => {
    if (panel === "layers") return "LAYERS";
    if (panel === "properties") return "PROPERTIES";
    return "TOOLS";
  }, [panel]);

  return (
    <>
      <nav
        className={cn(
          "fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/70 backdrop-blur supports-[backdrop-filter]:bg-black/50",
          className,
        )}
        aria-label="Mobile editor toolbar"
      >
        <div className="mx-auto flex max-w-3xl items-center gap-2 overflow-x-auto px-2 py-2 [padding-bottom:calc(env(safe-area-inset-bottom)+0.5rem)]">
          {TOOL_CONFIGS.map(({ tool, label, Icon }) => (
            <Button
              key={tool}
              type="button"
              variant={activeTool === tool ? "secondary" : "ghost"}
              className={cn(TOOLBAR_BUTTON_CLASS, activeTool === tool && "bg-white/15")}
              onClick={() => handleToolPress(tool)}
              disabled={readOnly && tool !== "select"}
              aria-label={label}
            >
              <Icon className="h-5 w-5" />
            </Button>
          ))}

          <div className="h-10 w-px shrink-0 bg-white/10" aria-hidden="true" />

          <Button
            type="button"
            variant="ghost"
            className={TOOLBAR_BUTTON_CLASS}
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo"
          >
            <Undo2 className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={TOOLBAR_BUTTON_CLASS}
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo"
          >
            <Redo2 className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={TOOLBAR_BUTTON_CLASS}
            onClick={onDuplicateSelected}
            disabled={readOnly || !hasSelection}
            aria-label="Duplicate"
          >
            <Copy className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={cn(TOOLBAR_BUTTON_CLASS, "text-red-100 hover:text-red-50")}
            onClick={onDeleteSelected}
            disabled={readOnly || !hasSelection}
            aria-label="Delete"
          >
            <Trash2 className="h-5 w-5" />
          </Button>

          <div className="h-10 w-px shrink-0 bg-white/10" aria-hidden="true" />

          <Button
            type="button"
            variant="ghost"
            className={cn(TOOLBAR_BUTTON_CLASS, sheetOpen && panel === "layers" && "bg-white/15")}
            onClick={() => openPanel("layers")}
            aria-label="Layers"
          >
            <Layers className="h-5 w-5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              TOOLBAR_BUTTON_CLASS,
              sheetOpen && panel === "properties" && "bg-white/15",
            )}
            onClick={() => openPanel("properties")}
            aria-label="Properties"
          >
            <SlidersHorizontal className="h-5 w-5" />
          </Button>
        </div>
      </nav>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[78dvh] rounded-t-3xl border-white/10 bg-black/90 px-4 pb-6 pt-4 text-white shadow-2xl"
        >
          <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-white/10" aria-hidden="true" />

          <SheetHeader className="space-y-1 pb-3">
            <SheetTitle className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/80">
              {headerLabel}
            </SheetTitle>
          </SheetHeader>

          <Tabs value={panel} onValueChange={(value) => setPanel(value as MobilePanel)}>
            <TabsList className="h-11 w-full justify-start rounded-2xl border border-white/10 bg-black/40 p-1">
              <TabsTrigger
                value="tool"
                className="h-9 rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
              >
                Tool
              </TabsTrigger>
              <TabsTrigger
                value="properties"
                className="h-9 rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
              >
                Properties
              </TabsTrigger>
              <TabsTrigger
                value="layers"
                className="h-9 rounded-xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
              >
                Layers
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tool" className="mt-4">
              <Accordion
                type="single"
                collapsible
                defaultValue="tools"
                className="rounded-2xl border border-white/10 bg-black/30"
              >
                <AccordionItem value="tools" className="border-white/10 px-4">
                  <AccordionTrigger className="py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80 hover:no-underline">
                    Tool group
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="flex flex-wrap gap-2">
                      {TOOL_CONFIGS.map(({ tool, label, Icon }) => (
                        <Button
                          key={tool}
                          type="button"
                          variant={activeTool === tool ? "secondary" : "ghost"}
                          className="h-11 rounded-2xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
                          onClick={() => handleToolPress(tool)}
                          disabled={readOnly && tool !== "select"}
                        >
                          <Icon className="h-4 w-4" />
                          {label}
                        </Button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="actions" className="border-white/10 px-4">
                  <AccordionTrigger className="py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80 hover:no-underline">
                    Quick actions
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-11 rounded-2xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
                        onClick={onUndo}
                        disabled={!canUndo}
                      >
                        <Undo2 className="h-4 w-4" />
                        Undo
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-11 rounded-2xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
                        onClick={onRedo}
                        disabled={!canRedo}
                      >
                        <Redo2 className="h-4 w-4" />
                        Redo
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-11 rounded-2xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
                        onClick={onDuplicateSelected}
                        disabled={readOnly || !hasSelection}
                      >
                        <Copy className="h-4 w-4" />
                        Duplicate
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="h-11 rounded-2xl px-4 text-[11px] font-semibold uppercase tracking-[0.18em]"
                        onClick={onDeleteSelected}
                        disabled={readOnly || !hasSelection}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="mt-4 max-h-[50dvh] overflow-y-auto pr-1">{toolPanel}</div>
            </TabsContent>

            <TabsContent value="properties" className="mt-4 max-h-[62dvh] overflow-y-auto pr-1">
              {propertiesPanel}
            </TabsContent>

            <TabsContent value="layers" className="mt-4 max-h-[62dvh] overflow-y-auto pr-1">
              {layersPanel}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </>
  );
}
