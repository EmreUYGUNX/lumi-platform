"use client";

import { useEffect, useMemo } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, MapPin, Truck } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddresses } from "@/features/account/hooks/useAddresses";
import type { AccountAddress } from "@/features/account/types";
import type { CheckoutAddress } from "@/features/checkout/types/checkout.types";
import { cn } from "@/lib/utils";
import { uiStore } from "@/store";
import { sessionStore } from "@/store/session";

import { SHIPPING_METHODS, useCheckout } from "../hooks/useCheckout";
import { shippingMethodSchema } from "../types/checkout.types";

const shippingFormSchema = z
  .object({
    mode: z.enum(["existing", "new"]),
    addressId: z.string().optional(),
    fullName: z.string().min(2, "İsim gerekli"),
    email: z.string().email("Geçerli e-posta").optional(),
    phone: z.string().min(5, "Telefon gerekli"),
    line1: z.string().min(3, "Adres satırı gerekli"),
    line2: z.string().optional(),
    city: z.string().min(2, "Şehir gerekli"),
    state: z.string().min(2, "İl/İlçe gerekli"),
    postalCode: z.string().min(3, "Posta kodu gerekli"),
    country: z.string().min(2, "Ülke kodu gerekli"),
    saveAddress: z.boolean().optional(),
    billingSameAsShipping: z.boolean().optional(),
    shippingMethod: shippingMethodSchema,
  })
  .superRefine((value, ctx) => {
    if (value.mode === "existing" && !value.addressId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Kaydedilmiş bir adres seçin.",
        path: ["addressId"],
      });
    }
  });

type ShippingFormValues = z.infer<typeof shippingFormSchema>;

const mapAddressToForm = (
  address: (AccountAddress | CheckoutAddress) | undefined,
  email?: string,
): Omit<ShippingFormValues, "shippingMethod" | "mode"> => ({
  addressId: address?.id,
  fullName: address?.fullName ?? "",
  email: email ?? "",
  phone: address?.phone ?? "",
  line1: address?.line1 ?? "",
  line2: address?.line2 ?? "",
  city: address?.city ?? "",
  state: address?.state ?? "",
  postalCode: address?.postalCode ?? "",
  country: address?.country ?? "TR",
  saveAddress:
    address && "isDefault" in address && typeof address.isDefault === "boolean"
      ? address.isDefault
      : false,
  billingSameAsShipping: true,
});

const addressCardClasses =
  "hover:border-lumi-text relative block cursor-pointer rounded-xl border border-lumi-border/70 p-4 transition";
const subtleDetailClass = "text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]";
const selectedAddressClasses = "border-lumi-text shadow-sm";
const selectedDotClass = "bg-lumi-text";
const unselectedDotClass = "bg-lumi-border";
const radioDotClass = "absolute right-3 top-3 h-3 w-3 rounded-full";

