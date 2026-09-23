import { NextFunction, Request, Response } from "express";
import { UserRole } from "../models/UserEntity";
import {
  AuthenticationError,
  DuplicateEmailError,
  getCurrentUser as getCurrentUserService,
  getSignUpDistributors as getSignUpDistributorsService,
  InvalidRoleAssociationError,
  logout as logoutService,
  signIn as signInService,
  signUp as signUpService,
} from "../services/auth.service";
import {
  isUuid,
  isValidEmail,
  sendValidationError,
  ValidationIssue,
} from "../utils/validators";

const MinNameLength = 2;
const MaxNameLength = 100;
const MinPasswordLength = 8;
const MaxPasswordLength = 100;
const PasswordHasLetterAndDigit = /(?=.*[A-Za-z])(?=.*\d)/;
const AllowedRoles = new Set<string>(Object.values(UserRole));

interface SignUpRequestBody {
  name?: unknown;
  email?: unknown;
  password?: unknown;
  role?: unknown;
  distributorId?: unknown;
  contactNumber?: unknown;
}

function parseSignUpBody(Body: SignUpRequestBody):
  | {
      value: {
        name: string;
        email: string;
        password: string;
        role: UserRole;
        distributorId?: string;
        contactNumber: string | null;
      };
    }
  | { issues: ValidationIssue[] } {
  const Issues: ValidationIssue[] = [];

  const Name = typeof Body.name === "string" ? Body.name.trim() : "";
  if (
    typeof Body.name !== "string" ||
    Name.length < MinNameLength ||
    Name.length > MaxNameLength
  ) {
    Issues.push({
      field: "name",
      message: `name is required and must be ${MinNameLength}-${MaxNameLength} characters`,
    });
  }

  const Email = typeof Body.email === "string" ? Body.email.trim() : "";
  if (!isValidEmail(Email)) {
    Issues.push({
      field: "email",
      message: "a valid email address is required",
    });
  }

  if (
    typeof Body.password !== "string" ||
    Body.password.length < MinPasswordLength ||
    Body.password.length > MaxPasswordLength
  ) {
    Issues.push({
      field: "password",
      message: `password must be ${MinPasswordLength}-${MaxPasswordLength} characters`,
    });
  } else if (!PasswordHasLetterAndDigit.test(Body.password)) {
    Issues.push({
      field: "password",
      message: "password must contain at least one letter and one digit",
    });
  }

  if (typeof Body.role !== "string" || !AllowedRoles.has(Body.role)) {
    Issues.push({
      field: "role",
      message: `role must be one of ${[...AllowedRoles].join(", ")}`,
    });
  }

  if (Body.role === UserRole.Distributor && !isUuid(Body.distributorId)) {
    Issues.push({
      field: "distributorId",
      message:
        "distributorId is required and must be a UUID when role is DISTRIBUTOR",
    });
  }

  if (
    Body.contactNumber !== undefined &&
    Body.contactNumber !== null &&
    typeof Body.contactNumber !== "string"
  ) {
    Issues.push({
      field: "contactNumber",
      message: "contactNumber must be a string when provided",
    });
  }

  if (Issues.length > 0) return { issues: Issues };

  return {
    value: {
      name: Name,
      email: Email,
      password: Body.password as string,
      role: Body.role as UserRole,
      distributorId:
        Body.role === UserRole.Distributor
          ? (Body.distributorId as string)
          : undefined,
      contactNumber:
        typeof Body.contactNumber === "string"
          ? Body.contactNumber.trim() || null
          : null,
    },
  };
}

export async function signUp(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const Parsed = parseSignUpBody(Req.body ?? {});
  if ("issues" in Parsed) {
    sendValidationError(Res, Parsed.issues);
    return;
  }

  try {
    const Result = await signUpService(Parsed.value);
    Res.status(201).json(Result);
  } catch (Err) {
    if (Err instanceof DuplicateEmailError) {
      Res.status(409).json({ message: Err.message });
      return;
    }
    if (Err instanceof InvalidRoleAssociationError) {
      sendValidationError(Res, [
        { field: "distributorId", message: Err.message },
      ]);
      return;
    }
    Next(Err);
  }
}

interface SignInRequestBody {
  email?: unknown;
  password?: unknown;
}

export async function signIn(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  const Body = (Req.body ?? {}) as SignInRequestBody;

  const Email = typeof Body.email === "string" ? Body.email.trim() : "";
  const Issues: ValidationIssue[] = [];
  if (!isValidEmail(Email)) {
    Issues.push({
      field: "email",
      message: "a valid email address is required",
    });
  }
  if (typeof Body.password !== "string" || Body.password.length === 0) {
    Issues.push({ field: "password", message: "password is required" });
  }
  if (Issues.length > 0) {
    sendValidationError(Res, Issues);
    return;
  }

  try {
    const Result = await signInService({
      email: Email,
      password: Body.password as string,
    });
    Res.json(Result);
  } catch (Err) {
    if (Err instanceof AuthenticationError) {
      Res.status(401).json({ message: Err.message });
      return;
    }
    Next(Err);
  }
}

export async function getMe(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  try {
    if (!Req.user) {
      Res.status(401).json({ message: "Not authenticated" });
      return;
    }

    const User = await getCurrentUserService(Req.user.id);
    if (!User) {
      Res.status(404).json({ message: "User not found" });
      return;
    }

    Res.json(User);
  } catch (Err) {
    Next(Err);
  }
}

export async function logout(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  try {
    await logoutService(Req.user!.id, Req.tokenSession!);
    Res.status(200).json({ message: "Logged out" });
  } catch (Err) {
    Next(Err);
  }
}

export async function getSignUpDistributors(
  Req: Request,
  Res: Response,
  Next: NextFunction,
): Promise<void> {
  try {
    Res.json(await getSignUpDistributorsService());
  } catch (Err) {
    Next(Err);
  }
}
