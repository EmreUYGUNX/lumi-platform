import { useMutation, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/use-toast";
import { sessionStore } from "@/store/session";
import { logAuditEvent } from "@/lib/auth/audit";

import type { AccountProfile } from "../types";

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["account", "profile", "update"],
    mutationFn: async (payload: Partial<AccountProfile>) => {
      // Simulate API latency
      await delay(150);
      return payload;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: ["account", "profile"] });
      const previous = queryClient.getQueryData<AccountProfile>(["account", "profile"]);

      if (previous) {
        const optimistic = { ...previous, ...payload };
        queryClient.setQueryData(["account", "profile"], optimistic);
        sessionStore.getState().updateUser({
          name: optimistic.fullName,
          email: optimistic.email,
          avatarUrl: optimistic.avatarUrl,
        });
      }

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["account", "profile"], context.previous);
      }
      toast({
        title: "Profil güncellenemedi",
        description: "Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    },
    onSuccess: (data) => {
      const next = { ...queryClient.getQueryData<AccountProfile>(["account", "profile"]) };
      const merged = { ...next, ...data };
      queryClient.setQueryData(["account", "profile"], merged);
      toast({
        title: "Profil güncellendi",
        description: "Bilgilerin başarıyla kaydedildi.",
      });
      logAuditEvent("profile_update");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["account", "profile"] });
    },
  });
};
