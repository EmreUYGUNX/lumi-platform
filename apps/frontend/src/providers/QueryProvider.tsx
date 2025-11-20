"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";

import type { DehydratedState } from "@tanstack/react-query";
import { HydrationBoundary, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { createQueryClient } from "@/lib/query-client";

interface QueryProviderProps {
  children: ReactNode;
  dehydratedState?: DehydratedState;
}

export function QueryProvider({ children, dehydratedState }: QueryProviderProps): JSX.Element {
  const [client] = useState(createQueryClient);
  const shouldRenderDevtools = useMemo(() => process.env.NODE_ENV === "development", []);

  return (
    <QueryClientProvider client={client}>
      <HydrationBoundary state={dehydratedState}>{children}</HydrationBoundary>
      {shouldRenderDevtools && (
        <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />
      )}
    </QueryClientProvider>
  );
}
