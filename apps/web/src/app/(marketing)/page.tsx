import { redirect } from "next/navigation";

// The exported design starts at the dashboard overview.
export default function HomePage() { redirect("/dashboard"); }
