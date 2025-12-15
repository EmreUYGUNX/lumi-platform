"use client";

import { useEffect, useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Trash2, UploadCloud } from "lucide-react";

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
import { useAdminClipartAsset } from "@/features/customization/hooks/useAdminClipartAsset";
import { useAdminClipartAssets } from "@/features/customization/hooks/useAdminClipartAssets";
import { clipartKeys } from "@/features/customization/hooks/clipart.keys";
import {
  clipartAssetSchema,
  clipartUploadResultSchema,
} from "@/features/customization/types/clipart.types";

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

const deleteClipartRequest = async (id: string): Promise<void> => {
  const token = sessionStore.getState().accessToken;

  const response = await fetch(`${apiBaseUrl}/admin/clipart/${id}`, {
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

interface ClipartUploadFormState {
  files: File[];
  category: string;
  description: string;
  tags: string;
  isPaid: boolean;
  priceAmount: string;
  currency: string;
  thumbnailUrl: string;
}

const defaultUploadState = (): ClipartUploadFormState => ({
  files: [],
  category: "",
  description: "",
  tags: "",
  isPaid: false,
  priceAmount: "0",
  currency: "TRY",
  thumbnailUrl: "",
});

interface ClipartEditState {
  name: string;
  category: string;
  description: string;
  tags: string;
  isPaid: boolean;
  priceAmount: string;
  currency: string;
  thumbnailUrl: string;
}

export default function AdminClipartPage(): JSX.Element {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [searchTag, setSearchTag] = useState<string | undefined>();
  const [category, setCategory] = useState("");
  const [paid, setPaid] = useState<PaidFilter>("all");
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
  }, [searchTag, category, paid, perPage]);

  const clipartQuery = useAdminClipartAssets({
    page,
    perPage,
    category: toOptionalString(category),
    tag: searchTag,
    isPaid: paid === "all" ? undefined : paid === "paid",
    sort: "newest",
    order: "desc",
  });

  const clipart = clipartQuery.data?.items ?? [];
  const pagination = clipartQuery.data?.pagination;

  const canPrev = Boolean(pagination?.hasPreviousPage);
  const canNext = Boolean(pagination?.hasNextPage);

  const [uploadState, setUploadState] = useState<ClipartUploadFormState>(() =>
    defaultUploadState(),
  );
  const [uploadFailures, setUploadFailures] = useState<{ filename: string; message: string }[]>([]);

  const uploadMutation = useMutation<void, Error, ClipartUploadFormState>({
    mutationFn: async (state) => {
      if (state.files.length === 0) {
        throw new Error("Select one or more SVG files.");
      }

      const formData = new FormData();
      state.files.forEach((file) => {
        formData.append("files", file, file.name);
      });

      if (toOptionalString(state.category)) formData.append("category", state.category.trim());
      if (toOptionalString(state.description))
        formData.append("description", state.description.trim());
      if (toOptionalString(state.tags)) formData.append("tags", state.tags);
      if (toOptionalString(state.thumbnailUrl))
        formData.append("thumbnailUrl", state.thumbnailUrl.trim());
      formData.append("isPaid", String(state.isPaid));
      formData.append("priceAmount", state.priceAmount);
      formData.append("currency", state.currency.toUpperCase());

      const response = await apiClient.post("/admin/clipart", {
        body: formData,
        dataSchema: clipartUploadResultSchema,
      });

      setUploadFailures(response.data.failures);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clipartKeys.all() }).catch(() => {});
      setUploadState(defaultUploadState());
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Uploaded",
        description: "Clipart upload processed.",
      });
    },
    onError: (error) => {
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Upload failed",
        description: error.message || "Unable to upload clipart.",
      });
    },
  });

  const deleteMutation = useMutation<void, Error, string>({
    mutationFn: deleteClipartRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clipartKeys.all() }).catch(() => {});
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Deleted",
        description: "Clipart deleted.",
      });
    },
    onError: (error) => {
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Delete failed",
        description: error.message || "Unable to delete clipart.",
      });
    },
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [hydratedForId, setHydratedForId] = useState<string | undefined>();
  const [editState, setEditState] = useState<ClipartEditState | undefined>();

  const editQuery = useAdminClipartAsset(editingId);

  useEffect(() => {
    if (!editOpen) return;
    if (!editingId) return;
    if (!editQuery.data) return;
    if (hydratedForId === editingId) return;

    const asset = editQuery.data;
    setEditState({
      name: asset.name,
      category: asset.category ?? "",
      description: asset.description ?? "",
      tags: asset.tags.join(", "),
      isPaid: asset.isPaid,
      priceAmount: asset.price.amount,
      currency: asset.price.currency,
      thumbnailUrl: asset.thumbnailUrl ?? "",
    });
    setHydratedForId(editingId);
  }, [editOpen, editQuery.data, editingId, hydratedForId]);

  const updateMutation = useMutation<void, Error, { id: string; state: ClipartEditState }>({
    mutationFn: async ({ id, state }) => {
      await apiClient.put(`/admin/clipart/${id}`, {
        body: {
          name: state.name,
          category: toOptionalString(state.category),
          description: toOptionalString(state.description),
          tags: state.tags,
          isPaid: state.isPaid,
          priceAmount: state.priceAmount,
          currency: state.currency,
          thumbnailUrl: toOptionalString(state.thumbnailUrl),
        },
        dataSchema: clipartAssetSchema,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clipartKeys.all() }).catch(() => {});
      setEditOpen(false);
      setEditingId(undefined);
      setHydratedForId(undefined);
      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Saved",
        description: "Clipart updated.",
      });
    },
    onError: (error) => {
      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Save failed",
        description: error.message || "Unable to update clipart.",
      });
    },
  });

  const pageLabel = useMemo(() => {
    if (!pagination) return `Page ${page}`;
    return `Page ${pagination.page} / ${pagination.totalPages}`;
  }, [page, pagination]);

  return (
    <div className="space-y-6">
      <div className="border-lumi-border/70 bg-lumi-bg shadow-glow rounded-3xl border p-6">
        <p className="text-lumi-text-secondary text-sm uppercase tracking-[0.3em]">
          Admin · Design library
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Clipart assets</h1>
        <p className="text-lumi-text-secondary mt-1 text-sm">
          Upload SVG clipart, adjust metadata, and make them available in the editor library.
        </p>
      </div>

      <Card className="border-lumi-border/70">
        <CardContent className="space-y-4 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-2">
              <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                Bulk upload (SVG)
              </p>
              <input
                type="file"
                multiple
                accept="image/svg+xml"
                onChange={(event) => {
                  const files = [...(event.target.files ?? [])];
                  setUploadState((prev) => ({ ...prev, files }));
                }}
              />
            </div>

            <Button
              type="button"
              className="rounded-full"
              onClick={() => uploadMutation.mutate(uploadState)}
              disabled={uploadMutation.isPending}
            >
              {uploadMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              Upload
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Input
              value={uploadState.category}
              onChange={(event) =>
                setUploadState((prev) => ({ ...prev, category: event.target.value }))
              }
              placeholder="Category (optional)"
              className="border-lumi-border/70 h-10 bg-white/70"
            />
            <Input
              value={uploadState.tags}
              onChange={(event) =>
                setUploadState((prev) => ({ ...prev, tags: event.target.value }))
              }
              placeholder="Tags (comma separated)"
              className="border-lumi-border/70 h-10 bg-white/70"
            />
            <Input
              value={uploadState.thumbnailUrl}
              onChange={(event) =>
                setUploadState((prev) => ({ ...prev, thumbnailUrl: event.target.value }))
              }
              placeholder="Thumbnail URL (optional)"
              className="border-lumi-border/70 h-10 bg-white/70"
            />
            <Input
              value={uploadState.description}
              onChange={(event) =>
                setUploadState((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Description (optional)"
              className="border-lumi-border/70 h-10 bg-white/70"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={uploadState.isPaid}
                onChange={(event) =>
                  setUploadState((prev) => ({ ...prev, isPaid: event.target.checked }))
                }
              />
              Paid
            </label>
            <Input
              value={uploadState.priceAmount}
              onChange={(event) =>
                setUploadState((prev) => ({ ...prev, priceAmount: event.target.value }))
              }
              className="border-lumi-border/70 h-10 w-32 bg-white/70"
              placeholder="0"
              inputMode="decimal"
            />
            <Input
              value={uploadState.currency}
              onChange={(event) =>
                setUploadState((prev) => ({ ...prev, currency: event.target.value.toUpperCase() }))
              }
              className="border-lumi-border/70 h-10 w-24 bg-white/70"
              placeholder="TRY"
            />
          </div>

          {uploadFailures.length > 0 && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-50/40 p-4">
              <p className="text-sm font-semibold">Some files failed</p>
              <ul className="text-lumi-text-secondary mt-2 space-y-1 text-xs">
                {uploadFailures.slice(0, 5).map((failure) => (
                  <li key={failure.filename}>
                    {failure.filename}: {failure.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

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
                placeholder="e.g. star"
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
                placeholder="e.g. icons"
                className="border-lumi-border/70 h-10 bg-white/70"
              />
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
            <div className="space-y-2">
              <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                Page size
              </p>
              <Input
                type="number"
                min={5}
                max={200}
                value={perPage}
                onChange={(event) => setPerPage(Number(event.target.value) || 25)}
                className="border-lumi-border/70 h-10 bg-white/70"
              />
            </div>
          </div>

          {clipartQuery.isLoading ? (
            <div className="text-lumi-text-secondary flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading clipart…
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Preview</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Tags</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Usage</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clipart.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-lumi-text-secondary text-sm">
                      No clipart found.
                    </TableCell>
                  </TableRow>
                )}

                {clipart.map((asset) => (
                  <TableRow key={asset.id}>
                    <TableCell>
                      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-black/10 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element -- Inline SVG preview */}
                        <img
                          src={`data:image/svg+xml;utf8,${encodeURIComponent(asset.svg)}`}
                          alt={asset.name}
                          className="h-10 w-10 object-contain"
                          loading="lazy"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">{asset.name}</TableCell>
                    <TableCell className="text-sm">{asset.category ?? "—"}</TableCell>
                    <TableCell className="text-lumi-text-secondary text-sm">
                      {asset.tags.slice(0, 4).join(", ")}
                      {asset.tags.length > 4 ? "…" : ""}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant={asset.isPaid ? "secondary" : "default"}>
                          {asset.isPaid ? `${asset.price.amount} ${asset.price.currency}` : "Free"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-sm">{asset.usageCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            setEditingId(asset.id);
                            setEditOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            const confirmed = window.confirm(`Delete clipart “${asset.name}”?`);
                            if (!confirmed) return;
                            deleteMutation.mutate(asset.id);
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
                disabled={!canPrev || clipartQuery.isFetching}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={!canNext || clipartQuery.isFetching}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={editOpen}
        onOpenChange={(next) => {
          setEditOpen(next);
          if (!next) {
            setEditingId(undefined);
            setHydratedForId(undefined);
            setEditState(undefined);
          }
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit clipart metadata</DialogTitle>
          </DialogHeader>

          {editingId && editQuery.isLoading ? (
            <div className="text-lumi-text-secondary flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading clipart…
            </div>
          ) : editState ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                    Name
                  </span>
                  <Input
                    value={editState.name}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, name: event.target.value } : prev))
                    }
                    className="border-lumi-border/70 h-10 bg-white/70"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                    Category
                  </span>
                  <Input
                    value={editState.category}
                    onChange={(event) =>
                      setEditState((prev) =>
                        prev ? { ...prev, category: event.target.value } : prev,
                      )
                    }
                    className="border-lumi-border/70 h-10 bg-white/70"
                  />
                </label>
              </div>

              <label className="space-y-1">
                <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                  Description
                </span>
                <Textarea
                  value={editState.description}
                  onChange={(event) =>
                    setEditState((prev) =>
                      prev ? { ...prev, description: event.target.value } : prev,
                    )
                  }
                  className="border-lumi-border/70 bg-white/70"
                  rows={4}
                />
              </label>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                    Tags
                  </span>
                  <Input
                    value={editState.tags}
                    onChange={(event) =>
                      setEditState((prev) => (prev ? { ...prev, tags: event.target.value } : prev))
                    }
                    className="border-lumi-border/70 h-10 bg-white/70"
                    placeholder="star, icon"
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
                    Thumbnail URL
                  </span>
                  <Input
                    value={editState.thumbnailUrl}
                    onChange={(event) =>
                      setEditState((prev) =>
                        prev ? { ...prev, thumbnailUrl: event.target.value } : prev,
                      )
                    }
                    className="border-lumi-border/70 h-10 bg-white/70"
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editState.isPaid}
                    onChange={(event) =>
                      setEditState((prev) =>
                        prev ? { ...prev, isPaid: event.target.checked } : prev,
                      )
                    }
                  />
                  Paid
                </label>
                <Input
                  value={editState.priceAmount}
                  onChange={(event) =>
                    setEditState((prev) =>
                      prev ? { ...prev, priceAmount: event.target.value } : prev,
                    )
                  }
                  className="border-lumi-border/70 h-10 w-32 bg-white/70"
                  inputMode="decimal"
                />
                <Input
                  value={editState.currency}
                  onChange={(event) =>
                    setEditState((prev) =>
                      prev ? { ...prev, currency: event.target.value.toUpperCase() } : prev,
                    )
                  }
                  className="border-lumi-border/70 h-10 w-24 bg-white/70"
                />
              </div>
            </div>
          ) : (
            <p className="text-lumi-text-secondary text-sm">Select a clipart asset to edit.</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-full"
              disabled={!editingId || !editState || updateMutation.isPending}
              onClick={() => {
                if (!editingId || !editState) return;
                updateMutation.mutate({ id: editingId, state: editState });
              }}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
