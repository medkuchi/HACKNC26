import type { Account, Bill, Customer, Purchase } from "./types";

export interface NessieClientOptions {
  /** Server-side key; never pass this configuration to a browser component. */
  apiKey: string;
  /** API origin from your Nessie environment, not the documentation page URL. */
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export interface NessieClient {
  getAccount(accountId: string): Promise<Account>;
  getCustomer(customerId: string): Promise<Customer>;
  getAccountPurchases(accountId: string): Promise<Purchase[]>;
  getAccountBills(accountId: string): Promise<Bill[]>;
}

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("Invalid Nessie response: expected an object");
  }
  return value as JsonObject;
}
function stringField(row: JsonObject, key: string): string {
  if (typeof row[key] !== "string" || !row[key]) {
    throw new TypeError(`Invalid Nessie response: ${key} must be a nonempty string`);
  }
  return row[key];
}
function numberField(row: JsonObject, key: string, nonnegative = true): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isFinite(value) || (nonnegative && value < 0)) {
    throw new TypeError(`Invalid Nessie response: ${key} must be a finite number`);
  }
  return value;
}
function optionalString(row: JsonObject, key: string): string | undefined {
  return row[key] === undefined ? undefined : stringField(row, key);
}
function enumField<T extends string>(row: JsonObject, key: string, values: readonly T[]): T {
  const value = stringField(row, key);
  if (!values.includes(value as T)) throw new TypeError(`Invalid Nessie response: unsupported ${key}`);
  return value as T;
}
function parseAccount(value: unknown): Account {
  const row = object(value);
  return {
    _id: stringField(row, "_id"), customer_id: stringField(row, "customer_id"),
    type: enumField(row, "type", ["Checking", "Savings", "Credit Card"]),
    nickname: stringField(row, "nickname"), balance: numberField(row, "balance", false),
    account_number: optionalString(row, "account_number"),
  };
}
function parseCustomer(value: unknown): Customer {
  const row = object(value);
  return { _id: stringField(row, "_id"), first_name: stringField(row, "first_name"), last_name: stringField(row, "last_name") };
}
function parseBill(value: unknown): Bill {
  const row = object(value);
  const recurring = row.recurring_date === undefined ? undefined : numberField(row, "recurring_date");
  if (recurring !== undefined && (!Number.isInteger(recurring) || recurring < 1 || recurring > 31)) {
    throw new TypeError("Invalid Nessie response: recurring_date must be a day from 1 to 31");
  }
  return {
    _id: stringField(row, "_id"), account_id: stringField(row, "account_id"),
    status: enumField(row, "status", ["pending", "recurring", "completed", "cancelled"]),
    payee: stringField(row, "payee"), payment_amount: numberField(row, "payment_amount"),
    nickname: optionalString(row, "nickname"), payment_date: optionalString(row, "payment_date"),
    recurring_date: recurring, creation_date: optionalString(row, "creation_date"),
  };
}
function parsePurchase(value: unknown): Purchase {
  const row = object(value);
  return {
    _id: stringField(row, "_id"), payer_id: stringField(row, "payer_id"),
    merchant_id: stringField(row, "merchant_id"),
    medium: enumField(row, "medium", ["balance", "rewards"]),
    purchase_date: stringField(row, "purchase_date"), amount: numberField(row, "amount"),
    status: enumField(row, "status", ["pending", "completed", "cancelled"]),
    description: optionalString(row, "description"),
  };
}
function list<T>(value: unknown, parse: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new TypeError("Invalid Nessie response: expected an array");
  return value.map(parse);
}

/** Read-only server-side API client. Responses are uncached to avoid stale balances. */
export function createNessieClient(options: NessieClientOptions): NessieClient {
  if (typeof window !== "undefined") throw new Error("Nessie client must run on the server");
  if (!options.apiKey.trim()) throw new Error("A Nessie API key is required");
  const base = new URL(options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`);
  if (base.protocol !== "https:") throw new Error("Nessie baseUrl must use HTTPS");
  const requestFetch = options.fetchImpl ?? fetch;
  async function get(path: string): Promise<unknown> {
    const url = new URL(path, base);
    url.searchParams.set("key", options.apiKey);
    let response: Response;
    try {
      response = await requestFetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    } catch {
      // Do not expose an error containing the URL, since it includes the API key.
      throw new Error("Nessie request failed or timed out");
    }
    if (!response.ok) throw new Error(`Nessie request failed with HTTP ${response.status}`);
    try { return await response.json(); }
    catch { throw new TypeError("Invalid Nessie response: expected JSON"); }
  }
  const id = (value: string): string => {
    if (!value.trim()) throw new Error("A Nessie resource ID is required");
    return encodeURIComponent(value);
  };
  return {
    getAccount: async accountId => parseAccount(await get(`accounts/${id(accountId)}`)),
    getCustomer: async customerId => parseCustomer(await get(`customers/${id(customerId)}`)),
    getAccountPurchases: async accountId => list(await get(`accounts/${id(accountId)}/purchases`), parsePurchase),
    getAccountBills: async accountId => list(await get(`accounts/${id(accountId)}/bills`), parseBill),
  };
}
