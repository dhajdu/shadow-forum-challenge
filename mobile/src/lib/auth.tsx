import type { Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { signUp as apiSignUp } from "./api";
import { config } from "./config";
import { registerForPush, revokePush } from "./push";
import { supabase } from "./supabase";

type Auth = {
  session: Session | null;
  ready: boolean;
  /** Fixture persona: screens render on typed fixtures, nothing is sent to Supabase. */
  demo: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (b: { code: string; name: string; email: string; password: string }) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Auth | null>(null);
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
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
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (!error) registerForPush(false).catch(() => {});
    return error ? error.message : null;
  }

  const value: Auth = {
    session,
    ready,
    demo,
    signIn,
    async signUp(b) {
      try {
        await apiSignUp({ ...b, email: b.email.trim(), name: b.name.trim(), code: b.code.trim() });
      } catch (e) {
        return msg(e);
      }
      return signIn(b.email, b.password);
    },
    async signOut() {
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
