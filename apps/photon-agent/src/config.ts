import { resolve } from "node:path";
import { env, loadEnvFile } from "node:process";

export interface PhotonAgentConfig {
  readonly photonProjectId: string;
  readonly photonApiKey: string;
  readonly bridgeApiBaseUrl: string;
  readonly photonAgentSharedSecret: string;
}

/** Validate settings without logging or including secret values in errors. */
export function parseConfig(values: Record<string, string | undefined>): PhotonAgentConfig {
  const required = ["PHOTON_PROJECT_ID", "PHOTON_API_KEY", "BRIDGE_API_BASE_URL", "PHOTON_AGENT_SHARED_SECRET"] as const;
  const missing = required.filter(key => !values[key]?.trim());
  if (missing.length) throw new Error(`Missing required Photon agent configuration: ${missing.join(", ")}`);
  const bridgeApiBaseUrl = values.BRIDGE_API_BASE_URL!.trim();
  let url: URL;
  try { url = new URL(bridgeApiBaseUrl); }
  catch { throw new Error("BRIDGE_API_BASE_URL must be an absolute HTTP or HTTPS URL"); }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("BRIDGE_API_BASE_URL must use HTTP or HTTPS");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("BRIDGE_API_BASE_URL must not contain credentials, query parameters, or a fragment");
  }
  return Object.freeze({
    photonProjectId: values.PHOTON_PROJECT_ID!.trim(),
    photonApiKey: values.PHOTON_API_KEY!.trim(),
    bridgeApiBaseUrl: url.toString().replace(/\/+$/, ""),
    photonAgentSharedSecret: values.PHOTON_AGENT_SHARED_SECRET!.trim(),
  });
}

/**
 * Call once at worker startup: const config = loadConfig().
 * Loads apps/photon-agent/.env relative to this source (or compiled dist file).
 * Existing process environment values take precedence. A missing .env is fine
 * for hosted deployments, but required configuration must still be present.
 * Pass false to skip the file, or a path to load another file. Requires Node 22+.
 */
export function loadConfig(envFile: string | false = resolve(__dirname, "../.env")): PhotonAgentConfig {
  if (envFile !== false) {
    try { loadEnvFile(envFile); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw new Error("Unable to load the Photon agent environment file");
      }
    }
  }
  return parseConfig(env);
}
