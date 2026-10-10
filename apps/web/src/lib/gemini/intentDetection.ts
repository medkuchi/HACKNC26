import { generateText } from "./client";
import { intentDetectionPrompt } from "./prompts";

export interface DetectedIntent {
  detected: boolean;
  description?: string;
  estimatedCost?: number;
  currency?: string;
  expectedDate?: string;
  category?: string;
  isParticipant?: boolean;
  isTentative?: boolean;
  confidence?: number;
}

export async function detectSpendingIntent(message: string): Promise<DetectedIntent> {
  const raw = await generateText(intentDetectionPrompt(message));

  try {
    return JSON.parse(raw);
  } catch {
    return { detected: false };
  }
}
