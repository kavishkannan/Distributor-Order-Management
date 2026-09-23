import winston from "winston";
import { env } from "./env";

const SensitiveKeyPattern =
  /pass(word)?|token|secret|authorization|cookie|jwt|api[-_]?key/i;
const Redacted = "[REDACTED]";

function redact(Value: unknown, Depth = 0): unknown {
  if (Depth > 5 || Value === null || typeof Value !== "object") return Value;
  if (Value instanceof Date) return Value;
  if (Array.isArray(Value)) return Value.map((Item) => redact(Item, Depth + 1));
  const Result: Record<string, unknown> = {};
  for (const [Key, Inner] of Object.entries(Value as Record<string, unknown>)) {
    Result[Key] = SensitiveKeyPattern.test(Key)
      ? Redacted
      : redact(Inner, Depth + 1);
  }
  return Result;
}

const redactSensitive = winston.format((Info) => {
  for (const Key of Object.keys(Info)) {
    if (
      Key === "level" ||
      Key === "message" ||
      Key === "timestamp" ||
      Key === "stack"
    )
      continue;
    Info[Key] = SensitiveKeyPattern.test(Key) ? Redacted : redact(Info[Key]);
  }
  return Info;
});

export const logger = winston.createLogger({
  level: env.logLevel,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    redactSensitive(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

export function errorDetails(Err: unknown): { error: string; stack?: string } {
  if (Err instanceof Error) return { error: Err.message, stack: Err.stack };
  return { error: String(Err) };
}
