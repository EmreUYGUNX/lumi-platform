import { useMutation, useQuery } from "@tanstack/react-query";

import { toast } from "@/hooks/use-toast";

import type { OnboardingState, OnboardingStepKey } from "../types";

const defaultState: OnboardingState = {
  step: "profile",
  completed: {},
  profile: {
    fullName: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    avatarUrl: "",
  },
  preferences: {
    notifications: true,
    language: "tr-TR",
    currency: "TRY",
    marketing: false,
  },
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const loadState = async (): Promise<OnboardingState> => {
  await delay(50);
  return defaultState;
};

const persistState = async (state: OnboardingState): Promise<OnboardingState> => {
  await delay(80);
  return state;
};

export const useOnboardingState = () => {
  const query = useQuery({
    queryKey: ["onboarding", "state"],
    queryFn: loadState,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationKey: ["onboarding", "save"],
    mutationFn: persistState,
    onSuccess: () => {
      toast({ title: "Onboarding saved" });
    },
    onError: () => {
      toast({
        title: "Kaydedilemedi",
        description: "Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    },
  });

  const setStep = (step: OnboardingStepKey) => {
    const current = query.data ?? defaultState;
    const next = { ...current, step };
    mutation.mutate(next);
  };

  const completeStep = (step: OnboardingStepKey) => {
    const current = query.data ?? defaultState;
    const next = { ...current, completed: { ...current.completed, [step]: true } };
    mutation.mutate(next);
  };

  return {
    ...query,
    save: mutation.mutate,
    isSaving: mutation.isPending,
    setStep,
    completeStep,
  };
};
