import { getForumContext } from "@/app/_data/context";
import { listChat, listPeople } from "@/app/_data/chat";
import { ForumChat } from "./ForumChat";

export default async function ChatPage() {
  const { db, user, viewer } = await getForumContext();
  const [messages, people] = await Promise.all([listChat(db), listPeople(db)]);
  return <ForumChat initial={messages} people={people} me={user.id} isAdmin={viewer.is_admin} />;
}
