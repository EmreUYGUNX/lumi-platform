import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { toast } from "@/hooks/use-toast";
import { logAuditEvent } from "@/lib/auth/audit";

import type { AccountAddress } from "../types";

const mockAddresses: AccountAddress[] = [
  {
    id: "addr_home",
    label: "Home",
    fullName: "Leyla Işık",
    phone: "+90 555 111 2233",
    line1: "İstiklal Cd. No:10",
    line2: "Beyoğlu",
    city: "İstanbul",
    state: "İstanbul",
    postalCode: "34000",
    country: "TR",
    isDefault: true,
  },
  {
    id: "addr_work",
    label: "Work",
    fullName: "Leyla Işık",
    phone: "+90 555 111 2233",
    line1: "Techno Park Blok B",
    city: "İstanbul",
    state: "İstanbul",
    postalCode: "34906",
    country: "TR",
    isDefault: false,
  },
];

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const fetchAddresses = async (): Promise<AccountAddress[]> => {
  await delay(80);
  return mockAddresses;
};

export const useAddresses = () => {
  return useQuery({
    queryKey: ["account", "addresses"],
    queryFn: fetchAddresses,
    staleTime: 60_000,
  });
};

export const useCreateAddress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["account", "addresses", "create"],
    mutationFn: async (payload: AccountAddress) => {
      await delay(80);
      return payload;
    },
    onSuccess: (address) => {
      queryClient.setQueryData<AccountAddress[]>(["account", "addresses"], (prev = []) => [
        ...prev,
        address,
      ]);
      toast({ title: "Adres eklendi", description: `${address.label} kaydedildi.` });
      logAuditEvent("address_add", { addressId: address.id, label: address.label });
    },
  });
};

export const useUpdateAddress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["account", "addresses", "update"],
    mutationFn: async (payload: AccountAddress) => {
      await delay(80);
      return payload;
    },
    onSuccess: (address) => {
      queryClient.setQueryData<AccountAddress[]>(["account", "addresses"], (prev = []) =>
        prev.map((item) => (item.id === address.id ? address : item)),
      );
      toast({ title: "Adres güncellendi", description: `${address.label} kaydedildi.` });
      logAuditEvent("address_update", { addressId: address.id, label: address.label });
    },
  });
};

export const useDeleteAddress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["account", "addresses", "delete"],
    mutationFn: async (addressId: string) => {
      await delay(80);
      return addressId;
    },
    onSuccess: (addressId) => {
      queryClient.setQueryData<AccountAddress[]>(["account", "addresses"], (prev = []) =>
        prev.filter((item) => item.id !== addressId),
      );
      toast({ title: "Adres silindi" });
      logAuditEvent("address_delete", { addressId });
    },
  });
};

export const useSetDefaultAddress = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["account", "addresses", "default"],
    mutationFn: async (addressId: string) => {
      await delay(80);
      return addressId;
    },
    onSuccess: (addressId) => {
      queryClient.setQueryData<AccountAddress[]>(["account", "addresses"], (prev = []) =>
        prev.map((item) => ({ ...item, isDefault: item.id === addressId })),
      );
      toast({ title: "Varsayılan adres güncellendi" });
      logAuditEvent("address_update", { addressId, default: true });
    },
  });
};
