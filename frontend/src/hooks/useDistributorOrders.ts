import { useCallback, useEffect, useState } from "react";
import {
  GetDistributorOrdersParams,
  getDistributorOrders,
} from "../api/distributors";
import { OrderSummaryDto } from "../api/orders";
import { ListResponse } from "../api/types";

interface UseDistributorOrdersResult {
  orders: ListResponse<OrderSummaryDto> | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDistributorOrders(
  DistributorId: string | undefined,
  Params: GetDistributorOrdersParams,
): UseDistributorOrdersResult {
  const [Orders, SetOrders] = useState<ListResponse<OrderSummaryDto> | null>(
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
      SetOrders(null);
      SetLoading(false);
      return;
    }

    let Cancelled = false;
    SetLoading(true);
    SetErrorMessage(null);

    getDistributorOrders(DistributorId, Params)
      .then((Data) => {
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
    DistributorId,
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
