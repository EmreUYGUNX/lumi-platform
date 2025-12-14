import type { SessionListQuery } from "../types/session.types";

export const sessionKeys = {
  all: ["design-sessions"] as const,
  lists: () => [...sessionKeys.all, "list"] as const,
  list: (query: SessionListQuery) => [...sessionKeys.lists(), query] as const,
  details: () => [...sessionKeys.all, "detail"] as const,
  detail: (sessionId: string) => [...sessionKeys.details(), sessionId] as const,
  saves: () => [...sessionKeys.all, "save"] as const,
  shares: () => [...sessionKeys.all, "share"] as const,
};
