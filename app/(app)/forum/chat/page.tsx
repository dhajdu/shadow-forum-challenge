import { redirect } from "next/navigation";

// Chat is its own section now.
export default function OldChat() {
  redirect("/chat");
}
