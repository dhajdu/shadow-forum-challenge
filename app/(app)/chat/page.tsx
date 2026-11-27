import { getForumContext } from "@/app/_data/context";
import { listChat, listPeople } from "@/app/_data/chat";
import { ForumChat } from "./ForumChat";
import { PageBanner } from "@/components/PageBanner";

export default async function ChatPage() {
  const { db, user, viewer } = await getForumContext();
  const [messages, people] = await Promise.all([listChat(db), listPeople(db)]);
  return (
    <>
      <PageBanner src="/banners/chat.webp" position="50% 40%">
        <h1>Chat</h1>
      </PageBanner>
      <main className="page">
        <ForumChat initial={messages} people={people} me={user.id} isAdmin={viewer.is_admin} />
      </main>
    </>
  );
}
