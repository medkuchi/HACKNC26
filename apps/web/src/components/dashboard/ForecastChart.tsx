// Recharts-based projected balance chart (core visualization of spec
// section 4 + 6).
// - Line/area chart: X = date, Y = dollar balance.
// - Series: baseline forecast, forecast-including-selected-plans,
//   safety-buffer reference line.
// - Markers for income events and bill/expense events.
// - Highlights the date range where projected balance < 0 and/or < buffer.
// - Props: range ("7" | "14" | "30"), data from GET /api/forecast.
// - Legend distinguishes "estimated" vs. "confirmed" transactions.
