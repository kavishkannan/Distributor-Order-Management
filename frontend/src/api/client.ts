import axios from "axios";

export const TokenStorageKey = "metayb.authToken";

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TokenStorageKey);
  } catch {
    return null;
  }
}

export function setStoredToken(Token: string): void {
  try {
    localStorage.setItem(TokenStorageKey, Token);
  } catch {}
}

export function clearStoredToken(): void {
  try {
    localStorage.removeItem(TokenStorageKey);
  } catch {}
}

export const ApiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:4000/api",
});

ApiClient.interceptors.request.use((Config) => {
  const Token = getStoredToken();
  if (Token) {
    Config.headers.Authorization = `Bearer ${Token}`;
  }
  return Config;
});

let UnauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(Handler: (() => void) | null): void {
  UnauthorizedHandler = Handler;
}

ApiClient.interceptors.response.use(undefined, (Error) => {
  if (
    axios.isAxiosError(Error) &&
    Error.response?.status === 401 &&
    Error.config?.headers?.Authorization
  ) {
    UnauthorizedHandler?.();
  }
  return Promise.reject(Error);
});

export function newIdempotencyKey(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const Bytes = crypto.getRandomValues(new Uint8Array(16));
  Bytes[6] = (Bytes[6] & 0x0f) | 0x40;
  Bytes[8] = (Bytes[8] & 0x3f) | 0x80;
  const Hex = [...Bytes]
    .map((Byte) => Byte.toString(16).padStart(2, "0"))
    .join("");
  return `${Hex.slice(0, 8)}-${Hex.slice(8, 12)}-${Hex.slice(12, 16)}-${Hex.slice(16, 20)}-${Hex.slice(20)}`;
}

export function idempotencyHeaders(IdempotencyKey?: string): {
  headers?: Record<string, string>;
} {
  return IdempotencyKey
    ? { headers: { "Idempotency-Key": IdempotencyKey } }
    : {};
}
