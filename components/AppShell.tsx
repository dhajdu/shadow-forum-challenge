import Link from "next/link";
import { TabNav } from "@/components/TabNav";

/** Signed-in frame: sidebar on desktop, bottom tabs on phone widths. */
export function AppShell({ isAdmin, children }: { isAdmin: boolean; children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href="/" className="side-brand">THE SHADOW</Link>
        <TabNav variant="side" />
        {isAdmin && (
          <div className="side-foot">
            <Link href="/me/members">Members and access</Link>
          </div>
        )}
      </aside>
      <div className="shell-main">{children}</div>
      <TabNav variant="bottom" />
    </div>
  );
}
