import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { distributorRepository } from "../repositories/distributor.repository";
import { revokedTokenRepository } from "../repositories/revokedToken.repository";
import { salesManagerRepository } from "../repositories/salesManager.repository";
import { isUniqueViolation } from "../repositories/transaction";
import { userRepository } from "../repositories/user.repository";
import { UserEntity, UserRole } from "../models/UserEntity";

const SaltRounds = 10;

export class AuthenticationError extends Error {}
export class DuplicateEmailError extends Error {}
export class InvalidRoleAssociationError extends Error {}

export function normalizeEmail(Email: string): string {
  return Email.trim().toLowerCase();
}

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  distributorId: string | null;
  salesManagerId: string | null;
}

function toSafeUser(User: UserEntity): SafeUser {
  return {
    id: User.Id,
    name: User.Name,
    email: User.Email,
    role: User.Role,
    distributorId: User.Distributor?.Id ?? null,
    salesManagerId: User.SalesManager?.Id ?? null,
  };
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
  exp?: number;
  jti?: string;
}

function signToken(User: UserEntity): string {
  const Payload: JwtPayload = { sub: User.Id, role: User.Role };
  return jwt.sign(Payload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    jwtid: randomUUID(),
  } as jwt.SignOptions);
}

export function verifyToken(Token: string): JwtPayload {
  return jwt.verify(Token, env.jwtSecret) as JwtPayload;
}

function fingerprintToken(Token: string): string {
  return createHash("sha256").update(Token).digest("hex");
}

export interface TokenSession {
  tokenHash: string;
  expiresAt: Date;
}

export interface AuthenticatedToken {
  user: SafeUser;
  session: TokenSession;
}

export class TokenRejectedError extends AuthenticationError {
  constructor(
    public readonly reason:
      | "invalid_or_expired"
      | "revoked"
      | "user_not_found_or_deleted",
  ) {
    super("Invalid or expired token");
  }
}

export async function authenticateToken(
  Token: string,
): Promise<AuthenticatedToken> {
  let Payload: JwtPayload;
  try {
    Payload = verifyToken(Token);
  } catch {
    throw new TokenRejectedError("invalid_or_expired");
  }
  if (typeof Payload.exp !== "number" || typeof Payload.sub !== "string") {
    throw new TokenRejectedError("invalid_or_expired");
  }

  const TokenHash = fingerprintToken(Token);
  if (await revokedTokenRepository.exists(TokenHash)) {
    throw new TokenRejectedError("revoked");
  }

  const User = await getCurrentUser(Payload.sub);
  if (!User) {
    throw new TokenRejectedError("user_not_found_or_deleted");
  }

  return {
    user: User,
    session: { tokenHash: TokenHash, expiresAt: new Date(Payload.exp * 1000) },
  };
}

export async function logout(
  UserId: string,
  Session: TokenSession,
): Promise<void> {
  await revokedTokenRepository.add(
    Session.tokenHash,
    UserId,
    Session.expiresAt,
  );
  await revokedTokenRepository.deleteExpiredBefore(new Date());
  logger.info("User logged out; token revoked", { userId: UserId });
}

export interface AuthResult {
  user: SafeUser;
  token: string;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  distributorId?: string;
  contactNumber?: string | null;
}

export async function signUp(Input: SignUpInput): Promise<AuthResult> {
  const Email = normalizeEmail(Input.email);

  const Existing = await userRepository.findByEmail(Email);
  if (Existing) {
    throw new DuplicateEmailError(
      `An account with email ${Email} already exists`,
    );
  }

  let DistributorLink = null;
  let SalesManagerLink = null;

  if (Input.role === UserRole.Distributor) {
    const Distributor = Input.distributorId
      ? await distributorRepository.findById(Input.distributorId)
      : null;
    if (!Distributor || Distributor.IsDeleted) {
      throw new InvalidRoleAssociationError(
        `Distributor ${Input.distributorId} not found`,
      );
    }
    DistributorLink = Distributor;
  } else {
    const SalesManager = await salesManagerRepository.findFirstActive();
    if (!SalesManager) {
      throw new InvalidRoleAssociationError(
        "No sales manager record exists to associate this account with",
      );
    }
    SalesManagerLink = SalesManager;
  }

  const HashedPassword = await bcrypt.hash(Input.password, SaltRounds);

  let User: UserEntity;
  try {
    User = await userRepository.create({
      Name: Input.name,
      Email,
      Password: HashedPassword,
      ContactNumber: Input.contactNumber ?? null,
      Role: Input.role,
      Distributor: DistributorLink,
      SalesManager: SalesManagerLink,
    });
  } catch (Err) {
    if (isUniqueViolation(Err)) {
      throw new DuplicateEmailError(
        `An account with email ${Email} already exists`,
      );
    }
    throw Err;
  }

  User.Distributor = DistributorLink;
  User.SalesManager = SalesManagerLink;

  logger.info("User signed up", { userId: User.Id, role: User.Role });

  return { user: toSafeUser(User), token: signToken(User) };
}

export interface SignInInput {
  email: string;
  password: string;
}

export async function signIn(Input: SignInInput): Promise<AuthResult> {
  const Email = normalizeEmail(Input.email);

  const User = await userRepository.findByEmailWithLinks(Email);
  if (!User || User.IsDeleted) {
    logger.warn("Sign-in failed", {
      reason: User ? "account_deleted" : "unknown_account",
    });
    throw new AuthenticationError("Invalid email or password");
  }

  const PasswordMatches = await bcrypt.compare(Input.password, User.Password);
  if (!PasswordMatches) {
    logger.warn("Sign-in failed", {
      reason: "wrong_credentials",
      userId: User.Id,
    });
    throw new AuthenticationError("Invalid email or password");
  }

  return { user: toSafeUser(User), token: signToken(User) };
}

export async function getCurrentUser(UserId: string): Promise<SafeUser | null> {
  const User = await userRepository.findByIdWithLinks(UserId);
  return User && !User.IsDeleted ? toSafeUser(User) : null;
}

export interface SignUpDistributorOption {
  id: string;
  name: string;
}

export async function getSignUpDistributors(): Promise<
  SignUpDistributorOption[]
> {
  const Distributors = await distributorRepository.findActiveNames();
  return Distributors.map((Distributor) => ({
    id: Distributor.Id,
    name: Distributor.Name,
  }));
}
