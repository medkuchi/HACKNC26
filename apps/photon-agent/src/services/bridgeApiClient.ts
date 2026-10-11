import type { PairingVerificationResult, PhotonMessageEvent, PhotonWebhookResult } from "@hacknc26/shared";
import type { PhotonAgentConfig } from "../config";
import { logger } from "../logger";
import type { Logger } from "../logger";

export type BridgeApiConfig = Pick<PhotonAgentConfig, "bridgeApiBaseUrl" | "photonAgentSharedSecret">;
export interface BridgeApiClientOptions {
  fetchImpl?: typeof fetch;
  /** Override both defaults: pairing 10s, message analysis/forecasting 30s. */
  timeoutMs?: number;
  logger?: Logger;
}
export interface BridgeRequestOptions {
  signal?: AbortSignal;
}
export interface BridgeApiClient {
  verifyPairingCode(code: string, options?: BridgeRequestOptions): Promise<PairingVerificationResult>;
  forwardMessage(event: PhotonMessageEvent, options?: BridgeRequestOptions): Promise<PhotonWebhookResult>;
}
export type BridgeApiErrorKind = "http" | "network" | "timeout" | "aborted" | "invalid_response";
export class BridgeApiError extends Error {
  constructor(message: string, readonly kind: BridgeApiErrorKind, readonly statusCode?: number,
    readonly code?: string) {
    super(message);
    this.name = "BridgeApiError";
  }
}

const backendErrorCodes = new Set([
  "GEMINI_AUTH_ERROR", "GEMINI_QUOTA_EXCEEDED", "GEMINI_MODEL_UNAVAILABLE",
  "GEMINI_INVALID_REQUEST", "GEMINI_UNAVAILABLE", "GEMINI_TIMEOUT",
  "GEMINI_NETWORK_ERROR", "GEMINI_INVALID_RESPONSE", "GEMINI_CONFIGURATION_ERROR",
  "GEMINI_ANALYSIS_ERROR", "NESSIE_DATA_ERROR",
]);

/**
 * Worker-to-backend HTTP client. The backend must verify the Bearer shared secret.
 * It does not send Photon SDK credentials or log bodies, codes, text, or secrets.
 * No automatic retries: pairing consumes codes, and webhooks may create plans.
 * Pairing/consent checks are caller responsibilities before forwarding messages.
 */
