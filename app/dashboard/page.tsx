"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Dashboard() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.replace("/");
        return;
      }
      setEmail(data.user.email ?? null);
      setChecked(true);
    });
  }, [router]);

  async function signOut() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (!checked) return <main className="wrap"><div className="hero" /></main>;

  return (
    <main className="wrap">
      <div className="hero" />
      <div className="scrim" />
      <section className="panel">
        <div className="eyebrow">Inside</div>
        <h1 className="title">Welcome</h1>
        <p className="tagline">{email}</p>
        <button className="btn" onClick={signOut}>Sign out</button>
      </section>
    </main>
  );
}
