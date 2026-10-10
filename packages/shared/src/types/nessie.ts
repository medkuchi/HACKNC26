/**
 * Shared subset of Nessie response fields used by the app.
 * API field names intentionally stay in snake_case; unused fields are omitted.
 * Validate HTTP responses at runtime; TypeScript types do not validate JSON.
 * Nessie is a banking simulation; amounts use major currency units.
 * Sources: https://github.com/nessieisreal/nessie-javascript-sdk
 * NESSIE DOCUMENTATION: https://prod.nessieisreal.com/docs#Accounts
 */
export interface Customer {
  _id: string;
  first_name: string;
  last_name: string;
}

export type AccountType = "Checking" | "Savings" | "Credit Card";

export interface Account {
  _id: string;
  customer_id: string;
  type: AccountType;
  nickname: string;
  //rewards: number;
  balance: number;
  account_number?: string;
}

export type PurchaseMedium = "balance" | "rewards";
export type PurchaseStatus = "pending" | "completed" | "cancelled";

export interface Purchase {
  _id: string;
  payer_id: string;
  merchant_id: string;
  medium: PurchaseMedium;
  /** API date string; normalize and validate before sending to the forecast. */
  purchase_date: string;
  amount: number;
  status: PurchaseStatus;
  description?: string;
}

/** Nessie uses "cancelled"; app spending plans use "canceled". */
export type BillStatus = "pending" | "recurring" | "completed" | "cancelled";

export interface Bill {
  _id: string;
  account_id: string;
  status: BillStatus;
  payee: string;
  nickname?: string;
  payment_amount: number;
  /** May be absent on bills defined by a recurring day of month. */
  payment_date?: string;
  /** Recurring day of month, not a forecast frequency; validate before mapping. */
  recurring_date?: number;
  creation_date?: string;
}

}

/** App-normalized history item, not a separate Nessie API resource. */
export interface Transaction {
  id: string;
  accountId: string;
  type: "purchase" | "deposit" | "withdrawal" | "transfer";
  /** Explicit direction; amount is always finite and nonnegative. */
  direction: "credit" | "debit";
  amount: number;
  currency: string;
  /** Normalized YYYY-MM-DD date. */
  date: string;
  status: PurchaseStatus;
  description?: string;
  merchantId?: string;
  category?: string;
}

/**
 * App-level snapshot for one selected account, assembled by the adapter.
 * Historical purchases must not be subtracted from currentBalance again.
 * Adapters derive upcoming unpaid bills from bills before building ForecastInput.
 */
export interface FinancialOverview {
  customer: Customer;
  account: Account;
  /** The selected account's balance, not a sum that includes credit-card debt. */
  currentBalance: number;
  /** Supplied by the adapter; Nessie entities do not carry a currency field. */
  currency: string;
  purchases: Purchase[];
  bills: Bill[];
  /** Both sources are simulated; mock specifically means local demo fixtures. */
  dataSource: "nessie" | "mock";
  /** ISO 8601 timestamp when this snapshot was fetched. */
  fetchedAt: string;
}