export function ShippingForm(): JSX.Element {
  const {
    shippingAddress,
    shippingMethod,
    billingSameAsShipping,
    updateShipping,
    setBillingSameAsShipping,
    goToStep,
  } = useCheckout();
  const { data: savedAddresses, isLoading: addressesLoading } = useAddresses();
  const userEmail = sessionStore((state) => state.user?.email ?? "");
  const isAuthenticated = sessionStore((state) => state.isAuthenticated);

  const defaultMode =
    shippingAddress?.id || (savedAddresses && savedAddresses.length > 0) ? "existing" : "new";

  const defaultValues = useMemo<ShippingFormValues>(
    () => ({
      mode: defaultMode,
      shippingMethod: shippingMethod ?? "standard",
      ...mapAddressToForm(shippingAddress, shippingAddress?.email ?? userEmail),
      billingSameAsShipping,
    }),
    [defaultMode, shippingAddress, shippingMethod, billingSameAsShipping, userEmail],
  );

  const form = useForm<ShippingFormValues>({
    resolver: zodResolver(shippingFormSchema),
    defaultValues,
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const handleAddressSelection = (addressId: string) => {
    if (addressId === "new") {
      form.setValue("mode", "new");
      form.setValue("addressId", undefined);
      return;
    }
    const selected = savedAddresses?.find((entry) => entry.id === addressId);
    if (selected) {
      form.setValue("mode", "existing");
      form.setValue("addressId", addressId);
      form.reset({
        ...mapAddressToForm(selected, userEmail),
        mode: "existing",
        addressId,
        shippingMethod: form.getValues("shippingMethod") ?? shippingMethod ?? "standard",
        billingSameAsShipping: form.getValues("billingSameAsShipping") ?? billingSameAsShipping,
      });
    }
  };

  const onSubmit = (values: ShippingFormValues) => {
    const requireEmail = !isAuthenticated && (!values.email || values.email.trim() === "");
    if (requireEmail) {
      uiStore.getState().enqueueToast({
        variant: "warning",
        title: "E-posta gerekli",
        description: "Misafir ödeme için e-posta adresinizi ekleyin.",
      });
      return;
    }

    let resolvedAddress = shippingAddress;
    if (values.mode === "existing") {
      resolvedAddress =
        savedAddresses?.find((entry) => entry.id === values.addressId) ?? shippingAddress;
      if (!resolvedAddress) {
        uiStore.getState().enqueueToast({
          variant: "error",
          title: "Adres bulunamadı",
          description: "Lütfen farklı bir adres seçin veya yeni adres ekleyin.",
        });
        return;
      }
    } else {
      resolvedAddress = {
        id: values.addressId ?? crypto.randomUUID(),
        fullName: values.fullName,
        email: values.email ?? userEmail,
        phone: values.phone,
        line1: values.line1,
        line2: values.line2,
        city: values.city,
        state: values.state,
        postalCode: values.postalCode,
        country: values.country,
        label: "Checkout",
        saveAddress: values.saveAddress,
      };
    }

    updateShipping({
      address: resolvedAddress,
      method: values.shippingMethod,
    });
    setBillingSameAsShipping(values.billingSameAsShipping ?? true);
    const moved = goToStep("payment");
    if (!moved) {
      uiStore.getState().enqueueToast({
        variant: "warning",
        title: "Bilgileri tamamlayın",
        description: "Devam etmeden önce teslimat bilgilerini doldurun.",
      });
    }
  };

  const shippingMethodValue = form.watch("shippingMethod") ?? shippingMethod ?? "standard";
  const mode = form.watch("mode");
  const selectedAddressId = form.watch("addressId");

  return (
    <div className="glass-panel border-lumi-border/60 space-y-6 rounded-2xl border bg-white/80 p-6 shadow-md backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="border-lumi-border/60 rounded-full border bg-white/70 p-3 shadow-sm">
          <MapPin className="text-lumi-primary h-5 w-5" />
        </div>
        <div>
          <p className="text-lumi-text-secondary text-[10px] font-semibold uppercase tracking-[0.24em]">
            Step 1
          </p>
          <h3 className="text-lumi-text text-xl font-semibold uppercase tracking-[0.32em]">
            Shipping details
          </h3>
        </div>
      </div>

      {isAuthenticated && (
        <div className="space-y-3">
          <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.2em]">
            Use existing address
          </p>
          <RadioGroup
            className="grid gap-3 sm:grid-cols-2"
            value={mode === "existing" ? selectedAddressId : "new"}
            onValueChange={handleAddressSelection}
          >
            {addressesLoading && (
              <div className="border-lumi-border/70 flex items-center gap-2 rounded-xl border p-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-lumi-text-secondary text-sm">Adresler yükleniyor...</span>
              </div>
            )}
            {savedAddresses?.map((address) => {
              const isSelectedAddress = selectedAddressId === address.id && mode === "existing";
              return (
                <label
                  key={address.id}
                  className={cn(
                    addressCardClasses,
                    isSelectedAddress ? selectedAddressClasses : "",
                  )}
                >
                  <RadioGroupItem value={address.id} className="sr-only" />
                  <div
                    className={cn(
                      radioDotClass,
                      isSelectedAddress ? selectedDotClass : unselectedDotClass,
                    )}
                  />
                  <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
                    {address.label}
                  </p>
                  <p className={cn(subtleDetailClass, "mt-1")}>{address.fullName}</p>
                  <p className={subtleDetailClass}>
                    {address.line1}
                    {address.line2 ? `, ${address.line2}` : ""}
                  </p>
                  <p className={subtleDetailClass}>
                    {address.city}, {address.state} {address.postalCode}
                  </p>
                  <p className={subtleDetailClass}>{address.country}</p>
                </label>
              );
            })}
            <label
              className={cn(
                addressCardClasses.replace("block", "flex items-center justify-between"),
                mode === "new" ? selectedAddressClasses : "",
              )}
            >
              <RadioGroupItem value="new" className="sr-only" />
              <div>
                <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
                  Yeni adres
                </p>
                <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
                  Yeni bir teslimat adresi ekleyin
                </p>
              </div>
              <div
                className={cn(
                  radioDotClass,
                  mode === "new" ? selectedDotClass : unselectedDotClass,
                )}
              />
            </label>
          </RadioGroup>
        </div>
      )}

      <Form {...form}>
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] uppercase tracking-[0.2em]">
                    Full name
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Leyla Işık" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] uppercase tracking-[0.2em]">
                    Email {isAuthenticated ? "(optional)" : "(required)"}
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="ornek@mail.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] uppercase tracking-[0.2em]">Phone</FormLabel>
                  <FormControl>
                    <Input placeholder="+90 5xx xxx xx xx" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] uppercase tracking-[0.2em]">Country</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="TR">Türkiye</SelectItem>
                      <SelectItem value="US">United States</SelectItem>
                      <SelectItem value="GB">United Kingdom</SelectItem>
                      <SelectItem value="DE">Germany</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] uppercase tracking-[0.2em]">
                    State / Province
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="İstanbul" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] uppercase tracking-[0.2em]">City</FormLabel>
                  <FormControl>
                    <Input placeholder="İstanbul" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px] uppercase tracking-[0.2em]">
                    Postal code
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="34000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="line1"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] uppercase tracking-[0.2em]">
                  Address line 1
                </FormLabel>
                <FormControl>
                  <Input placeholder="Street, building, number" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="line2"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px] uppercase tracking-[0.2em]">
                  Address line 2 (optional)
                </FormLabel>
                <FormControl>
                  <Input placeholder="Apartment, suite" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <FormField
              control={form.control}
              name="billingSameAsShipping"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(value) => {
                        const next = Boolean(value);
                        field.onChange(next);
                        setBillingSameAsShipping(next);
                      }}
                    />
                  </FormControl>
                  <FormLabel className="text-[11px] font-normal uppercase tracking-[0.18em]">
                    Billing same as shipping
                  </FormLabel>
                </FormItem>
              )}
            />
            {isAuthenticated && (
              <FormField
                control={form.control}
                name="saveAddress"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(value) => field.onChange(Boolean(value))}
                      />
                    </FormControl>
                    <FormLabel className="text-[11px] font-normal uppercase tracking-[0.18em]">
                      Save address for next time
                    </FormLabel>
                  </FormItem>
                )}
              />
            )}
          </div>

          <div className="space-y-3">
            <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.24em]">
              Shipping method
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {SHIPPING_METHODS.map((method) => {
                const selected = shippingMethodValue === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => form.setValue("shippingMethod", method.id)}
                    className={cn(
                      "hover:border-lumi-text border-lumi-border/70 flex h-full flex-col gap-2 rounded-xl border p-4 text-left transition",
                      selected && "border-lumi-text shadow-sm",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Truck className="text-lumi-primary h-4 w-4" />
                        <p className="text-lumi-text text-sm font-semibold uppercase tracking-[0.22em]">
                          {method.label}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "h-3 w-3 rounded-full",
                          selected ? "bg-lumi-text" : "bg-lumi-border",
                        )}
                      />
                    </div>
                    <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
                      {method.description}
                    </p>
                    <p className="text-lumi-text text-[12px] font-semibold uppercase tracking-[0.2em]">
                      {method.cost === 0 ? "FREE" : `₺${method.cost.toFixed(0)}`} • {method.eta}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button
              type="submit"
              className="bg-lumi-text hover:bg-lumi-text/90 rounded-full px-6 uppercase tracking-[0.24em] text-white"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Continue to payment"
              )}
            </Button>
            <p className="text-lumi-text-secondary text-[11px] uppercase tracking-[0.18em]">
              Güvenli ödeme • Şifrelenmiş bağlantı
            </p>
          </div>
        </form>
      </Form>
    </div>
  );
}
