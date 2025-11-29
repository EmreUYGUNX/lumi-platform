import type { MoneyDTO } from "@lumi/shared/dto";

const parseAmount = (value: string): number => {
  const normalized = value.replace(",", ".");
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) ? amount : 0;
};

export const formatMoney = (money: MoneyDTO | null | undefined, locale = "tr-TR"): string => {
  if (!money) return "—";

  const amount = parseAmount(money.amount);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: money.currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console -- only surfaced during development for debugging
      console.warn("[formatMoney] Fallback formatting used", error);
    }
    return `${money.currency} ${amount.toFixed(2)}`;
  }
};
