import { useQuery } from "@tanstack/react-query";

import { sessionStore } from "@/store/session";

import type { AccountProfile } from "../types";

const DEFAULT_PROFILE: AccountProfile = {
  fullName: "Leyla Işık",
  email: "leyla@lumi.com",
  phone: "+90 555 111 2233",
  dateOfBirth: "1991-06-15",
  gender: "female",
  bio: "Building modern commerce experiences with Lumi.",
  avatarUrl: "https://www.gravatar.com/avatar/?d=identicon",
  language: "tr-TR",
  timezone: "Europe/Istanbul",
  currency: "TRY",
  emailVerified: true,
};

const getProfile = async (): Promise<AccountProfile> => {
  const { user } = sessionStore.getState();
  if (user) {
    return {
      ...DEFAULT_PROFILE,
      fullName: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email,
      email: user.email,
      avatarUrl: user.avatarUrl ?? DEFAULT_PROFILE.avatarUrl,
      emailVerified: user.emailVerified ?? true,
    };
  }

  return DEFAULT_PROFILE;
};

export const useProfile = () => {
  return useQuery({
    queryKey: ["account", "profile"],
    queryFn: getProfile,
    staleTime: 60_000,
  });
};
