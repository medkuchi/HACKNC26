import type { ForecastComparisonResult, ForecastDate, ForecastEvent, ForecastInput, ForecastRecurringExpense, ForecastResult } from "./types";
import { compareRiskScores } from "./risk";

const DAY_MS = 86_400_000;
function parseDate(value: ForecastDate): number {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new RangeError(`Invalid forecast date: ${value}`);
    }
    const time = Date.parse(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) {
        throw new RangeError(`Invalid forecast date: ${value}`);
    }
    return time;
}
function dateString(time: number): ForecastDate {
    return new Date(time).toISOString().slice(0, 10);
}
function assertAmount(value: number, label: string, allowNegative = false): void {
    if (!Number.isFinite(value) || (!allowNegative && value < 0)) {
        throw new RangeError(`${label} must be finite${allowNegative ? "" : " and nonnegative"}`);
    }
}
function assertSafeUnits(value: number): number {
    if (!Number.isSafeInteger(value)) {
        throw new RangeError("Forecast amount exceeds safe monetary precision");
    }
    return value;
}
function currencyScale(currency: string): number {
    if (!/^[A-Z]{3}$/.test(currency)) {
        throw new RangeError("currency must be a three-letter uppercase currency code");
    }
    const digits = new Intl.NumberFormat("en", {
        style: "currency",
        currency,
    }).resolvedOptions().maximumFractionDigits;
    return 10 ** (digits ?? 2);
}
/** True on scheduled UTC calendar days; month-end clamping preserves the anchor. */
function occursOn(expense: ForecastRecurringExpense, anchor: number, day: number): boolean {
    if (day < anchor)
        return false;
    const elapsedDays = (day - anchor) / DAY_MS;
    if (expense.frequency === "weekly")
        return elapsedDays % 7 === 0;
    if (expense.frequency === "biweekly")
        return elapsedDays % 14 === 0;
    const first = new Date(anchor);
    const current = new Date(day);
    if (expense.frequency === "yearly" && current.getUTCMonth() !== first.getUTCMonth()) {
        return false;
    }
    // Derive month length from this day, avoiding Date.UTC's special handling of years 0–99.
    const monthEnd = new Date(day);
    monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
    return current.getUTCDate() === Math.min(first.getUTCDate(), monthEnd.getUTCDate());
}
/**
 * B(t) = B(0) + sum(income through t) - sum(expenses through t)
 *        - sum(selected planned purchases through t).
 * B(0) is the opening balance; t is a day in the inclusive forecast window.
 * Returns the daily balance series and summary of projected finances.
 *
 * Compute daily closing balances without mutating the input or calling APIs.
 * Events outside the inclusive window are ignored. Same-day events are netted;
 * this forecast cannot determine whether an overdraft happens within a day.
 * Amounts are rounded once to currency minor units before integer arithmetic.
 */
