"use client";

import { useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { PasswordStrength } from "@/features/auth/components/PasswordStrength";
import { AddressForm } from "@/features/account/components/AddressForm";
import { NotificationSettings } from "@/features/account/components/NotificationSettings";

import { useOnboardingState } from "../hooks/useOnboardingState";
import type { OnboardingStepKey } from "../types";

const steps: { key: OnboardingStepKey; label: string; weight: number }[] = [
  { key: "profile", label: "Profile", weight: 40 },
  { key: "address", label: "Address", weight: 20 },
  { key: "security", label: "Security", weight: 20 },
  { key: "preferences", label: "Preferences", weight: 20 },
];

const profileSchema = z.object({
  fullName: z.string().min(2),
  phone: z.string().min(5),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  avatarUrl: z.string().optional(),
});

const securitySchema = z.object({
  password: z.string().min(12),
  enable2fa: z.boolean(),
  backupCodes: z.boolean(),
});

const preferencesSchema = z.object({
  notifications: z.boolean(),
  language: z.string(),
  currency: z.string(),
  marketing: z.boolean(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;
type SecurityFormValues = z.infer<typeof securitySchema>;
type PreferencesFormValues = z.infer<typeof preferencesSchema>;

export function OnboardingWizard(): JSX.Element {
  const { data, isLoading, setStep, completeStep } = useOnboardingState();
  const [activeStep, setActiveStep] = useState<OnboardingStepKey>("profile");

  const progress = useMemo(() => {
    const completed = data?.completed ?? {};
    let total = 0;
    steps.forEach((step) => {
      if (completed[step.key]) {
        total += step.weight;
      }
    });
    return total;
  }, [data?.completed]);

  const goTo = (key: OnboardingStepKey) => {
    setActiveStep(key);
    setStep(key);
  };

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: data?.profile ?? {
      fullName: "",
      phone: "",
      dateOfBirth: "",
      gender: "",
      avatarUrl: "",
    },
  });

  const securityForm = useForm<SecurityFormValues>({
    resolver: zodResolver(securitySchema),
    defaultValues: {
      password: "",
      enable2fa: false,
      backupCodes: false,
    },
  });

  const preferencesForm = useForm<PreferencesFormValues>({
    resolver: zodResolver(preferencesSchema),
    defaultValues: data?.preferences ?? {
      notifications: true,
      language: "tr-TR",
      currency: "TRY",
      marketing: false,
    },
  });

  const nextStep = (current: OnboardingStepKey) => {
    const currentIndex = steps.findIndex((step) => step.key === current);
    const next = steps[currentIndex + 1];
    if (next) {
      goTo(next.key);
    }
  };

  const renderProfile = () => (
    <Form {...profileForm}>
      <form
        className="space-y-4"
        onSubmit={profileForm.handleSubmit(() => {
          completeStep("profile");
          nextStep("profile");
        })}
      >
        <FormField
          control={profileForm.control}
          name="fullName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full name</FormLabel>
              <FormControl>
                <Input placeholder="Leyla Işık" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={profileForm.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl>
                <Input placeholder="+90 5xx xxx xx xx" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={profileForm.control}
          name="dateOfBirth"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date of birth</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={profileForm.control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Gender</FormLabel>
              <FormControl>
                <Input placeholder="Female / Male / Non-binary" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={profileForm.control}
          name="avatarUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Avatar URL</FormLabel>
              <FormControl>
                <Input placeholder="https://avatar.example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex items-center gap-2">
          <Button type="submit">Next</Button>
          <Button variant="ghost" type="button" onClick={() => nextStep("profile")}>
            Skip
          </Button>
        </div>
      </form>
    </Form>
  );

  const renderAddress = () => (
    <div className="space-y-4">
      <AddressForm />
      <div className="flex items-center gap-2">
        <Button onClick={() => nextStep("address")}>Next</Button>
        <Button variant="ghost" onClick={() => nextStep("address")}>
          Skip
        </Button>
      </div>
    </div>
  );

  const renderSecurity = () => (
    <Form {...securityForm}>
      <form
        className="space-y-4"
        onSubmit={securityForm.handleSubmit(() => {
          completeStep("security");
          nextStep("security");
        })}
      >
        <FormField
          control={securityForm.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <Input type="password" {...field} />
              </FormControl>
              <PasswordStrength value={field.value} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={securityForm.control}
          name="enable2fa"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(Boolean(value))}
                />
              </FormControl>
              <FormLabel className="text-sm font-normal">Enable 2FA (coming soon)</FormLabel>
            </FormItem>
          )}
        />
        <FormField
          control={securityForm.control}
          name="backupCodes"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(Boolean(value))}
                />
              </FormControl>
              <FormLabel className="text-sm font-normal">
                Generate backup codes (placeholder)
              </FormLabel>
            </FormItem>
          )}
        />
        <div className="flex items-center gap-2">
          <Button type="submit">Next</Button>
          <Button variant="ghost" type="button" onClick={() => nextStep("security")}>
            Skip
          </Button>
        </div>
      </form>
    </Form>
  );

  const renderPreferences = () => (
    <Form {...preferencesForm}>
      <form
        className="space-y-4"
        onSubmit={preferencesForm.handleSubmit(() => {
          completeStep("preferences");
        })}
      >
        <NotificationSettings />
        <FormField
          control={preferencesForm.control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Language</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={preferencesForm.control}
          name="currency"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Currency</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={preferencesForm.control}
          name="marketing"
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={(value) => field.onChange(Boolean(value))}
                />
              </FormControl>
              <FormLabel className="text-sm font-normal">Receive marketing updates</FormLabel>
            </FormItem>
          )}
        />
        <div className="flex items-center gap-2">
          <Button type="submit">Complete</Button>
        </div>
      </form>
    </Form>
  );

  const renderStep = () => {
    switch (activeStep) {
      case "profile": {
        return renderProfile();
      }
      case "address": {
        return renderAddress();
      }
      case "security": {
        return renderSecurity();
      }
      case "preferences": {
        return renderPreferences();
      }
      default: {
        return <></>;
      }
    }
  };

  return (
    <div className="border-lumi-border/60 bg-lumi-bg mx-auto max-w-3xl space-y-6 rounded-3xl border p-6 shadow-lg">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lumi-text-secondary text-sm">Onboarding</p>
          <h1 className="text-2xl font-semibold">Complete your account</h1>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">{progress}%</p>
          <Progress value={progress} className="w-32" />
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {steps.map((step) => {
          const isActive = activeStep === step.key;
          const isDone = data?.completed?.[step.key];
          return (
            <Button
              key={step.key}
              variant={isActive ? "default" : "outline"}
              size="sm"
              onClick={() => goTo(step.key)}
            >
              {step.label} {isDone ? "✓" : ""}
            </Button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="text-lumi-text-secondary flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your onboarding...
        </div>
      ) : (
        renderStep()
      )}
    </div>
  );
}
