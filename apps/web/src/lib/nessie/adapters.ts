import type {
  Account, Bill, FinancialOverview, ForecastBill, ForecastInput, ForecastPeriod,
} from "@hacknc26/shared";
import { createNessieClient, parseAccountCreationInput, parseCustomerCreationInput } from "./client";
import type { AccountCreationInput, CustomerCreationInput, NessieClientOptions } from "./client";

// Demo accounts live only in this server process; a restart clears them.
const mockAccounts = new Map<string, Account>();

export class CashAccountRequiredError extends Error {
  constructor() { super("Cash forecasts require a Checking or Savings account"); }
}

export async function createNessieAccount(
  customerId: string,
  input: AccountCreationInput,
  options: FinancialDataSourceOptions = {},
) {
  if (typeof window !== "undefined") throw new Error("Account creation must run on the server");
  if (!customerId.trim()) throw new TypeError("A customer ID is required");
  const payload = parseAccountCreationInput(input);
  const useMock = options.useMock ?? !options.apiKey?.trim();
  if (useMock) {
    const account: Account = { _id: `mock-account-${crypto.randomUUID()}`, customer_id: customerId, ...payload };
    mockAccounts.set(account._id, account);
    return { account: { ...account }, dataSource: "mock" as const };
  }
  if (!options.baseUrl) throw new Error("NESSIE_BASE_URL is required for API data");
  const client = createNessieClient({ apiKey: options.apiKey ?? "", baseUrl: options.baseUrl,
    fetchImpl: options.fetchImpl });
  return { account: await client.createAccount(customerId, payload), dataSource: "nessie" as const };
}

export interface FinancialDataSourceOptions {
  apiKey?: string;
  baseUrl?: string;
  useMock?: boolean;
  currency?: string;
  fetchImpl?: NessieClientOptions["fetchImpl"];
  now?: () => Date;
}

/** Create an API customer or return the single, clearly labeled mock demo customer. */
export async function createNessieCustomer(
  input: CustomerCreationInput,
  options: FinancialDataSourceOptions = {},
) {
  if (typeof window !== "undefined") throw new Error("Customer creation must run on the server");
  const payload = parseCustomerCreationInput(input);
  const useMock = options.useMock ?? !options.apiKey?.trim();
  if (useMock) {
    return {
      customer: { _id: "mock-customer", first_name: payload.first_name, last_name: payload.last_name },
      dataSource: "mock" as const,
    };
  }
  if (!options.baseUrl) throw new Error("NESSIE_BASE_URL is required for API data");
  const client = createNessieClient({ apiKey: options.apiKey ?? "", baseUrl: options.baseUrl,
    fetchImpl: options.fetchImpl });
  return { customer: await client.createCustomer(payload), dataSource: "nessie" as const };
}

/**
 * Pass server environment settings from the caller. Explicit useMock=false
 * requires credentials; an omitted flag defaults to mock only when no key exists.
 * API failures never silently become demo data.
 */
export function createFinancialDataSource(options: FinancialDataSourceOptions = {}) {
  if (typeof window !== "undefined") throw new Error("Financial data source must run on the server");
  const useMock = options.useMock ?? !options.apiKey?.trim();
  const currency = options.currency ?? "USD";
  const now = options.now ?? (() => new Date());
  if (!useMock && !options.baseUrl) throw new Error("NESSIE_BASE_URL is required for API data");
  const client = useMock ? undefined : createNessieClient({
    apiKey: options.apiKey ?? "",
    baseUrl: options.baseUrl!,
    fetchImpl: options.fetchImpl,
  });
  async function getAccount(accountId: string): Promise<Account> {
    if (!accountId.trim()) throw new Error("An account ID is required");
    const account: Account = client ? await client.getAccount(accountId) : {
      ...(mockAccounts.get(accountId) ?? { _id: accountId, customer_id: "mock-customer",
        type: "Checking", nickname: "Demo checking (mock)", balance: 500 }),
    };
    if (account._id !== accountId) throw new Error("Nessie returned a different account");
    if (account.type === "Credit Card") throw new CashAccountRequiredError();
    return account;
  }
  return {
    dataSource: useMock ? "mock" as const : "nessie" as const,
    getAccount,
    async getFinancialOverview(accountId: string): Promise<FinancialOverview> {
      const account = await getAccount(accountId);
      if (!client) {
        // Fresh objects on every call prevent callers from mutating shared fixtures.
        const fetchedAt = now().toISOString();
        return {
          customer: { _id: account.customer_id, first_name: "Demo", last_name: "User" },
          account, currentBalance: account.balance, currency, purchases: [],
          bills: [{ _id: "mock-subscription", account_id: accountId, status: "recurring", payee: "Demo subscription (mock)", payment_amount: 25, recurring_date: 15 }],
          dataSource: "mock", fetchedAt,
        };
      }
      const [customer, purchases, bills] = await Promise.all([
        client.getCustomer(account.customer_id),
        client.getAccountPurchases(accountId),
        client.getAccountBills(accountId),
      ]);
      if (customer._id !== account.customer_id || bills.some(bill => bill.account_id !== accountId) ||
          purchases.some(purchase => purchase.payer_id !== accountId)) {
        throw new Error("Nessie response contains records for a different account or customer");
      }
      return { customer, account, currentBalance: account.balance, currency,
        purchases, bills, dataSource: "nessie", fetchedAt: now().toISOString() };
    },
  };
}

function calendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError(`Invalid calendar date: ${value}`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new RangeError(`Invalid calendar date: ${value}`);
  }
  return date;
}

/** Expand unpaid monthly bills into explicit occurrences, preserving day 29/30/31. */
export function mapBillsToForecast(bills: Bill[], period: ForecastPeriod): ForecastBill[] {
  const start = calendarDate(period.startDate);
  const end = calendarDate(period.endDate);
  if (end < start) throw new RangeError("Forecast endDate must be on or after startDate");
  const results: ForecastBill[] = [];
  const seen = new Set<string>();
  for (const bill of bills) {
    if (seen.has(bill._id)) throw new Error(`Duplicate bill ID: ${bill._id}`);
    seen.add(bill._id);
    if (bill.status === "completed" || bill.status === "cancelled") continue;
    if (bill.status !== "pending" && bill.status !== "recurring") throw new Error(`Invalid bill status: ${bill.status}`);
    if (!Number.isFinite(bill.payment_amount) || bill.payment_amount < 0) {
      throw new RangeError(`Invalid payment amount for bill ${bill._id}`);
    }
    const paymentDate = bill.payment_date === undefined ? undefined : calendarDate(bill.payment_date);
    const add = (date: Date) => {
      if (date < start || date > end || (paymentDate !== undefined && date < paymentDate)) return;
      const expectedDate = date.toISOString().slice(0, 10);
      results.push({ id: `${bill._id}:${expectedDate}`, name: bill.nickname ?? bill.payee,
        amount: bill.payment_amount, expectedDate, amountIsEstimated: false });
    };
    if (bill.recurring_date !== undefined) {
      const day = bill.recurring_date;
      if (!Number.isInteger(day) || day < 1 || day > 31) throw new RangeError(`Invalid recurring day for bill ${bill._id}`);
      const month = new Date(start);
      month.setUTCDate(1);
      for (; month <= end; month.setUTCMonth(month.getUTCMonth() + 1)) {
        const lastDay = new Date(month);
        lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0);
        const occurrence = new Date(month);
        occurrence.setUTCDate(Math.min(day, lastDay.getUTCDate()));
        add(occurrence);
      }
    } else {
      if (bill.status === "recurring") throw new Error(`Recurring bill ${bill._id} has no recurring day`);
      if (paymentDate === undefined) throw new Error(`Bill ${bill._id} has no payment date`);
      add(paymentDate);
    }
  }
  return results.sort((a, b) => a.expectedDate.localeCompare(b.expectedDate) || a.id.localeCompare(b.id));
}

export type ForecastSetup = Pick<ForecastInput,
  "period" | "safetyBuffer" | "incomeEvents" | "plannedPurchases"
> & { recurringExpenses?: ForecastInput["recurringExpenses"] };

/**
 * Keep purchase history out of future expenses: it already affects the balance.
 * Nessie bill recurrence is expanded into bills, so do not duplicate it in the
 * optional user-supplied recurringExpenses list. Detected subscriptions should
 * be confirmed by the user before being added to that list.
 */
export function toForecastInput(overview: FinancialOverview, setup: ForecastSetup): ForecastInput {
  if (overview.account.type !== "Checking" && overview.account.type !== "Savings") {
    throw new Error("Cash forecasts require a Checking or Savings account");
  }
  if (overview.bills.some(bill => bill.account_id !== overview.account._id)) {
    throw new Error("Bills must belong to the forecast account");
  }
  return {
    currentBalance: overview.currentBalance,
    currency: overview.currency,
    bills: mapBillsToForecast(overview.bills, setup.period),
    incomeEvents: setup.incomeEvents,
    recurringExpenses: setup.recurringExpenses ?? [],
    plannedPurchases: setup.plannedPurchases,
    safetyBuffer: setup.safetyBuffer,
    period: setup.period,
  };
}
