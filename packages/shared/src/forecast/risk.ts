// Risk-score heuristic (spec section 6).
// - R = clamp(100 * (S - Bmin) / max(S, 100), 0, 100)
//   where S = user's safety buffer, Bmin = lowest projected balance
//   over the forecast window.
// - Interpretation bands: 0 = no buffer breach, 1-49 = mild pressure,
//   50-99 = significant pressure, 100 = severe/possible shortfall.
//   Explicitly provisional/product thresholds, not statistically
//   validated probabilities.
// - Computes baseline risk, post-purchase risk, and the delta between
//   them, alongside the engine's concrete dollar-shortfall figures —
//   per spec, alerting logic should prioritize the concrete shortfall
//   amount over the score alone.
