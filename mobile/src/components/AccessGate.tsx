// Members set up on the website before they install the app, so access is normally in place.
// If it isn't (no first-forum date) or it has ended, the database returns nothing anyway;
// the app signs out with one plain line instead of showing empty tabs.
import { useEffect, type ReactNode } from "react";
import { today } from "@shared/contest";
import * as data from "@/data";
import { useAuth } from "@/lib/auth";
import { useLoad } from "@/lib/useLoad";

export function AccessGate({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const { data: p } = useLoad(() => data.myProfile());
  const left = !!p && p.forum_left_on != null && p.forum_left_on <= today();
  const noDate = !!p && !p.is_founding && p.forum_joined_on == null;
  useEffect(() => {
    if (left) signOut("You are no longer in the forum.");
    else if (noDate) signOut("Your access is still being set up. Sign in again once Dave has set your first forum.");
  }, [left, noDate, signOut]);
  return left || noDate ? null : <>{children}</>;
}
