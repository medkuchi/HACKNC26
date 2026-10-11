// Financial Forecast page — route: "/dashboard/forecast"
// - Full-size version of components/dashboard/ForecastChart with 7/14/30
//   day range controls.
// - X-axis: dates, Y-axis: dollar balance.
// - Plots: baseline forecast, forecast-with-selected-plans overlay,
//   income events, bill/expense events, user's safety-buffer line.
// - Visually flags the first date the balance goes negative and any
//   other at-risk dates.
// - Clear "estimated" vs. "confirmed" transaction labeling/legend.
// - Backed by GET /api/forecast (calls packages/shared forecast engine).

import PlaceholderPage from "@/components/PlaceholderPage";

export default function Page() {
  return (
    <PlaceholderPage
      title="Financial forecast"
    />
  );
}
