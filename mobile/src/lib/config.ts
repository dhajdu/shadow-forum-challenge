// Build-time config. EXPO_PUBLIC_* vars are inlined by Metro from mobile/.env.local (dev)
// or from the EAS environment (cloud builds). Only public values: the anon key is safe,
// the service-role key must never be here.
import * as Application from "expo-application";
import Constants from "expo-constants";

export const config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
  apiBaseUrl: (process.env.EXPO_PUBLIC_API_BASE_URL || "https://eoshadowforum.com").replace(/\/$/, ""),
  /** Fixture persona for demos and screenshots: "founding" | "nam" | "minhanh". Empty = live. */
  demoPersona: process.env.EXPO_PUBLIC_DEMO_PERSONA ?? "",
  easProjectId: (Constants.expoConfig?.extra?.eas?.projectId as string | undefined) ?? undefined,
  appVersion: Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "0",
  /** The native build number (EAS increments it remotely). 0 in Expo Go and on web: never gated. */
  buildNumber: Constants.executionEnvironment === "storeClient" ? 0 : Number(Application.nativeBuildVersion ?? 0) || 0,
};

export const isConfigured = () => config.supabaseUrl !== "" && config.supabaseAnonKey !== "";
