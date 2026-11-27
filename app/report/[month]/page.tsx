import { redirect } from "next/navigation";

// Legacy route (still linked from the Chronicler email): reports now live under the Contest tab.
export default async function Report({ params }: { params: Promise<{ month: string }> }) {
  const { month } = await params;
  redirect(`/contest/report/${month}`);
}
