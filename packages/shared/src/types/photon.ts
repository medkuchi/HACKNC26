/** Already-paired, authorized message forwarded by the worker to the backend. */
export interface PhotonMessageEvent {
  messageId: string;
  userId: string;
  senderId: string;
  conversationId: string;
  isGroup: boolean;
  text: string;
}

/** Null means the worker should not send a reply. */
export interface PhotonWebhookResult {
  replyText: string | null;
  planId?: string;
}

export type PairingVerificationResult =
  | { verified: true; userId: string }
  | { verified: false };
