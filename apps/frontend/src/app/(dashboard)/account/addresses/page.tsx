"use client";

import { Suspense } from "react";

import { AddressBook } from "@/features/account/components/AddressBook";

export default function AddressesPage(): JSX.Element {
  return (
    <Suspense fallback={undefined}>
      <AddressBook />
    </Suspense>
  );
}
