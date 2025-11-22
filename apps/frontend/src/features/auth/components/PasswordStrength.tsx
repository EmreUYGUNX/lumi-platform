import { useMemo } from "react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

const scorePassword = (password: string): number => {
  let score = 0;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^\dA-Za-z]/.test(password)) score += 1;
  return Math.min(score, 4);
};

const labels: Record<number, string> = {
  0: "Zayıf",
  1: "Zayıf",
  2: "Orta",
  3: "Güçlü",
  4: "Çok güçlü",
};

const colors: Record<number, string> = {
  0: "bg-lumi-error",
  1: "bg-lumi-error",
  2: "bg-lumi-warning",
  3: "bg-lumi-success",
  4: "bg-lumi-primary",
};

interface PasswordStrengthProps {
  value: string;
}

export function PasswordStrength({ value }: PasswordStrengthProps): JSX.Element {
  const strength = useMemo(() => scorePassword(value), [value]);
  const percentage = (strength / 4) * 100;

  return (
    <div className="space-y-2">
      <div className="text-lumi-text-secondary flex items-center justify-between text-xs">
        <span>Şifre Gücü</span>
        <span className={cn("font-semibold", colors[strength])}>{labels[strength]}</span>
      </div>
      <Progress value={percentage} className="h-2" />
    </div>
  );
}
