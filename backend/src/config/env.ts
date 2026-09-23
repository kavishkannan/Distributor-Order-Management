import dotenv from "dotenv";

dotenv.config();

const Port = Number(process.env.PORT) || 4000;
const MaxRetryAttempts = Number(process.env.ERP_MAX_RETRY_ATTEMPTS) || 5;
const RetryBaseDelayMs = Number(process.env.ERP_RETRY_BASE_DELAY_MS) || 60_000;

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET must be set when NODE_ENV=production");
}

export const env = {
  port: Port,
  erpEndpointUrl:
    process.env.ERP_ENDPOINT_URL || `http://localhost:${Port}/mockerp`,
  erpWebhookTimeoutMs: Number(process.env.ERP_WEBHOOK_TIMEOUT_MS) || 5000,
  erpMaxRetryAttempts: MaxRetryAttempts,
  erpRetryDelaysMs: process.env.ERP_RETRY_DELAYS_MS
    ? process.env.ERP_RETRY_DELAYS_MS.split(",").map((Value) =>
        Number(Value.trim()),
      )
    : Array.from(
        { length: Math.max(1, MaxRetryAttempts - 1) },
        (_, Index) => RetryBaseDelayMs * 2 ** Index,
      ),
  erpRetryPollIntervalMs:
    Number(process.env.ERP_RETRY_POLL_INTERVAL_MS) || 30_000,
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  logLevel: process.env.LOG_LEVEL || "info",
};
