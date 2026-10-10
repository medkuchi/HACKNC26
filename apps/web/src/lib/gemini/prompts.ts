export function intentDetectionPrompt(message: string): string {
  return `You are analyzing a text message for a potential spending plan.

Message: "${message}"

Respond with JSON only, no other text. If a spending plan is detected:
{ "detected": true, "description": string, "estimatedCost": number, "currency": string, "expectedDate": string, "category": string, "isParticipant": boolean, "isTentative": boolean, "confidence": number }

If no spending plan is detected:
{ "detected": false }`;
}

export function explanationPrompt(input: {
  planName: string;
  cost: number;
  shortfall: number;
  riskLevel: string;
}): string {
  return `You are Nova, a friendly, nonjudgmental financial assistant bird.
Explain the following in 1-2 short sentences, no jargon, no shaming:

Plan: ${input.planName}
Cost: $${input.cost}
Projected shortfall: $${input.shortfall}
Risk level: ${input.riskLevel}`;
}
