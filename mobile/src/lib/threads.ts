import type { ForumMessage } from "@/data";

/**
 * Splits the chat into top-level messages and the threads under them, matching the website:
 * a reply belongs to the thread of the top-level message its reply chain starts from.
 * A reply whose chain starts before the loaded window is left out.
 */
export function threads(messages: ForumMessage[]) {
  const byId = new Map(messages.map((m) => [m.id, m]));
  const rootOf = (m: ForumMessage): string | null => {
    let cur = m;
    for (let hops = 0; cur.reply_to && hops < 50; hops++) {
      const parent = byId.get(cur.reply_to);
      if (!parent) return null;
      cur = parent;
    }
    return cur.reply_to ? null : cur.id;
  };
  const top: ForumMessage[] = [];
  const replies = new Map<string, ForumMessage[]>();
  for (const m of messages) {
    if (!m.reply_to) top.push(m);
    else {
      const root = rootOf(m);
      if (root) replies.set(root, [...(replies.get(root) ?? []), m]);
    }
  }
  return { top, replies };
}

export const replyCount = (n: number) => `${n} ${n === 1 ? "reply" : "replies"}`;
