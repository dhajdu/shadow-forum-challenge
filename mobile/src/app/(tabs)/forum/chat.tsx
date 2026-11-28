import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { ChatRoom } from "@/components/ChatRoom";
import { SampleNote } from "@/components/SampleNote";
import { FORUM_NAV, SubNav } from "@/components/SubNav";
import { Banner, Header, Loading, Screen } from "@/components/ui";
import * as data from "@/data";
import { refreshUnread } from "@/lib/unread";
import { threads } from "@/lib/threads";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

// /forum/chat — one group chat for the whole forum, with threads like the website: a reply sits in
// the thread under the message it answers (/forum/thread/<id>), not in this list. The database
// shows messages from the member's first forum on; the app never filters.
export default function Chat() {
  const { data: d, error, loading, reload } = useLoad(async () => {
    const [me, messages] = await Promise.all([data.myProfile(), data.chatMessages()]);
    return { me, messages };
  });

  useEffect(() => data.onChatChange(reload), [reload]);

  // Coming back from a thread: refresh, so its reply count is current.
  const seen = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (seen.current) reload();
      seen.current = true;
    }, [reload]),
  );

  // Opening the chat (and every refresh while it is open) marks it read.
  const markRead = useCallback(() => {
    data.markChatRead().then(refreshUnread, () => {});
  }, []);
  useFocusEffect(markRead);
  useEffect(() => {
    if (d) markRead();
  }, [d, markRead]);

  const { top, replies } = useMemo(() => threads(d?.messages ?? []), [d]);

  return (
    <Screen scroll={false}>
      <Header title="Forum" />
      <SubNav items={FORUM_NAV} />
      <SampleNote />
      {loading && !d ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {d ? (
        <ChatRoom
          me={d.me}
          messages={top}
          replies={replies}
          onOpenThread={(id) => router.push(`/forum/thread/${id}`)}
          reload={reload}
          placeholder="Message the forum…"
          empty="No messages yet. Say hello to the forum."
        />
      ) : null}
    </Screen>
  );
}
