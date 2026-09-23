import "reflect-metadata";
import http from "http";

const FakeErpPort = 4499;
const BaseDelayMs = 1000;
const TimeoutMs = 500;
process.env.ERP_ENDPOINT_URL = `http://localhost:${FakeErpPort}`;
process.env.ERP_MAX_RETRY_ATTEMPTS = "5";
delete process.env.ERP_RETRY_DELAYS_MS;
process.env.ERP_RETRY_BASE_DELAY_MS = String(BaseDelayMs);
process.env.ERP_WEBHOOK_TIMEOUT_MS = String(TimeoutMs);

const Hang = -1;

import { AppDataSource } from "../config/data-source";
import { DistributorEntity } from "../models/DistributorEntity";
import { OrderEntity, OrderStatus } from "../models/OrderEntity";
import {
  OutboundEventEntity,
  OutboundEventStatus,
} from "../models/OutboundEventEntity";
import { attemptDelivery } from "../services/erp.service";
import { processRetryableEvents } from "../services/erpRetry.service";

let Passed = 0;
let Failed = 0;

function check(Condition: boolean, Description: string): void {
  if (Condition) {
    Passed += 1;
    console.log(`  PASS: ${Description}`);
  } else {
    Failed += 1;
    console.error(`  FAIL: ${Description}`);
  }
}

function sleep(Ms: number): Promise<void> {
  return new Promise((Resolve) => setTimeout(Resolve, Ms));
}

