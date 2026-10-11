import type { ReactNode } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";

// Preserve the existing unauthenticated demo dashboard.
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
