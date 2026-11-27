import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { Consent } from "./Consent";

export const dynamic = "force-dynamic";

// MCP sign-in: Supabase's OAuth server sends the member here with ?authorization_id=.
// The member must be signed in; the client then shows who is asking and for what.
export default async function ConsentPage({ searchParams }: { searchParams: Promise<{ authorization_id?: string }> }) {
  const { authorization_id: id } = await searchParams;
  const user = await getSessionUser(await createClient());
  if (!user) {
    const back = `/oauth/consent${id ? `?authorization_id=${encodeURIComponent(id)}` : ""}`;
    redirect(`/?mode=signin&next=${encodeURIComponent(back)}`);
  }
  return (
    <main className="wrap">
      <div className="hero" />
      <div className="scrim" />
      <section className="panel">
        <div className="eyebrow">Connect an AI assistant</div>
        {id ? <Consent authorizationId={id} /> : <p className="msg err">This sign-in link is missing its request. Start again from your assistant.</p>}
      </section>
    </main>
  );
}
