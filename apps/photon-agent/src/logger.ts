export type LogLevel = "debug" | "info" | "warn" | "error";

/** Operational metadata only. Never pass message text, API keys, or pairing codes. */
export interface LogMetadata {
  senderId?: string;
  conversationId?: string;
  conversationType?: "dm" | "group";
  monitoringEnabled?: boolean;
  eventType?: string;
  requestId?: string;
  planId?: string;
  attempt?: number;
  durationMs?: number;
  statusCode?: number;
  /** Only the error type/code is logged; its message, stack, and cause are omitted. */
  error?: unknown;
}

export interface Logger {
  debug(event: string, metadata?: LogMetadata): void;
  info(event: string, metadata?: LogMetadata): void;
  warn(event: string, metadata?: LogMetadata): void;
  error(event: string, metadata?: LogMetadata): void;
}
export interface LoggerOptions {
  level?: LogLevel;
  now?: () => Date;
  /** Injectable output for tests; receives one JSON record without a newline. */
  write?: (line: string, level: LogLevel) => void;
}

const priority: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export function parseLogLevel(value = "info"): LogLevel {
  const level = value.trim().toLowerCase();
  if (level === "debug" || level === "info" || level === "warn" || level === "error") return level;
  throw new Error("LOG_LEVEL must be debug, info, warn, or error");
}

/**
 * JSON-line logger for connection lifecycle, routing decisions, and failures.
 * Use static event names (e.g. "photon.connected"), never raw text or error.message.
 * An allowlist drops unexpected metadata fields, including nested request bodies.
 */
export function createLogger(options: LoggerOptions = {}): Logger {
  const levelOverride = options.level === undefined ? undefined : parseLogLevel(options.level);
  const now = options.now ?? (() => new Date());
  const write = options.write ?? ((line: string, level: LogLevel) => {
    const stream = level === "warn" || level === "error" ? process.stderr : process.stdout;
    stream.write(`${line}\n`);
  });
  const log = (level: LogLevel, event: string, metadata: LogMetadata = {}): void => {
    // Resolve the environment lazily: loadConfig() may load .env after imports.
    const threshold = priority[levelOverride ?? parseLogLevel(process.env.LOG_LEVEL ?? "info")];
    if (priority[level] < threshold) return;
    const fields: Record<string, unknown> = {};
    for (const key of ["senderId", "conversationId", "eventType", "requestId", "planId"] as const) {
      if (typeof metadata[key] === "string") fields[key] = metadata[key];
    }
    for (const key of ["attempt", "durationMs", "statusCode"] as const) {
      if (typeof metadata[key] === "number" && Number.isFinite(metadata[key])) fields[key] = metadata[key];
    }
    if (metadata.conversationType === "dm" || metadata.conversationType === "group") {
      fields.conversationType = metadata.conversationType;
    }
    if (typeof metadata.monitoringEnabled === "boolean") fields.monitoringEnabled = metadata.monitoringEnabled;
    if (metadata.error !== undefined) fields.error = summarizeError(metadata.error);
    write(JSON.stringify({ timestamp: now().toISOString(), level, service: "photon-agent", event,
      ...(Object.keys(fields).length ? { metadata: fields } : {}) }), level);
  };
  return Object.freeze({
    debug: (event: string, metadata?: LogMetadata) => log("debug", event, metadata),
    info: (event: string, metadata?: LogMetadata) => log("info", event, metadata),
    warn: (event: string, metadata?: LogMetadata) => log("warn", event, metadata),
    error: (event: string, metadata?: LogMetadata) => log("error", event, metadata),
  });
}

function summarizeError(value: unknown): { name: string; code?: string | number } {
  if (value === null || typeof value !== "object") return { name: "UnknownError" };
  const error = value as { name?: unknown; code?: unknown };
  const safeToken = (token: unknown): token is string =>
    typeof token === "string" && /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(token);
  const result: { name: string; code?: string | number } = {
    name: safeToken(error.name) ? error.name : "Error",
  };
  if (safeToken(error.code) || (typeof error.code === "number" && Number.isFinite(error.code))) result.code = error.code;
  return result;
}

export const logger = createLogger();