export function calculateProjectedCost(input: ForecastInput): ForecastResult {
    const start = parseDate(input.period.startDate);
    const end = parseDate(input.period.endDate);
    if (end < start)
        throw new RangeError("Forecast endDate must be on or after startDate");
    assertAmount(input.currentBalance, "currentBalance", true);
    assertAmount(input.safetyBuffer, "safetyBuffer");
    const scale = currencyScale(input.currency);
    const units = (value: number): number => {
        // Round magnitude so negative opening balances round symmetrically.
        return assertSafeUnits(Math.sign(value) * Math.round((Math.abs(value) + Number.EPSILON) * scale));
    };
    const money = (value: number): number => value / scale;
    const events = new Map<number, { income: number; expenses: number; purchases: number }>();
    const add = (day: number, field: "income" | "expenses" | "purchases", amount: number): void => {
        if (day < start || day > end)
            return;
        const totals = events.get(day) ?? { income: 0, expenses: 0, purchases: 0 };
        totals[field] = assertSafeUnits(totals[field] + amount);
        events.set(day, totals);
    };
    const validateEvent = (event: ForecastEvent): number => {
        assertAmount(event.amount, `Event ${event.id} amount`);
        return parseDate(event.expectedDate);
    };
    for (const event of input.incomeEvents)
        add(validateEvent(event), "income", units(event.amount));
    for (const event of input.bills)
        add(validateEvent(event), "expenses", units(event.amount));
    for (const event of input.plannedPurchases) {
        const date = validateEvent(event);
        if (!["tentative", "confirmed", "canceled", "completed"].includes(event.status)) {
            throw new RangeError(`Invalid purchase status: ${event.status}`);
        }
        if (event.status === "tentative" || event.status === "confirmed") {
            add(date, "purchases", units(event.amount));
        }
    }
    for (const expense of input.recurringExpenses) {
        const anchor = validateEvent(expense);
        if (!["weekly", "biweekly", "monthly", "yearly"].includes(expense.frequency)) {
            throw new RangeError(`Invalid recurrence frequency: ${expense.frequency}`);
        }
        const last = expense.endDate === undefined ? end : parseDate(expense.endDate);
        if (last < anchor)
            throw new RangeError(`Recurring expense ${expense.id} ends before its first occurrence`);
        const amount = units(expense.amount);
        for (let day = Math.max(start, anchor); day <= Math.min(end, last); day += DAY_MS) {
            if (occursOn(expense, anchor, day))
                add(day, "expenses", amount);
        }
    }
    const openingBalance = units(input.currentBalance);
    let balance = openingBalance;
    let cumulativeIncome = 0;
    let cumulativeExpenses = 0;
    let cumulativePurchases = 0;
    let minimum = balance;
    let firstNegativeDate: ForecastDate | null = balance < 0 ? input.period.startDate : null;
    const dailyBalances: ForecastResult["dailyBalances"] = [];
    for (let day = start; day <= end; day += DAY_MS) {
        const totals = events.get(day) ?? { income: 0, expenses: 0, purchases: 0 };
        cumulativeIncome = assertSafeUnits(cumulativeIncome + totals.income);
        cumulativeExpenses = assertSafeUnits(cumulativeExpenses + totals.expenses);
        cumulativePurchases = assertSafeUnits(cumulativePurchases + totals.purchases);
        // B(t) = B(0) + I(t) - E(t) - P(t), calculated in currency minor units.
        balance = assertSafeUnits(openingBalance + cumulativeIncome);
        balance = assertSafeUnits(balance - cumulativeExpenses);
        balance = assertSafeUnits(balance - cumulativePurchases);
        minimum = Math.min(minimum, balance);
        const date = dateString(day);
        if (balance < 0 && firstNegativeDate === null)
            firstNegativeDate = date;
        dailyBalances.push({
            date,
            income: money(totals.income),
            expenses: money(totals.expenses),
            plannedPurchases: money(totals.purchases),
            balance: money(balance),
        });
    }
    return {
        currency: input.currency,
        dailyBalances,
        minimumProjectedBalance: money(minimum),
        firstNegativeDate,
        maximumProjectedShortfall: money(Math.max(0, -minimum)),
        remainingAfterObligations: money(balance),
    };
}
/** Compare a no-plan baseline with all selected tentative/confirmed purchases. */
export function compareForecasts(input: ForecastInput): ForecastComparisonResult {
    const baseline = calculateProjectedCost({ ...input, plannedPurchases: [] });
    const postPurchase = calculateProjectedCost(input);
    const scale = currencyScale(input.currency);
    const balanceDelta = assertSafeUnits(Math.round(postPurchase.remainingAfterObligations * scale) -
        Math.round(baseline.remainingAfterObligations * scale)) / scale;
    return {
        baseline,
        postPurchase,
        balanceDelta,
        balanceDeltaRelativeToSafetyBuffer: input.safetyBuffer === 0 ? null : balanceDelta / input.safetyBuffer,
        riskScore: compareRiskScores(
            input.safetyBuffer,
            baseline.minimumProjectedBalance,
            postPurchase.minimumProjectedBalance,
        ),
    };
}
