"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ className = "btn" }: { className?: string }) {
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    try {
      sessionStorage.clear(); // drop the saved assistant chat
    } catch {}
    router.replace("/");
    router.refresh();
  }

  return (
    <button className={className} onClick={signOut}>
      Sign out
    </button>
  );
}
