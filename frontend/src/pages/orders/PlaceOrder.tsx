import axios from "axios";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getAllProducts, ProductDto } from "../../api/products";
import { newIdempotencyKey } from "../../api/client";
import { isStockError, OrderDto, placeOrder } from "../../api/orders";
import { isValidationErrorResponse } from "../../api/types";
import Button from "../../components/ui/Button";
import Card from "../../components/ui/Card";
import PageHeader from "../../components/ui/PageHeader";
import LoyaltySummary from "../../components/LoyaltySummary";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { formatPrice } from "../../utils/currency";

interface LineItemRow {
  productId: string | "";
  quantity: number;
  error?: string;
}

function emptyRow(): LineItemRow {
  return { productId: "", quantity: 1 };
}

function draftKey(UserId: string): string {
  return `metayb.orderDraft.${UserId}`;
}

function loadDraft(UserId: string): LineItemRow[] {
  try {
    const Parsed = JSON.parse(
      sessionStorage.getItem(draftKey(UserId)) ?? "null",
    );
    if (Array.isArray(Parsed) && Parsed.length > 0) {
      return Parsed.map((Row) => ({
        productId: String(Row.productId ?? ""),
        quantity: Number(Row.quantity) || 1,
      }));
    }
  } catch {}
  return [emptyRow()];
}

function saveDraft(UserId: string, Rows: LineItemRow[]): void {
  try {
    sessionStorage.setItem(
      draftKey(UserId),
      JSON.stringify(
        Rows.map(({ productId, quantity }) => ({ productId, quantity })),
      ),
    );
  } catch {}
}

const MaxQuantityPerLineItem = 10_000;
const ProductPickerLimit = 100;

