import { Request, Response } from "express";
import { logger } from "../config/logger";

export function receiveEvent(Req: Request, Res: Response): void {
  const Payload = (Req.body ?? {}) as Record<string, unknown>;
  logger.info("Mock ERP received event", {
    requestId: Req.requestId,
    eventType: Payload.eventType,
    orderId: Payload.orderId,
    orderEventId: Payload.orderEventId,
    newStatus: Payload.newStatus,
  });
  Res.status(200).json({ received: true });
}
