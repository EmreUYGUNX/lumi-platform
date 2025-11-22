"use client";

import { AlertTriangle, RefreshCcw, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { SessionCard } from "./SessionCard";
import { useRevokeAllSessions, useRevokeSession, useSessions } from "../hooks/useSessions";

export function SessionsList(): JSX.Element {
  const { data, isLoading, refetch, isFetching } = useSessions();
  const revoke = useRevokeSession();
  const revokeAll = useRevokeAllSessions();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Active sessions</h1>
          <p className="text-lumi-text-secondary text-sm">
            Review devices signed into your account and revoke any you don&apos;t recognize.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCcw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => revokeAll.mutate()}
            disabled={revokeAll.isPending}
          >
            Revoke all
          </Button>
        </div>
      </div>

      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertTitle>Background refresh</AlertTitle>
        <AlertDescription>
          Sessions auto-refresh every 30s. We also sync changes across tabs using BroadcastChannel.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Loading sessions</AlertTitle>
          <AlertDescription>Fetching your current devices...</AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {data?.map((session) => (
            <SessionCard key={session.id} session={session} onRevoke={(id) => revoke.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  );
}