export default function PlaceOrder() {
  const { user: User } = useAuth();
  const DistributorId = User!.distributorId!;
  const { showToast: ShowToast } = useToast();
  const [Products, SetProducts] = useState<ProductDto[]>([]);
  const [LineItems, SetLineItems] = useState<LineItemRow[]>(() =>
    loadDraft(User!.id),
  );
  const [Submitting, SetSubmitting] = useState(false);
  const [SubmitError, SetSubmitError] = useState<string | null>(null);
  const [CreatedOrder, SetCreatedOrder] = useState<OrderDto | null>(null);
  const [SearchParams, SetSearchParams] = useSearchParams();
  const PreselectedProductId = SearchParams.get("productId");

  useEffect(() => {
    getAllProducts({
      limit: ProductPickerLimit,
      sortBy: "name",
      sortOrder: "ASC",
    })
      .then((Result) => SetProducts(Result.data))
      .catch(() => SetSubmitError("Failed to load products."));
  }, []);

  useEffect(() => {
    if (!PreselectedProductId || Products.length === 0) return;
    const Product = Products.find((P) => P.Id === PreselectedProductId);
    if (Product && Number(Product.StockQuantity) > 0) {
      SetLineItems((Rows) => {
        if (Rows.some((Row) => Row.productId === Product.Id)) return Rows;
        const EmptyIndex = Rows.findIndex((Row) => Row.productId === "");
        return EmptyIndex >= 0
          ? Rows.map((Row, I) =>
              I === EmptyIndex ? { ...Row, productId: Product.Id } : Row,
            )
          : [...Rows, { productId: Product.Id, quantity: 1 }];
      });
    }
    SetSearchParams({}, { replace: true });
  }, [PreselectedProductId, Products, SetSearchParams]);

  useEffect(() => {
    saveDraft(User!.id, LineItems);
  }, [User, LineItems]);

  function updateLineItem(Index: number, Changes: Partial<LineItemRow>) {
    SetLineItems((Rows) =>
      Rows.map((Row, I) =>
        I === Index ? { ...Row, ...Changes, error: undefined } : Row,
      ),
    );
  }

  function setQuantity(Index: number, Quantity: number) {
    const Clamped = Math.min(Math.max(Quantity, 1), MaxQuantityPerLineItem);
    updateLineItem(Index, { quantity: Number.isFinite(Clamped) ? Clamped : 1 });
  }

  function addLineItem() {
    SetLineItems((Rows) => [...Rows, emptyRow()]);
  }

  function removeLineItem(Index: number) {
    SetLineItems((Rows) => Rows.filter((_, I) => I !== Index));
  }

  const DraftSignature = JSON.stringify(
    LineItems.map(({ productId, quantity }) => [productId, quantity]),
  );
  const SubmissionKey = useMemo(() => newIdempotencyKey(), [DraftSignature]);

  const EstimatedSubtotal = useMemo(() => {
    return LineItems.reduce((Sum, Row) => {
      const Product = Products.find((P) => P.Id === Row.productId);
      if (!Product) return Sum;
      return Sum + Number(Product.UnitPrice) * Row.quantity;
    }, 0);
  }, [LineItems, Products]);

  async function handleSubmit(Evt: FormEvent) {
    Evt.preventDefault();
    SetSubmitError(null);
    SetCreatedOrder(null);

    if (LineItems.some((Row) => Row.productId === "" || Row.quantity <= 0)) {
      SetSubmitError(
        "Select a product and a quantity greater than zero for every line item.",
      );
      return;
    }

    SetSubmitting(true);
    try {
      const Order = await placeOrder(
        LineItems.map((Row) => ({
          productId: Row.productId as string,
          quantity: Row.quantity,
        })),
        SubmissionKey,
      );
      SetCreatedOrder(Order);
      SetLineItems([emptyRow()]);
      ShowToast(`Order #${Order.Id} placed successfully.`, "success");
    } catch (Err) {
      const Data = axios.isAxiosError(Err) ? Err.response?.data : undefined;

      if (isStockError(Data)) {
        SetLineItems((Rows) =>
          Rows.map((Row) => {
            const Product = Products.find((P) => P.Id === Row.productId);
            return Product?.Sku === Data.sku
              ? {
                  ...Row,
                  error: `Only ${Data.availableQuantity} in stock for ${Data.sku}`,
                }
              : Row;
          }),
        );
      } else if (isValidationErrorResponse(Data)) {
        SetSubmitError(Data.errors.map((Issue) => Issue.message).join(" "));
      } else {
        SetSubmitError(Data?.message ?? "Failed to place order.");
      }
    } finally {
      SetSubmitting(false);
    }
  }

  return (
    <div className="page">
      <PageHeader
        title="Place Order"
        subtitle="Build an order for a distributor from the live catalogue."
      />

      <form onSubmit={handleSubmit}>
        <div className="order-layout">
          <div>
            <LoyaltySummary distributorId={DistributorId} />

            <Card title="Line items">
              <div className="table-wrap">
                <div className="table-scroll">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {LineItems.map((Row, Index) => {
                        const SelectedProduct = Products.find(
                          (P) => P.Id === Row.productId,
                        );
                        return (
                          <tr key={Index}>
                            <td>
                              <select
                                className="select"
                                value={Row.productId}
                                onChange={(Evt) =>
                                  updateLineItem(Index, {
                                    productId: Evt.target.value,
                                  })
                                }
                              >
                                <option value="" disabled>
                                  Select a product
                                </option>
                                {Products.map((Product) => (
                                  <option
                                    key={Product.Id}
                                    value={Product.Id}
                                    disabled={
                                      Number(Product.StockQuantity) === 0
                                    }
                                  >
                                    {Product.Sku} - {Product.Name}
                                    {Number(Product.StockQuantity) === 0
                                      ? " (out of stock)"
                                      : ""}
                                  </option>
                                ))}
                              </select>
                              {SelectedProduct && (
                                <div
                                  className="text-muted"
                                  style={{
                                    fontSize: "var(--text-xs)",
                                    marginTop: 4,
                                  }}
                                >
                                  {formatPrice(SelectedProduct.UnitPrice)} /
                                  unit &middot; {SelectedProduct.StockQuantity}{" "}
                                  in stock
                                </div>
                              )}
                              {Row.error && (
                                <div role="alert" className="line-item-error">
                                  {Row.error}
                                </div>
                              )}
                            </td>
                            <td>
                              <div className="qty-stepper">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQuantity(Index, Row.quantity - 1)
                                  }
                                  disabled={Row.quantity <= 1}
                                  aria-label="Decrease quantity"
                                >
                                  &minus;
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={MaxQuantityPerLineItem}
                                  value={Row.quantity}
                                  onChange={(Evt) =>
                                    setQuantity(Index, Number(Evt.target.value))
                                  }
                                  aria-label="Quantity"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQuantity(Index, Row.quantity + 1)
                                  }
                                  disabled={
                                    Row.quantity >= MaxQuantityPerLineItem
                                  }
                                  aria-label="Increase quantity"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            <td>
                              {LineItems.length > 1 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeLineItem(Index)}
                                >
                                  Remove
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ marginTop: "var(--space-4)" }}>
                <Button type="button" variant="secondary" onClick={addLineItem}>
                  + Add line item
                </Button>
              </div>
            </Card>
          </div>

          <div className="order-summary">
            <Card title="Order summary">
              <div className="order-summary__row">
                <span>Estimated subtotal</span>
                <span>{formatPrice(EstimatedSubtotal)}</span>
              </div>
              <p style={{ fontSize: "var(--text-xs)" }}>
                Discount and final total are calculated by the server, based on
                the distributor&apos;s current loyalty tier, when the order is
                placed.
              </p>

              {SubmitError && (
                <div className="alert alert--danger" role="alert">
                  {SubmitError}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                block
                loading={Submitting}
              >
                {Submitting ? "Placing order..." : "Place order"}
              </Button>
            </Card>

            {CreatedOrder && (
              <Card title={`Order #${CreatedOrder.Id} placed`}>
                <div className="order-summary__row">
                  <span>Status</span>
                  <span>{CreatedOrder.Status}</span>
                </div>
                <div className="order-summary__row">
                  <span>Discount applied</span>
                  <span>{CreatedOrder.DiscountPercent}%</span>
                </div>
                <div className="order-summary__row order-summary__row--total">
                  <span>Total</span>
                  <span>{formatPrice(CreatedOrder.Total)}</span>
                </div>
                <ul
                  style={{
                    marginTop: "var(--space-4)",
                    paddingLeft: "var(--space-5)",
                  }}
                >
                  {CreatedOrder.LineItems.map((Item) => (
                    <li
                      key={Item.Id}
                      style={{ fontSize: "var(--text-sm)", marginBottom: 4 }}
                    >
                      {Item.Product.Sku} - {Item.Product.Name} x {Item.Quantity}{" "}
                      @ {formatPrice(Item.UnitPrice)}
                    </li>
                  ))}
                </ul>
                <Link to={`/orders/${CreatedOrder.Id}`}>
                  View order details &rarr;
                </Link>
              </Card>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
