// GET /api/forecast?range=7|14|30&planIds=...
// Server endpoint wrapping packages/shared/src/forecast/engine.ts.
// Loads current balance + bills + income + recurring expenses from
// Nessie/Supabase, runs the baseline forecast and (if planIds given)
// the with-purchase alternative forecast, and returns both series plus
// risk scores for the dashboard's ForecastChart.
