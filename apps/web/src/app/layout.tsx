// Root layout for the entire web app.
// - Applies global Tailwind styles (globals.css) and base font.
// - Wraps the tree in any app-wide providers (e.g. Supabase session
//   provider / React Query provider) once added.
// - Sets default <html>/<body> theme attributes for the Frutiger Aero
//   look (sky-blue gradient background).

import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bridge — Your financial outlook",
  description: "Plan ahead with Bridge: spending plans, financial forecasts, and Nova insights.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
