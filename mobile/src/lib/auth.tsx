import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { config } from "./config";
import { registerForPush, revokePush } from "./push";
import { supabase } from "./supabase";

type Auth = {
  session: Session | null;
  ready: boolean;
  /** Fixture persona: screens render on typed fixtures, nothing is sent to Supabase. */
  demo: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  /** Signs out; `notice` is shown once on the sign-in screen (for example when access has ended). */
  signOut: (notice?: string) => Promise<void>;
  notice: string | null;
};

const Ctx = createContext<Auth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const demo = config.demoPersona !== "";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
      // Re-register quietly on launch if notifications were already allowed (token can rotate).
      if (data.session) registerForPush(false).catch(() => {});
    });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    setNotice(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) registerForPush(false).catch(() => {});
    return error ? error.message : null;
  }

  const value: Auth = {
    session,
    ready,
    demo,
    signIn,
    notice,
    async signOut(n) {
      setNotice(n ?? null);
      await revokePush(); // needs the session, so before signOut
      await supabase.auth.signOut();
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): Auth {
  const a = useContext(Ctx);
  if (!a) throw new Error("useAuth outside AuthProvider");
  return a;
}
