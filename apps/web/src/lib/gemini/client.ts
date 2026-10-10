import { GoogleGenerativeAI } from "@google/generative-ai";

const useMock = process.env.USE_MOCK_GEMINI === "true" || !process.env.GOOGLE_GEMINI_API_KEY;

let client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!client) {
    client = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!);
  }
  return client;
}

export async function generateText(prompt: string): Promise<string> {
  if (useMock) {
    return mockGenerate(prompt);
  }

  const model = getClient().getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// placeholder output shaped like what intentDetection.ts expects back,
// so the rest of the pipeline works without a real API key
function mockGenerate(prompt: string): string {
  if (prompt.includes("detected")) {
    return JSON.stringify({ detected: false });
  }
  return "Chirp chirp! Mock Nova response.";
}
