import { OrderEntity, OrderStatus } from "../models/OrderEntity";
import { ActorTypeEnum, OrderEventEntity } from "../models/OrderEventEntity";
import { TransactionContext } from "./transaction";

export interface NewOrderEvent {
  OrderId: string;
  FromStatus: OrderStatus | null;
  ToStatus: OrderStatus;
  ActorType: ActorTypeEnum;
  ActorId: string | null;
  IdempotencyKey: string | null;
}

export class OrderEventRepository {
  append(
    Tx: TransactionContext,
    Data: NewOrderEvent,
  ): Promise<OrderEventEntity> {
    const Repo = Tx.getRepository(OrderEventEntity);
    return Repo.save(
      Repo.create({
        Order: { Id: Data.OrderId } as OrderEntity,
        FromStatus: Data.FromStatus,
        ToStatus: Data.ToStatus,
        ActorType: Data.ActorType,
        ActorId: Data.ActorId,
        IdempotencyKey: Data.IdempotencyKey,
      }),
    );
  }

  findByIdempotencyKeyWithOrder(
    Tx: TransactionContext,
    IdempotencyKey: string,
  ): Promise<OrderEventEntity | null> {
    return Tx.getRepository(OrderEventEntity).findOne({
      where: { IdempotencyKey },
      relations: { Order: true },
    });
  }
}

export const orderEventRepository = new OrderEventRepository();
