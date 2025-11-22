import { RegisterForm } from "@/features/auth/components/RegisterForm";

// Prevent prerender during build; this client page should render at runtime.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function RegisterPage(): JSX.Element {
  return <RegisterForm />;
}
