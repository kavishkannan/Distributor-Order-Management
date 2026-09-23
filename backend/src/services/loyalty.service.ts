import { pointsLedgerRepository } from "../repositories/pointsLedger.repository";
import { TransactionContext } from "../repositories/transaction";

export type LoyaltyTier = "Bronze" | "Silver" | "Gold";

const NinetyDaysMs = 90 * 24 * 60 * 60 * 1000;

export function calculatePointsEarned(OrderTotalAfterDiscount: number): number {
  return Math.floor(OrderTotalAfterDiscount / 100);
}

export function calculateTier(PointsInTrailing90Days: number): LoyaltyTier {
  if (PointsInTrailing90Days >= 5000) return "Gold";
  if (PointsInTrailing90Days >= 1000) return "Silver";
  return "Bronze";
}

export function getDiscountForTier(Tier: LoyaltyTier): number {
  switch (Tier) {
    case "Gold":
      return 6;
    case "Silver":
      return 3;
    case "Bronze":
      return 0;
  }
}

export async function getTrailingNinetyDayPoints(
  DistributorId: string,
  Tx?: TransactionContext,
): Promise<number> {
  const Since = new Date(Date.now() - NinetyDaysMs);
  return pointsLedgerRepository.sumPointsSince(DistributorId, Since, Tx);
}
