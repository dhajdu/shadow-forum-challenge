import Link from "next/link";
import { TabNav } from "@/components/TabNav";
import { SignOutButton } from "@/components/SignOutButton";

/** Signed-in frame: sidebar on desktop, bottom tabs on phone widths. */
export function AppShell({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="side-brand">THE SHADOW</Link>
        <TabNav variant="side" />
        <div className="side-foot">
          {isAdmin && <Link href="/me/members">Members and access</Link>}
          <SignOutButton className="side-signout" />
        </div>
      </aside>
      <div className="shell-main">{children}</div>
      <TabNav variant="bottom" />
    </div>
  );
}
