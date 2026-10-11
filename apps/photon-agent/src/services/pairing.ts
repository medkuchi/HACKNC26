import type { MessagingIdentity } from "@hacknc26/shared";
import { identityMap } from "../photon/identityMap";
import type { IdentityMap } from "../photon/identityMap";
import { logger } from "../logger";
import type { Logger } from "../logger";
import { BridgeApiError } from "./bridgeApiClient";
import type { BridgeApiClient, BridgeRequestOptions } from "./bridgeApiClient";

export interface PairingMessage {
  senderId?: string;
  conversationId?: string;
  text?: string;
  isGroup: boolean;
}
export type PairingResult =
  | { handled: false }
  | { handled: true; status: "paired" | "already_paired"; identity: MessagingIdentity; replyText: string }
  | { handled: true; status: "invalid_code" | "group_not_allowed" | "unidentified" | "conflict" | "busy" | "unavailable"; replyText: string }
  | { handled: true; status: "canceled"; replyText: null };
export interface PairingServiceOptions {
  identities?: IdentityMap;
  logger?: Logger;
}
export interface PairingService {
  handleMessage(message: PairingMessage, options?: BridgeRequestOptions): Promise<PairingResult>;
}

/** Only whole-message codes are accepted; do not extract numbers from normal text. */
export function extractPairingCode(text: string | undefined): string | null {
  if (typeof text !== "string") return null;
  return /^(?:pair\s+)?(\d{6})$/i.exec(text.trim())?.[1] ?? null;
}

/**
 * Verify codes through the Bridge API and store verified identity links.
 * The caller supplies an inbound text message from the iMessage handler.
 * This service returns outcomes/replies; it never sends messages itself and
 * never grants conversation monitoring consent. Codes are not logged or saved.
 *
 * One request per sender can be in flight. Same-code callers share its result
 * (and the initiating caller's cancellation); different codes return busy.
 * Once verification succeeds, the link is committed even if cancellation arrives
 * immediately afterward, because the backend has already consumed the code.
 */
export function createPairingService(
  bridge: Pick<BridgeApiClient, "verifyPairingCode">,
  options: PairingServiceOptions = {},
): PairingService {
  const identities = options.identities ?? identityMap;
  const log = options.logger ?? logger;
  // Codes exist here only while their verification request is pending.
  const inFlight = new Map<string, { code: string; result: Promise<PairingResult> }>();
  const canceled = (): PairingResult => ({ handled: true, status: "canceled", replyText: null });

  async function verify(senderId: string, conversationId: string, code: string,
    requestOptions: BridgeRequestOptions): Promise<PairingResult> {
    const metadata = { senderId, conversationId };
    try {
      const result = await bridge.verifyPairingCode(code, requestOptions);
      if (!result.verified) {
        if (requestOptions.signal?.aborted) return canceled();
        log.info("pairing.invalid_code", metadata);
        return { handled: true, status: "invalid_code", replyText: "That code is invalid, expired, or already used. Generate a new code in the app and send it here." };
      }
      if (typeof result.userId !== "string" || !result.userId.trim()) throw new TypeError("Invalid verified pairing result");
      const existing = identities.getIdentity(senderId);
      if (existing && existing.userId !== result.userId.trim()) {
        log.warn("pairing.identity_conflict", metadata);
        return { handled: true, status: "conflict", replyText: "This messaging identity is linked to another account. Remove its old link before pairing again." };
      }
      const identity = identities.linkVerifiedIdentity(senderId, result.userId);
      log.info("pairing.verified", metadata);
      return { handled: true, status: "paired", identity,
        replyText: "Your iMessage identity is connected. Conversation monitoring still needs to be enabled separately." };
    } catch (error) {
      if (requestOptions.signal?.aborted || (error instanceof BridgeApiError && error.kind === "aborted")) return canceled();
      log.error("pairing.verification_failed", { ...metadata, error });
      return { handled: true, status: "unavailable",
        replyText: "I couldn't verify your code. Generate a new code in the app and try again." };
    }
  }

  return Object.freeze({
    async handleMessage(message: PairingMessage, requestOptions: BridgeRequestOptions = {}): Promise<PairingResult> {
      const code = extractPairingCode(message.text);
      const explicitCommand = typeof message.text === "string" && /^pair(?:\s|$)/i.test(message.text.trim());
      if (!code && !explicitCommand) return { handled: false };
      if (requestOptions.signal?.aborted) return canceled();
      if (message.isGroup !== false) {
        return { handled: true, status: "group_not_allowed", replyText: "Pairing is available in a private conversation. Send your code directly to Nova." };
      }
      if (!code) return { handled: true, status: "invalid_code", replyText: "Send the six-digit code from the app, or type pair followed by that code." };
      const senderId = message.senderId?.trim();
      const conversationId = message.conversationId?.trim();
      if (!senderId || !conversationId) {
        return { handled: true, status: "unidentified", replyText: "I couldn't identify this sender or conversation. Try pairing again in a private conversation." };
      }
      const pending = inFlight.get(senderId);
      if (pending) {
        if (pending.code === code) return pending.result;
        return { handled: true, status: "busy", replyText: "A pairing request is already in progress. Wait for it to finish before sending another code." };
      }
      const existing = identities.getIdentity(senderId);
      if (existing?.status === "verified") {
        return { handled: true, status: "already_paired", identity: existing,
          replyText: "This iMessage identity is already connected. Remove its current link before pairing a different account." };
      }
      const result = verify(senderId, conversationId, code, requestOptions);
      inFlight.set(senderId, { code, result });
      try { return await result; }
      finally { inFlight.delete(senderId); }
    },
  });
}
