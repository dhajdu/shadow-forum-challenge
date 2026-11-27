import { redirect } from "next/navigation";

// Legacy route: rider pages now live under the Contest tab.
export default async function Rider({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/contest/rider/${encodeURIComponent(id)}`);
}
