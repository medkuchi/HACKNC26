export interface FinancialPreferences {
  userId: string;
  safetyBuffer: number; // default 100
  alertThresholds: number[];
  updatedAt: string;
}

export interface IncomeEvent {
  id: string;
  userId: string;
  expectedDate: string;
  amount: number;
  description?: string;
}

export type MessagingIdentityStatus = "pending" | "verified" | "revoked";

export interface MessagingIdentity {
  id: string;
  userId: string;
  photonIdentityId: string;
  status: MessagingIdentityStatus;
  pairingCode?: string;
  pairingCodeExpiresAt?: string;
  linkedAt?: string;
}
