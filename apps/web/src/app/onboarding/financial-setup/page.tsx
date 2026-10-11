// Onboarding Step 2 — Financial Setup. Route: "/onboarding/financial-setup"
// - Creates or selects a simulated Nessie customer + bank account via
//   lib/nessie (createNessieCustomer / createNessieAccount).
// - Loads and previews the account's fictional banking data, with a
//   clear "simulated data" disclaimer.
// - Form for the user to enter expected paycheck dates + amounts
//   (future income used by the forecast engine).

import PlaceholderPage from "@/components/PlaceholderPage";

export default function Page() {
  return (
    <PlaceholderPage
      title="Financial setup"
    />
  );
}
