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

const getStrengthLabel = (strength: number): string => {
  switch (strength) {
    case 4: {
      return "Çok güçlü";
    }
    case 3: {
      return "Güçlü";
    }
    case 2: {
      return "Orta";
    }
    default: {
      return "Zayıf";
    }
  }
};

const getStrengthColor = (strength: number): string => {
  switch (strength) {
    case 4: {
      return "bg-lumi-primary";
    }
    case 3: {
      return "bg-lumi-success";
    }
    case 2: {
      return "bg-lumi-warning";
    }
    default: {
      return "bg-lumi-error";
    }
  }
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
        <span className={cn("font-semibold", getStrengthColor(strength))}>
          {getStrengthLabel(strength)}
        </span>
      </div>
      <Progress
        value={percentage}
        className="h-2"
        aria-label="Password strength indicator"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percentage)}
      />
    </div>
  );
}
