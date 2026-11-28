import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import { ChatRoom } from "@/components/ChatRoom";
import { Head } from "@/components/Head";
import { Banner, Empty, Loading, Screen } from "@/components/ui";
import * as data from "@/data";
import { refreshUnread } from "@/lib/unread";
import { threads } from "@/lib/threads";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

// /forum/thread/<first message id> — a chat thread: the message, a reply count, the replies and a
// composer that posts { body, reply_to: <first message id> }.
export default function Thread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: d, error, loading, reload } = useLoad(async () => {
    const [me, messages] = await Promise.all([data.myProfile(), data.chatMessages()]);
    return { me, messages };
  });

  useEffect(() => data.onChatChange(reload), [reload]);

  const markRead = useCallback(() => {
    data.markChatRead().then(refreshUnread, () => {});
  }, []);
  useFocusEffect(markRead);
  useEffect(() => {
    if (d) markRead();
  }, [d, markRead]);

  const thread = useMemo(() => {
    if (!d) return null;
    const { top, replies } = threads(d.messages);
    const first = top.find((m) => m.id === id);
    return first ? [first, ...(replies.get(first.id) ?? [])] : null;
  }, [d, id]);

  return (
    <Screen scroll={false}>
      <Head title="Thread" back="Chat" />
      {loading && !d ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {/* Not found and not allowed look the same. */}
      {d && !thread ? <Empty>This thread isn&apos;t available.</Empty> : null}
      {d && thread ? <ChatRoom me={d.me} messages={thread} thread={id} reload={reload} placeholder="Reply in thread…" /> : null}
    </Screen>
  );
}
