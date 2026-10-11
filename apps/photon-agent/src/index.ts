import { setTimeout as delay } from "node:timers/promises";
import { loadConfig } from "./config";
import type { PhotonAgentConfig } from "./config";
import { createLogger, parseLogLevel } from "./logger";
import type { Logger } from "./logger";
import { getPhotonClient, stopPhotonClient } from "./photon/client";
import type { PhotonClient } from "./photon/client";
import { createPhotonHandlers } from "./photon/handlers";
import type { IdentityMap } from "./photon/identityMap";
import { createBridgeApiClient } from "./services/bridgeApiClient";
import type { BridgeApiClient } from "./services/bridgeApiClient";

export interface WorkerOptions {
  config?: PhotonAgentConfig;
  signal?: AbortSignal;
  logger?: Logger;
  /** Injectable dependencies keep lifecycle tests offline. */
  connect?: (config: PhotonAgentConfig) => Promise<PhotonClient>;
  bridge?: BridgeApiClient;
  identities?: IdentityMap;
  reconnectDelayMs?: number;
  reconnectMaxDelayMs?: number;
  maxReconnectAttempts?: number;
}

/** Run one worker, preserving handler state across terminal connection failures. */
export async function runWorker(options: WorkerOptions = {}): Promise<void> {
  if (options.signal?.aborted) return;
  const config = options.config ?? loadConfig();
  const log = options.logger ?? createLogger({ level: parseLogLevel(process.env.LOG_LEVEL ?? "info") });
  const bridge = options.bridge ?? createBridgeApiClient(config, { logger: log });
  const connect = options.connect ?? (value => getPhotonClient(value, { logger: log }));
  const initialDelay = options.reconnectDelayMs ?? 1_000;
  const maxDelay = options.reconnectMaxDelayMs ?? 30_000;
  const maxRetries = options.maxReconnectAttempts ?? 5;
  if (!Number.isInteger(initialDelay) || initialDelay < 0 || !Number.isInteger(maxDelay) ||
      maxDelay < initialDelay || maxDelay > 2_147_483_647 || !Number.isInteger(maxRetries) || maxRetries < 0) {
    throw new TypeError("Reconnect settings must be nonnegative integers with max delay >= initial delay");
  }
  let current: PhotonClient | undefined;
  const active = (): PhotonClient => {
    if (!current) throw new Error("Photon worker has no active connection");
    return current;
  };
  // Keep one handler instance, but delegate to the current connection after each reconnect.
  const proxy: PhotonClient = {
    get messages() { return active().messages; },
    get closed() { return current?.closed ?? true; },
    sendText: (space, text) => active().sendText(space, text),
    reply: (message, text) => active().reply(message, text),
    sendDirectText: (sender, text, source) => active().sendDirectText(sender, text, source),
    stop: async () => { await current?.stop(); },
  };
  const handlers = createPhotonHandlers(proxy, bridge, { identities: options.identities, logger: log });
  const disconnect = async (): Promise<void> => {
    if (current) await current.stop();
    if (!options.connect) await stopPhotonClient();
    current = undefined;
  };
  let failures = 0;
  log.info("worker.starting");
  try {
    while (!options.signal?.aborted) {
      let connectedAt: number | undefined;
      try {
        current = await connect(config);
        // Shutdown may have arrived while SDK initialization was still pending.
        if (options.signal?.aborted) break;
        connectedAt = Date.now();
        log.info("worker.listening");
        await handlers.run({ signal: options.signal });
        if (!options.signal?.aborted) throw new Error("Photon message stream ended unexpectedly");
      } catch (error) {
        if (options.signal?.aborted) break;
        log.warn("worker.connection_lost", { error });
      } finally {
        // Cleanup failure escapes the loop: never create overlapping connections.
        await disconnect();
      }
      if (options.signal?.aborted) break;
      if (connectedAt !== undefined && Date.now() - connectedAt >= 60_000) failures = 0;
      failures++;
      if (failures > maxRetries) throw new Error("Photon worker reconnect limit reached");
      const waitMs = Math.min(initialDelay * 2 ** Math.min(failures - 1, 30), maxDelay);
      log.info("worker.reconnecting", { attempt: failures, durationMs: waitMs });
      try { await delay(waitMs, undefined, { signal: options.signal }); }
      catch (error) { if (!options.signal?.aborted) throw error; }
    }
  } finally {
    await disconnect();
    log.info("worker.stopped");
  }
}

/** Process entry point: handle termination signals and bound a stalled shutdown. */
export async function main(options: Omit<WorkerOptions, "signal"> = {}): Promise<void> {
  const shutdown = new AbortController();
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let failed = false;
  const fallbackLog = options.logger ?? createLogger({ level: "error" });
  const armWatchdog = (): void => {
    if (watchdog) return;
    watchdog = setTimeout(() => {
      fallbackLog.error("worker.shutdown_timeout");
      process.exit(1);
    }, 15_000);
    watchdog.unref();
  };
  const stop = (): void => {
    if (shutdown.signal.aborted) return;
    shutdown.abort();
    armWatchdog();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    await runWorker({ ...options, signal: shutdown.signal });
  } catch (error) {
    failed = true;
    fallbackLog.error("worker.fatal", { error });
    process.exitCode = 1;
    // Failed SDK cleanup can leave open sockets; keep a bounded final exit.
    armWatchdog();
  } finally {
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
    if (watchdog && !failed) clearTimeout(watchdog);
  }
}

// Importing the module for tests does not launch the worker or install signal handlers.
if (require.main === module) void main();
