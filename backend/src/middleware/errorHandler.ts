import { NextFunction, Request, Response } from "express";
import { errorDetails, logger } from "../config/logger";

function isMalformedJsonError(Err: unknown): boolean {
  return (
    Err instanceof SyntaxError &&
    (Err as SyntaxError & { status?: number; type?: string }).status === 400 &&
    (Err as SyntaxError & { status?: number; type?: string }).type ===
      "entity.parse.failed"
  );
}

export function errorHandler(
  Err: unknown,
  Req: Request,
  Res: Response,
  Next: NextFunction,
): void {
  const Context = {
    requestId: Req.requestId,
    method: Req.method,
    path: Req.originalUrl.split("?")[0],
  };
  if (isMalformedJsonError(Err)) {
    logger.warn("Malformed JSON request body", { ...Context, statusCode: 400 });
    Res.status(400).json({ message: "Malformed JSON in request body" });
    return;
  }
  logger.error("Unhandled error", {
    ...Context,
    statusCode: 500,
    ...errorDetails(Err),
  });
  Res.status(500).json({ message: "Internal server error" });
}