async function run(): Promise<void> {
  const StatusForAttempt = new Map<string, (Attempt: number) => number>();
  const AttemptCounts = new Map<string, number>();

  const FakeErp = http.createServer((Req, Res) => {
    const Key = String(Req.headers["x-idempotency-key"] ?? "");
    const Attempt = (AttemptCounts.get(Key) ?? 0) + 1;
    AttemptCounts.set(Key, Attempt);
    const StatusCode = (StatusForAttempt.get(Key) ?? (() => 200))(Attempt);

    let Body = "";
    Req.on("data", (Chunk) => (Body += Chunk));
    Req.on("end", () => {
      const respond = () => {
        if (Res.writableEnded || Res.destroyed) return;
        Res.writeHead(StatusCode === Hang ? 200 : StatusCode, {
          "Content-Type": "application/json",
        });
        Res.end(JSON.stringify({ received: true, attempt: Attempt }));
      };
      if (StatusCode === Hang) setTimeout(respond, TimeoutMs * 3);
      else respond();
    });
  });

  await new Promise<void>((Resolve) => FakeErp.listen(FakeErpPort, Resolve));

  await AppDataSource.initialize();

  const DistributorRepo = AppDataSource.getRepository(DistributorEntity);
  const OrderRepo = AppDataSource.getRepository(OrderEntity);
  const OutboundEventRepo = AppDataSource.getRepository(OutboundEventEntity);

  const Distributor = await DistributorRepo.save({
    Name: "Test Webhook Retry Distributor",
    CreditLimit: 100000,
  });

  const CreatedOrderIds: string[] = [];

  async function makeOutboundEvent(
    Behavior: (Attempt: number) => number,
  ): Promise<OutboundEventEntity> {
    const Order = await OrderRepo.save({
      Distributor: Distributor,
      Status: OrderStatus.Confirmed,
      DiscountPercent: 0,
      Subtotal: 100,
      Total: 100,
      IdempotencyKey: null,
    });
    CreatedOrderIds.push(Order.Id);

    const Event = await OutboundEventRepo.save(
      OutboundEventRepo.create({
        Order: Order,
        EventType: "OrderStatusChanged",
        Payload: { orderId: Order.Id, eventType: "OrderStatusChanged" },
        Status: OutboundEventStatus.Pending,
        AttemptCount: 0,
      }),
    );
    StatusForAttempt.set(Event.Id, Behavior);
    return Event;
  }

  try {
    console.log(
      "First (synchronous) delivery attempt for all three scenarios:",
    );

    const EventA = await makeOutboundEvent(() => 503);
    await attemptDelivery(EventA);

    const EventB = await makeOutboundEvent((Attempt) =>
      Attempt < 3 ? 500 : 200,
    );
    await attemptDelivery(EventB);

    const EventC = await makeOutboundEvent(() => 400);
    await attemptDelivery(EventC);

    const EventT = await makeOutboundEvent((Attempt) =>
      Attempt === 1 ? Hang : 200,
    );
    await attemptDelivery(EventT);

    console.log(
      "\nScenario T (timeout) - a timeout is retryable, not a permanent failure:",
    );
    {
      const Reloaded = await OutboundEventRepo.findOneByOrFail({
        Id: EventT.Id,
      });
      check(
        Reloaded.Status === OutboundEventStatus.Failed,
        "status is Failed after the timed-out attempt",
      );
      check(
        Reloaded.ErrorMessage === "ECONNABORTED",
        `errorMessage is the timeout code (was "${Reloaded.ErrorMessage}")`,
      );
      check(Reloaded.NextRetryAt !== null, "a retry is scheduled");
    }

    console.log(
      "\nScenario C (always-4xx) - must fail permanently after exactly 1 attempt, no retry scheduled:",
    );
    {
      const Reloaded = await OutboundEventRepo.findOneByOrFail({
        Id: EventC.Id,
      });
      check(Reloaded.Status === OutboundEventStatus.Failed, "status is Failed");
      check(
        Reloaded.AttemptCount === 1,
        `attemptCount is 1 (was ${Reloaded.AttemptCount})`,
      );
      check(
        Reloaded.NextRetryAt === null,
        "nextRetryAt is null (a 4xx is not retryable)",
      );
      check(
        Reloaded.ErrorMessage === "HTTP 400",
        `errorMessage is "HTTP 400" (was "${Reloaded.ErrorMessage}")`,
      );
    }

    const GapsA = new Map<number, number>();
    const recordGap = (Event: OutboundEventEntity) => {
      if (
        Event.NextRetryAt &&
        Event.LastAttemptedAt &&
        !GapsA.has(Event.AttemptCount)
      ) {
        GapsA.set(
          Event.AttemptCount,
          Event.NextRetryAt.getTime() - Event.LastAttemptedAt.getTime(),
        );
      }
    };
    recordGap(await OutboundEventRepo.findOneByOrFail({ Id: EventA.Id }));

    console.log(
      "\nDriving the retry worker until A, B and T settle (or a generous timeout elapses):",
    );
    const Deadline = Date.now() + 30000;
    while (Date.now() < Deadline) {
      await sleep(250);
      await processRetryableEvents();
      const [ReloadedA, ReloadedB, ReloadedT] = await Promise.all([
        OutboundEventRepo.findOneByOrFail({ Id: EventA.Id }),
        OutboundEventRepo.findOneByOrFail({ Id: EventB.Id }),
        OutboundEventRepo.findOneByOrFail({ Id: EventT.Id }),
      ]);
      recordGap(ReloadedA);
      if (
        ReloadedA.NextRetryAt === null &&
        ReloadedB.NextRetryAt === null &&
        ReloadedT.NextRetryAt === null
      )
        break;
    }

    console.log(
      "\nExponential backoff - each scheduled gap doubles (base, 2x, 4x, 8x):",
    );
    {
      for (let Attempt = 1; Attempt <= 4; Attempt += 1) {
        const Expected = BaseDelayMs * 2 ** (Attempt - 1);
        const Gap = GapsA.get(Attempt);
        check(
          Gap !== undefined && Math.abs(Gap - Expected) <= 1000,
          `after attempt ${Attempt}, next retry is ~${Expected}ms later (was ${Gap}ms)`,
        );
      }
      check(!GapsA.has(5), "no retry scheduled after the final (5th) attempt");
    }

    console.log(
      "\nScenario T (timeout) - the retry succeeds and marks it Sent:",
    );
    {
      const Reloaded = await OutboundEventRepo.findOneByOrFail({
        Id: EventT.Id,
      });
      check(Reloaded.Status === OutboundEventStatus.Sent, "status is Sent");
      check(
        Reloaded.AttemptCount === 2,
        `attemptCount is 2 (was ${Reloaded.AttemptCount})`,
      );
    }

    console.log(
      "\nRetries never create duplicate events - each is the same outbound row, same idempotency key:",
    );
    {
      for (const [Label, Event] of [
        ["A", EventA],
        ["B", EventB],
        ["T", EventT],
      ] as const) {
        const Rows = await OutboundEventRepo.count({
          where: {
            Order: {
              Id: (
                await OutboundEventRepo.findOneOrFail({
                  where: { Id: Event.Id },
                  relations: { Order: true },
                })
              ).Order.Id,
            },
          },
        });
        const Reloaded = await OutboundEventRepo.findOneByOrFail({
          Id: Event.Id,
        });
        check(
          Rows === 1,
          `${Label}: still exactly 1 outbound row for its order (found ${Rows})`,
        );
        check(
          AttemptCounts.get(Event.Id) === Reloaded.AttemptCount,
          `${Label}: every delivery carried the same X-Idempotency-Key (ERP saw ${AttemptCounts.get(Event.Id)} deliveries of it, attemptCount ${Reloaded.AttemptCount})`,
        );
      }
    }

    console.log(
      "\nScenario A (always-5xx) - must exhaust all 5 attempts and stay Failed:",
    );
    {
      const Reloaded = await OutboundEventRepo.findOneByOrFail({
        Id: EventA.Id,
      });
      check(Reloaded.Status === OutboundEventStatus.Failed, "status is Failed");
      check(
        Reloaded.AttemptCount === 5,
        `attemptCount is 5, the configured max (was ${Reloaded.AttemptCount})`,
      );
      check(
        Reloaded.NextRetryAt === null,
        "nextRetryAt is null - retries are exhausted, no further attempt scheduled",
      );
      check(
        Reloaded.ErrorMessage === "HTTP 503",
        `errorMessage preserves the final failure (was "${Reloaded.ErrorMessage}")`,
      );
    }

    console.log(
      "\nScenario B (recovers on attempt 3) - must end Sent after exactly 3 attempts:",
    );
    {
      const Reloaded = await OutboundEventRepo.findOneByOrFail({
        Id: EventB.Id,
      });
      check(Reloaded.Status === OutboundEventStatus.Sent, "status is Sent");
      check(
        Reloaded.AttemptCount === 3,
        `attemptCount is 3 (was ${Reloaded.AttemptCount})`,
      );
      check(Reloaded.NextRetryAt === null, "nextRetryAt is null once Sent");
    }

    console.log(
      "\nConcurrency: two overlapping worker ticks must not double-process the same due event:",
    );
    {
      const EventD = await makeOutboundEvent(() => 503);
      await attemptDelivery(EventD);

      const DueAt = (
        await OutboundEventRepo.findOneByOrFail({ Id: EventD.Id })
      ).NextRetryAt!.getTime();
      await sleep(Math.max(0, DueAt - Date.now()) + 300);
      await Promise.all([processRetryableEvents(), processRetryableEvents()]);

      const Reloaded = await OutboundEventRepo.findOneByOrFail({
        Id: EventD.Id,
      });
      check(
        Reloaded.AttemptCount === 2,
        `attemptCount advanced by exactly 1 from the two overlapping ticks combined (was ${Reloaded.AttemptCount}, expected 2)`,
      );
    }
  } finally {
    for (const OrderId of CreatedOrderIds) {
      await OutboundEventRepo.delete({ Order: { Id: OrderId } });
      await OrderRepo.delete({ Id: OrderId });
    }
    await DistributorRepo.delete({ Id: Distributor.Id });
    await AppDataSource.destroy();
    await new Promise<void>((Resolve) => FakeErp.close(() => Resolve()));
  }

  console.log(`\n${Passed} passed, ${Failed} failed`);
  if (Failed > 0) {
    process.exitCode = 1;
  }
}

run().catch((Err) => {
  console.error("Webhook retry test script crashed", Err);
  process.exitCode = 1;
});
