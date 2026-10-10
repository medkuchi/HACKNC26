// Package entry point — re-exports forecast engine, risk scoring, and
// shared types/constants for consumption as "@hacknc26/shared" from
// both apps/web and apps/photon-agent.

export type * from "./types";
export { calculateProjectedCost, compareForecasts } from "./forecast/engine";
export { calculateRiskScore, compareRiskScores } from "./forecast/risk";
