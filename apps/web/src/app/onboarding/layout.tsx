// Shared layout for the multi-step onboarding flow (Page 3 of spec).
// - Renders components/onboarding/StepIndicator.tsx showing progress
//   across the 5 steps: Welcome, Financial Setup, Safety Preferences,
//   Connect iMessage, Privacy Consent.
// - Persists in-progress onboarding state (e.g. via a server action or
//   local state synced to Supabase) so users can resume if they leave.
// - Protected route: requires an authenticated Supabase session.
