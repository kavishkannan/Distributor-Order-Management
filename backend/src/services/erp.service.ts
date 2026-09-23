import axios from "axios";
import { env } from "../config/env";
import { errorDetails, logger } from "../config/logger";
import { OrderEntity } from "../models/OrderEntity";
import { OrderEventEntity } from "../models/OrderEventEntity";
import {
  OutboundEventEntity,
  OutboundEventStatus,
} from "../models/OutboundEventEntity";
import { outboundEventRepository } from "../repositories/outboundEvent.repository";
import { TransactionContext } from "../repositories/transaction";

interface ErpEventPayload {
  orderId: string;
  orderEventId: string;
  distributorId: string | undefined;
  eventType: string;
  previousStatus: string | null;
  newStatus: string;
  status: string;
  actorType: string;
  actorId: string | null;
  total: number | string;
  timestamp: string;
}

function describeError(Err: unknown): string {
  if (axios.isAxiosError(Err)) {
    if (Err.response) {
      return `HTTP ${Err.response.status}`;
    }
    if (Err.code) {
      return Err.code;
    }
    return "network error";
  }
  return "delivery failed";
}

function isRetryable(Err: unknown): boolean {
  if (axios.isAxiosError(Err) && Err.response) {
    return Err.response.status >= 500;
  }
  return true;
}

function nextRetryDelayMs(AttemptCount: number): number | null {
  if (AttemptCount >= env.erpMaxRetryAttempts) {
    return null;
  }
  const Delays = env.erpRetryDelaysMs;
  return Delays[AttemptCount - 1] ?? Delays[Delays.length - 1];
}

export async function attemptDelivery(
  OutboundEvent: OutboundEventEntity,
  Tx?: TransactionContext,
): Promise<void> {
  OutboundEvent.AttemptCount += 1;
  OutboundEvent.LastAttemptedAt = new Date();

  try {
    await axios.post(env.erpEndpointUrl, OutboundEvent.Payload, {
      timeout: env.erpWebhookTimeoutMs,
      headers: { "X-Idempotency-Key": OutboundEvent.Id },
    });
    OutboundEvent.Status = OutboundEventStatus.Sent;
    OutboundEvent.NextRetryAt = null;
    OutboundEvent.ErrorMessage = null;
    logger.info("ERP event delivered", {
      outboundEventId: OutboundEvent.Id,
      eventType: OutboundEvent.EventType,
      attempt: OutboundEvent.AttemptCount,
    });
  } catch (Err) {
    OutboundEvent.ErrorMessage = describeError(Err);
    const Delay = isRetryable(Err)
      ? nextRetryDelayMs(OutboundEvent.AttemptCount)
      : null;
    OutboundEvent.Status = OutboundEventStatus.Failed;
    OutboundEvent.NextRetryAt =
      Delay === null ? null : new Date(Date.now() + Delay);
    logger.log(
      OutboundEvent.NextRetryAt ? "warn" : "error",
      "ERP event delivery failed",
      {
        outboundEventId: OutboundEvent.Id,
        eventType: OutboundEvent.EventType,
        attempt: OutboundEvent.AttemptCount,
        error: OutboundEvent.ErrorMessage,
        nextRetryAt: OutboundEvent.NextRetryAt?.toISOString() ?? null,
        retriesExhausted: OutboundEvent.NextRetryAt === null,
      },
    );
  }

  await outboundEventRepository.save(OutboundEvent, Tx);
}

export async function createOutboundEvent(
  Tx: TransactionContext,
  Order: OrderEntity,
  Event: OrderEventEntity,
  EventType: string,
): Promise<OutboundEventEntity> {
  const Payload: ErpEventPayload = {
    orderId: Order.Id,
    orderEventId: Event.Id,
    distributorId: Order.Distributor?.Id,
    eventType: EventType,
    previousStatus: Event.FromStatus,
    newStatus: Event.ToStatus,
    status: Event.ToStatus,
    actorType: Event.ActorType,
    actorId: Event.ActorId,
    total: Order.Total,
    timestamp: (Event.CreatedAt ?? new Date()).toISOString(),
  };

  return outboundEventRepository.create(Tx, {
    OrderId: Order.Id,
    EventType: EventType,
    Payload: Payload as unknown as Record<string, unknown>,
    Status: OutboundEventStatus.Pending,
    AttemptCount: 0,
    NextRetryAt: new Date(Date.now() + (env.erpRetryDelaysMs[0] ?? 60_000)),
  });
}

export async function deliverOutboundEvents(
  Events: OutboundEventEntity[],
): Promise<void> {
  for (const OutboundEvent of Events) {
    logger.info("ERP event created", {
      outboundEventId: OutboundEvent.Id,
      orderId: (OutboundEvent.Payload as { orderId?: string }).orderId,
      eventType: OutboundEvent.EventType,
      newStatus: (OutboundEvent.Payload as { newStatus?: string }).newStatus,
    });
    try {
      await attemptDelivery(OutboundEvent);
    } catch (Err) {
      logger.error(
        "Could not record ERP delivery attempt; left for the retry worker",
        {
          outboundEventId: OutboundEvent.Id,
          ...errorDetails(Err),
        },
      );
    }
  }
}
