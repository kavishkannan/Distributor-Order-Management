import { useCallback, useEffect, useState } from "react";
import {
  getAllOrders,
  getPendingApprovalOrders,
  SalesManagerOrderSummaryDto,
} from "../api/salesManager";

export interface SalesManagerDashboardData {
  pendingApprovalCount: number;
  confirmedCount: number;
  dispatchedCount: number;
  deliveredCount: number;
  pendingQueuePreview: SalesManagerOrderSummaryDto[];
  recentOrders: SalesManagerOrderSummaryDto[];
}

interface UseSalesManagerDashboardResult {
  data: SalesManagerDashboardData | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSalesManagerDashboard(): UseSalesManagerDashboardResult {
  const [Data, SetData] = useState<SalesManagerDashboardData | null>(null);
  const [Loading, SetLoading] = useState(true);
  const [ErrorMessage, SetErrorMessage] = useState<string | null>(null);
  const [RefetchToken, SetRefetchToken] = useState(0);

  const Refetch = useCallback(() => {
    SetRefetchToken((Token) => Token + 1);
  }, []);

  useEffect(() => {
    let Cancelled = false;
    SetLoading(true);
    SetErrorMessage(null);

    Promise.all([
      getAllOrders({ status: "Confirmed", limit: 1 }),
      getAllOrders({ status: "Dispatched", limit: 1 }),
      getAllOrders({ status: "Delivered", limit: 1 }),
      getPendingApprovalOrders({ limit: 5 }),
      getAllOrders({ limit: 5, sortBy: "createdat", sortOrder: "DESC" }),
    ])
      .then(([Confirmed, Dispatched, Delivered, PendingQueue, Recent]) => {
        if (Cancelled) return;
        SetData({
          pendingApprovalCount: PendingQueue.pagination.total,
          confirmedCount: Confirmed.pagination.total,
          dispatchedCount: Dispatched.pagination.total,
          deliveredCount: Delivered.pagination.total,
          pendingQueuePreview: PendingQueue.data,
          recentOrders: Recent.data,
        });
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
  }, [RefetchToken]);

  return {
    data: Data,
    loading: Loading,
    error: ErrorMessage,
    refetch: Refetch,
  };
}
