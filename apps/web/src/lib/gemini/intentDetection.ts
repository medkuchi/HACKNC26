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

export async function detectSpendingIntent(
  message: string,
  referenceDate?: string,
): Promise<DetectedIntent> {
  const raw = await generateText(intentDetectionPrompt(message, referenceDate), {
    json: true,
    mockIntentMessage: message,
  });

  try {
    // Some providers wrap otherwise valid JSON in a Markdown code block.
    const json = raw.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, "$1");
    const value: unknown = JSON.parse(json);
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return { detected: false };
    }
    const intent = value as Record<string, unknown>;
    if (intent.detected !== true) return { detected: false };

    // Preserve only the declared fields with their expected types. The webhook
    // checks required values, confidence, dates and currency before saving.
    return {
      detected: true,
      ...(typeof intent.description === "string" ? { description: intent.description } : {}),
      ...(typeof intent.estimatedCost === "number" && Number.isFinite(intent.estimatedCost)
        ? { estimatedCost: intent.estimatedCost }
        : {}),
      ...(typeof intent.currency === "string" ? { currency: intent.currency } : {}),
      ...(typeof intent.expectedDate === "string" ? { expectedDate: intent.expectedDate } : {}),
      ...(typeof intent.category === "string" ? { category: intent.category } : {}),
      ...(typeof intent.isParticipant === "boolean" ? { isParticipant: intent.isParticipant } : {}),
      ...(typeof intent.isTentative === "boolean" ? { isTentative: intent.isTentative } : {}),
      ...(typeof intent.confidence === "number" && Number.isFinite(intent.confidence)
        ? { confidence: intent.confidence }
        : {}),
    };
  } catch {
    return { detected: false };
  }
}
