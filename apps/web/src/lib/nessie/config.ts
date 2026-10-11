import type { FinancialDataSourceOptions } from "./adapters";

/** Read configuration on each request so tests can change environment settings. */
export function readNessieOptions(): FinancialDataSourceOptions {
  const node = globalThis as typeof globalThis & {
    process?: { env: Record<string, string | undefined> };
  };
  const env = node.process?.env ?? {};
  const flag = env.USE_MOCK_NESSIE?.trim().toLowerCase();
  if (flag && flag !== "true" && flag !== "false") {
    throw new Error("USE_MOCK_NESSIE must be true or false");
  }
  const apiKey = env.NESSIE_API_KEY?.trim();
  const useMock = flag === "true" || (!flag && !apiKey);
  const baseUrl = env.NESSIE_BASE_URL?.trim();
  if (!useMock) {
    if (!apiKey || !baseUrl) {
      throw new Error("Configure NESSIE_API_KEY and NESSIE_BASE_URL, or enable USE_MOCK_NESSIE");
    }
    try {
      if (new URL(baseUrl).protocol !== "https:") throw new Error();
    } catch {
      throw new Error("NESSIE_BASE_URL must be a valid HTTPS URL");
    }
  }
  return { apiKey, baseUrl, useMock };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}
