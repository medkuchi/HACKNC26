import type { Account, Bill, Customer, Purchase } from "./types";

export interface NessieClientOptions {
  /** Server-side key; never pass this configuration to a browser component. */
  apiKey: string;
  /** API origin from your Nessie environment, not the documentation page URL. */
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export interface NessieClient {
  createAccount(customerId: string, input: AccountCreationInput): Promise<Account>;
  createCustomer(input: CustomerCreationInput): Promise<Customer>;
  getAccount(accountId: string): Promise<Account>;
  getCustomer(customerId: string): Promise<Customer>;
  getAccountPurchases(accountId: string): Promise<Purchase[]>;
  getAccountBills(accountId: string): Promise<Bill[]>;
}

/** Only cash accounts are offered by this forecast app. */
export interface AccountCreationInput {
  type: "Checking" | "Savings";
  nickname: string;
  balance: number;
}

export function parseAccountCreationInput(value: unknown): AccountCreationInput {
  const row = object(value);
  const nickname = stringField(row, "nickname").trim();
  if (!nickname || nickname.length > 100) throw new TypeError("nickname must contain 1 to 100 characters");
  return { type: enumField(row, "type", ["Checking", "Savings"]), nickname,
    balance: numberField(row, "balance") };
}

/** Creation-only fields; address is not needed in the forecast's Customer type. */
export interface CustomerCreationInput {
  first_name: string;
  last_name: string;
  address?: {
    street_number: string;
    street_name: string;
    city: string;
    state: string;
    zip: string;
  };
}

/** Validate untrusted request JSON before calling Nessie or returning mock data. */
export function parseCustomerCreationInput(value: unknown): CustomerCreationInput {
  const row = object(value);
  const name = (key: string): string => {
    const result = stringField(row, key).trim();
    if (!result || result.length > 100) throw new TypeError(`${key} must contain 1 to 100 characters`);
    return result;
  };
  const input: CustomerCreationInput = { first_name: name("first_name"), last_name: name("last_name") };
  if (row.address !== undefined) {
    const address = object(row.address);
    const field = (key: string): string => {
      const result = stringField(address, key).trim();
      if (!result) throw new TypeError(`address.${key} must be nonempty`);
      return result;
    };
    input.address = { street_number: field("street_number"), street_name: field("street_name"),
      city: field("city"), state: field("state"), zip: field("zip") };
  }
  return input;
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

/** Server-side API client. Responses are uncached to avoid stale balances. */
export function createNessieClient(options: NessieClientOptions): NessieClient {
  if (typeof window !== "undefined") throw new Error("Nessie client must run on the server");
  if (!options.apiKey.trim()) throw new Error("A Nessie API key is required");
  const base = new URL(options.baseUrl.endsWith("/") ? options.baseUrl : `${options.baseUrl}/`);
  if (base.protocol !== "https:") throw new Error("Nessie baseUrl must use HTTPS");
  const requestFetch = options.fetchImpl ?? fetch;
  async function request(path: string, body?: CustomerCreationInput | (AccountCreationInput & { rewards: number })): Promise<unknown> {
    const url = new URL(path, base);
    url.searchParams.set("key", options.apiKey);
    let response: Response;
    try {
      response = await requestFetch(url, {
        method: body === undefined ? "GET" : "POST",
        headers: body === undefined ? undefined : { "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store", signal: AbortSignal.timeout(10_000),
      });
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
    createAccount: async (customerId, input) => {
      const payload = parseAccountCreationInput(input);
      // Rewards is a creation-request field only; forecasts do not use rewards.
      const response = object(await request(`customers/${id(customerId)}/accounts`, { ...payload, rewards: 0 }));
      const account = parseAccount(response.objectCreated);
      if (account.customer_id !== customerId || account.type !== payload.type) {
        throw new TypeError("Nessie returned an account for a different customer or account type");
      }
      return account;
    },
    createCustomer: async input => {
      const payload = parseCustomerCreationInput(input);
      if (!payload.address) throw new TypeError("An address is required to create a Nessie API customer");
      const response = object(await request("customers", payload));
      return parseCustomer(response.objectCreated);
    },
    getAccount: async accountId => parseAccount(await request(`accounts/${id(accountId)}`)),
    getCustomer: async customerId => parseCustomer(await request(`customers/${id(customerId)}`)),
    getAccountPurchases: async accountId => list(await request(`accounts/${id(accountId)}/purchases`), parsePurchase),
    getAccountBills: async accountId => list(await request(`accounts/${id(accountId)}/bills`), parseBill),
  };
}
