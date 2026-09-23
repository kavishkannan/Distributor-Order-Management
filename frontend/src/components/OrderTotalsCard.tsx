import { OrderDto } from "../api/orders";
import { formatPrice } from "../utils/currency";
import Card from "./ui/Card";

interface OrderTotalsCardProps {
  order: OrderDto;
}

export default function OrderTotalsCard({
  order: Order,
}: OrderTotalsCardProps) {
  const DiscountAmount = Number(Order.Subtotal) - Number(Order.Total);

  return (
    <Card title="Order summary">
      {Order.Distributor && (
        <div className="order-summary__row">
          <span>Distributor</span>
          <span>{Order.Distributor.Name}</span>
        </div>
      )}
      <div className="order-summary__row">
        <span>Created</span>
        <span>{new Date(Order.CreatedAt).toLocaleString()}</span>
      </div>
      {Order.UpdatedAt && (
        <div className="order-summary__row">
          <span>Last updated</span>
          <span>{new Date(Order.UpdatedAt).toLocaleString()}</span>
        </div>
      )}
      <div className="order-summary__row">
        <span>Subtotal</span>
        <span>{formatPrice(Order.Subtotal)}</span>
      </div>
      <div className="order-summary__row">
        <span>Discount ({Number(Order.DiscountPercent)}%)</span>
        <span>-{formatPrice(DiscountAmount)}</span>
      </div>
      <div className="order-summary__row order-summary__row--total">
        <span>Total</span>
        <span>{formatPrice(Order.Total)}</span>
      </div>
    </Card>
  );
}
