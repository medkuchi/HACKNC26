import { createNessieCustomer } from "../../../../lib/nessie/adapters";
import { parseCustomerCreationInput } from "../../../../lib/nessie/client";
import type { CustomerCreationInput } from "../../../../lib/nessie/client";

// Supabase integration is deferred; its factory and database schema are scaffolds.
// import { createServerClient } from "../../../../lib/supabase/server";

export const runtime = "nodejs";

/** POST /api/nessie/customer — demo onboarding without Supabase authentication. */
export async function POST(request: Request): Promise<Response> {
  // FUTURE AUTH: implement the Supabase factory, then enable this block.
  // const supabase = await createServerClient();
  // const { data: { user }, error: authError } = await supabase.auth.getUser();
  // if (authError || !user) {
  //   return Response.json({ error: "Authentication required" }, { status: 401 });
  // }

  let input: CustomerCreationInput;
  try {
    input = parseCustomerCreationInput(await request.json());
  } catch (error) {
    return Response.json({ error: error instanceof TypeError ? error.message : "Request body must be valid JSON" },
      { status: 400 });
  }

  // Access the Node environment without requiring Node typings in this scaffold.
  const node = globalThis as typeof globalThis & {
    process?: { env: Record<string, string | undefined> };
  };
  const env = node.process?.env ?? {};
  const flag = env.USE_MOCK_NESSIE?.trim().toLowerCase();
  if (flag !== undefined && flag !== "" && flag !== "true" && flag !== "false") {
    return Response.json({ error: "USE_MOCK_NESSIE must be true or false" }, { status: 503 });
  }
  const apiKey = env.NESSIE_API_KEY?.trim();
  const useMock = flag === "true" || ((flag === undefined || flag === "") && !apiKey);
  if (!useMock && (!apiKey || !env.NESSIE_BASE_URL)) {
    return Response.json({ error: "Configure NESSIE_API_KEY and NESSIE_BASE_URL, or enable USE_MOCK_NESSIE" },
      { status: 503 });
  }
  if (!useMock && !input.address) {
    return Response.json({ error: "Nessie API customer creation requires an address" }, { status: 400 });
  }

  try {
    const { customer, dataSource } = await createNessieCustomer(input, {
      apiKey, baseUrl: env.NESSIE_BASE_URL, useMock,
    });

    // FUTURE PERSISTENCE: implement the schema and enable authentication above.
    // Example only: confirm table/column names when the migration is implemented.
    // const { error: saveError } = await supabase.from("nessie_accounts").upsert(
    //   { user_id: user.id, customer_id: customer._id },
    //   { onConflict: "user_id" },
    // );
    // if (saveError) {
    //   return Response.json({ error: "Customer created, but its account link could not be saved",
    //     customerId: customer._id }, { status: 500 });
    // }

    // No database persistence yet. The caller keeps this ID for account creation.
    return Response.json({ customerId: customer._id, customer, dataSource },
      { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    // Do not expose upstream URLs, keys, or personal details in errors.
    return Response.json({ error: "Unable to create the Nessie customer" }, { status: 502 });
  }
}
