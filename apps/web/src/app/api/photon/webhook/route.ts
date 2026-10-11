import { createPhotonWebhookHandler } from "../../../../lib/photon/webhook";

export const runtime = "nodejs";

/** POST /api/photon/webhook — authenticated worker message -> plan + Nova reply. */
export const POST = createPhotonWebhookHandler();

// FUTURE SUPABASE: resolve the paired user's account, preferences, income, and
// plans from the database. Persist the message ID and plan in one transaction
// for deduplication across restarts and multiple server instances.
