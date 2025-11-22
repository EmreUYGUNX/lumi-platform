"use client";

import { Laptop, LogOut, Smartphone, Tablet } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import type { SessionInfo } from "../types";

const iconMap: Record<SessionInfo["device"], React.ElementType> = {
  desktop: Laptop,
  mobile: Smartphone,
  tablet: Tablet,
};

interface SessionCardProps {
  session: SessionInfo;
  onRevoke: (id: string) => void;
}

export function SessionCard({ session, onRevoke }: SessionCardProps): JSX.Element {
  const Icon = iconMap[session.device];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Icon className="h-4 w-4" />
          {session.browser} on {session.os}
        </CardTitle>
        <div className="flex gap-2">
          {session.current && <Badge variant="outline">Current</Badge>}
          {session.trusted && <Badge variant="outline">Trusted</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <p>{session.location}</p>
        <p>IP: {session.ip}</p>
        <p className="text-lumi-text-secondary">
          Last active {new Date(session.lastActive).toLocaleString()}
        </p>
        <p className="text-lumi-text-secondary">
          Created {new Date(session.createdAt).toLocaleDateString()}
        </p>
      </CardContent>
      <CardFooter className="flex justify-end">
        {!session.current && (
          <Button
            variant="ghost"
            className="text-lumi-error"
            size="sm"
            onClick={() => onRevoke(session.id)}
          >
            <LogOut className="mr-1 h-4 w-4" />
            Revoke
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
