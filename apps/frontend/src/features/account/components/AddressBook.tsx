"use client";

import { Home, MapPin, Pencil, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { useAddresses, useDeleteAddress, useSetDefaultAddress } from "../hooks/useAddresses";

export function AddressBook(): JSX.Element {
  const { data, isLoading } = useAddresses();
  const deleteMutation = useDeleteAddress();
  const setDefaultMutation = useSetDefaultAddress();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((item) => (
          <Card key={item}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Address book</h1>
          <p className="text-lumi-text-secondary text-sm">
            Manage your shipping and billing addresses.
          </p>
        </div>
        <Button asChild>
          <a href="/account/addresses/new" className="gap-2">
            <Plus className="h-4 w-4" />
            Add address
          </a>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {data?.map((address) => (
          <Card key={address.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <MapPin className="h-4 w-4" />
                {address.label}
                {address.isDefault && (
                  <Badge variant="outline" className="gap-1">
                    <Home className="h-3 w-3" />
                    Default
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="font-semibold">{address.fullName}</p>
              <p>{address.line1}</p>
              {address.line2 && <p>{address.line2}</p>}
              <p>
                {address.city}, {address.state} {address.postalCode}
              </p>
              <p>{address.country}</p>
              <p className="text-lumi-text-secondary">{address.phone}</p>
            </CardContent>
            <CardFooter className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button asChild variant="ghost" size="sm">
                  <a href={`/account/addresses/${address.id}/edit`} className="gap-2">
                    <Pencil className="h-4 w-4" />
                    Edit
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-lumi-error"
                  onClick={() => deleteMutation.mutate(address.id)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete
                </Button>
              </div>
              {!address.isDefault && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDefaultMutation.mutate(address.id)}
                  disabled={setDefaultMutation.isPending}
                >
                  Set default
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
