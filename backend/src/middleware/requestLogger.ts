import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import { logger } from "../config/logger";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const RequestIdPattern = /^[A-Za-z0-9._-]{1,100}$/;

function resolveRequestId(Req: Request): string {
  const Incoming = Req.headers["x-request-id"];
  return typeof Incoming === "string" && RequestIdPattern.test(Incoming)
    ? Incoming
    : randomUUID();
}

export function requestLogger(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): void {
  const StartedAt = process.hrtime.bigint();
  Req.requestId = resolveRequestId(Req);
  Res.setHeader("X-Request-Id", Req.requestId);

  Res.on("finish", () => {
    const DurationMs = Number(process.hrtime.bigint() - StartedAt) / 1e6;
    const Level =
      Res.statusCode >= 500 ? "error" : Res.statusCode >= 400 ? "warn" : "info";
    logger.log(Level, "HTTP request", {
      requestId: Req.requestId,
      method: Req.method,
      path: Req.originalUrl.split("?")[0],
      statusCode: Res.statusCode,
      durationMs: Math.round(DurationMs * 10) / 10,
    });
  });
  Next();
}
