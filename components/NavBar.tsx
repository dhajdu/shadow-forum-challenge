import Link from "next/link";
import { ChatLauncher } from "@/components/ChatLauncher";

export function NavBar({ active }: { active?: "race" | "me" | "report" | "rules" }) {
  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  return (
    <div className="bar">
      <Link href="/race" className="brand">THE SHADOW FORUM</Link>
      <nav className="nav">
        <Link href="/race" className={active === "race" ? "on" : ""}>Race</Link>
        <Link href="/me" className={active === "me" ? "on" : ""}>My Zone</Link>
        <Link href={`/report/${encodeURIComponent(month)}`} className={active === "report" ? "on" : ""}>
          Report
        </Link>
        <Link href="/rules" className={active === "rules" ? "on" : ""}>Rules</Link>
      </nav>
      <div className="spacer" />
      <Link href="/profile" className="av" aria-label="Profile">◧</Link>
      <ChatLauncher />
    </div>
  );
}
