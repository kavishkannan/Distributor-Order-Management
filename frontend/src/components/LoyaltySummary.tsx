import { useEffect, useState } from "react";
import { getLoyaltyById, LoyaltySummaryDto } from "../api/distributors";
import Card from "./ui/Card";
import { LineSkeleton } from "./ui/LoadingState";
import TierBadge from "./TierBadge";

interface LoyaltySummaryProps {
  distributorId: string;
}

export default function LoyaltySummary({
  distributorId: DistributorId,
}: LoyaltySummaryProps) {
  const [Summary, SetSummary] = useState<LoyaltySummaryDto | null>(null);
  const [Loading, SetLoading] = useState(true);
  const [ErrorMessage, SetErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let Cancelled = false;
    SetLoading(true);
    SetErrorMessage(null);

    getLoyaltyById(DistributorId)
      .then((Data) => {
        if (!Cancelled) SetSummary(Data);
      })
      .catch(() => {
        if (!Cancelled) SetErrorMessage("Failed to load loyalty status.");
      })
      .finally(() => {
        if (!Cancelled) SetLoading(false);
      });

    return () => {
      Cancelled = true;
    };
  }, [DistributorId]);

  if (Loading) {
    return (
      <Card title="Loyalty status" tight>
        <LineSkeleton width="60%" />
      </Card>
    );
  }

  if (ErrorMessage || !Summary) {
    return (
      <Card title="Loyalty status" tight>
        <p role="alert" className="text-muted">
          {ErrorMessage ?? "Loyalty status unavailable."}
        </p>
      </Card>
    );
  }

  return (
    <Card title="Loyalty status" tight>
      <div className="loyalty-summary">
        <TierBadge tier={Summary.tier} />
        <div className="loyalty-summary__metric">
          <span className="loyalty-summary__metric-label">
            Points (90 days)
          </span>
          <span className="loyalty-summary__metric-value">
            {Summary.pointsBalance}
          </span>
        </div>
        <div className="loyalty-summary__metric">
          <span className="loyalty-summary__metric-label">Discount</span>
          <span className="loyalty-summary__metric-value">
            {Summary.currentDiscount}%
          </span>
        </div>
      </div>
    </Card>
  );
}