export function createBridgeApiClient(config: BridgeApiConfig, options: BridgeApiClientOptions = {}): BridgeApiClient {
  let base: URL;
  try { base = new URL(`${config.bridgeApiBaseUrl.replace(/\/+$/, "")}/`); }
  catch { throw new TypeError("Bridge API base URL must be an absolute HTTP or HTTPS URL"); }
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new TypeError("Bridge API base URL must use HTTP/HTTPS without credentials, query parameters, or a fragment");
  }
  const secret = config.photonAgentSharedSecret.trim();
  if (!secret || /[\r\n]/.test(secret)) throw new TypeError("A valid Photon agent shared secret is required");
  const timeoutMs = options.timeoutMs ?? 10_000;
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 2_147_483_647) {
    throw new TypeError("timeoutMs must be a positive integer within the supported timer range");
  }
  const requestFetch = options.fetchImpl ?? fetch;
  const log = options.logger ?? logger;

  async function request(path: string, method: "PATCH" | "POST", body: unknown,
    requestOptions: BridgeRequestOptions = {}, allowNotFound = false): Promise<{ status: number; payload: unknown }> {
    const started = Date.now();
    // Gemini can take 8s and Nessie performs up to two 10s request stages.
    const timeout = AbortSignal.timeout(options.timeoutMs ?? (path === "api/photon/webhook" ? 30_000 : timeoutMs));
    const signal = requestOptions.signal ? AbortSignal.any([timeout, requestOptions.signal]) : timeout;
    const eventType = path === "api/pairing" ? "pairing.verify" : "message.forward";
    const abortError = (): BridgeApiError => requestOptions.signal?.aborted ?
      new BridgeApiError("Bridge API request was canceled", "aborted") :
      new BridgeApiError("Bridge API request timed out", "timeout");
    try {
      if (signal.aborted) throw abortError();
      const response = await requestFetch(new URL(path, base), {
        method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
        body: JSON.stringify(body), cache: "no-store", redirect: "error", signal,
      });
      if (signal.aborted) throw abortError();
      if (!response.ok && !(allowNotFound && response.status === 404)) {
        let code: string | undefined;
        try {
          const failure: unknown = await response.json();
          if (object(failure)) {
            if (typeof failure.code === "string" && backendErrorCodes.has(failure.code)) code = failure.code;
            else if (failure.error === "Unable to load financial data") code = "NESSIE_DATA_ERROR";
          }
        } catch { /* Error bodies are optional; never log their raw contents. */ }
        if (signal.aborted) throw abortError();
        throw new BridgeApiError(`Bridge API request failed with HTTP ${response.status}`, "http", response.status, code);
      }
      let payload: unknown;
      try { payload = await response.json(); }
      catch {
        if (signal.aborted) throw abortError();
        throw new BridgeApiError("Bridge API returned invalid JSON", "invalid_response", response.status);
      }
      if (signal.aborted) throw abortError();
      log.debug("bridge.request_completed", { eventType, statusCode: response.status, durationMs: Date.now() - started });
      return { status: response.status, payload };
    } catch (error) {
      const failure = error instanceof BridgeApiError ? error : signal.aborted ? abortError() :
        new BridgeApiError("Bridge API request failed", "network");
      log.error("bridge.request_failed", { eventType, statusCode: failure.statusCode, durationMs: Date.now() - started, error: failure });
      throw failure;
    }
  }

  return Object.freeze({
    async verifyPairingCode(code: string, requestOptions?: BridgeRequestOptions): Promise<PairingVerificationResult> {
      if (typeof code !== "string" || !/^\d{6}$/.test(code.trim())) {
        throw new TypeError("Pairing code must contain six digits");
      }
      const { payload, status } = await request("api/pairing", "PATCH", { code: code.trim() }, requestOptions, true);
      if (object(payload) && payload.verified === false) return { verified: false };
      if (status !== 404 && object(payload) && payload.verified === true && nonempty(payload.userId)) {
        return { verified: true, userId: payload.userId.trim() };
      }
      throw new BridgeApiError("Bridge API returned an invalid pairing result", "invalid_response", status);
    },
    async forwardMessage(event: PhotonMessageEvent, requestOptions?: BridgeRequestOptions): Promise<PhotonWebhookResult> {
      if (!object(event) || !nonempty(event.messageId) || !nonempty(event.userId) || !nonempty(event.senderId) ||
          !nonempty(event.conversationId) || typeof event.isGroup !== "boolean" || !nonempty(event.text)) {
        throw new TypeError("A forwarded message requires IDs, isGroup, and nonempty text");
      }
      // Send only the contract fields; exclude extra properties on SDK objects.
      const body: PhotonMessageEvent = { messageId: event.messageId.trim(), userId: event.userId.trim(),
        senderId: event.senderId.trim(), conversationId: event.conversationId.trim(), isGroup: event.isGroup, text: event.text };
      const { payload, status } = await request("api/photon/webhook", "POST", body, requestOptions);
      if (!object(payload) || !(payload.replyText === null || nonempty(payload.replyText)) ||
          (payload.planId !== undefined && !nonempty(payload.planId))) {
        throw new BridgeApiError("Bridge API returned an invalid webhook result", "invalid_response", status);
      }
      return { replyText: payload.replyText as string | null,
        ...(payload.planId === undefined ? {} : { planId: (payload.planId as string).trim() }) };
    },
  });
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nonempty(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}
