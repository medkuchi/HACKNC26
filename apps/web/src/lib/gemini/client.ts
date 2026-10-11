import { GoogleGenerativeAI } from "@google/generative-ai";

export interface GenerateTextOptions {
  /** Ask Gemini to return JSON instead of free-form text. */
  json?: boolean;
  /** Original message used only by the deliberately narrow demo detector. */
  mockIntentMessage?: string;
}

let cachedClient: { apiKey: string; client: GoogleGenerativeAI } | undefined;

function getClient(apiKey: string): GoogleGenerativeAI {
  if (!cachedClient || cachedClient.apiKey !== apiKey) {
    cachedClient = { apiKey, client: new GoogleGenerativeAI(apiKey) };
  }
  return cachedClient.client;
}

export async function generateText(
  prompt: string,
  options: GenerateTextOptions = {},
): Promise<string> {
  // Read settings for each request so changing credentials or demo mode does
  // not keep using values captured when the module was first imported.
  const mockSetting = process.env.USE_MOCK_GEMINI;
  if (mockSetting !== undefined && mockSetting !== "true" && mockSetting !== "false") {
    throw new Error("USE_MOCK_GEMINI must be true or false.");
  }
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY?.trim();
  const useMock = mockSetting === "true" || (mockSetting === undefined && !apiKey);
  if (useMock) {
    return mockGenerate(options);
  }
  if (!apiKey) {
    throw new Error("GOOGLE_GEMINI_API_KEY is required when USE_MOCK_GEMINI is false.");
  }

  const modelName = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash";
  const model = getClient(apiKey).getGenerativeModel(
    {
      model: modelName,
      ...(options.json ? { generationConfig: { responseMimeType: "application/json" } } : {}),
    },
    { timeout: 8_000 },
  );

  const result = await model.generateContent(prompt);
  return result.response.text();
}

function mockGenerate(options: GenerateTextOptions): string {
  if (options.mockIntentMessage === undefined) {
    return options.json ? JSON.stringify({ detected: false }) : "Chirp chirp! Mock Nova response.";
  }

  // Demo templates only: "I plan to spend $120 on dinner on 2026-10-15"
  // or "I might spend $120 on dinner on 2026-10-15". This is not natural
  // language understanding: other phrasing intentionally detects no plan.
  const match = /^I (plan to|might) spend \$(\d+(?:\.\d{1,2})?) on ([^\r\n]+?) on (\d{4}-\d{2}-\d{2})[.!]?$/i.exec(
    options.mockIntentMessage.trim(),
  );
  if (!match) return JSON.stringify({ detected: false });

  const estimatedCost = Number(match[2]);
  const expectedDate = match[4];
  const date = new Date(`${expectedDate}T00:00:00.000Z`);
  if (
    !Number.isFinite(estimatedCost) ||
    !Number.isSafeInteger(Math.round(estimatedCost * 100)) ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== expectedDate
  ) {
    return JSON.stringify({ detected: false });
  }

  return JSON.stringify({
    detected: true,
    description: match[3].trim(),
    estimatedCost,
    currency: "USD",
    expectedDate,
    category: "other",
    isParticipant: true,
    isTentative: match[1].toLowerCase() === "might",
    confidence: 1,
  });
}
