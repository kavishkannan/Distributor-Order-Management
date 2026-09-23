import { useCallback, useEffect, useState } from "react";
import {
  DistributorDashboardDto,
  getDistributorDashboard,
} from "../api/distributors";

interface UseDistributorDashboardResult {
  dashboard: DistributorDashboardDto | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDistributorDashboard(
  DistributorId: string | undefined,
): UseDistributorDashboardResult {
  const [Dashboard, SetDashboard] = useState<DistributorDashboardDto | null>(
    null,
  );
  const [Loading, SetLoading] = useState(true);
  const [ErrorMessage, SetErrorMessage] = useState<string | null>(null);
  const [RefetchToken, SetRefetchToken] = useState(0);

  const Refetch = useCallback(() => {
    SetRefetchToken((Token) => Token + 1);
  }, []);

  useEffect(() => {
    if (!DistributorId) {
      SetDashboard(null);
      SetLoading(false);
      return;
    }

    let Cancelled = false;
    SetLoading(true);
    SetErrorMessage(null);

    getDistributorDashboard(DistributorId)
      .then((Data) => {
        if (!Cancelled) SetDashboard(Data);
      })
      .catch(() => {
        if (!Cancelled) SetErrorMessage("Failed to load dashboard.");
      })
      .finally(() => {
        if (!Cancelled) SetLoading(false);
      });

    return () => {
      Cancelled = true;
    };
  }, [DistributorId, RefetchToken]);

  return {
    dashboard: Dashboard,
    loading: Loading,
    error: ErrorMessage,
    refetch: Refetch,
  };
}
