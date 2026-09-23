import { LoyaltyTier } from "../api/distributors";
import Badge, { BadgeTone } from "./ui/Badge";

const TierTones: Record<LoyaltyTier, BadgeTone> = {
  Bronze: "warning",
  Silver: "neutral",
  Gold: "info",
};

interface TierBadgeProps {
  tier: LoyaltyTier;
}

export default function TierBadge({ tier: Tier }: TierBadgeProps) {
  return <Badge tone={TierTones[Tier]}>{Tier}</Badge>;
}
