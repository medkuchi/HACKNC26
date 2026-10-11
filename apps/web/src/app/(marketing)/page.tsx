// Landing page (Page 1 of spec) — route: "/"
// Composes marketing sections from src/components/landing/*:
//   Hero (logo, Nova mascot, tagline "Think ahead. Spend with confidence.",
//     Get Started / Log In buttons)
//   ProblemSection (reactive vs. proactive financial apps)
//   HowItWorks (connect finances -> connect Nova to iMessage -> get insights)
//   ProductPreview (dashboard + forecast chart + Nova iMessage mockups)
//   PrivacySection (explicit opt-in, user-controlled monitoring)
//   CTASection (final call-to-action)
// Fully static/marketing — no auth required.

import ApiChecks from "@/components/development/ApiChecks";

/** Replace this development page with the Figma landing page when ready. */
export default function HomePage() {
  return (
    <main className="page-shell">
      <header className="card introduction">
        <p className="eyebrow">Bridge · Development preview</p>
        <h1>Your app is running.</h1>
        <p>This is a temporary homepage while the Figma screens are being built.</p>
        <p>Check the API routes below. Local mock mode works without API keys.</p>
      </header>
      <ApiChecks />
      <footer>Nova’s forecast engine and API routes are ready to connect to your UI.</footer>
    </main>
  );
}
