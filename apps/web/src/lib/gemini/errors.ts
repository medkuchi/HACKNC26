import {
  GoogleGenerativeAIError,
  GoogleGenerativeAIFetchError,
  GoogleGenerativeAIRequestInputError,
  GoogleGenerativeAIResponseError,
} from "@google/generative-ai";

const messages = {
  GEMINI_AUTH_ERROR: "Gemini rejected its API key or access. Check GOOGLE_GEMINI_API_KEY and API restrictions.",
  GEMINI_QUOTA_EXCEEDED: "Gemini quota or rate limit was reached. Check the key's quota and billing, then try again.",
  GEMINI_MODEL_UNAVAILABLE: "The configured Gemini model is unavailable. Check GEMINI_MODEL and model access.",
  GEMINI_INVALID_REQUEST: "Gemini rejected the analysis request. Check the configured model and request settings.",
  GEMINI_UNAVAILABLE: "Gemini is temporarily unavailable. Try again shortly.",
  GEMINI_TIMEOUT: "Gemini did not respond within 8 seconds. Try again.",
  GEMINI_NETWORK_ERROR: "Unable to reach Gemini. Check network access and try again.",
  GEMINI_INVALID_RESPONSE: "Gemini could not return a usable analysis. Try rephrasing the spending message.",
  GEMINI_CONFIGURATION_ERROR: "Gemini configuration is incomplete or invalid. Check USE_MOCK_GEMINI and GOOGLE_GEMINI_API_KEY.",
  GEMINI_ANALYSIS_ERROR: "Unable to analyze the message",
} as const;

export type GeminiFailureCode = keyof typeof messages;

/** Only fixed messages survive; do not retain a provider exception as a cause. */
export class GeminiServiceError extends Error {
  readonly name = "GeminiServiceError";
  constructor(readonly code: GeminiFailureCode, readonly providerStatus?: number) {
    super(messages[code]);
  }
}

const authReasons = new Set([
  "API_KEY_INVALID", "API_KEY_EXPIRED", "API_KEY_SERVICE_BLOCKED",
  "API_KEY_HTTP_REFERRER_BLOCKED", "API_KEY_IP_ADDRESS_BLOCKED",
  "ACCESS_TOKEN_EXPIRED", "ACCESS_TOKEN_SCOPE_INSUFFICIENT", "SERVICE_DISABLED",
]);
const quotaReasons = new Set(["RATE_LIMIT_EXCEEDED", "QUOTA_EXCEEDED"]);

/** Inspect structured status/reasons only; never copy messages, URLs or details. */
export function classifyGeminiError(error: unknown, timedOut = false): GeminiServiceError {
  if (error instanceof GeminiServiceError) return error;
  if (timedOut) return new GeminiServiceError("GEMINI_TIMEOUT");
  if (error instanceof GoogleGenerativeAIFetchError) {
    const status = Number.isInteger(error.status) && error.status! >= 100 && error.status! <= 599
      ? error.status : undefined;
    const reasons = Array.isArray(error.errorDetails)
      ? error.errorDetails.map(detail => detail?.reason).filter((reason): reason is string => typeof reason === "string") : [];
    if (reasons.some(reason => authReasons.has(reason))) {
      return new GeminiServiceError("GEMINI_AUTH_ERROR", status);
    }
    if (reasons.some(reason => quotaReasons.has(reason))) {
      return new GeminiServiceError("GEMINI_QUOTA_EXCEEDED", status);
    }
    if (status === 401 || status === 403) return new GeminiServiceError("GEMINI_AUTH_ERROR", status);
    if (status === 429) return new GeminiServiceError("GEMINI_QUOTA_EXCEEDED", status);
    if (status === 404) return new GeminiServiceError("GEMINI_MODEL_UNAVAILABLE", status);
    if (status === 408 || status === 504) return new GeminiServiceError("GEMINI_TIMEOUT", status);
    if (status !== undefined && status >= 500) return new GeminiServiceError("GEMINI_UNAVAILABLE", status);
    return new GeminiServiceError("GEMINI_INVALID_REQUEST", status);
  }
  if (error instanceof GoogleGenerativeAIRequestInputError) return new GeminiServiceError("GEMINI_INVALID_REQUEST");
  if (error instanceof GoogleGenerativeAIResponseError) return new GeminiServiceError("GEMINI_INVALID_RESPONSE");
  if (error instanceof GoogleGenerativeAIError) return new GeminiServiceError("GEMINI_NETWORK_ERROR");
  return new GeminiServiceError("GEMINI_ANALYSIS_ERROR");
}
