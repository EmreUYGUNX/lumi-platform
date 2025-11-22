import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/use-toast";

import type { NotificationSettingsModel } from "../types";

const DEFAULT_SETTINGS: NotificationSettingsModel = {
  email: {
    orderUpdates: true,
    shipping: true,
    marketing: false,
    recommendations: true,
    newsletter: true,
  },
  push: {
    orderUpdates: true,
    priceDrops: true,
    backInStock: false,
  },
  sms: {
    orderUpdates: false,
    shipping: false,
  },
  frequency: "daily",
};

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const fetchSettings = async (): Promise<NotificationSettingsModel> => {
  await delay(60);
  return DEFAULT_SETTINGS;
};

export const useNotificationSettings = () => {
  return useQuery({
    queryKey: ["account", "notifications"],
    queryFn: fetchSettings,
  });
};

export const useUpdateNotificationSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["account", "notifications", "update"],
    mutationFn: async (payload: NotificationSettingsModel) => {
      await delay(80);
      return payload;
    },
    onSuccess: (settings) => {
      queryClient.setQueryData(["account", "notifications"], settings);
      toast({ title: "Bildirim tercihleri güncellendi" });
    },
  });
};
