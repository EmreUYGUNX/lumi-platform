import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { broadcastSessionEvent } from "@/lib/auth/session";
import { logAuditEvent } from "@/lib/auth/audit";
import { toast } from "@/hooks/use-toast";

import type { SessionInfo } from "../types";

const mockSessions: SessionInfo[] = [
  {
    id: "sess_current",
    device: "desktop",
    browser: "Chrome",
    os: "macOS",
    location: "İstanbul, TR",
    ip: "192.168.1.12",
    lastActive: new Date().toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    trusted: true,
    current: true,
  },
  {
    id: "sess_phone",
    device: "mobile",
    browser: "Safari",
    os: "iOS",
    location: "Ankara, TR",
    ip: "10.0.0.5",
    lastActive: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    trusted: false,
  },
];

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const fetchSessions = async (): Promise<SessionInfo[]> => {
  await delay(80);
  return mockSessions;
};

export const useSessions = () => {
  return useQuery({
    queryKey: ["account", "sessions"],
    queryFn: fetchSessions,
    refetchInterval: 30_000,
  });
};

export const useRevokeSession = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["account", "sessions", "revoke"],
    mutationFn: async (sessionId: string) => {
      await delay(80);
      return sessionId;
    },
    onSuccess: (sessionId) => {
      queryClient.setQueryData<SessionInfo[]>(["account", "sessions"], (prev = []) =>
        prev.filter((session) => session.id !== sessionId),
      );
      broadcastSessionEvent({ type: "logout" });
      toast({ title: "Oturum sonlandırıldı" });
      logAuditEvent("session_revoke", { sessionId });
    },
  });
};

export const useRevokeAllSessions = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["account", "sessions", "revoke-all"],
    mutationFn: async () => {
      await delay(80);
      return true;
    },
    onSuccess: () => {
      queryClient.setQueryData<SessionInfo[]>(["account", "sessions"], () => []);
      broadcastSessionEvent({ type: "logout" });
      toast({ title: "Tüm oturumlar kapatıldı", description: "Tekrar giriş yapmanız gerekecek." });
      logAuditEvent("session_revoke_all");
    },
  });
};
