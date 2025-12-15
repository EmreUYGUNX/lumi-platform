"use client";

import { useEffect, useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Save } from "lucide-react";

import Link from "next/link";
import { useParams } from "next/navigation";

import { ProductTemplateEditor } from "@/features/customization/components/admin/ProductTemplateEditor";
import { customizationKeys } from "@/features/customization/hooks/customization.keys";
import { useAdminProductCustomizationConfig } from "@/features/customization/hooks/useAdminProductCustomizationConfig";
import type { ProductCustomizationConfig } from "@/features/customization/types/product-customization.types";
import { productCustomizationConfigSchema } from "@/features/customization/types/product-customization.types";
import { FONT_FAMILIES } from "@/features/customization/utils/text-fonts";
import { productKeys } from "@/features/products/hooks/product.keys";
import { useAdminProductById } from "@/features/products/hooks/useAdminProductById";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError, apiClient } from "@/lib/api-client";
import { formatMoney } from "@/lib/formatters/price";
import { uiStore } from "@/store";

const DEFAULT_CONFIG: ProductCustomizationConfig = {
  enabled: false,
  designAreas: [],
  maxLayers: 10,
  allowImages: true,
  allowText: true,
  allowShapes: false,
  allowDrawing: false,
  allowedFonts: [],
  restrictedWords: [],
  basePriceModifier: 0,
  pricePerLayer: 0,
};

const parseCommaSeparated = (raw: string) => {
  const items = raw
    .split(/[,\\n]/u)
    .map((item) => item.trim())
    .filter(Boolean);

  const unique: string[] = [];
  const seen = new Set<string>();

  items.forEach((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    unique.push(item);
  });

  return unique;
};

const isDefined = <TValue,>(value: TValue | undefined): value is TValue => value !== undefined;

const parseValidationIssue = (issue: unknown) => {
  let parsed: { path: string; message: string } | undefined;

  if (issue && typeof issue === "object") {
    const { path, message } = issue as { path?: unknown; message?: unknown };
    if (typeof path === "string" && typeof message === "string") {
      parsed = { path, message };
    }
  }

  return parsed;
};

const toOptionalFiniteInteger = (raw: string) => {
  let value: number | undefined;
  const trimmed = raw.trim();
  if (trimmed) {
    const next = Number(trimmed);
    if (Number.isFinite(next)) {
      value = Math.max(0, Math.trunc(next));
    }
  }
  return value;
};

const toFiniteNumber = (raw: string, fallback: number) => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return fallback;
  }
  const next = Number(trimmed);
  return Number.isFinite(next) ? next : fallback;
};

const extractValidationIssues = (error: unknown) => {
  let extracted: { path: string; message: string }[] | undefined;

  if (error instanceof ApiClientError) {
    const { details } = error;
    if (details && typeof details === "object") {
      const { issues } = details as { issues?: unknown };
      if (Array.isArray(issues)) {
        extracted = issues
          .map((issue) => parseValidationIssue(issue))
          .filter((issue) => isDefined(issue));
      }
    }
  }

  return extracted;
};

