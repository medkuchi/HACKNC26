import type { MessagingIdentity } from "@hacknc26/shared";

export interface IdentityMapOptions {
  now?: () => Date;
}
export interface IdentityMap {
  /** Call only after the Bridge backend has verified the pairing code. */
  linkVerifiedIdentity(photonIdentityId: string, userId: string): MessagingIdentity;
  getIdentity(photonIdentityId: string | undefined): MessagingIdentity | undefined;
  getUserId(photonIdentityId: string | undefined): string | undefined;
  getIdentitiesForUser(userId: string): MessagingIdentity[];
  revokeIdentity(photonIdentityId: string): boolean;
  removeIdentity(photonIdentityId: string): boolean;
  setConversationConsent(photonIdentityId: string, conversationId: string, enabled: boolean): void;
  canMonitorConversation(photonIdentityId: string | undefined, conversationId: string | undefined): boolean;
  getAuthorizedUserId(photonIdentityId: string | undefined, conversationId: string | undefined): string | undefined;
}

function requiredId(value: string, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${name} must be a nonempty string`);
  return value.trim();
}

/**
 * In-memory pairing and consent for the worker; restarting clears all records.
 * Pass Photon message.sender?.id and space.id as opaque IDs. No phone-number
 * rewriting or automatic assignment to a demo user is performed.
 *
 * Pairing verification belongs in services/pairing.ts. This map stores the
 * verified result, never the pairing code. Consent is explicit per identity
 * and conversation, so changing an identity never carries permissions across.
 * FUTURE PERSISTENCE: load verified links and consent through the Bridge API;
 * the worker should not connect directly to Supabase.
 */
export function createIdentityMap(options: IdentityMapOptions = {}): IdentityMap {
  const identities = new Map<string, MessagingIdentity>();
  const consent = new Map<string, Set<string>>();
  const now = options.now ?? (() => new Date());

  const getIdentity = (photonIdentityId: string | undefined): MessagingIdentity | undefined => {
    const identity = photonIdentityId?.trim() ? identities.get(photonIdentityId.trim()) : undefined;
    return identity ? { ...identity } : undefined;
  };
  const getUserId = (photonIdentityId: string | undefined): string | undefined => {
    const identity = getIdentity(photonIdentityId);
    return identity?.status === "verified" ? identity.userId : undefined;
  };
  const canMonitorConversation = (photonIdentityId: string | undefined, conversationId: string | undefined): boolean => {
    if (!photonIdentityId?.trim() || !conversationId?.trim() || getUserId(photonIdentityId) === undefined) return false;
    return consent.get(photonIdentityId.trim())?.has(conversationId.trim()) ?? false;
  };

  return Object.freeze({
    linkVerifiedIdentity(photonIdentityId: string, userId: string): MessagingIdentity {
      const sender = requiredId(photonIdentityId, "photonIdentityId");
      const owner = requiredId(userId, "userId");
      const existing = identities.get(sender);
      if (existing && existing.userId !== owner) {
        throw new Error("This Photon identity is already linked to another user; remove the old link first");
      }
      if (existing?.status === "verified") return { ...existing };
      const identity: MessagingIdentity = { id: existing?.id ?? crypto.randomUUID(), userId: owner,
        photonIdentityId: sender, status: "verified", linkedAt: now().toISOString() };
      // A newly linked or re-verified identity starts without monitoring consent.
      consent.delete(sender);
      identities.set(sender, identity);
      return { ...identity };
    },
    getIdentity,
    getUserId,
    getIdentitiesForUser(userId: string): MessagingIdentity[] {
      const owner = requiredId(userId, "userId");
      return [...identities.values()].filter(identity => identity.userId === owner)
        .map(identity => ({ ...identity }));
    },
    revokeIdentity(photonIdentityId: string): boolean {
      const sender = requiredId(photonIdentityId, "photonIdentityId");
      const existing = identities.get(sender);
      if (!existing) return false;
      identities.set(sender, { ...existing, status: "revoked" });
      consent.delete(sender);
      return true;
    },
    removeIdentity(photonIdentityId: string): boolean {
      const sender = requiredId(photonIdentityId, "photonIdentityId");
      consent.delete(sender);
      return identities.delete(sender);
    },
    setConversationConsent(photonIdentityId: string, conversationId: string, enabled: boolean): void {
      const sender = requiredId(photonIdentityId, "photonIdentityId");
      const conversation = requiredId(conversationId, "conversationId");
      if (typeof enabled !== "boolean") throw new TypeError("Conversation consent must be a boolean");
      if (!enabled) {
        const conversations = consent.get(sender);
        conversations?.delete(conversation);
        if (conversations?.size === 0) consent.delete(sender);
        return;
      }
      if (getUserId(sender) === undefined) throw new Error("Conversation consent requires a verified identity");
      const conversations = consent.get(sender) ?? new Set<string>();
      conversations.add(conversation);
      consent.set(sender, conversations);
    },
    canMonitorConversation,
    getAuthorizedUserId(photonIdentityId: string | undefined, conversationId: string | undefined): string | undefined {
      return canMonitorConversation(photonIdentityId, conversationId) ? getUserId(photonIdentityId) : undefined;
    },
  });
}

/** Shared map used by pairing.ts and handlers.ts within this worker process. */
export const identityMap = createIdentityMap();
