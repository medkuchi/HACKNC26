import ApiChecks from "@/components/development/ApiChecks";
import Link from "next/link";

export default function Page() {
  return <main className="page-shell"><Link href="/dashboard">Back to dashboard</Link><ApiChecks /></main>;
}
