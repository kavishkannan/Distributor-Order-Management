import { env } from "../config/env";
import { errorDetails, logger } from "../config/logger";
import { OutboundEventStatus } from "../models/OutboundEventEntity";
import { outboundEventRepository } from "../repositories/outboundEvent.repository";
import { runInTransaction } from "../repositories/transaction";
import { attemptDelivery } from "./erp.service";

const MaxEventsPerTick = 20;

let IsProcessing = false;

async function claimAndDeliverOne(): Promise<boolean> {
  return runInTransaction(async (Tx) => {
    const Event = await outboundEventRepository.lockNextDue(Tx, {
      Statuses: [OutboundEventStatus.Pending, OutboundEventStatus.Failed],
      MaxAttemptCount: env.erpMaxRetryAttempts,
      Now: new Date(),
    });

    if (!Event) {
      return false;
    }

    await attemptDelivery(Event, Tx);
    return true;
  });
}

export async function processRetryableEvents(): Promise<number> {
  if (IsProcessing) {
    return 0;
  }
  IsProcessing = true;
  let ProcessedCount = 0;
  try {
    for (let Index = 0; Index < MaxEventsPerTick; Index += 1) {
      let Claimed: boolean;
      try {
        Claimed = await claimAndDeliverOne();
      } catch (Err) {
        logger.error(
          "ERP retry worker: unexpected error claiming/delivering an event",
          errorDetails(Err),
        );
        break;
      }
      if (!Claimed) {
        break;
      }
      ProcessedCount += 1;
    }
  } finally {
    IsProcessing = false;
  }
  return ProcessedCount;
}

let TimerHandle: NodeJS.Timeout | null = null;

export function startErpRetryWorker(): void {
  if (TimerHandle) {
    return;
  }
  TimerHandle = setInterval(() => {
    processRetryableEvents().catch((Err) => {
      logger.error("ERP retry worker tick failed", errorDetails(Err));
    });
  }, env.erpRetryPollIntervalMs);
  TimerHandle.unref();
}

export function stopErpRetryWorker(): void {
  if (TimerHandle) {
    clearInterval(TimerHandle);
    TimerHandle = null;
  }
}
