import { createHash, timingSafeEqual } from "node:crypto";
import { calculateProjectedCost, calculateRiskScore } from "@hacknc26/shared";
import type { FinancialOverview, ForecastPlannedPurchase, PhotonMessageEvent, PhotonWebhookResult } from "@hacknc26/shared";
import { detectSpendingIntent } from "../gemini/intentDetection";
import { createFinancialDataSource, toForecastInput } from "../nessie/adapters";
import { jsonResponse, readNessieOptions } from "../nessie/config";
import { createPlan, DEMO_USER_ID, listPlans, parseCreatePlanInput } from "../plans/store";
import type { CreatePlanInput } from "../plans/store";

interface WebhookOptions {
  sharedSecret?: () => string | undefined;
  detectIntent?: (text: string, referenceDate: string) => Promise<unknown>;
  loadOverview?: () => Promise<FinancialOverview>;
  safetyBuffer?: () => number;
  now?: () => Date;
}

class WebhookError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}

async function loadDemoOverview(): Promise<FinancialOverview> {
  let options;
  try { options = readNessieOptions(); }
  catch { throw new WebhookError(503, "Nessie configuration is incomplete"); }
  const accountId = process.env.PHOTON_DEMO_ACCOUNT_ID?.trim() || (options.useMock ? "demo" : "");
  if (!accountId) throw new WebhookError(503, "Configure PHOTON_DEMO_ACCOUNT_ID for the demo profile");
  try { return await createFinancialDataSource(options).getFinancialOverview(accountId); }
  catch { throw new WebhookError(502, "Unable to load financial data"); }
}

