// Dashboard Overview — route: "/dashboard"
// Sections (per spec section 4):
//   Welcome section — personalized Nova greeting + one-line financial
//     summary (e.g. "Good morning, Maya! Here's your financial outlook.")
//   Financial summary cards — current balance, upcoming bills, expected
//     income, lowest projected balance, discretionary budget, active
//     plans count, overall risk indicator. Uses components/dashboard/SummaryCard.
//   Financial forecast chart — components/dashboard/ForecastChart
//     (7/14/30-day toggle, baseline vs. with-planned-purchases scenario).
//   Upcoming bills widget — components/dashboard/UpcomingBillsWidget.
//   Recent spending plans — components/dashboard/PlanCard grid.
//   Nova insights feed — components/dashboard/InsightsFeed (shortfalls,
//     detected plans, suggested adjustments, reminders, milestones).

import PlaceholderPage from "@/components/PlaceholderPage";

export default function Page() {
  return (
    <PlaceholderPage
      title="Dashboard"
    />
  );
}
