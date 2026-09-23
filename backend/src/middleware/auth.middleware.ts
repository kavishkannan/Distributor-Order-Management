import { NextFunction, Request, Response } from "express";
import { errorDetails, logger } from "../config/logger";
import { UserRole } from "../models/UserEntity";
import {
  authenticateToken,
  TokenRejectedError,
  TokenSession,
} from "../services/auth.service";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  distributorId: string | null;
  salesManagerId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      tokenSession?: TokenSession;
    }
  }
}

export async function authenticateUser(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const LogContext = {
    requestId: Req.requestId,
    method: Req.method,
    path: Req.originalUrl.split("?")[0],
  };
  const Header = Req.headers.authorization;
  if (!Header || !Header.startsWith("Bearer ")) {
    logger.warn("Authentication failed", {
      ...LogContext,
      reason: "missing_or_malformed_header",
    });
    Res.status(401).json({
      message: "Missing or malformed Authorization header",
    });
    return;
  }

  const Token = Header.slice("Bearer ".length);

  try {
    const { user: User, session: Session } = await authenticateToken(Token);

    Req.tokenSession = Session;
    Req.user = {
      id: User.id,
      name: User.name,
      email: User.email,
      role: User.role,
      distributorId: User.distributorId,
      salesManagerId: User.salesManagerId,
    };
    Next();
  } catch (Err) {
    if (Err instanceof TokenRejectedError) {
      logger.warn("Authentication failed", {
        ...LogContext,
        reason: Err.reason,
      });
    } else {
      logger.error("Authentication check failed unexpectedly", {
        ...LogContext,
        ...errorDetails(Err),
      });
    }
    Res.status(401).json({ message: "Invalid or expired token" });
  }
}

export function requireRole(...Roles: UserRole[]) {
  return (Req: Request, Res: Response, Next: NextFunction): void => {
    if (!Req.user) {
      Res.status(401).json({ message: "Not authenticated" });
      return;
    }
    if (!Roles.includes(Req.user.role)) {
      logger.warn("Authorization failed", {
        requestId: Req.requestId,
        method: Req.method,
        path: Req.originalUrl.split("?")[0],
        userId: Req.user.id,
        role: Req.user.role,
      });
      Res.status(403).json({
        message: "You do not have access to this resource",
      });
      return;
    }
    Next();
  };
}
