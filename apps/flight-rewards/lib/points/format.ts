/** Keep each currency's normal minor units (AUD/USD cents, JPY whole yen, etc.). */
export function formatMoney(
  amount: number,
  currency: string,
  currencyDisplay: "symbol" | "code" = "symbol",
) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency,
    currencyDisplay,
  }).format(amount);
}
