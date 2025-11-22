"use client";

import { useParams } from "next/navigation";

import { AddressForm } from "@/features/account/components/AddressForm";
import { useAddresses } from "@/features/account/hooks/useAddresses";

export default function AddressEditPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const { data } = useAddresses();
  const address = data?.find((item) => item.id === params?.id);

  return <AddressForm address={address} />;
}
