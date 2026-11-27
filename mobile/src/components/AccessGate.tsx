// A member with no first-forum date (new sign-ups, invites not yet dated) or who has left sees
// nothing: the database returns no rows and the API answers 403. Say so plainly instead of
// showing five empty tabs. This is presentation only; the rule itself is in the database.
import type { ReactNode } from "react";
import { View } from "react-native";
import { today } from "@shared/contest";
import { Body, Button, Eyebrow, Header } from "@/components/ui";
import * as data from "@/data";
import { useAuth } from "@/lib/auth";
import { useLoad } from "@/lib/useLoad";
import { color, space } from "@/theme/tokens";

export function AccessGate({ children }: { children: ReactNode }) {
  const { signOut } = useAuth();
  const { data: p, reload } = useLoad(() => data.myProfile());
  if (!p) return <>{children}</>; // loading or error: the tabs show their own state
  const left = p.forum_left_on != null && p.forum_left_on <= today();
  const noDate = !p.is_founding && p.forum_joined_on == null;
  if (!left && !noDate) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: color.bg, padding: space.page, justifyContent: "center", gap: 16 }}>
      <Eyebrow>THE SHADOW FORUM</Eyebrow>
      <Header title={left ? "Access ended" : "Almost there"} />
      <Body muted>
        {left
          ? "Your forum membership has ended, so the forum isn't available on this account."
          : `Welcome, ${p.full_name}. Your access starts once the moderator sets your first forum date. You'll see the forum from that date on.`}
      </Body>
      {!left ? <Button ghost label="Check again" onPress={reload} /> : null}
      <Button ghost label="Sign out" onPress={signOut} />
    </View>
  );
}
