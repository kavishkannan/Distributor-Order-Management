import { OrderEntity } from "../models/OrderEntity";
import {
  OutboundEventEntity,
  OutboundEventStatus,
} from "../models/OutboundEventEntity";
import { managerFor, TransactionContext } from "./transaction";

export interface NewOutboundEvent {
  OrderId: string;
  EventType: string;
  Payload: Record<string, unknown>;
  Status: OutboundEventStatus;
  AttemptCount: number;
  NextRetryAt: Date | null;
}

export interface DueEventCriteria {
  Statuses: OutboundEventStatus[];
  MaxAttemptCount: number;
  Now: Date;
}

export class OutboundEventRepository {
  create(
    Tx: TransactionContext,
    Data: NewOutboundEvent,
  ): Promise<OutboundEventEntity> {
    const Repo = Tx.getRepository(OutboundEventEntity);
    return Repo.save(
      Repo.create({
        Order: { Id: Data.OrderId } as OrderEntity,
        EventType: Data.EventType,
        Payload: Data.Payload,
        Status: Data.Status,
        AttemptCount: Data.AttemptCount,
        NextRetryAt: Data.NextRetryAt,
      }),
    );
  }

  save(
    Event: OutboundEventEntity,
    Tx?: TransactionContext,
  ): Promise<OutboundEventEntity> {
    return managerFor(Tx).getRepository(OutboundEventEntity).save(Event);
  }

  lockNextDue(
    Tx: TransactionContext,
    Criteria: DueEventCriteria,
  ): Promise<OutboundEventEntity | null> {
    return Tx.getRepository(OutboundEventEntity)
      .createQueryBuilder("e")
      .setLock("pessimistic_write")
      .where("e.Status IN (:...statuses)", { statuses: Criteria.Statuses })
      .andWhere("e.AttemptCount < :max", { max: Criteria.MaxAttemptCount })
      .andWhere("e.NextRetryAt IS NOT NULL")
      .andWhere("e.NextRetryAt <= :now", { now: Criteria.Now })
      .orderBy("e.NextRetryAt", "ASC")
      .getOne();
  }
}

export const outboundEventRepository = new OutboundEventRepository();
