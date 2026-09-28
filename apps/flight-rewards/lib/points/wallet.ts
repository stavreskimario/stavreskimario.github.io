import type { Wallet } from "../types";
export const walletKey = "mario-flight-rewards-wallet-v1";
export const emptyWallet = (): Wallet => ({
  qantas: { balance: null, valuationCents: 1.8, updatedAt: null },
  velocity: { balance: null, valuationCents: 1.8, updatedAt: null },
});
export function parseWallet(raw: string | null): Wallet {
  if (!raw) return emptyWallet();
  const value = JSON.parse(raw);
  if (value?.version !== 1) throw new Error("Unrecognised wallet format.");
  const wallet = emptyWallet();
  for (const p of ["qantas", "velocity"] as const) {
    const item = value.wallet?.[p];
    if (
      !item ||
      !(
        item.balance === null ||
        (Number.isSafeInteger(item.balance) &&
          item.balance >= 0 &&
          item.balance <= 1000000000)
      ) ||
      !Number.isFinite(item.valuationCents) ||
      item.valuationCents < 0 ||
      item.valuationCents > 100 ||
      !(
        item.updatedAt === null ||
        (typeof item.updatedAt === "string" &&
          Number.isFinite(Date.parse(item.updatedAt)))
      )
    )
      throw new Error("Saved wallet contains invalid values.");
    wallet[p] = {
      balance: item.balance,
      valuationCents: item.valuationCents,
      updatedAt: item.updatedAt,
    };
  }
  return wallet;
}
