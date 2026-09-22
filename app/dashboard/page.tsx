import { redirect } from "next/navigation";

// Legacy route — the app home is now /race (which handles auth + onboarding gating).
export default function Dashboard() {
  redirect("/race");
}
