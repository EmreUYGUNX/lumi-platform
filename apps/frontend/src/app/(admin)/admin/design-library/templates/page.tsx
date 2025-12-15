"use client";

import { useEffect, useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { apiClient, isErrorResponse } from "@/lib/api-client";
import { env } from "@/lib/env";
import { sessionStore, uiStore } from "@/store";
import { useAdminDesignTemplate } from "@/features/customization/hooks/useAdminDesignTemplate";
import { useAdminDesignTemplates } from "@/features/customization/hooks/useAdminDesignTemplates";
import { templateKeys } from "@/features/customization/hooks/template.keys";
import { designTemplateViewSchema } from "@/features/customization/types/templates.types";

type PublishedFilter = "all" | "published" | "draft";
type PaidFilter = "all" | "free" | "paid";

const apiBaseUrl = env.NEXT_PUBLIC_API_URL.replace(/\/+$/u, "");

const buildTagQuery = (value: string): string | undefined => {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;
  const normalized = trimmed
    .replaceAll(/[^\da-z-]+/gu, "-")
    .replaceAll(/-+/gu, "-")
    .slice(0, 32);
  return normalized || undefined;
};

const toOptionalString = (value: string): string | undefined => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const parseJson = (value: string): unknown => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("Canvas data is required.");
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Canvas JSON is invalid: ${error.message}`
        : "Canvas JSON is invalid.",
    );
  }
};

const deleteTemplateRequest = async (id: string): Promise<void> => {
  const token = sessionStore.getState().accessToken;

  const response = await fetch(`${apiBaseUrl}/admin/templates/${id}`, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include",
  });

  if (response.status === 204) return;

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    // ignore parse failures
  }

  if (payload && isErrorResponse(payload)) {
    throw new Error(payload.error.message);
  }

  throw new Error(`Delete failed (HTTP ${response.status}).`);
};

interface TemplateFormState {
  name: string;
  description: string;
  category: string;
  tags: string;
  isPaid: boolean;
  priceAmount: string;
  currency: string;
  thumbnailUrl: string;
  previewUrl: string;
  isPublished: boolean;
  isFeatured: boolean;
  canvasData: string;
}

const createEmptyCanvasData = () =>
  JSON.stringify(
    {
      lumiEditor: {
        version: 1,
        name: "Untitled template",
        tags: [],
        editorLayers: [],
      },
    },
    undefined,
    2,
  );

const defaultFormState = (): TemplateFormState => ({
  name: "",
  description: "",
  category: "",
  tags: "",
  isPaid: false,
  priceAmount: "0",
  currency: "TRY",
  thumbnailUrl: "",
  previewUrl: "",
  isPublished: false,
  isFeatured: false,
  canvasData: createEmptyCanvasData(),
});

export default function AdminDesignTemplatesPage(): JSX.Element {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [searchTag, setSearchTag] = useState<string | undefined>();
  const [category, setCategory] = useState("");
  const [published, setPublished] = useState<PublishedFilter>("all");
  const [paid, setPaid] = useState<PaidFilter>("all");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setSearchTag(buildTagQuery(searchInput));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [searchTag, category, featuredOnly, paid, perPage, published]);

  const templatesQuery = useAdminDesignTemplates({
    page,
    perPage,
    category: toOptionalString(category),
    tag: searchTag,
    isPaid: paid === "all" ? undefined : paid === "paid",
    featured: featuredOnly ? true : undefined,
    published: published === "all" ? undefined : published === "published",
    sort: "newest",
    order: "desc",
  });

  const templates = templatesQuery.data?.items ?? [];
  const pagination = templatesQuery.data?.pagination;

  const canPrev = Boolean(pagination?.hasPreviousPage);
  const canNext = Boolean(pagination?.hasNextPage);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [hydratedForId, setHydratedForId] = useState<string | undefined>();
  const [form, setForm] = useState<TemplateFormState>(() => defaultFormState());

  const editingQuery = useAdminDesignTemplate(editingId);

  useEffect(() => {
    if (!formOpen) return;

    if (!editingId) {
      setHydratedForId(undefined);
      setForm(defaultFormState());
      return;
    }

    if (!editingQuery.data) return;
    if (hydratedForId === editingId) return;

    const template = editingQuery.data;
    setForm({
      name: template.name,
      description: template.description ?? "",
      category: template.category ?? "",
      tags: template.tags.join(", "),
      isPaid: template.isPaid,
      priceAmount: template.price.amount,
      currency: template.price.currency,
      thumbnailUrl: template.thumbnailUrl ?? "",
      previewUrl: template.previewUrl ?? "",
      isPublished: template.isPublished,
      isFeatured: template.isFeatured,
      canvasData: JSON.stringify(template.canvasData, undefined, 2),
    });
    setHydratedForId(editingId);
  }, [editingId, editingQuery.data, formOpen, hydratedForId]);

  const upsertMutation = useMutation<void, Error, { id?: string; state: TemplateFormState }>({
    mutationFn: async ({ id, state }) => {
      const body = {
        name: state.name,
        description: toOptionalString(state.description),
        category: toOptionalString(state.category),
        tags: state.tags,
        isPaid: state.isPaid,
        priceAmount: state.priceAmount,
        currency: state.currency,
        thumbnailUrl: toOptionalString(state.thumbnailUrl),
        previewUrl: toOptionalString(state.previewUrl),
        canvasData: parseJson(state.canvasData),
        isPublished: state.isPublished,
        isFeatured: state.isFeatured,
      };

      if (id) {
        await apiClient.put(`/admin/templates/${id}`, {
          body,
          dataSchema: designTemplateViewSchema,
        });
        return;
      }

      await apiClient.post("/admin/templates", { body, dataSchema: designTemplateViewSchema });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all() }).catch(() => {});
      setFormOpen(false);
      setEditingId(undefined);
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Saved",
        description: "Template saved successfully.",
      });
    },
    onError: (error) => {
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Save failed",
        description: error.message || "Unable to save template.",
      });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteTemplateRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all() }).catch(() => {});
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Deleted",
        description: "Template deleted.",
      });
    },
    onError: (error) => {
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Delete failed",
        description: error.message || "Unable to delete template.",
      });
    },
  });

  const isSaving = upsertMutation.isPending;

  const pageLabel = useMemo(() => {
    if (!pagination) return `Page ${page}`;
    return `Page ${pagination.page} / ${pagination.totalPages}`;
  }, [page, pagination]);

  return (
    <div className="space-y-6">
      <div className="border-lumi-border/70 bg-lumi-bg shadow-glow flex flex-col gap-4 rounded-3xl border p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-2">
          <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">
            Admin · Design library
          </p>
          <h1 className="text-2xl font-semibold">Design templates</h1>
          <p className="text-lumi-text-secondary text-sm">
            Create and manage reusable templates for the product customization editor.
          </p>
        </div>

        <Button
          type="button"
          className="rounded-full"
          onClick={() => {
            setEditingId(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          New template
        </Button>
      </div>

      <Card className="border-lumi-border/70">
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                Tag search
              </p>
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="e.g. logo"
                className="border-lumi-border/70 h-10 bg-white/70"
              />
            </div>

            <div className="space-y-2">
              <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                Category
              </p>
              <Input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="e.g. minimal"
                className="border-lumi-border/70 h-10 bg-white/70"
              />
            </div>

            <div className="space-y-2">
              <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                Published
              </p>
              <div className="flex gap-2">
                {(["all", "published", "draft"] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={published === value ? "secondary" : "outline"}
                    className="h-10 flex-1 rounded-xl text-[11px] uppercase tracking-[0.22em]"
                    onClick={() => setPublished(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                Pricing
              </p>
              <div className="flex gap-2">
                {(["all", "free", "paid"] as const).map((value) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={paid === value ? "secondary" : "outline"}
                    className="h-10 flex-1 rounded-xl text-[11px] uppercase tracking-[0.22em]"
                    onClick={() => setPaid(value)}
                  >
                    {value}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={featuredOnly}
                onChange={(event) => setFeaturedOnly(event.target.checked)}
              />
              Featured only
            </label>

            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={5}
                max={100}
                value={perPage}
                onChange={(event) => setPerPage(Number(event.target.value) || 25)}
                className="border-lumi-border/70 h-10 w-28 bg-white/70"
              />
              <span className="text-lumi-text-secondary text-sm">per page</span>
            </div>
          </div>

          {templatesQuery.isLoading ? (
            <div className="text-lumi-text-secondary flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading templates…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Usage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-lumi-text-secondary text-sm">
                      No templates found.
                    </TableCell>
                  </TableRow>
                )}

                {templates.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <p className="font-semibold">{template.name}</p>
                        <p className="text-lumi-text-secondary text-xs">
                          {template.isPaid
                            ? `${template.price.amount} ${template.price.currency}`
                            : "Free"}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{template.category ?? "—"}</TableCell>
                    <TableCell className="text-lumi-text-secondary text-sm">
                      {template.tags.slice(0, 4).join(", ")}
                      {template.tags.length > 4 ? "…" : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={template.isPublished ? "default" : "secondary"}>
                          {template.isPublished ? "Published" : "Draft"}
                        </Badge>
                        {template.isFeatured && <Badge variant="secondary">Featured</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{template.usageCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setEditingId(template.id);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const confirmed = window.confirm(`Delete template “${template.name}”?`);
                            if (!confirmed) return;
                            deleteMutation.mutate(template.id);
                          }}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-lumi-text-secondary text-sm">{pageLabel}</p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={!canPrev || templatesQuery.isFetching}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={!canNext || templatesQuery.isFetching}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={formOpen}
        onOpenChange={(next) => {
          setFormOpen(next);
          if (!next) {
            setEditingId(undefined);
            setHydratedForId(undefined);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit template" : "New template"}</DialogTitle>
          </DialogHeader>

          {editingId && editingQuery.isLoading ? (
            <div className="text-lumi-text-secondary flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading template…
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="space-y-1">
                  <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                    Name
                  </span>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="border-lumi-border/70 h-10 bg-white/70"
                    placeholder="Minimal logo"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                    Description
                  </span>
                  <Textarea
                    value={form.description}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                    className="border-lumi-border/70 bg-white/70"
                    rows={4}
                    placeholder="Where/when to use this template…"
                  />
                </label>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                      Category
                    </span>
                    <Input
                      value={form.category}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, category: event.target.value }))
                      }
                      className="border-lumi-border/70 h-10 bg-white/70"
                      placeholder="minimal"
                    />
                  </label>

                  <label className="space-y-1">
                    <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                      Tags
                    </span>
                    <Input
                      value={form.tags}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, tags: event.target.value }))
                      }
                      className="border-lumi-border/70 h-10 bg-white/70"
                      placeholder="logo, clean"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isPaid}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, isPaid: event.target.checked }))
                      }
                    />
                    Paid
                  </label>
                  <label className="space-y-1">
                    <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                      Price
                    </span>
                    <Input
                      value={form.priceAmount}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, priceAmount: event.target.value }))
                      }
                      className="border-lumi-border/70 h-10 bg-white/70"
                      inputMode="decimal"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                      Currency
                    </span>
                    <Input
                      value={form.currency}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
                      }
                      className="border-lumi-border/70 h-10 bg-white/70"
                      placeholder="TRY"
                    />
                  </label>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1">
                    <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                      Thumbnail URL
                    </span>
                    <Input
                      value={form.thumbnailUrl}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, thumbnailUrl: event.target.value }))
                      }
                      className="border-lumi-border/70 h-10 bg-white/70"
                      placeholder="https://…"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                      Preview URL
                    </span>
                    <Input
                      value={form.previewUrl}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, previewUrl: event.target.value }))
                      }
                      className="border-lumi-border/70 h-10 bg-white/70"
                      placeholder="https://…"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isPublished}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, isPublished: event.target.checked }))
                      }
                    />
                    Published
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form.isFeatured}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, isFeatured: event.target.checked }))
                      }
                    />
                    Featured
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                    Canvas data (JSON)
                  </p>
                  <p className="text-lumi-text-secondary text-xs">
                    Paste the editor export payload (must include `lumiEditor.editorLayers`).
                  </p>
                </div>

                <Textarea
                  value={form.canvasData}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, canvasData: event.target.value }))
                  }
                  className="border-lumi-border/70 bg-white/70 font-mono text-xs"
                  rows={18}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setFormOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full"
              onClick={() => upsertMutation.mutate({ id: editingId ?? undefined, state: form })}
              disabled={isSaving || (editingId ? editingQuery.isLoading : false)}
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
