export type OnboardingStepKey = "profile" | "address" | "security" | "preferences";

export interface OnboardingState {
  step: OnboardingStepKey;
  completed: Partial<Record<OnboardingStepKey, boolean>>;
  profile: {
    fullName: string;
    phone: string;
    dateOfBirth?: string;
    gender?: string;
    avatarUrl?: string;
  };
  address?: {
    label: string;
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    isDefault: boolean;
  };
  security?: {
    password?: string;
    twoFactorPlanned?: boolean;
    backupCodes?: boolean;
  };
  preferences?: {
    notifications: boolean;
    language: string;
    currency: string;
    marketing: boolean;
  };
}