export default function AdminProductCustomizationPage(): JSX.Element {
  const params = useParams<{ id?: string }>();
  const productId = typeof params?.id === "string" ? params.id : undefined;

  const queryClient = useQueryClient();

  const productQuery = useAdminProductById(productId);
  const configQuery = useAdminProductCustomizationConfig(productId);

  const [draft, setDraft] = useState<ProductCustomizationConfig>(DEFAULT_CONFIG);
  const [restrictedWordsText, setRestrictedWordsText] = useState("");
  const [fontSearch, setFontSearch] = useState("");
  const [previewLayers, setPreviewLayers] = useState(4);
  const [saveIssues, setSaveIssues] = useState<{ path: string; message: string }[]>([]);
  const [hasConfig, setHasConfig] = useState(false);

  const configExists = hasConfig;

  useEffect(() => {
    if (!productId) {
      setDraft(DEFAULT_CONFIG);
      setRestrictedWordsText("");
      setHasConfig(false);
      return;
    }

    const next = configQuery.data ?? DEFAULT_CONFIG;
    const normalized = {
      ...next,
      maxLayers: Math.min(50, Math.max(1, next.maxLayers)),
      restrictedWords: next.restrictedWords ?? [],
    };
    setDraft(normalized);
    setRestrictedWordsText(normalized.restrictedWords.join(", "));
    setSaveIssues([]);
    setHasConfig(Boolean(configQuery.data));
  }, [configQuery.data, productId]);

  const product = productQuery.data;
  const primaryMedia = product?.media.find((item) => item.isPrimary) ?? product?.media[0];
  const productImage = primaryMedia?.media.url;
  const imageWidth = primaryMedia?.media.width;
  const imageHeight = primaryMedia?.media.height;

  const filteredFonts = useMemo(() => {
    const term = fontSearch.trim().toLowerCase();
    if (!term) {
      return [...FONT_FAMILIES];
    }
    return FONT_FAMILIES.filter((font) => font.toLowerCase().includes(term));
  }, [fontSearch]);

  const pricingPreview = useMemo(() => {
    let preview: { fee: string; total?: string } | undefined;
    const fee = draft.basePriceModifier + draft.pricePerLayer * previewLayers;
    if (Number.isFinite(fee)) {
      const currency = product?.currency ?? "TRY";
      const baseAmount = product ? Number(product.price.amount) : Number.NaN;
      const total = Number.isFinite(baseAmount) ? baseAmount + fee : Number.NaN;
      let formattedTotal: string | undefined;
      if (Number.isFinite(total)) {
        formattedTotal = formatMoney({ amount: total.toFixed(2), currency });
      }

      preview = {
        fee: formatMoney({ amount: fee.toFixed(2), currency }),
        total: formattedTotal,
      };
    }

    return preview;
  }, [draft.basePriceModifier, draft.pricePerLayer, previewLayers, product]);

  const saveMutation = useMutation<ProductCustomizationConfig, Error, ProductCustomizationConfig>({
    mutationFn: async (payload) => {
      if (!productId) {
        throw new Error("Missing product id.");
      }

      setSaveIssues([]);

      const putRequest = () =>
        apiClient.put(`/admin/products/${productId}/customization`, {
          body: payload,
          dataSchema: productCustomizationConfigSchema,
        });

      const postRequest = () =>
        apiClient.post(`/admin/products/${productId}/customization`, {
          body: payload,
          dataSchema: productCustomizationConfigSchema,
        });

      try {
        const response = configExists ? await putRequest() : await postRequest();
        return response.data;
      } catch (error) {
        if (error instanceof ApiClientError) {
          if (!configExists && error.status === 409) {
            const response = await putRequest();
            return response.data;
          }

          if (configExists && error.status === 404) {
            const response = await postRequest();
            return response.data;
          }
        }

        throw error;
      }
    },
    onSuccess: async (saved) => {
      setDraft(saved);
      setRestrictedWordsText(saved.restrictedWords.join(", "));
      setSaveIssues([]);
      setHasConfig(true);

      queryClient.setQueryData(customizationKeys.adminConfig(productId ?? "unknown"), saved);

      await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: customizationKeys.adminConfigs() }),
        queryClient.invalidateQueries({ queryKey: customizationKeys.configs() }),
        queryClient.invalidateQueries({ queryKey: productKeys.all() }),
      ]);

      uiStore.getState().enqueueToast({
        variant: "success",
        title: "Customization template saved",
        description: "Product customization settings have been updated.",
      });
    },
    onError: (error) => {
      const issues = extractValidationIssues(error);
      if (issues) {
        setSaveIssues(issues);
      }

      uiStore.getState().enqueueToast({
        variant: "error",
        title: "Save failed",
        description: error.message || "Unable to save customization settings.",
      });
    },
  });

  const handleSave = () => {
    const restrictedWords = parseCommaSeparated(restrictedWordsText);

    const candidate: ProductCustomizationConfig = {
      ...draft,
      restrictedWords,
      maxLayers: Math.min(50, Math.max(1, Math.round(draft.maxLayers))),
    };

    const parsed = productCustomizationConfigSchema.safeParse(candidate);
    if (!parsed.success) {
      setSaveIssues(
        parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      );

      uiStore.getState().enqueueToast({
        variant: "warning",
        title: "Fix validation issues",
        description: "Some fields need attention before saving.",
      });

      return;
    }

    saveMutation.mutate(parsed.data);
  };

  if (productQuery.isLoading) {
    return (
      <Card className="border-lumi-border/70">
        <CardContent className="space-y-3 p-6">
          <div className="h-6 w-1/2 animate-pulse rounded-xl bg-black/5" />
          <div className="h-4 w-1/3 animate-pulse rounded-xl bg-black/5" />
        </CardContent>
      </Card>
    );
  }

  if (productQuery.isError || !product) {
    const message =
      productQuery.error instanceof Error ? productQuery.error.message : "Unable to load product.";

    return (
      <Card className="border-lumi-border/70">
        <CardContent className="space-y-3 p-6">
          <p className="text-sm font-semibold">Product unavailable</p>
          <p className="text-lumi-text-secondary text-sm">{message}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 text-[11px] font-semibold uppercase tracking-[0.22em]"
            asChild
          >
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to admin
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
            asChild
          >
            <Link href="/admin">
              <ArrowLeft className="h-4 w-4" />
              Admin
            </Link>
          </Button>

          <div>
            <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.28em]">
              Product customization template
            </p>
            <h1 className="text-2xl font-semibold md:text-3xl">{product.title}</h1>
          </div>
        </div>

        <div className="flex flex-col items-end gap-3">
          <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-white/70 px-5 py-4 shadow-sm">
            <div className="space-y-1">
              <p className="text-sm font-semibold">Customization enabled</p>
              <p className="text-lumi-text-secondary text-xs">
                Customers can launch the editor from product pages.
              </p>
            </div>
            <Switch
              checked={draft.enabled}
              onCheckedChange={(checked) =>
                setDraft((current) => ({ ...current, enabled: checked }))
              }
            />
          </div>

          <Button
            type="button"
            size="sm"
            className="h-11 gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
            onClick={handleSave}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save template
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="border-lumi-border/70">
        <CardHeader>
          <CardTitle className="space-y-1">
            <span className="text-lumi-text-secondary block text-[10px] font-semibold uppercase tracking-[0.28em]">
              Design areas
            </span>
            <span className="text-lg font-semibold">
              Define editable regions on the product image
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {productImage ? (
            <ProductTemplateEditor
              productImageUrl={productImage}
              imageWidth={imageWidth}
              imageHeight={imageHeight}
              areas={draft.designAreas}
              onAreasChange={(areas) => setDraft((current) => ({ ...current, designAreas: areas }))}
            />
          ) : (
            <div className="border-lumi-border/60 bg-lumi-bg-secondary/40 rounded-xl border p-6 text-sm">
              <p className="font-semibold">No product image found</p>
              <p className="text-lumi-text-secondary mt-1 text-sm">
                Upload a primary product image to configure design areas.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-lumi-border/70">
        <CardHeader>
          <CardTitle className="space-y-1">
            <span className="text-lumi-text-secondary block text-[10px] font-semibold uppercase tracking-[0.28em]">
              Constraints
            </span>
            <span className="text-lg font-semibold">Global editor limits</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="customization-max-layers">Max layers ({draft.maxLayers})</Label>
              <input
                id="customization-max-layers"
                type="range"
                min={1}
                max={50}
                step={1}
                value={draft.maxLayers}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, maxLayers: Number(event.target.value) }))
                }
                className="accent-lumi-primary w-full"
              />
              <p className="text-lumi-text-secondary text-xs">
                Limits how many elements customers can add (text, images, shapes).
              </p>
            </div>

            <div className="space-y-4 lg:col-span-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl border border-dashed border-black/10 p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Allow images</p>
                    <p className="text-lumi-text-secondary text-xs">Upload and place images.</p>
                  </div>
                  <Switch
                    checked={draft.allowImages}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, allowImages: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-dashed border-black/10 p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Allow text</p>
                    <p className="text-lumi-text-secondary text-xs">Text tool enabled.</p>
                  </div>
                  <Switch
                    checked={draft.allowText}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, allowText: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-dashed border-black/10 p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Allow shapes</p>
                    <p className="text-lumi-text-secondary text-xs">Add basic shapes.</p>
                  </div>
                  <Switch
                    checked={draft.allowShapes}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, allowShapes: checked }))
                    }
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl border border-dashed border-black/10 p-3">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">Allow drawing</p>
                    <p className="text-lumi-text-secondary text-xs">Free-hand drawing mode.</p>
                  </div>
                  <Switch
                    checked={draft.allowDrawing}
                    onCheckedChange={(checked) =>
                      setDraft((current) => ({ ...current, allowDrawing: checked }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-black/10" />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customization-min-image">Min image size (px)</Label>
              <Input
                id="customization-min-image"
                type="number"
                value={draft.minImageSize ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    minImageSize: toOptionalFiniteInteger(event.target.value),
                  }))
                }
                placeholder="e.g. 256"
              />
              <p className="text-lumi-text-secondary text-xs">
                Prevents customers from inserting very small images.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customization-max-image">Max image size (px)</Label>
              <Input
                id="customization-max-image"
                type="number"
                value={draft.maxImageSize ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    maxImageSize: toOptionalFiniteInteger(event.target.value),
                  }))
                }
                placeholder="e.g. 2048"
              />
              <p className="text-lumi-text-secondary text-xs">
                Limits large uploads to keep previews fast.
              </p>
            </div>
          </div>

          <Separator className="bg-black/10" />

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Allowed fonts</p>
                  <p className="text-lumi-text-secondary text-xs">
                    Leave empty to allow all editor fonts.
                  </p>
                </div>
                <div className="w-40">
                  <Input
                    value={fontSearch}
                    onChange={(event) => setFontSearch(event.target.value)}
                    placeholder="Search fonts"
                  />
                </div>
              </div>

              <div className="border-lumi-border/60 max-h-64 space-y-2 overflow-auto rounded-xl border p-3">
                {filteredFonts.map((font) => {
                  const checked = draft.allowedFonts.includes(font);
                  return (
                    <label
                      key={font}
                      className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-black/5"
                      style={{ fontFamily: font }}
                    >
                      <span className="font-semibold">{font}</span>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(value) => {
                          const nextChecked = value === true;
                          setDraft((current) => {
                            const set = new Set(current.allowedFonts);
                            if (nextChecked) {
                              set.add(font);
                            } else {
                              set.delete(font);
                            }
                            return { ...current, allowedFonts: [...set] };
                          });
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customization-restricted-words">Restricted words</Label>
              <Textarea
                id="customization-restricted-words"
                value={restrictedWordsText}
                onChange={(event) => setRestrictedWordsText(event.target.value)}
                placeholder="comma,separated,words"
                className="min-h-[180px]"
              />
              <p className="text-lumi-text-secondary text-xs">
                Comma-separated list. Used to block offensive or brand-sensitive text.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-lumi-border/70">
        <CardHeader>
          <CardTitle className="space-y-1">
            <span className="text-lumi-text-secondary block text-[10px] font-semibold uppercase tracking-[0.28em]">
              Pricing
            </span>
            <span className="text-lg font-semibold">Customization fee configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="customization-base-price">Base price modifier (₺)</Label>
              <Input
                id="customization-base-price"
                type="number"
                step="0.01"
                value={draft.basePriceModifier}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    basePriceModifier: toFiniteNumber(
                      event.target.value,
                      current.basePriceModifier,
                    ),
                  }))
                }
              />
              <p className="text-lumi-text-secondary text-xs">Applied once per customized item.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customization-price-per-layer">Price per layer (₺)</Label>
              <Input
                id="customization-price-per-layer"
                type="number"
                step="0.01"
                value={draft.pricePerLayer}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    pricePerLayer: toFiniteNumber(event.target.value, current.pricePerLayer),
                  }))
                }
              />
              <p className="text-lumi-text-secondary text-xs">
                Charged per layer in the saved design.
              </p>
            </div>
          </div>

          <Separator className="bg-black/10" />

          <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Preview calculated price</p>
              <p className="text-lumi-text-secondary text-sm">
                Adjust the layer count to see how the fee scales.
              </p>

              <div className="mt-4 space-y-2">
                <Label htmlFor="customization-preview-layers">Layers ({previewLayers})</Label>
                <input
                  id="customization-preview-layers"
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={previewLayers}
                  onChange={(event) => setPreviewLayers(Number(event.target.value))}
                  className="accent-lumi-primary w-full"
                />
              </div>
            </div>

            <div className="border-lumi-border/60 bg-lumi-bg-secondary/40 space-y-3 rounded-xl border p-4 text-sm">
              <p className="font-semibold">Preview</p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-lumi-text-secondary">Customization fee</span>
                <span className="font-semibold">{pricingPreview?.fee ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-lumi-text-secondary">Total price</span>
                <span className="font-semibold">{pricingPreview?.total ?? "—"}</span>
              </div>
              <Separator className="bg-black/10" />
              <div className="flex items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Apply to all variants</p>
                  <p className="text-lumi-text-secondary text-xs">
                    Product-level setting (always applies).
                  </p>
                </div>
                <Checkbox checked disabled />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-lumi-border/70">
        <CardHeader>
          <CardTitle className="space-y-1">
            <span className="text-lumi-text-secondary block text-[10px] font-semibold uppercase tracking-[0.28em]">
              Preview
            </span>
            <span className="text-lg font-semibold">Customer experience snapshot</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            <p className="text-lumi-text-secondary text-sm">
              Open the storefront to test the editor button and pricing calculations.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 text-[11px] font-semibold uppercase tracking-[0.22em]"
                asChild
              >
                <Link href={`/products/${product.slug}`}>View product page</Link>
              </Button>
            </div>
          </div>

          <div className="border-lumi-border/60 bg-lumi-bg-secondary/40 space-y-3 rounded-xl border p-4 text-sm">
            <p className="font-semibold">Current settings</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-lumi-text-secondary">Enabled</span>
              <span className="font-semibold">{draft.enabled ? "Yes" : "No"}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-lumi-text-secondary">Design areas</span>
              <span className="font-semibold">{draft.designAreas.length}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-lumi-text-secondary">Max layers</span>
              <span className="font-semibold">{draft.maxLayers}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-lumi-text-secondary">Allowed fonts</span>
              <span className="font-semibold">
                {draft.allowedFonts.length > 0 ? draft.allowedFonts.length : "All"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-lumi-text-secondary">Restricted words</span>
              <span className="font-semibold">
                {parseCommaSeparated(restrictedWordsText).length}
              </span>
            </div>
            <Separator className="bg-black/10" />
            <p className="text-lumi-text-secondary text-xs">
              {configExists
                ? "Config exists (admin can keep disabled)."
                : "Config not saved yet. Save to activate."}
            </p>
          </div>
        </CardContent>
      </Card>

      {saveIssues.length > 0 && (
        <Card className="border-lumi-border/70">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Validation issues</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-lumi-text-secondary text-sm">
              Resolve these issues before saving the template.
            </p>
            <ul className="text-lumi-text-secondary list-disc space-y-1 pl-5 text-sm">
              {saveIssues.map((issue) => (
                <li key={`${issue.path}:${issue.message}`}>
                  <span className="font-semibold">{issue.path}</span>: {issue.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {configQuery.isLoading && (
        <div className="text-lumi-text-secondary flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading current customization settings…
        </div>
      )}

      {configQuery.isError && (
        <div className="text-lumi-text-secondary text-sm">
          Unable to load customization config. You can still edit defaults and save.
        </div>
      )}
    </div>
  );
}
