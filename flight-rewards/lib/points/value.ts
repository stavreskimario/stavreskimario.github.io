import type { ManualComparison, RedemptionOption, WalletEntry } from "../types";
export function compare(
  points: number | null,
  cash: number | null,
  charges: number | null,
  valuationCents: number,
) {
  return {
    centsPerPoint:
      points && cash !== null && charges !== null
        ? ((cash - charges) / points) * 100
        : null,
    effectiveCost:
      points && charges !== null
        ? (points * valuationCents) / 100 + charges
        : null,
  };
}
export function balanceStatus(
  option: RedemptionOption,
  wallet: WalletEntry,
): string {
  if (option.pointsRequired === null) return "Quote needed";
  if (wallet.balance === null) return "Balance not entered";
  if (wallet.balance < option.pointsRequired)
    return `${(option.pointsRequired - wallet.balance).toLocaleString("en-AU")} points short`;
  if (option.pointsMaximum !== null && wallet.balance < option.pointsMaximum)
    return "Covers the minimum only";
  return "Enough points";
}
export function canAfford(
  option: RedemptionOption,
  wallet: WalletEntry,
): boolean {
  return (
    wallet.balance !== null &&
    option.pointsRequired !== null &&
    wallet.balance >= (option.pointsMaximum ?? option.pointsRequired)
  );
}
export function comparisonValues(
  option: RedemptionOption,
  manual: ManualComparison | undefined,
  cashAUD: number | null,
  valuationCents: number,
) {
  const cash = manual?.cash ?? cashAUD;
  const charges =
    manual?.charges ??
    (option.unavoidableCashCharges?.currency === "AUD"
      ? option.unavoidableCashCharges.amount
      : null);
  return {
    ...compare(option.pointsRequired, cash, charges, valuationCents),
    cash,
    charges,
  };
}