function demoSafetyBuffer(): number {
  const value = process.env.PHOTON_DEMO_SAFETY_BUFFER?.trim();
  if (value === "") throw new WebhookError(503, "PHOTON_DEMO_SAFETY_BUFFER must be nonnegative");
  const buffer = value === undefined ? 100 : Number(value);
  if (!Number.isFinite(buffer) || buffer < 0) {
    throw new WebhookError(503, "PHOTON_DEMO_SAFETY_BUFFER must be nonnegative");
  }
  return buffer;
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseEvent(value: unknown): PhotonMessageEvent {
  if (!object(value)) throw new TypeError("Request body must be a JSON object");
  const id = (field: string): string => {
    const valueAtField = value[field];
    if (typeof valueAtField !== "string" || !valueAtField.trim() || valueAtField.length > 512) {
      throw new TypeError(`${field} must be a nonempty string of at most 512 characters`);
    }
    return valueAtField.trim();
  };
  if (typeof value.isGroup !== "boolean") throw new TypeError("isGroup must be a boolean");
  if (typeof value.text !== "string" || !value.text.trim() || value.text.length > 10_000) {
    throw new TypeError("text must contain between 1 and 10000 characters");
  }
  return { messageId: id("messageId"), userId: id("userId"), senderId: id("senderId"),
    conversationId: id("conversationId"), isGroup: value.isGroup, text: value.text };
}

/** Reject uncertain or third-party spending before interpreting financial fields. */
function detectedPlan(value: unknown, event: PhotonMessageEvent): CreatePlanInput | null {
  if (!object(value) || value.detected !== true || value.isParticipant !== true ||
      typeof value.confidence !== "number" || !Number.isFinite(value.confidence) ||
      value.confidence < 0.7 || value.confidence > 1) return null;
  // These fields must actually be supplied by the detector; parser defaults would
  // otherwise turn missing currency or intent into a seemingly complete plan.
  if (typeof value.currency !== "string" || typeof value.isTentative !== "boolean") {
    throw new TypeError("Incomplete spending intent");
  }
  const plan = parseCreatePlanInput({ name: value.description, estimatedCost: value.estimatedCost,
    currency: value.currency, category: value.category ?? "other", expectedDate: value.expectedDate,
    status: value.isTentative ? "tentative" : "confirmed",
    source: event.isGroup ? "authorized_group" : "private_imessage", confidence: value.confidence });
  const digits = new Intl.NumberFormat("en", { style: "currency", currency: plan.currency })
    .resolvedOptions().maximumFractionDigits ?? 2;
  if (!Number.isSafeInteger(Math.round((plan.estimatedCost + Number.EPSILON) * 10 ** digits))) {
    throw new TypeError("Spending amount exceeds safe monetary precision");
  }
  return plan;
}

function purchase(plan: CreatePlanInput, id: string): ForecastPlannedPurchase {
  return { id, name: plan.name, amount: plan.estimatedCost, expectedDate: plan.expectedDate,
    status: plan.status, amountIsEstimated: true };
}

/**
 * One demo user until Supabase/account ownership/preferences are implemented.
 * The worker already checks pairing and consent; this endpoint authenticates
 * the worker again. Tests inject providers so no real messages or APIs are used.
 */
export function createPhotonWebhookHandler(options: WebhookOptions = {}) {
  const secret = options.sharedSecret ?? (() => process.env.PHOTON_AGENT_SHARED_SECRET);
  const detect = options.detectIntent ?? detectSpendingIntent;
  const overviewForDemo = options.loadOverview ?? loadDemoOverview;
  const safetyBufferForDemo = options.safetyBuffer ?? demoSafetyBuffer;
  const now = options.now ?? (() => new Date());
  // Both cache and plans are temporary. A durable unique message key belongs in
  // the future database transaction alongside plan creation.
  const deliveries = new Map<string, { fingerprint: string; result: Promise<PhotonWebhookResult>; completedAt?: number }>();
  const cacheLimit = 1000;
  const cacheTtlMs = 24 * 60 * 60 * 1000;

  async function processEvent(event: PhotonMessageEvent): Promise<PhotonWebhookResult> {
    const startDate = now().toISOString().slice(0, 10);
    let detected: unknown;
    try { detected = await detect(event.text, startDate); }
    catch { throw new WebhookError(502, "Unable to analyze the message"); }
    let input: CreatePlanInput | null;
    try { input = detectedPlan(detected, event); }
    catch {
      return { replyText: "What is your expected cost, currency, and spending date (YYYY-MM-DD)? I need these to check the plan." };
    }
    if (!input) return { replyText: null };
    if (input.expectedDate < startDate) {
      return { replyText: "That spending date is in the past. What future date should I use?" };
    }
    const end = new Date(`${startDate}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 29);
    const endDate = end.toISOString().slice(0, 10);
    let overview: FinancialOverview;
    try { overview = await overviewForDemo(); }
    catch (error) {
      if (error instanceof WebhookError) throw error;
      throw new WebhookError(502, "Unable to load financial data");
    }
    if (input.currency !== overview.currency) {
      return { replyText: `Your forecast uses ${overview.currency}. What is your cost in ${overview.currency}? I have not saved this plan yet.` };
    }
    if (input.expectedDate > endDate) {
      const plan = createPlan(input, DEMO_USER_ID);
      return { planId: plan.id, replyText: `Saved "${input.name}" for ${input.expectedDate}. It is beyond the current 30-day forecast, so its impact and risk are not calculated yet.` };
    }
    const safetyBuffer = safetyBufferForDemo();
    const existing = listPlans(DEMO_USER_ID).filter(plan =>
      (plan.status === "tentative" || plan.status === "confirmed") && plan.currency === overview.currency);
    const baselineInput = toForecastInput(overview, { period: { startDate, endDate }, safetyBuffer,
      incomeEvents: [], plannedPurchases: existing.map(plan => purchase(plan, plan.id)) });
    const baseline = calculateProjectedCost(baselineInput);
    const projected = calculateProjectedCost({ ...baselineInput,
      plannedPurchases: [...baselineInput.plannedPurchases, purchase(input, "new-message-plan")] });
    // Subtract integer currency units to avoid storing a floating-point artifact.
    const digits = new Intl.NumberFormat("en", { style: "currency", currency: overview.currency })
      .resolvedOptions().maximumFractionDigits ?? 2;
    const scale = 10 ** digits;
    const projectedImpact = (Math.round(projected.remainingAfterObligations * scale) -
      Math.round(baseline.remainingAfterObligations * scale)) / scale;
    const riskScore = calculateRiskScore(safetyBuffer, projected.minimumProjectedBalance);
    const money = (value: number) => new Intl.NumberFormat("en-US", {
      style: "currency", currency: overview.currency,
    }).format(value);
    const warning = projected.maximumProjectedShortfall > 0
      ? `The forecast reaches a shortfall of ${money(projected.maximumProjectedShortfall)}.`
      : projected.minimumProjectedBalance < safetyBuffer
        ? `The lowest projected balance is ${money(projected.minimumProjectedBalance)}, below your ${money(safetyBuffer)} safety buffer.`
        : `The lowest projected balance stays at ${money(projected.minimumProjectedBalance)}, above or equal to your ${money(safetyBuffer)} safety buffer.`;
    // Build the reply from engine values so a second AI call cannot invent money
    // figures or fail after a plan has already been created.
    const replyText = `Saved "${input.name}" (${money(input.estimatedCost)} on ${input.expectedDate}). ${warning} ` +
      `${overview.dataSource === "mock" ? "Demo forecast with mock data" : "30-day forecast"}; includes active ${overview.currency} plans and known bills, with no future income configured.`;
    const plan = createPlan(input, DEMO_USER_ID, { projectedImpact, riskScore });
    return { replyText, planId: plan.id };
  }

  return async function POST(request: Request): Promise<Response> {
    const expected = secret()?.trim();
    if (!expected || /[\r\n]/.test(expected)) {
      return jsonResponse({ error: "PHOTON_AGENT_SHARED_SECRET is not configured" }, 503);
    }
    const provided = /^Bearer (.+)$/i.exec(request.headers.get("Authorization") ?? "")?.[1];
    const hash = (value: string) => createHash("sha256").update(value).digest();
    if (!provided || !timingSafeEqual(hash(provided), hash(expected))) {
      return jsonResponse({ error: "Unauthorized worker request" }, 401);
    }
    let event: PhotonMessageEvent;
    try { event = parseEvent(await request.json()); }
    catch (error) {
      return jsonResponse({ error: error instanceof TypeError ? error.message : "Request body must be valid JSON" }, 400);
    }
    if (event.userId !== DEMO_USER_ID) {
      return jsonResponse({ error: "This demo supports only the paired demo-user profile" }, 403);
    }
    const key = JSON.stringify([event.userId, event.conversationId, event.messageId]);
    const fingerprint = hash(JSON.stringify(event)).toString("hex");
    const timestamp = now().getTime();
    for (const [id, entry] of deliveries) {
      if (entry.completedAt !== undefined && timestamp - entry.completedAt >= cacheTtlMs) deliveries.delete(id);
    }
    let entry = deliveries.get(key);
    if (entry && entry.fingerprint !== fingerprint) {
      return jsonResponse({ error: "Message ID was already used for a different event" }, 409);
    }
    if (!entry) {
      if (deliveries.size >= cacheLimit) {
        const oldestCompleted = [...deliveries].find(([, item]) => item.completedAt !== undefined);
        if (!oldestCompleted) return jsonResponse({ error: "Webhook is busy; try again later" }, 503);
        deliveries.delete(oldestCompleted[0]);
      }
      entry = { fingerprint, result: processEvent(event) };
      deliveries.set(key, entry);
    }
    try {
      const result = await entry.result;
      entry.completedAt ??= now().getTime();
      return jsonResponse(result);
    } catch (error) {
      // Another waiter may already have cleared this failed delivery.
      if (deliveries.get(key) === entry) deliveries.delete(key);
      return jsonResponse({ error: error instanceof WebhookError ? error.message : "Unable to process the message" },
        error instanceof WebhookError ? error.status : 500);
    }
  };
}
