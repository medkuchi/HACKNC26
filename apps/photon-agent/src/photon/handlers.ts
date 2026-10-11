import type { Message, PhotonClient, Space } from "./client";
import { identityMap } from "./identityMap";
import type { IdentityMap } from "./identityMap";
import { createPairingService } from "../services/pairing";
import type { PairingService } from "../services/pairing";
import type { BridgeApiClient, BridgeRequestOptions } from "../services/bridgeApiClient";
import { logger } from "../logger";
import type { Logger } from "../logger";

export interface PhotonHandlersOptions {
  identities?: IdentityMap;
  pairing?: PairingService;
  logger?: Logger;
  /** Maximum completed message IDs remembered in this worker process. */
  dedupeLimit?: number;
}
export type MessageHandlingResult =
  | { status: "ignored"; reason: string }
  | { status: "duplicate" | "canceled" }
  | { status: "pairing"; outcome: string; replySent: boolean }
  | { status: "consent"; enabled: boolean; replySent: boolean }
  | { status: "forwarded"; replySent: boolean; planId?: string }
  | { status: "failed"; stage: "pairing" | "consent" | "backend" | "delivery" };
export interface PhotonHandlers {
  handleMessage(space: Space, message: Message, options?: BridgeRequestOptions): Promise<MessageHandlingResult>;
  /** Consume messages sequentially; aborting this loop also stops the client. */
  run(options?: BridgeRequestOptions): Promise<void>;
}

/**
 * Route inbound text to pairing, consent commands, or the financial backend.
 * `monitor on`/`monitor off` affect only this sender in this conversation.
 * Group-derived replies are always delivered privately to the sender.
 * Deduplication is bounded and in-memory; the backend should also dedupe by
 * messageId for delivery across worker restarts. Failed messages are not retried.
 */
export function createPhotonHandlers(
  client: PhotonClient,
  bridge: BridgeApiClient,
  options: PhotonHandlersOptions = {},
): PhotonHandlers {
  const identities = options.identities ?? identityMap;
  const log = options.logger ?? logger;
  const pairing = options.pairing ?? createPairingService(bridge, { identities, logger: log });
  const limit = options.dedupeLimit ?? 1_000;
  if (!Number.isInteger(limit) || limit < 1) throw new TypeError("dedupeLimit must be a positive integer");
  const inFlight = new Set<string>();
  const completed = new Set<string>();

  async function handleMessage(space: Space, message: Message,
    requestOptions: BridgeRequestOptions = {}): Promise<MessageHandlingResult> {
    const ignored = (reason: string): MessageHandlingResult => {
      log.info("message.ignored", { eventType: reason });
      return { status: "ignored", reason };
    };
    if (requestOptions.signal?.aborted) return { status: "canceled" };
    if (message.platform !== "imessage" || space.__platform !== "imessage" ||
        message.direction !== "inbound" || message.sender?.kind === "agent") return ignored("not_inbound_imessage");
    // Inline iMessage replies wrap the sender's new content. Never analyze the
    // quoted target, which may belong to another person in the group.
    const content = message.content.type === "reply" ? message.content.content : message.content;
    if (content.type !== "text" || !content.text.trim()) return ignored("unsupported_content");
    const senderId = message.sender?.id?.trim();
    if (!senderId || !space.id?.trim() || !message.id?.trim() || message.space.id !== space.id) return ignored("unidentified");
    const type = (space as Space & { type?: unknown }).type;
    if (type !== "dm" && type !== "group") return ignored("unknown_conversation_type");
    const isGroup = type === "group";
    const text = content.text;
    const key = JSON.stringify([space.id, message.id]);
    if (inFlight.has(key) || completed.has(key)) return { status: "duplicate" };
    inFlight.add(key);
    const metadata = { senderId, conversationId: space.id, requestId: message.id, conversationType: type } as const;
    log.info("message.received", metadata);
    let stage: "pairing" | "consent" | "backend" | "delivery" = "pairing";
    const sendReply = async (replyText: string | null): Promise<boolean> => {
      if (replyText === null || requestOptions.signal?.aborted) return false;
      if (isGroup) await client.sendDirectText(senderId, replyText, space);
      else await client.reply(message, replyText);
      return true;
    };
    try {
      const pairResult = await pairing.handleMessage({ senderId, conversationId: space.id, isGroup, text }, requestOptions);
      if (requestOptions.signal?.aborted) return { status: "canceled" };
      if (pairResult.handled) {
        stage = "delivery";
        return { status: "pairing", outcome: pairResult.status, replySent: await sendReply(pairResult.replyText) };
      }
      const consentCommand = /^monitor\s+(on|off)$/i.exec(text.trim());
      if (consentCommand) {
        stage = "consent";
        if (!identities.getUserId(senderId)) return ignored("pairing_required");
        const enabled = consentCommand[1].toLowerCase() === "on";
        identities.setConversationConsent(senderId, space.id, enabled);
        log.info("message.consent_changed", { ...metadata, monitoringEnabled: enabled });
        stage = "delivery";
        return { status: "consent", enabled, replySent: await sendReply(enabled ?
          "Monitoring is enabled for your messages in this conversation. Alerts are sent privately." :
          "Monitoring is disabled for your messages in this conversation.") };
      }
      const userId = identities.getAuthorizedUserId(senderId, space.id);
      if (!userId) return ignored("not_authorized");
      stage = "backend";
      const result = await bridge.forwardMessage({ messageId: message.id, userId, senderId,
        conversationId: space.id, isGroup, text }, requestOptions);
      if (requestOptions.signal?.aborted) return { status: "canceled" };
      // Revoking pairing/consent while the backend is working suppresses its reply.
      if (identities.getAuthorizedUserId(senderId, space.id) !== userId) return ignored("authorization_changed");
      stage = "delivery";
      const replySent = await sendReply(result.replyText);
      log.info("message.forwarded", { ...metadata, planId: result.planId });
      return { status: "forwarded", replySent, ...(result.planId ? { planId: result.planId } : {}) };
    } catch (error) {
      if (requestOptions.signal?.aborted) return { status: "canceled" };
      log.error("message.processing_failed", { ...metadata, eventType: stage, error });
      return { status: "failed", stage };
    } finally {
      inFlight.delete(key);
      completed.add(key);
      if (completed.size > limit) completed.delete(completed.values().next().value!);
    }
  }

  async function run(requestOptions: BridgeRequestOptions = {}): Promise<void> {
    let shutdown: Promise<void> | undefined;
    const stop = () => {
      shutdown ??= client.stop().catch(error => log.error("message.shutdown_failed", { error }));
    };
    if (requestOptions.signal?.aborted) { stop(); await shutdown; return; }
    requestOptions.signal?.addEventListener("abort", stop, { once: true });
    try {
      for await (const [space, message] of client.messages) {
        if (requestOptions.signal?.aborted) break;
        await handleMessage(space, message, requestOptions);
      }
    } finally {
      requestOptions.signal?.removeEventListener("abort", stop);
      await shutdown;
    }
  }
  return Object.freeze({ handleMessage, run });
}
