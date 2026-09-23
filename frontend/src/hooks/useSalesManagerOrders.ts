import { useCallback, useEffect, useState } from "react";
import {
  getAllOrders,
  getPendingApprovalOrders,
  GetOrdersParams,
  SalesManagerOrderSummaryDto,
} from "../api/salesManager";
import { ListResponse } from "../api/types";

interface UseSalesManagerOrdersResult {
  orders: ListResponse<SalesManagerOrderSummaryDto> | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSalesManagerOrders(
  Mode: "all" | "pending",
  Params: GetOrdersParams,
): UseSalesManagerOrdersResult {
  const [Orders, SetOrders] =
    useState<ListResponse<SalesManagerOrderSummaryDto> | null>(null);
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

    const Request =
      Mode === "pending"
        ? getPendingApprovalOrders(Params)
        : getAllOrders(Params);

    Request.then((Data) => {
      if (!Cancelled) SetOrders(Data);
    })
      .catch(() => {
        if (!Cancelled) SetErrorMessage("Failed to load orders.");
      })
      .finally(() => {
        if (!Cancelled) SetLoading(false);
      });

    return () => {
      Cancelled = true;
    };
  }, [
    Mode,
    Params.page,
    Params.limit,
    Params.status,
    Params.search,
    Params.sortBy,
    Params.sortOrder,
    RefetchToken,
  ]);

  return {
    orders: Orders,
    loading: Loading,
    error: ErrorMessage,
    refetch: Refetch,
  };
}
