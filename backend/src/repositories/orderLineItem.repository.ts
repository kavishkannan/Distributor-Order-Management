import { OrderEntity } from "../models/OrderEntity";
import { OrderLineItemEntity } from "../models/OrderLineItemEntity";
import { ProductEntity } from "../models/ProductEntity";
import { TransactionContext } from "./transaction";

export interface NewOrderLineItem {
  Order: OrderEntity;
  Product: ProductEntity;
  Quantity: number;
  UnitPrice: number;
}

export class OrderLineItemRepository {
  createMany(
    Tx: TransactionContext,
    Items: NewOrderLineItem[],
  ): Promise<OrderLineItemEntity[]> {
    const Repo = Tx.getRepository(OrderLineItemEntity);
    return Repo.save(Items.map((Item) => Repo.create(Item)));
  }

  findByOrderIdWithProduct(
    Tx: TransactionContext,
    OrderId: string,
  ): Promise<OrderLineItemEntity[]> {
    return Tx.getRepository(OrderLineItemEntity).find({
      where: { Order: { Id: OrderId } },
      relations: { Product: true },
    });
  }
}

export const orderLineItemRepository = new OrderLineItemRepository();
